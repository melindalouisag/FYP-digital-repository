package com.example.thesisrepo.service.registration;

import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.service.CalendarDeadlineService;
import com.example.thesisrepo.service.workflow.AuditEventService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@RequiredArgsConstructor
public class RegistrationSubmissionService {

  private final PublicationCaseRepository cases;
  private final PublicationRegistrationRepository registrations;
  private final CalendarDeadlineService calendarDeadlineService;
  private final PublicationWorkflowGateService workflowGates;
  private final RegistrationSupportService registrationSupportService;
  private final AuditEventService auditEvents;
  private final EntityManager entityManager;

  @Transactional
  public CaseStatusResponse submitStudentRegistration(User student, Long caseId, boolean permissionAccepted) {
    PublicationCase publicationCase = workflowGates.requireOwnedCase(student, caseId);
    workflowGates.ensureRegistrationSubmittable(publicationCase);
    calendarDeadlineService.ensureRegistrationOpen(publicationCase.getType());

    PublicationRegistration registration = registrations.findByPublicationCase(publicationCase)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Registration not found"));
    if (!permissionAccepted) {
      throw new ResponseStatusException(BAD_REQUEST, "Permission must be accepted");
    }

    registrationSupportService.resetSupervisorDecisions(publicationCase);
    registrationSupportService.clearRegistrationSubmissionState(registration);
    registration.setPermissionAcceptedAt(Instant.now());
    registration.setSubmittedAt(Instant.now());
    registrations.save(registration);

    publicationCase.setStatus(CaseStatus.REGISTRATION_PENDING);
    cases.save(publicationCase);

    auditEvents.log(
      publicationCase.getId(),
      student,
      Role.STUDENT,
      AuditEventType.REGISTRATION_SUBMITTED,
      "Registration submitted for supervisor approval"
    );

    entityManager.flush();
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
  }
}
