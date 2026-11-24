package io.traceboard.agent;

import java.lang.instrument.ClassFileTransformer;
import java.security.ProtectionDomain;
import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicLong;

import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.InsnList;
import org.objectweb.asm.tree.InsnNode;
import org.objectweb.asm.tree.LabelNode;
import org.objectweb.asm.tree.LineNumberNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.TryCatchBlockNode;
import org.objectweb.asm.tree.VarInsnNode;

/**
 * S6b no-debug transformer: exact class {@code com.example.shop.service.NoDebugService}, method
 * {@code compute(D)D}. The class is recompiled by the demo build (Maven antrun
 * {@code javac debug="false"} / {@code -g:none}) so it carries NO {@code LocalVariableTable},
 * NO {@code LineNumberTable} and NO {@code SourceFile}. That absence is the EXPECTED path here:
 * only enter/exit is injected (no line probe, no variable name, no guessed line).
 *
 * <p>The exit emits a service span with {@code status=NOT_COLLECTED_NO_DEBUG_INFO}, the verbatim
 * reason {@code LocalVariableTable missing}, flag {@code NO_DEBUG_INFO}, NO {@code values} key, the
 * real returned double and no fabricated source; the catch-all emits {@code THREW} with no return.
 * If the class still has debug information (build fallback: any local variable entry or line
 * number), it logs {@code nodebug_lvt_present} and returns the ORIGINAL bytes without
 * instrumentation (the gate must FAIL; never treated as a normal L2 span, never a guessed name).</p>
 *
 * <p>Fail-open by construction: any mismatch or {@code Throwable} returns the original bytes.</p>
 */
final class NoDebugClassFileTransformer implements ClassFileTransformer {

    static final String TARGET_CLASS = "com.example.shop.service.NoDebugService";
    static final String TARGET_METHOD = "compute";
    static final String TARGET_DESCRIPTOR = "(D)D";

    private static final String LOCAL_OWNER = "io/traceboard/agent/SpanContext";
    private static final String ENTER_METHOD = "enterNoDebug";
    private static final String EXIT_METHOD = "exitNoDebug";
    private static final String THREW_METHOD = "exitNoDebugThrew";
    private static final String ENTER_DESC = "(J)V";
    private static final String EXIT_DESC = "(JD)V";
    private static final String THREW_DESC = "(J)V";
    private static final String SYSTEM_OWNER = "java/lang/System";
    private static final String NANO_DESC = "()J";
    private static final String THROWABLE_CLASS = "java/lang/Throwable";

    private static final AtomicLong ERRORS = new AtomicLong();
    private static final AtomicLong NO_METHOD = new AtomicLong();
    private static final AtomicLong LVT_PRESENT = new AtomicLong();

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
                TraceAgent.log("nodebug_transform_error=" + n + " cause=" + failure.getClass().getName());
            }
            return null;
        }
    }

    private byte[] instrument(byte[] original) {
        ClassNode node = new ClassNode();
        new ClassReader(original).accept(node, 0);
        MethodNode method = findTargetMethod(node);
        if (method == null) {
            count(NO_METHOD, "nodebug_no_method");
            return null;
        }
        if (hasDebugInfo(method)) {
            // Build fallback: the class was compiled WITH debug information. Never guess names,
            // never instrument: the gate must fail (api.v1.md Appendix G / event-model 4.4.9).
            long n = LVT_PRESENT.incrementAndGet();
            TraceAgent.log("nodebug_lvt_present=" + n + " class=" + TARGET_CLASS
                    + " method=" + TARGET_METHOD);
            return null;
        }
        AbstractInsnNode singleReturn = findSingleDoubleReturn(method);
        if (singleReturn == null) {
            count(NO_METHOD, "nodebug_no_method");
            return null;
        }

        int enterSlot = method.maxLocals;
        int returnSlot = method.maxLocals + 2;
        method.maxLocals = method.maxLocals + 4;

        // enter: enterNs = System.nanoTime(); SpanContext.enterNoDebug(enterNs)
        // The protected range starts AFTER the enterNs store so the catch-all handler frame can
        // read that slot without a verify error.
        LabelNode tryStart = new LabelNode();
        LabelNode tryEnd = new LabelNode();
        LabelNode handler = new LabelNode();
        InsnList enter = new InsnList();
        enter.add(new MethodInsnNode(Opcodes.INVOKESTATIC, SYSTEM_OWNER, "nanoTime", NANO_DESC, false));
        enter.add(new VarInsnNode(Opcodes.LSTORE, enterSlot));
        enter.add(tryStart);
        enter.add(new VarInsnNode(Opcodes.LLOAD, enterSlot));
        enter.add(new MethodInsnNode(Opcodes.INVOKESTATIC, LOCAL_OWNER, ENTER_METHOD, ENTER_DESC, false));
        method.instructions.insert(enter);

        // exit: store the result, emit, reload the result and return unchanged
        InsnList exit = new InsnList();
        exit.add(new VarInsnNode(Opcodes.DSTORE, returnSlot));
        exit.add(new VarInsnNode(Opcodes.LLOAD, enterSlot));
        exit.add(new VarInsnNode(Opcodes.DLOAD, returnSlot));
        exit.add(new MethodInsnNode(Opcodes.INVOKESTATIC, LOCAL_OWNER, EXIT_METHOD, EXIT_DESC, false));
        exit.add(new VarInsnNode(Opcodes.DLOAD, returnSlot));
        method.instructions.insertBefore(singleReturn, exit);

        // catch-all: SpanContext.exitNoDebugThrew(enterNs); athrow (THREW path, no fake return)
        InsnList tail = new InsnList();
        tail.add(tryEnd);
        tail.add(handler);
        tail.add(new VarInsnNode(Opcodes.LLOAD, enterSlot));
        tail.add(new MethodInsnNode(Opcodes.INVOKESTATIC, LOCAL_OWNER, THREW_METHOD, THREW_DESC, false));
        tail.add(new InsnNode(Opcodes.ATHROW));
        method.instructions.add(tail);
        if (method.tryCatchBlocks == null) {
            method.tryCatchBlocks = new ArrayList<TryCatchBlockNode>();
        }
        method.tryCatchBlocks.add(0, new TryCatchBlockNode(tryStart, tryEnd, handler, THROWABLE_CLASS));

        ClassWriter writer = new FrameComputingClassWriter();
        node.accept(writer);
        byte[] instrumented = writer.toByteArray();
        TraceAgent.log("nodebug_probes_installed method=" + TARGET_METHOD
                + " class=" + TARGET_CLASS + " values=false lines=false");
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

    /** Build fallback detection: any local variable entry or any line number means debug info. */
    private static boolean hasDebugInfo(MethodNode method) {
        if (method.localVariables != null && !method.localVariables.isEmpty()) {
            return true;
        }
        for (AbstractInsnNode insn = method.instructions.getFirst(); insn != null; insn = insn.getNext()) {
            if (insn instanceof LineNumberNode) {
                return true;
            }
        }
        return false;
    }

    /**
     * @return the single {@code DRETURN} instruction, or {@code null} when the method returns in
     *         any other way (signature drift) - the class is then left untouched
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

    private static void count(AtomicLong counter, String label) {
        long n = counter.incrementAndGet();
        if (n == 1L || n % 100L == 0L) {
            TraceAgent.log(label + "=" + n + " class=" + TARGET_CLASS);
        }
    }

    /**
     * Computes stack map frames without loading demo classes through the agent class loader. The
     * inserted code only touches primitive locals and {@code java/lang/Throwable}, so the object
     * common-supertype fallback is exact for the shapes created here.
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