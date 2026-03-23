package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.ReviewOutcome;

public record ChecklistResultResponse(
  Long id,
  ChecklistItemResponse checklistItem,
  ReviewOutcome passFail,
  String note
) {
  public record ChecklistItemResponse(
    Long id,
    String section,
    String itemText
  ) {
  }
}
