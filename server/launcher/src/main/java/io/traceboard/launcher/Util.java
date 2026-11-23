package io.traceboard.launcher;

import java.io.IOException;
import java.io.PrintStream;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Small JDK-only helpers: paths, JSON scanning, log tailing, OS specifics. */
final class Util {

    private static final long MAX_TAIL_BYTES = 256 * 1024;

    private Util() {
    }

    static boolean isWindows() {
        return System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win");
    }

    static Path abs(String raw) {
        return Paths.get(raw).toAbsolutePath().normalize();
    }

    /** Forward-slash form, used inside the PID JSON (no backslash escaping needed). */
    static String fwd(Path path) {
        return path.toString().replace('\\', '/');
    }

    static String normalize(String value) {
        return value == null ? "" : value.replace('\\', '/');
    }

    static String oneLine(String value, int max) {
        if (value == null) {
            return "";
        }
        String flat = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return flat.length() <= max ? flat : flat.substring(0, max) + "...";
    }

    /** Case-insensitive lastIndexOf without lowercasing the text (keeps indices aligned). */
    static int lastIndexOfIgnoreCase(String text, String needle) {
        if (text == null || needle == null || needle.isEmpty() || text.length() < needle.length()) {
            return -1;
        }
        for (int i = text.length() - needle.length(); i >= 0; i--) {
            if (regionMatchesIgnoreCase(text, i, needle)) {
                return i;
            }
        }
        return -1;
    }

    /** Case-insensitive indexOf without lowercasing the text (keeps indices aligned). */
    static int indexOfIgnoreCase(String text, String needle) {
        if (text == null || needle == null || needle.isEmpty()) {
            return -1;
        }
        for (int i = 0; i + needle.length() <= text.length(); i++) {
            if (regionMatchesIgnoreCase(text, i, needle)) {
                return i;
            }
        }
        return -1;
    }

    private static boolean regionMatchesIgnoreCase(String text, int offset, String needle) {
        for (int j = 0; j < needle.length(); j++) {
            if (Character.toLowerCase(text.charAt(offset + j)) != Character.toLowerCase(needle.charAt(j))) {
                return false;
            }
        }
        return true;
    }

    static String snippet(byte[] body, int max) {
        return oneLine(body == null ? "" : new String(body, StandardCharsets.UTF_8), max);
    }

    static List<String> tailLines(Path file, int count) {
        List<String> lines = new ArrayList<>();
        if (file == null || !Files.isRegularFile(file)) {
            return lines;
        }
        try {
            long size = Files.size(file);
            long from = Math.max(0, size - MAX_TAIL_BYTES);
            byte[] data;
            try (RandomAccessFile raf = new RandomAccessFile(file.toFile(), "r")) {
                raf.seek(from);
                data = new byte[(int) (size - from)];
                raf.readFully(data);
            }
            String[] split = new String(data, StandardCharsets.UTF_8).split("\\R");
            for (String line : split) {
                if (!line.isBlank()) {
                    lines.add(line);
                }
            }
            if (from > 0 && !lines.isEmpty()) {
                lines.set(0, "...(日志前部已截断) " + lines.get(0));
            }
        } catch (IOException ignored) {
            // best-effort diagnostics only
        }
        if (lines.size() > count) {
            return lines.subList(lines.size() - count, lines.size());
        }
        return lines;
    }

    static void printTail(PrintStream sink, List<String> lines) {
        if (lines.isEmpty()) {
            sink.println("  (日志为空或日志文件尚未生成)");
            return;
        }
        for (String line : lines) {
            sink.println("  | " + line);
        }
    }

    /** Follows a growing log file and echoes appended bytes; used in attached (non-detach) mode. */
    static final class Tail {
        private final Path path;
        private final PrintStream sink;
        private final Thread thread;
        private volatile boolean stopped;
        private long position;

        Tail(Path path, PrintStream sink) {
            this.path = path;
            this.sink = sink;
            this.thread = new Thread(this::loop, "traceboard-launcher-tail");
            this.thread.setDaemon(true);
        }

        void start() {
            thread.start();
        }

