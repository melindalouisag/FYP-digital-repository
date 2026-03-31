package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.CaseStatus;

import java.time.Instant;

public record DashboardActivityItemResponse(
  Long caseId,
  Long studentUserId,
  String title,
  String subtitle,
  String detail,
  Instant occurredAt,
  CaseStatus status
) {
}
