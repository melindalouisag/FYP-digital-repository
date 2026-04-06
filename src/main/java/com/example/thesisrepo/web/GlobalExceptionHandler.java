package com.example.thesisrepo.web;

import com.example.thesisrepo.web.dto.ApiErrorResponse;
import com.example.thesisrepo.web.dto.ApiFieldErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
  @Value("${file.max-size-bytes:15728640}")
  private long maxFileSizeBytes;

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiErrorResponse> handleMethodArgumentNotValid(
    MethodArgumentNotValidException exception,
    HttpServletRequest request
  ) {
    return buildValidationResponse(exception.getBindingResult(), request);
  }

  @ExceptionHandler(BindException.class)
  public ResponseEntity<ApiErrorResponse> handleBindException(BindException exception, HttpServletRequest request) {
    return buildValidationResponse(exception.getBindingResult(), request);
  }

  @ExceptionHandler(HandlerMethodValidationException.class)
  public ResponseEntity<ApiErrorResponse> handleHandlerMethodValidation(
    HandlerMethodValidationException exception,
    HttpServletRequest request
  ) {
    List<ApiFieldErrorResponse> fieldErrors = exception.getParameterValidationResults().stream()
      .flatMap(result -> result.getResolvableErrors().stream()
        .map(error -> new ApiFieldErrorResponse(result.getMethodParameter().getParameterName(), error.getDefaultMessage())))
      .toList();
    return buildResponse(HttpStatus.BAD_REQUEST, "Validation failed.", request, fieldErrors);
  }

  @ExceptionHandler(ConstraintViolationException.class)
  public ResponseEntity<ApiErrorResponse> handleConstraintViolation(
    ConstraintViolationException exception,
    HttpServletRequest request
  ) {
    List<ApiFieldErrorResponse> fieldErrors = exception.getConstraintViolations().stream()
      .map(violation -> new ApiFieldErrorResponse(
        extractLeafNode(violation.getPropertyPath() != null ? violation.getPropertyPath().toString() : null),
        violation.getMessage()
      ))
      .sorted(Comparator.comparing(ApiFieldErrorResponse::field, Comparator.nullsLast(String::compareTo)))
      .toList();
    return buildResponse(HttpStatus.BAD_REQUEST, "Validation failed.", request, fieldErrors);
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ApiErrorResponse> handleHttpMessageNotReadable(
    HttpMessageNotReadableException exception,
    HttpServletRequest request
  ) {
    return buildResponse(HttpStatus.BAD_REQUEST, "Malformed request body.", request, List.of());
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  public ResponseEntity<ApiErrorResponse> handleMaxUploadSizeExceeded(
    MaxUploadSizeExceededException exception,
    HttpServletRequest request
  ) {
    return buildResponse(HttpStatus.BAD_REQUEST, buildMaxFileSizeMessage(), request, List.of());
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<ApiErrorResponse> handleResponseStatus(
    ResponseStatusException exception,
    HttpServletRequest request
  ) {
    HttpStatusCode statusCode = exception.getStatusCode();
    String reason = exception.getReason();
    if (reason == null || reason.isBlank()) {
      reason = HttpStatus.resolve(statusCode.value()) != null
        ? HttpStatus.resolve(statusCode.value()).getReasonPhrase()
        : "Request failed";
    }
    return buildResponse(HttpStatus.valueOf(statusCode.value()), reason, request, List.of());
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception exception, HttpServletRequest request) {
    log.error("Unhandled exception type={} message={}", exception.getClass().getName(), exception.getMessage());
    return buildResponse(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "An unexpected error occurred. Please try again later.",
      request,
      List.of()
    );
  }

  private ResponseEntity<ApiErrorResponse> buildValidationResponse(
    BindingResult bindingResult,
    HttpServletRequest request
  ) {
    List<ApiFieldErrorResponse> fieldErrors = new ArrayList<>();
    for (FieldError error : bindingResult.getFieldErrors()) {
      fieldErrors.add(new ApiFieldErrorResponse(error.getField(), error.getDefaultMessage()));
    }
    bindingResult.getGlobalErrors().forEach(error ->
      fieldErrors.add(new ApiFieldErrorResponse(error.getObjectName(), error.getDefaultMessage()))
    );
    fieldErrors.sort(Comparator.comparing(ApiFieldErrorResponse::field, Comparator.nullsLast(String::compareTo)));
    return buildResponse(HttpStatus.BAD_REQUEST, "Validation failed.", request, fieldErrors);
  }

  private ResponseEntity<ApiErrorResponse> buildResponse(
    HttpStatus status,
    String message,
    HttpServletRequest request,
    List<ApiFieldErrorResponse> fieldErrors
  ) {
    return ResponseEntity.status(status).body(new ApiErrorResponse(
      Instant.now(),
      status.value(),
      status.getReasonPhrase(),
      message,
      request.getRequestURI(),
      fieldErrors
    ));
  }

  private String extractLeafNode(String path) {
    if (path == null || path.isBlank()) {
      return null;
    }
    int index = path.lastIndexOf('.');
    return index >= 0 ? path.substring(index + 1) : path;
  }

  private String buildMaxFileSizeMessage() {
    long maxSizeMb = Math.round((double) maxFileSizeBytes / (1024 * 1024));
    return "File size must not exceed " + maxSizeMb + "MB.";
  }
}
