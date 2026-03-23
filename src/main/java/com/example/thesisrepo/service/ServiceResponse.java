package com.example.thesisrepo.service;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;

public record ServiceResponse<T>(
  HttpStatusCode status,
  T body
) {
  public static <T> ServiceResponse<T> ok(T body) {
    return new ServiceResponse<>(org.springframework.http.HttpStatus.OK, body);
  }

  public static <T> ServiceResponse<T> status(HttpStatusCode status, T body) {
    return new ServiceResponse<>(status, body);
  }

  public ResponseEntity<T> toResponseEntity() {
    return ResponseEntity.status(status).body(body);
  }
}
