package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.CaseStatus;

public record CaseStatusResponse(
  Long caseId,
  CaseStatus status
) {
}
