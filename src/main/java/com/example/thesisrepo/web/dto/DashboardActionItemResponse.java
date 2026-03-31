package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.CaseStatus;

import java.time.Instant;

public record DashboardActionItemResponse(
  Long caseId,
  String title,
  CaseStatus status,
  String queueKey,
  String queueLabel,
  String detail,
  Instant updatedAt
) {
}
