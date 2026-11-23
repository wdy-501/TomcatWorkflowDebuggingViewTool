package io.traceboard.agent;

import java.lang.instrument.Instrumentation;

/**
 * S0 noop java agent.
 *
 * <p>Scope reminder: S0 only proves the agent can be attached. This class must not
 * register a {@code ClassFileTransformer}, must not call {@code inst}, must not scan
 * classes, read configuration or open sockets. Real instrumentation is S1.</p>
 */
public final class TraceAgent {

    private TraceAgent() {
        // utility class, never instantiated
    }

    /**
     * JVM entry point for {@code -javaagent:...}.
     *
     * <p>Prints exactly one line to stderr and never throws (S0 is fail-open by being a noop).</p>
     *
     * @param agentArgs arguments after '=' on the -javaagent option, may be null
     * @param inst      instrumentation handle, intentionally unused in S0
     */
    public static void premain(String agentArgs, Instrumentation inst) {
        String args = (agentArgs == null) ? "" : agentArgs;
        try {
            System.err.println("[traceboard-agent] noop premain; args=" + args);
        } catch (Throwable ignored) {
            // S0 fail-open: a broken log must never affect the host application.
        }
    }
}