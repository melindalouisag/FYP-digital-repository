package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.ChecklistScope;
import com.example.thesisrepo.publication.SubmissionStatus;

import java.time.Instant;

public record SubmissionDetailResponse(
  Long id,
  Integer versionNumber,
  String originalFilename,
  String contentType,
  Long fileSize,
  SubmissionStatus status,
  Instant createdAt,
  String metadataTitle,
  String metadataAuthors,
  String metadataKeywords,
  String metadataFaculty,
  String metadataStudyProgram,
  Integer metadataYear,
  String abstractText,
  ChecklistTemplateInfoResponse checklistTemplate
) {
  public record ChecklistTemplateInfoResponse(
    Long id,
    ChecklistScope publicationType,
    Integer version,
    boolean active
  ) {
  }
}
