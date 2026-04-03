package com.example.thesisrepo.service.registration;

import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.service.CalendarDeadlineService;
import com.example.thesisrepo.service.RegistrationService.CreateRegistrationCommand;
import com.example.thesisrepo.service.RegistrationService.UpdateRegistrationCommand;
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

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@RequiredArgsConstructor
public class RegistrationDraftService {

  private final PublicationCaseRepository cases;
  private final PublicationRegistrationRepository registrations;
  private final CaseSupervisorRepository caseSupervisors;
  private final CalendarDeadlineService calendarDeadlineService;
  private final PublicationWorkflowGateService workflowGates;
  private final RegistrationSupportService registrationSupportService;
  private final AuditEventService auditEvents;
  private final EntityManager entityManager;

  @Transactional
  public CaseStatusResponse createStudentRegistration(User student, CreateRegistrationCommand command) {
    calendarDeadlineService.ensureRegistrationOpen(command.type());
    registrationSupportService.ensureStudentCanCreateRegistration(student, command.type());

    String studentProgram = registrationSupportService.requireStudentProgram(student);
    User supervisor = registrationSupportService.resolveRequestedSupervisor(
      command.supervisorEmail(),
      command.supervisorUserId(),
      command.supervisorUserIds(),
      command.supervisorEmails()
    );
    registrationSupportService.validateSupervisorForStudent(supervisor, studentProgram);

    PublicationCase publicationCase = cases.save(PublicationCase.builder()
      .student(student)
      .type(command.type())
      .status(CaseStatus.REGISTRATION_DRAFT)
      .build());

    registrations.save(PublicationRegistration.builder()
      .publicationCase(publicationCase)
      .title(command.title())
      .year(command.year())
      .articlePublishIn(command.articlePublishIn())
      .faculty(command.faculty())
      .studentIdNumber(command.studentIdNumber())
      .authorName(command.authorName())
      .build());

    caseSupervisors.save(com.example.thesisrepo.publication.CaseSupervisor.builder()
      .publicationCase(publicationCase)
      .lecturer(supervisor)
      .build());

    auditEvents.log(
      publicationCase.getId(),
      student,
      Role.STUDENT,
      AuditEventType.REGISTRATION_DRAFT_SAVED,
      "Registration draft created"
    );

    entityManager.flush();
    return toStatusResponse(publicationCase);
  }

  @Transactional
  public CaseStatusResponse updateStudentRegistration(User student, Long caseId, UpdateRegistrationCommand command) {
    PublicationCase publicationCase = workflowGates.requireOwnedCase(student, caseId);
    workflowGates.ensureRegistrationEditable(publicationCase);
    calendarDeadlineService.ensureRegistrationOpen(publicationCase.getType());

    String studentProgram = registrationSupportService.requireStudentProgram(student);
    PublicationRegistration registration = registrations.findByPublicationCase(publicationCase)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Registration not found"));
    User supervisor = registrationSupportService.resolveRequestedSupervisor(
      command.supervisorEmail(),
      command.supervisorUserId(),
      command.supervisorUserIds(),
      command.supervisorEmails()
    );
    registrationSupportService.validateSupervisorForStudent(supervisor, studentProgram);

    registration.setTitle(command.title());
    registration.setYear(command.year());
    registration.setArticlePublishIn(command.articlePublishIn());
    registration.setFaculty(command.faculty());
    registration.setStudentIdNumber(command.studentIdNumber());
    registration.setAuthorName(command.authorName());

    if (publicationCase.getStatus() == CaseStatus.REGISTRATION_PENDING) {
      registrationSupportService.clearRegistrationSubmissionState(registration);
      registrationSupportService.resetSupervisorDecisions(publicationCase);
      publicationCase.setStatus(CaseStatus.REGISTRATION_DRAFT);
      cases.save(publicationCase);
    }

    registrations.save(registration);
    registrationSupportService.replaceSupervisorAssignment(publicationCase, supervisor);

    auditEvents.log(
      publicationCase.getId(),
      student,
      Role.STUDENT,
      AuditEventType.REGISTRATION_DRAFT_SAVED,
      "Registration draft updated"
    );

    entityManager.flush();
    return toStatusResponse(publicationCase);
  }

  private CaseStatusResponse toStatusResponse(PublicationCase publicationCase) {
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
  }
}
