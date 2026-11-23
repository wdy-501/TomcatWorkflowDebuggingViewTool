package io.traceboard.agent;

import java.lang.instrument.ClassFileTransformer;
import java.security.ProtectionDomain;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.FieldInsnNode;
import org.objectweb.asm.tree.IincInsnNode;
import org.objectweb.asm.tree.InsnList;
import org.objectweb.asm.tree.InsnNode;
import org.objectweb.asm.tree.IntInsnNode;
import org.objectweb.asm.tree.JumpInsnNode;
import org.objectweb.asm.tree.LabelNode;
import org.objectweb.asm.tree.LdcInsnNode;
import org.objectweb.asm.tree.LineNumberNode;
import org.objectweb.asm.tree.LocalVariableNode;
import org.objectweb.asm.tree.LookupSwitchInsnNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.MultiANewArrayInsnNode;
import org.objectweb.asm.tree.TableSwitchInsnNode;
import org.objectweb.asm.tree.TryCatchBlockNode;
import org.objectweb.asm.tree.TypeInsnNode;
import org.objectweb.asm.tree.VarInsnNode;

/**
 * S6a L2 transformer: the ONE class the Byte Buddy advices never touch
 * ({@code com.example.shop.service.L2DemoService}, explicitly ignored in {@link TraceAgent}).
 *
 * <p>It instruments exactly one method, {@code reconcileAmount(long,double,int)}, and only when
 * the class file carries debug information with a {@code local:D} local variable table entry. The
 * probes are inserted at source-line boundaries inside the inclusive live range of that entry
 * ({@code lvtStart <= offset < lvtStart + lvtLength}); init probe offset == LVT start. Every line
 * that ends with a jump/return/throw/switch gets no probe (unreachable or duplicate values are
 * handled by the frame-local previous-value de-duplication in {@link SpanContext#recordLocal}).
 *
 * <p>Fail-open by construction: any mismatch (class/method/descriptor/local table/return shape)
 * or any {@code Throwable} returns the ORIGINAL bytes and only bumps a counter - no event, no
 * guessed value, never a half-instrumented class.</p>
 */
final class L2ClassFileTransformer implements ClassFileTransformer {

    static final String TARGET_CLASS = "com.example.shop.service.L2DemoService";
    static final String TARGET_METHOD = "reconcileAmount";
    static final String TARGET_DESCRIPTOR = "(JDI)D";

    private static final String LOCAL_OWNER = "io/traceboard/agent/SpanContext";
    private static final String RECORD_DESC = "(ILjava/lang/String;Ljava/lang/Object;)V";
    private static final String ENTER_DESC = "(J)V";
    private static final String EXIT_DESC = "(JD)V";
    private static final String THREW_DESC = "(J)V";
    private static final String BOX_OWNER = "java/lang/Double";
    private static final String BOX_DESC = "(D)Ljava/lang/Double;";
    private static final String SYSTEM_OWNER = "java/lang/System";
    private static final String NANO_DESC = "()J";
    private static final String THROWABLE_CLASS = "java/lang/Throwable";

    private static final AtomicLong ERRORS = new AtomicLong();
    private static final AtomicLong NO_METHOD = new AtomicLong();
    private static final AtomicLong NO_LVT = new AtomicLong();
    private static final AtomicLong PROBE_MISSING = new AtomicLong();

    @Override
    public byte[] transform(ClassLoader loader, String className, Class<?> classBeingRedefined,
                            ProtectionDomain protectionDomain, byte[] classfileBuffer) {
        try {
            if (classfileBuffer == null || className == null) {
                return null;
            }
            if (!TARGET_CLASS.equals(className.replace('/', '.'))) {
                return null;
            }
            if (classBeingRedefined != null) {
                return null;
            }
            return instrument(classfileBuffer);
        } catch (Throwable failure) {
            long n = ERRORS.incrementAndGet();
            if (n == 1L || n % 100L == 0L) {
                TraceAgent.log("l2_transform_error=" + n + " cause=" + failure.getClass().getName());
            }
            return null;
        }
    }

