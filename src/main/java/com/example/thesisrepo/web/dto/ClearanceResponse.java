package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.ClearanceStatus;

import java.time.Instant;

public record ClearanceResponse(
  Long id,
  ClearanceStatus status,
  String note,
  Instant submittedAt,
  Instant approvedAt
) {
}
