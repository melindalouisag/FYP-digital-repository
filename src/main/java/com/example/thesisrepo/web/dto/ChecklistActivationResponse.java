package com.example.thesisrepo.web.dto;

public record ChecklistActivationResponse(
  Long templateId,
  boolean active
) implements ChecklistTemplateActionResponse {
}
