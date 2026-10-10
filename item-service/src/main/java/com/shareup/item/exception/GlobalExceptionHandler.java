package com.shareup.item.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.LocalDateTime;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntime(RuntimeException ex) {
        String msg = ex.getMessage();

        if (msg == null) {
            log.error("Unexpected null RuntimeException", ex);
            return ResponseEntity.status(500)
                    .body(new ErrorResponse(500, "Internal server error"));
        }

        if (msg.toLowerCase().contains("not found")) {
            log.warn("Item not found: {}", msg);
            return ResponseEntity.status(404)
                    .body(new ErrorResponse(404, msg));
        }

        if (msg.toLowerCase().contains("upload failed")) {
            log.error("Cloudinary upload failed: {}", msg);
            return ResponseEntity.status(502)
                    .body(new ErrorResponse(502, "Image upload failed. Please try again."));
        }

        // 400 — business rule violations
        if (msg.toLowerCase().contains("invalid") ||
            msg.toLowerCase().contains("cannot")) {
            log.warn("Bad request: {}", msg);
            return ResponseEntity.status(400)
                    .body(new ErrorResponse(400, msg));
        }

        log.error("Unhandled exception: {}", msg, ex);
        return ResponseEntity.status(500)
                .body(new ErrorResponse(500, "Something went wrong. Please try again."));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        return ResponseEntity.status(403)
                .body(new ErrorResponse(403, "You are not authorized to perform this action"));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleTooLarge(MaxUploadSizeExceededException ex) {
        log.warn("Upload too large: {}", ex.getMessage());
        return ResponseEntity.status(413)
                .body(new ErrorResponse(413, "Image is too large. The limit is 10MB."));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException ex) {
        log.warn("Unreadable request body: {}", ex.getMessage());
        return ResponseEntity.status(400)
                .body(new ErrorResponse(400, "Invalid request body"));
    }

    public record ErrorResponse(
            int status,
            String message,
            LocalDateTime timestamp
    ) {
        public ErrorResponse(int status, String message) {
            this(status, message, LocalDateTime.now());
        }
    }
}