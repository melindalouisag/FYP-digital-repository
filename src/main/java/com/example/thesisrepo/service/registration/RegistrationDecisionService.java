package com.example.thesisrepo.service.registration;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.CaseSupervisor;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.WorkflowComment;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.publication.repo.WorkflowCommentRepository;
import com.example.thesisrepo.service.workflow.AuditEventService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.AdminRegistrationApprovalDto;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import com.example.thesisrepo.web.dto.PagedResponse;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@RequiredArgsConstructor
public class RegistrationDecisionService {

  private final PublicationCaseRepository cases;
  private final PublicationRegistrationRepository registrations;
  private final CaseSupervisorRepository caseSupervisors;
  private final WorkflowCommentRepository comments;
  private final StudentProfileRepository studentProfiles;
  private final PublicationWorkflowGateService workflowGates;
  private final AuditEventService auditEvents;
  private final EntityManager entityManager;

  @Transactional
  public CaseStatusResponse approveRegistrationByLecturer(User lecturer, Long caseId) {
    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    CaseSupervisor supervisor = workflowGates.ensureLecturerCanApproveRegistration(lecturer, publicationCase);

    supervisor.approve();
    caseSupervisors.save(supervisor);

    List<CaseSupervisor> supervisors = caseSupervisors.findByCaseId(publicationCase.getId());
    boolean anyRejected = supervisors.stream().anyMatch(item -> item.getRejectedAt() != null);
    boolean allApproved = supervisors.stream().allMatch(item -> item.getApprovedAt() != null);
    CaseStatus nextStatus = anyRejected
      ? CaseStatus.REJECTED
      : (allApproved ? CaseStatus.REGISTRATION_APPROVED : CaseStatus.REGISTRATION_PENDING);

    if (nextStatus != publicationCase.getStatus()) {
      publicationCase.setStatus(nextStatus);
      cases.save(publicationCase);

      PublicationRegistration registration = registrations.findByPublicationCase(publicationCase).orElse(null);
      if (registration != null) {
        if (nextStatus == CaseStatus.REGISTRATION_APPROVED) {
          registration.setSupervisorDecisionAt(Instant.now());
          registration.setSupervisorDecisionNote("Approved by all supervisors");
          registrations.save(registration);
        } else if (nextStatus == CaseStatus.REJECTED) {
          registration.setSupervisorDecisionAt(Instant.now());
          registration.setSupervisorDecisionNote(supervisor.getDecisionNote());
          registrations.save(registration);
        }
      }
    }

    auditEvents.log(
      publicationCase.getId(),
      lecturer,
      Role.LECTURER,
      AuditEventType.SUPERVISOR_APPROVED_REGISTRATION,
      "Supervisor approved registration"
    );

    entityManager.flush();
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
  }

  @Transactional
  public CaseStatusResponse rejectRegistrationByLecturer(User lecturer, Long caseId, String note) {
    String normalizedNote = requireText(note, "Rejection note is required");

    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    CaseSupervisor supervisor = workflowGates.ensureLecturerCanApproveRegistration(lecturer, publicationCase);

    supervisor.reject(normalizedNote);
    caseSupervisors.save(supervisor);

    publicationCase.setStatus(CaseStatus.REJECTED);
    cases.save(publicationCase);

    PublicationRegistration registration = registrations.findByPublicationCase(publicationCase)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Registration not found"));
    registration.setSupervisorDecisionAt(Instant.now());
    registration.setSupervisorDecisionNote(normalizedNote);
    registrations.save(registration);

    auditEvents.log(
      publicationCase.getId(),
      lecturer,
      Role.LECTURER,
      AuditEventType.SUPERVISOR_REJECTED_REGISTRATION,
      normalizedNote
    );

    entityManager.flush();
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
  }

  @Transactional
  public CaseStatusResponse approveRegistrationByAdmin(User admin, Long caseId) {
    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    workflowGates.ensureAdminCanApproveRegistration(publicationCase);

    publicationCase.setStatus(CaseStatus.REGISTRATION_VERIFIED);
    cases.save(publicationCase);

    auditEvents.log(
      publicationCase.getId(),
      admin,
      Role.ADMIN,
      AuditEventType.LIBRARY_APPROVED_REGISTRATION,
      "Registration verified by library"
    );

    entityManager.flush();
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
  }

  @Transactional
  public CaseStatusResponse rejectRegistrationByAdmin(User admin, Long caseId, String reason) {
    String normalizedReason = requireText(reason, "Reason is required");

    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    workflowGates.ensureAdminCanRejectRegistration(publicationCase);

    publicationCase.setStatus(CaseStatus.REJECTED);
    cases.save(publicationCase);

    comments.save(WorkflowComment.builder()
      .publicationCase(publicationCase)
      .author(admin)
      .authorRole(Role.ADMIN)
      .authorEmail(admin.getEmail())
      .body(normalizedReason)
      .build());

    auditEvents.log(
      publicationCase.getId(),
      admin,
      Role.ADMIN,
      AuditEventType.LIBRARY_REJECTED_REGISTRATION,
      normalizedReason
    );

    entityManager.flush();
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
  }

  @Transactional(readOnly = true)
  public PagedResponse<AdminRegistrationApprovalDto> adminApprovalQueue(Pageable pageable) {
    Page<PublicationRegistration> registrationsPage = registrations.findAdminApprovalQueue(
      CaseStatus.REGISTRATION_APPROVED,
      pageable
    );

    List<PublicationRegistration> approvalRegistrations = registrationsPage.getContent();
    List<PublicationCase> approvalCases = approvalRegistrations.stream()
      .map(PublicationRegistration::getPublicationCase)
      .toList();
    Map<Long, StudentProfile> profileByUser = loadStudentProfiles(approvalCases);

    List<AdminRegistrationApprovalDto> items = approvalRegistrations.stream()
      .map(registration -> toAdminRegistrationApprovalDto(registration, profileByUser))
      .toList();
    return PagedResponse.from(registrationsPage, items);
  }

  private Map<Long, StudentProfile> loadStudentProfiles(List<PublicationCase> publicationCases) {
    List<Long> studentIds = publicationCases.stream()
      .map(c -> c.getStudent().getId())
      .distinct()
      .toList();
    return studentProfiles.findByUserIdIn(studentIds).stream()
      .collect(Collectors.toMap(StudentProfile::getUserId, Function.identity()));
  }

  private AdminRegistrationApprovalDto toAdminRegistrationApprovalDto(
    PublicationRegistration registration,
    Map<Long, StudentProfile> profileByUser
  ) {
    PublicationCase publicationCase = registration.getPublicationCase();
    StudentProfile profile = profileByUser.get(publicationCase.getStudent().getId());
    String studentName = profile != null && hasText(profile.getName())
      ? profile.getName()
      : publicationCase.getStudent().getEmail();
    return new AdminRegistrationApprovalDto(
      publicationCase.getId(),
      registration.getTitle(),
      publicationCase.getType(),
      publicationCase.getStatus(),
      publicationCase.getUpdatedAt(),
      registration.getSubmittedAt(),
      publicationCase.getStudent().getId(),
      studentName,
      profile != null ? profile.getStudentId() : null,
      profile != null ? profile.getFaculty() : null,
      profile != null ? profile.getProgram() : null,
      publicationCase.getStudent().getEmail()
    );
  }

  private String requireText(String value, String message) {
    if (!hasText(value)) {
      throw new ResponseStatusException(BAD_REQUEST, message);
    }
    return value.trim();
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