    private byte[] instrument(byte[] original) {
        // No SKIP_DEBUG: the local variable table is the only source of truth here.
        ClassNode node = new ClassNode();
        new ClassReader(original).accept(node, 0);
        MethodNode method = findTargetMethod(node);
        if (method == null) {
            count(NO_METHOD, "l2_no_method");
            return null;
        }
        if (method.localVariables == null || method.localVariables.isEmpty()) {
            count(NO_LVT, "l2_no_lvt");
            return null;
        }
        LocalVariableNode local = findLocalVariable(method);
        if (local == null || local.start == null || local.end == null) {
            count(NO_LVT, "l2_no_lvt");
            return null;
        }
        Map<LabelNode, Integer> labelOffsets = labelOffsets(method);
        if (labelOffsets == null) {
            count(NO_METHOD, "l2_no_method");
            return null;
        }
        Integer startOffset = labelOffsets.get(local.start);
        Integer endOffset = labelOffsets.get(local.end);
        if (startOffset == null || endOffset == null || endOffset.intValue() <= startOffset.intValue()) {
            count(NO_LVT, "l2_no_lvt");
            return null;
        }
        int lvtStart = startOffset.intValue();
        int lvtLength = endOffset.intValue() - lvtStart;

        AbstractInsnNode singleReturn = findSingleDoubleReturn(method);
        if (singleReturn == null) {
            count(NO_METHOD, "l2_no_method");
            return null;
        }

        List<Boundary> boundaries = boundaries(method, lvtStart, lvtLength);
        if (boundaries == null) {
            count(NO_METHOD, "l2_no_method");
            return null;
        }
        if (boundaries.size() != 2) {
            long n = PROBE_MISSING.incrementAndGet();
            TraceAgent.log("l2_probe_missing method=" + TARGET_METHOD + " candidates="
                    + boundaries.size() + " counter=" + n);
            return null;
        }

        int enterSlot = method.maxLocals;
        int returnSlot = method.maxLocals + 2;
        method.maxLocals = method.maxLocals + 4;

        // enter: enterNs = System.nanoTime(); SpanContext.enterL2(enterNs)
        // The protected range starts AFTER the enterNs store so the catch-all handler (whose frame
        // carries the protected range's local state) can read that slot without a verify error.
        LabelNode tryStart = new LabelNode();
        LabelNode tryEnd = new LabelNode();
        LabelNode handler = new LabelNode();
        InsnList enter = new InsnList();
        enter.add(new MethodInsnNode(Opcodes.INVOKESTATIC, SYSTEM_OWNER, "nanoTime", NANO_DESC, false));
        enter.add(new VarInsnNode(Opcodes.LSTORE, enterSlot));
        enter.add(tryStart);
        enter.add(new VarInsnNode(Opcodes.LLOAD, enterSlot));
        enter.add(new MethodInsnNode(Opcodes.INVOKESTATIC, LOCAL_OWNER, "enterL2", ENTER_DESC, false));
        method.instructions.insert(enter);

        // probes: LDC line; LDC "local"; DLOAD slot; Double.valueOf; recordLocal(int,String,Object)
        for (Boundary boundary : boundaries) {
            InsnList probe = new InsnList();
            probe.add(new LdcInsnNode(Integer.valueOf(boundary.line)));
            probe.add(new LdcInsnNode(L2Values.NAME_LOCAL));
            probe.add(new VarInsnNode(Opcodes.DLOAD, local.index));
            probe.add(new MethodInsnNode(Opcodes.INVOKESTATIC, BOX_OWNER, "valueOf", BOX_DESC, false));
            probe.add(new MethodInsnNode(Opcodes.INVOKESTATIC, LOCAL_OWNER, "recordLocal", RECORD_DESC, false));
            method.instructions.insertBefore(boundary.at, probe);
        }

        // exit: store the result, emit, reload the result and return unchanged
        InsnList exit = new InsnList();
        exit.add(new VarInsnNode(Opcodes.DSTORE, returnSlot));
        exit.add(new VarInsnNode(Opcodes.LLOAD, enterSlot));
        exit.add(new VarInsnNode(Opcodes.DLOAD, returnSlot));
        exit.add(new MethodInsnNode(Opcodes.INVOKESTATIC, LOCAL_OWNER, "exitL2", EXIT_DESC, false));
        exit.add(new VarInsnNode(Opcodes.DLOAD, returnSlot));
        method.instructions.insertBefore(singleReturn, exit);

        // catch-all: SpanContext.exitL2Threw(enterNs); athrow (THREW path, never a fake return)
        InsnList tail = new InsnList();
        tail.add(tryEnd);
        tail.add(handler);
        tail.add(new VarInsnNode(Opcodes.LLOAD, enterSlot));
        tail.add(new MethodInsnNode(Opcodes.INVOKESTATIC, LOCAL_OWNER, "exitL2Threw", THREW_DESC, false));
        tail.add(new InsnNode(Opcodes.ATHROW));
        method.instructions.add(tail);
        if (method.tryCatchBlocks == null) {
            method.tryCatchBlocks = new ArrayList<TryCatchBlockNode>();
        }
        method.tryCatchBlocks.add(0, new TryCatchBlockNode(tryStart, tryEnd, handler, THROWABLE_CLASS));

        ClassWriter writer = new FrameComputingClassWriter();
        node.accept(writer);
        byte[] instrumented = writer.toByteArray();

        TraceAgent.log("l2_probes_installed method=" + TARGET_METHOD
                + " offsets=" + boundaries.get(0).offset + "," + boundaries.get(1).offset
                + " lines=" + boundaries.get(0).line + "," + boundaries.get(1).line);
        return instrumented;
    }

