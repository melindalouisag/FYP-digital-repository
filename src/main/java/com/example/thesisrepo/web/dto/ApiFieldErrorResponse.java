package com.example.thesisrepo.web.dto;

public record ApiFieldErrorResponse(
  String field,
  String message
) {
}
