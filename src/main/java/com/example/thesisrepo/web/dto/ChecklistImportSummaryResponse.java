package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.ChecklistScope;

import java.util.List;

public record ChecklistImportSummaryResponse(
  ChecklistScope type,
  Long newTemplateId,
  Integer newVersion,
  Integer itemsImported,
  List<String> sections
) {
}
