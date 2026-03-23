package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.SubmissionStatus;

import java.time.Instant;

public record SubmissionSummaryResponse(
  Long id,
  Integer versionNumber,
  String originalFilename,
  String contentType,
  Long fileSize,
  SubmissionStatus status,
  Instant createdAt
) {
}