    private static MethodNode findTargetMethod(ClassNode node) {
        for (MethodNode candidate : node.methods) {
            if (TARGET_METHOD.equals(candidate.name) && TARGET_DESCRIPTOR.equals(candidate.desc)) {
                return candidate;
            }
        }
        return null;
    }

    private static LocalVariableNode findLocalVariable(MethodNode method) {
        for (LocalVariableNode candidate : method.localVariables) {
            if (L2Values.NAME_LOCAL.equals(candidate.name) && "D".equals(candidate.desc)) {
                return candidate;
            }
        }
        return null;
    }

    /**
     * @return the single {@code DRETURN} instruction, or {@code null} when the method returns in any
     *         other way (signature drift) - the whole class is then left untouched
     */
    private static AbstractInsnNode findSingleDoubleReturn(MethodNode method) {
        AbstractInsnNode found = null;
        int returns = 0;
        for (AbstractInsnNode insn = method.instructions.getFirst(); insn != null; insn = insn.getNext()) {
            int opcode = insn.getOpcode();
            if (opcode >= Opcodes.IRETURN && opcode <= Opcodes.RETURN) {
                returns++;
                if (opcode != Opcodes.DRETURN) {
                    return null;
                }
                found = insn;
            }
        }
        return returns == 1 ? found : null;
    }

    private static Map<LabelNode, Integer> labelOffsets(MethodNode method) {
        Map<LabelNode, Integer> offsets = new IdentityHashMap<LabelNode, Integer>();
        int offset = 0;
        for (AbstractInsnNode insn = method.instructions.getFirst(); insn != null; insn = insn.getNext()) {
            if (insn instanceof LabelNode) {
                offsets.put((LabelNode) insn, Integer.valueOf(offset));
            }
            int size = insnSize(insn);
            if (size < 0) {
                return null;
            }
            offset += size;
        }
        return offsets;
    }

    /**
     * Source-line boundaries (next real instruction offset + previous line) inside the inclusive
     * live range, skipping any line whose last real instruction ends the block (jump/return/throw/
     * switch). One candidate per offset. {@code null} when the instruction mix is unsupported.
     */
    private static List<Boundary> boundaries(MethodNode method, int lvtStart, int lvtLength) {
        List<Boundary> result = new ArrayList<Boundary>();
        Set<Integer> seen = new HashSet<Integer>();
        int offset = 0;
        int currentLine = -1;
        int previousLine = -1;
        AbstractInsnNode previousReal = null;
        for (AbstractInsnNode insn = method.instructions.getFirst(); insn != null; insn = insn.getNext()) {
            if (insn instanceof LineNumberNode) {
                currentLine = ((LineNumberNode) insn).line;
            } else if (insn.getOpcode() >= 0) {
                if (previousReal != null && previousLine > 0 && currentLine > 0
                        && currentLine != previousLine
                        && !endsBlock(previousReal)
                        && offset >= lvtStart && offset < lvtStart + lvtLength
                        && seen.add(Integer.valueOf(offset))) {
                    result.add(new Boundary(insn, offset, previousLine));
                }
                previousReal = insn;
                previousLine = currentLine;
            }
            int size = insnSize(insn);
            if (size < 0) {
                return null;
            }
            offset += size;
        }
        return result;
    }

