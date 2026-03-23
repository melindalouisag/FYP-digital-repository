package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.PublicationType;

public record LecturerStudentCaseResponse(
  Long caseId,
  Long studentId,
  CaseStatus status,
  PublicationType type
) {
}
