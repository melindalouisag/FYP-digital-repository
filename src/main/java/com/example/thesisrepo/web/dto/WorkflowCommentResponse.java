package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.user.Role;

import java.time.Instant;

public record WorkflowCommentResponse(
  Long id,
  Long submissionVersionId,
  Role authorRole,
  String authorEmail,
  String body,
  Instant createdAt
) {
}
