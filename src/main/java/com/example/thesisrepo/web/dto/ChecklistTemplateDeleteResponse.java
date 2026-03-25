package com.example.thesisrepo.web.dto;

public record ChecklistTemplateDeleteResponse(
  boolean deleted,
  Long templateId
) implements ChecklistTemplateActionResponse {
}
