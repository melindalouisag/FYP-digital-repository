package com.example.thesisrepo.web.dto;

import java.time.Instant;

public record RegistrationDetailResponse(
  Long id,
  String title,
  Integer year,
  String articlePublishIn,
  String faculty,
  String studentIdNumber,
  String authorName,
  Instant permissionAcceptedAt,
  Instant submittedAt,
  Instant supervisorDecisionAt,
  String supervisorDecisionNote
) {
}
