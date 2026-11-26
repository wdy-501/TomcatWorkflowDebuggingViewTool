package io.traceboard.launcher;

import java.io.IOException;
import java.util.List;
import java.util.Locale;

/** Best-effort system browser launcher; never blocks and never affects the app. */
final class Browser {

    private Browser() {
    }

    /** Returns true when a browser command was started; failures are advisory only. */
    static boolean open(String url) {
        String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
        List<String> command;
        if (os.contains("win")) {
            // rundll32 avoids cmd.exe quoting problems with non-ASCII paths.
            command = List.of("rundll32", "url.dll,FileProtocolHandler", url);
        } else if (os.contains("mac")) {
            command = List.of("open", url);
        } else {
            command = List.of("xdg-open", url);
        }
        try {
            new ProcessBuilder(command)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();
            return true;
        } catch (IOException e) {
            return false;
        }
    }
}