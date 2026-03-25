package com.example.thesisrepo.web.dto;

public record ChecklistItemsSaveResponse(
  boolean ok,
  boolean lockReleased
) implements ChecklistTemplateActionResponse {
}
