package com.example.thesisrepo.web.dto;

public record ChecklistTemplateLockResponse(
  Long templateId,
  boolean locked,
  ChecklistTemplateDetailResponse.EditLockResponse lock
) {
}
