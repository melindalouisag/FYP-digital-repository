package com.example.thesisrepo.web.dto;

public record ChecklistConflictResponse(
  String error,
  Long templateId,
  ChecklistTemplateDetailResponse.EditLockResponse lock
) implements ChecklistTemplateActionResponse {
}
