package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;

import java.time.Instant;

public record NotificationItemResponse(
  Long caseId,
  AuditEventType eventType,
  String title,
  String detail,
  Instant occurredAt,
  CaseStatus status
) {
}