    /**
     * Byte size of one instruction (asm-tree does not expose it). Only the shapes javac 8 emits are
     * supported; switches or wide forms return {@code -1} and the whole class stays untouched.
     */
    private static int insnSize(AbstractInsnNode insn) {
        int opcode = insn.getOpcode();
        if (opcode < 0) {
            return 0;
        }
        if (insn instanceof MethodInsnNode) {
            return (opcode == Opcodes.INVOKEINTERFACE || opcode == Opcodes.INVOKEDYNAMIC) ? 5 : 3;
        }
        if (insn instanceof LdcInsnNode) {
            Object constant = ((LdcInsnNode) insn).cst;
            if (constant instanceof Long || constant instanceof Double) {
                return 3;
            }
            if (constant instanceof Integer) {
                int value = ((Integer) constant).intValue();
                return (value >= Byte.MIN_VALUE && value <= Byte.MAX_VALUE) ? 2 : 3;
            }
            if (constant instanceof Float) {
                float value = ((Float) constant).floatValue();
                return (value == 0F || value == 1F || value == 2F) ? 2 : 3;
            }
            return 3;
        }
        if (insn instanceof IntInsnNode) {
            return opcode == Opcodes.SIPUSH ? 3 : 2;
        }
        if (insn instanceof VarInsnNode) {
            int var = ((VarInsnNode) insn).var;
            return (var <= 3) ? 1 : (var > 255 ? 4 : 2);
        }
        if (insn instanceof IincInsnNode) {
            IincInsnNode iinc = (IincInsnNode) insn;
            return (iinc.var > 255 || iinc.incr > 127 || iinc.incr < -128) ? 6 : 3;
        }
        if (insn instanceof TypeInsnNode || insn instanceof FieldInsnNode || insn instanceof JumpInsnNode) {
            return 3;
        }
        if (insn instanceof MultiANewArrayInsnNode) {
            return 4;
        }
        if (insn instanceof TableSwitchInsnNode || insn instanceof LookupSwitchInsnNode) {
            return -1;
        }
        return 1;
    }

    private static boolean endsBlock(AbstractInsnNode insn) {
        int opcode = insn.getOpcode();
        if (opcode < 0) {
            return true;
        }
        boolean returnsOrThrows = (opcode >= Opcodes.IRETURN && opcode <= Opcodes.RETURN) || opcode == Opcodes.ATHROW;
        boolean jumps = (opcode >= Opcodes.IFEQ && opcode <= Opcodes.IF_ACMPNE)
                || opcode == Opcodes.GOTO || opcode == Opcodes.JSR || opcode == Opcodes.RET;
        boolean switches = opcode == Opcodes.TABLESWITCH || opcode == Opcodes.LOOKUPSWITCH;
        return returnsOrThrows || jumps || switches;
    }

    private static void count(AtomicLong counter, String label) {
        long n = counter.incrementAndGet();
        if (n == 1L || n % 100L == 0L) {
            TraceAgent.log(label + "=" + n + " class=" + TARGET_CLASS);
        }
    }

    /** Probe insertion point (before {@code at}) and the source line that ends there. */
    private static final class Boundary {
        final AbstractInsnNode at;
        final int offset;
        final int line;

        Boundary(AbstractInsnNode at, int offset, int line) {
            this.at = at;
            this.offset = offset;
            this.line = line;
        }
    }

    /**
     * Computes stack map frames without loading demo classes through the agent class loader
     * (the instrumented class is defined by the application loader). Our inserted code only
     * touches primitive locals, {@code java/lang/Double} and {@code java/lang/Throwable}, so an
     * object common-supertype fallback is exact for the shapes we create.
     */
    private static final class FrameComputingClassWriter extends ClassWriter {

        FrameComputingClassWriter() {
            super(ClassWriter.COMPUTE_FRAMES | ClassWriter.COMPUTE_MAXS);
        }

        @Override
        protected String getCommonSuperClass(String type1, String type2) {
            return "java/lang/Object";
        }
    }
}