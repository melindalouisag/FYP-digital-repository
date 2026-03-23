package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.PublicationType;

import java.time.Instant;

public record StudentCaseSummaryResponse(
  Long id,
  PublicationType type,
  CaseStatus status,
  String title,
  Instant updatedAt,
  Instant createdAt
) {
}
