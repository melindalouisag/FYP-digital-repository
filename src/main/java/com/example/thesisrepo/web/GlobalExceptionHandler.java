package com.example.thesisrepo.web;

import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;

@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

  @ExceptionHandler(ResponseStatusException.class)
  public void handleResponseStatus(ResponseStatusException exception, HttpServletResponse response) throws IOException {
    HttpStatusCode statusCode = exception.getStatusCode();
    String reason = exception.getReason();
    if (reason == null || reason.isBlank()) {
      reason = HttpStatus.resolve(statusCode.value()) != null
        ? HttpStatus.resolve(statusCode.value()).getReasonPhrase()
        : "Request failed";
    }
    response.sendError(statusCode.value(), reason);
  }

  @ExceptionHandler(Exception.class)
  public void handleUnexpected(Exception exception, HttpServletResponse response) throws IOException {
    log.error("Unhandled exception type={} message={}", exception.getClass().getName(), exception.getMessage());
    response.sendError(
      HttpStatus.INTERNAL_SERVER_ERROR.value(),
      "An unexpected error occurred. Please try again later."
    );
  }
}
