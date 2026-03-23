package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.ChecklistScope;

import java.time.Instant;

public record ChecklistTemplateSummaryResponse(
  Long id,
  ChecklistScope publicationType,
  Integer version,
  boolean active,
  Instant createdAt,
  int itemCount
) {
}
