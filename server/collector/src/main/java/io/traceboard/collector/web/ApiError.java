package io.traceboard.collector.web;

/**
 * v1 error envelope: {@code {"error":"<code>","message":"<...>","apiVersion":"v1"}}.
 * Messages are short and never contain internal paths or credential material.
 */
public record ApiError(String error, String message, String apiVersion) {

    public static ApiError of(String error, String message) {
        return new ApiError(error, message, "v1");
    }
}
