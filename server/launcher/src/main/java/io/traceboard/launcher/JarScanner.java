package io.traceboard.launcher;

import java.io.IOException;
import java.nio.file.Path;
import java.util.jar.Attributes;
import java.util.jar.JarFile;
import java.util.jar.Manifest;

/**
 * Reads the application JAR manifest to derive the generic-agent include package.
 *
 * <p>Spring Boot executable JARs carry {@code Start-Class}; plain executable JARs carry
 * {@code Main-Class}. The package before the last dot is used as the default
 * {@code -Dtraceboard.include=<package>} (v1 auto-scan scope).</p>
 */
final class JarScanner {

    private JarScanner() {
    }

    /** {@code Start-Class} first (Spring Boot), then {@code Main-Class}; null when neither is set. */
    static String startClass(Path jar) throws LauncherException {
        try (JarFile file = new JarFile(jar.toFile())) {
            Manifest manifest = file.getManifest();
            if (manifest == null) {
                return null;
            }
            Attributes attributes = manifest.getMainAttributes();
            String start = trimToNull(attributes.getValue("Start-Class"));
            if (start != null) {
                return start;
            }
            return trimToNull(attributes.getValue("Main-Class"));
        } catch (IOException e) {
            throw LauncherException.failed("JAR_INVALID", "无法读取 JAR manifest: \"" + Util.fwd(jar)
                    + "\"（" + e.getClass().getSimpleName() + "）；确认 --jar 是完整的可执行 JAR。");
        }
    }

    /** Package of {@code com.acme.OrderApplication} → {@code com.acme}; null for the default package. */
    static String appBasePackage(Path jar) throws LauncherException {
        return basePackage(startClass(jar));
    }

    static String basePackage(String className) {
        if (className == null || className.isBlank()) {
            return null;
        }
        String value = className.trim();
        int dot = value.lastIndexOf('.');
        if (dot <= 0 || dot == value.length() - 1) {
            return null;
        }
        return value.substring(0, dot);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}