package com.example.thesisrepo.web.dto;

import java.time.Instant;
import java.util.List;

public record ApiErrorResponse(
  Instant timestamp,
  int status,
  String error,
  String message,
  String path,
  List<ApiFieldErrorResponse> fieldErrors
) {
  public ApiErrorResponse {
    fieldErrors = fieldErrors == null ? List.of() : List.copyOf(fieldErrors);
  }
}