        private void loop() {
            while (!stopped) {
                pump();
                try {
                    Thread.sleep(80);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
            pump();
        }

        private void pump() {
            try {
                if (!Files.isRegularFile(path)) {
                    return;
                }
                long size = Files.size(path);
                if (size <= position) {
                    return;
                }
                int chunk = (int) Math.min(size - position, 64 * 1024);
                try (RandomAccessFile raf = new RandomAccessFile(path.toFile(), "r")) {
                    raf.seek(position);
                    byte[] buffer = new byte[chunk];
                    int read = raf.read(buffer);
                    if (read > 0) {
                        sink.write(buffer, 0, read);
                        sink.flush();
                        position += read;
                    }
                }
            } catch (IOException ignored) {
                // file may be rotating; keep following
            }
        }

        void stop() {
            stopped = true;
            try {
                thread.join(3000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    /** Minimal JSON scanning; S4 responses are small, stable and machine-generated. */
    static final class Json {

        private Json() {
        }

        static String slice(String json, String key) {
            if (json == null) {
                return null;
            }
            String needle = "\"" + key + "\"";
            int keyIndex = json.indexOf(needle);
            if (keyIndex < 0) {
                return null;
            }
            int colon = json.indexOf(':', keyIndex + needle.length());
            if (colon < 0) {
                return null;
            }
            int i = colon + 1;
            while (i < json.length() && Character.isWhitespace(json.charAt(i))) {
                i++;
            }
            if (i >= json.length()) {
                return null;
            }
            char first = json.charAt(i);
            if (first == '{' || first == '[') {
                int end = match(json, i);
                return end < 0 ? null : json.substring(i, end + 1);
            }
            if (first == '"') {
                int end = i + 1;
                boolean escaped = false;
                while (end < json.length()) {
                    char c = json.charAt(end);
                    if (escaped) {
                        escaped = false;
                    } else if (c == '\\') {
                        escaped = true;
                    } else if (c == '"') {
                        return json.substring(i, end + 1);
                    }
                    end++;
                }
                return null;
            }
            int end = i;
            while (end < json.length() && ",}] \n\r\t".indexOf(json.charAt(end)) < 0) {
                end++;
            }
            return json.substring(i, end);
        }

        static String str(String json, String key) {
            String raw = slice(json, key);
            if (raw == null) {
                return null;
            }
            if (raw.length() >= 2 && raw.charAt(0) == '"' && raw.charAt(raw.length() - 1) == '"') {
                String body = raw.substring(1, raw.length() - 1);
                return body.replace("\\\"", "\"").replace("\\\\", "\\");
            }
            return raw;
        }

        static Long num(String json, String key) {
            String raw = slice(json, key);
            if (raw == null) {
                return null;
            }
            try {
                return Long.parseLong(raw.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }

        static boolean hasTrue(String json, String key) {
            String raw = slice(json, key);
            return raw != null && raw.trim().equalsIgnoreCase("true");
        }

        static String object(String json, String key) {
            String raw = slice(json, key);
            if (raw == null || raw.isEmpty() || raw.charAt(0) != '{') {
                return null;
            }
            return raw;
        }

        static String array(String json, String key) {
            String raw = slice(json, key);
            if (raw == null || raw.isEmpty() || raw.charAt(0) != '[') {
                return null;
            }
            return raw;
        }

        static Set<String> objectKeys(String objectJson) {
            Set<String> keys = new LinkedHashSet<>();
            if (objectJson == null) {
                return keys;
            }
            boolean inString = false;
            boolean escaped = false;
            int keyStart = -1;
            int depth = 0;
            for (int i = 0; i < objectJson.length(); i++) {
                char c = objectJson.charAt(i);
                if (inString) {
                    if (escaped) {
                        escaped = false;
                    } else if (c == '\\') {
                        escaped = true;
                    } else if (c == '"') {
                        inString = false;
                        if (depth == 1 && keyStart >= 0) {
                            int j = i + 1;
                            while (j < objectJson.length() && Character.isWhitespace(objectJson.charAt(j))) {
                                j++;
                            }
                            if (j < objectJson.length() && objectJson.charAt(j) == ':') {
                                keys.add(objectJson.substring(keyStart + 1, i));
                            }
                        }
                        keyStart = -1;
                    }
                } else if (c == '"') {
                    inString = true;
                    if (depth == 1) {
                        keyStart = i;
                    }
                } else if (c == '{' || c == '[') {
                    depth++;
                } else if (c == '}' || c == ']') {
                    depth--;
                }
            }
            return keys;
        }

        private static int match(String s, int start) {
            int depth = 0;
            boolean inString = false;
            boolean escaped = false;
            for (int i = start; i < s.length(); i++) {
                char c = s.charAt(i);
                if (inString) {
                    if (escaped) {
                        escaped = false;
                    } else if (c == '\\') {
                        escaped = true;
                    } else if (c == '"') {
                        inString = false;
                    }
                } else if (c == '"') {
                    inString = true;
                } else if (c == '{' || c == '[') {
                    depth++;
                } else if (c == '}' || c == ']') {
                    depth--;
                    if (depth == 0) {
                        return i;
                    }
                }
            }
            return -1;
        }
    }
}
