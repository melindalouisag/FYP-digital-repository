package com.example.thesisrepo.service.student;

import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.ClearanceForm;
import com.example.thesisrepo.publication.ClearanceStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.repo.ClearanceFormRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.service.workflow.AuditEventService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class StudentCaseCommandService {

  private final PublicationCaseRepository cases;
  private final ClearanceFormRepository clearances;
  private final PublicationWorkflowGateService workflowGates;
  private final AuditEventService auditEvents;

  @Transactional
  public CaseStatusResponse submitClearance(User student, Long caseId, String note) {
    PublicationCase publicationCase = workflowGates.requireOwnedCase(student, caseId);
    workflowGates.ensureClearanceSubmittable(publicationCase);

    ClearanceForm clearance = clearances.findByPublicationCase(publicationCase).orElseGet(() -> ClearanceForm.builder()
      .publicationCase(publicationCase)
      .status(ClearanceStatus.DRAFT)
      .build());

    clearance.setStatus(ClearanceStatus.SUBMITTED);
    clearance.setSubmittedAt(Instant.now());
    clearance.setNote(note);
    clearances.save(clearance);

    publicationCase.setStatus(CaseStatus.CLEARANCE_SUBMITTED);
    cases.save(publicationCase);

    auditEvents.log(
      publicationCase.getId(),
      student,
      Role.STUDENT,
      AuditEventType.CLEARANCE_SUBMITTED,
      "Student submitted clearance form"
    );

    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
  }
}
