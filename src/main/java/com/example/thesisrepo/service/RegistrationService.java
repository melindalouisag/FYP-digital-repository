package com.example.thesisrepo.service;

import com.example.thesisrepo.profile.LecturerProfile;
import com.example.thesisrepo.profile.LecturerProfileRepository;
import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.CaseSupervisor;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.publication.WorkflowComment;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.publication.repo.WorkflowCommentRepository;
import com.example.thesisrepo.service.workflow.AuditEventService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.AuthProvider;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.StaffRegistry;
import com.example.thesisrepo.user.StaffRegistryRepository;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@RequiredArgsConstructor
public class RegistrationService {

  private final PublicationCaseRepository cases;
  private final PublicationRegistrationRepository registrations;
  private final CaseSupervisorRepository caseSupervisors;
  private final WorkflowCommentRepository comments;
  private final StudentProfileRepository studentProfiles;
  private final LecturerProfileRepository lecturerProfiles;
  private final UserRepository users;
  private final StaffRegistryRepository staffRegistry;
  private final PublicationWorkflowGateService workflowGates;
  private final AuditEventService auditEvents;
  private final PasswordEncoder passwordEncoder;
  private final EntityManager entityManager;

  @Transactional
  public CaseStatusResponse createStudentRegistration(User student, CreateRegistrationCommand command) {
    ensureStudentCanCreateRegistration(student, command.type());

    String studentProgram = requireStudentProgram(student);
    User supervisor = resolveRequestedSupervisor(
      command.supervisorEmail(),
      command.supervisorUserId(),
      command.supervisorUserIds(),
      command.supervisorEmails()
    );
    validateSupervisorForStudent(supervisor, studentProgram);

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

    caseSupervisors.save(CaseSupervisor.builder()
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

    String studentProgram = requireStudentProgram(student);
    PublicationRegistration registration = registrations.findByPublicationCase(publicationCase)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Registration not found"));
    User supervisor = resolveRequestedSupervisor(
      command.supervisorEmail(),
      command.supervisorUserId(),
      command.supervisorUserIds(),
      command.supervisorEmails()
    );
    validateSupervisorForStudent(supervisor, studentProgram);

    registration.setTitle(command.title());
    registration.setYear(command.year());
    registration.setArticlePublishIn(command.articlePublishIn());
    registration.setFaculty(command.faculty());
    registration.setStudentIdNumber(command.studentIdNumber());
    registration.setAuthorName(command.authorName());

    if (publicationCase.getStatus() == CaseStatus.REGISTRATION_PENDING) {
      clearRegistrationSubmissionState(registration);
      resetSupervisorDecisions(publicationCase);
      publicationCase.setStatus(CaseStatus.REGISTRATION_DRAFT);
      cases.save(publicationCase);
    }

    registrations.save(registration);
    replaceSupervisorAssignment(publicationCase, supervisor);

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

  @Transactional
  public CaseStatusResponse submitStudentRegistration(User student, Long caseId, boolean permissionAccepted) {
    PublicationCase publicationCase = workflowGates.requireOwnedCase(student, caseId);
    workflowGates.ensureRegistrationSubmittable(publicationCase);

    PublicationRegistration registration = registrations.findByPublicationCase(publicationCase)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Registration not found"));
    if (!permissionAccepted) {
      throw new ResponseStatusException(BAD_REQUEST, "Permission must be accepted");
    }

    List<CaseSupervisor> supervisors = caseSupervisors.findByPublicationCase(publicationCase);
    supervisors.forEach(supervisor -> {
      supervisor.setApprovedAt(null);
      supervisor.setRejectedAt(null);
      supervisor.setDecisionNote(null);
    });
    caseSupervisors.saveAll(supervisors);

    clearRegistrationSubmissionState(registration);
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
    return toStatusResponse(publicationCase);
  }

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
    return toStatusResponse(publicationCase);
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
    return toStatusResponse(publicationCase);
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
    return toStatusResponse(publicationCase);
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
    return toStatusResponse(publicationCase);
  }

  private CaseStatusResponse toStatusResponse(PublicationCase publicationCase) {
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
  }

  private String requireStudentProgram(User student) {
    StudentProfile studentProfile = studentProfiles.findByUserId(student.getId()).orElse(null);
    String studentProgram = normalize(studentProfile != null ? studentProfile.getProgram() : null);
    if (studentProfile == null || studentProgram.isBlank()) {
      throw new ResponseStatusException(BAD_REQUEST, "Student profile must include study program before selecting supervisors");
    }
    return studentProgram;
  }

  private void ensureStudentCanCreateRegistration(User student, PublicationType type) {
    if (type != PublicationType.THESIS) {
      return;
    }

    List<PublicationCase> thesisCases = cases.findByStudentAndTypeOrderByUpdatedAtDesc(student, PublicationType.THESIS);
    if (thesisCases.isEmpty()) {
      return;
    }

    PublicationCase canonical = pickCanonicalThesisCase(thesisCases);
    if (canonical != null) {
      throw new ResponseStatusException(
        CONFLICT,
        "You already have a THESIS registration case (case #" + canonical.getId() + "). Edit the existing case instead of creating a new one."
      );
    }

    throw new ResponseStatusException(
      CONFLICT,
      "You already have THESIS registration cases. Use an existing case instead of creating a new one."
    );
  }

  private PublicationCase pickCanonicalThesisCase(List<PublicationCase> thesisCases) {
    return thesisCases.stream()
      .min(Comparator.comparingInt((PublicationCase item) -> thesisCasePriority(item.getStatus()))
        .thenComparing(PublicationCase::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
        .thenComparing(PublicationCase::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
      .orElse(null);
  }

  private static int thesisCasePriority(CaseStatus status) {
    if (status == CaseStatus.REGISTRATION_VERIFIED) {
      return 0;
    }
    if (status == CaseStatus.REGISTRATION_APPROVED) {
      return 1;
    }
    if (status == CaseStatus.REGISTRATION_PENDING) {
      return 2;
    }
    if (status == CaseStatus.REGISTRATION_DRAFT) {
      return 3;
    }
    if (status == CaseStatus.REJECTED) {
      return 4;
    }
    return 5;
  }

  private void validateSupervisorForStudent(User supervisor, String studentProgram) {
    if (supervisor.getRole() != Role.LECTURER) {
      throw new ResponseStatusException(BAD_REQUEST, "Supervisor must be a lecturer.");
    }

    StaffRegistry staffEntry = staffRegistry.findByEmailIgnoreCase(supervisor.getEmail()).orElse(null);
    LecturerProfile lecturerProfile = lecturerProfiles.findByUserId(supervisor.getId()).orElse(null);

    String supervisorProgram = "";
    if (staffEntry != null && staffEntry.getStudyProgram() != null) {
      supervisorProgram = normalize(staffEntry.getStudyProgram());
    } else if (lecturerProfile != null && lecturerProfile.getDepartment() != null) {
      supervisorProgram = normalize(lecturerProfile.getDepartment());
    }

    if (supervisorProgram.isBlank()) {
      throw new ResponseStatusException(BAD_REQUEST, "Supervisor study program is not configured.");
    }

    if (!normalizeStudyProgram(supervisorProgram).equals(normalizeStudyProgram(studentProgram))) {
      throw new ResponseStatusException(BAD_REQUEST, "Supervisor must be from the same study program.");
    }
  }

  private void replaceSupervisorAssignment(PublicationCase publicationCase, User supervisor) {
    List<CaseSupervisor> existing = caseSupervisors.findByPublicationCase(publicationCase);
    if (existing.size() == 1 && existing.get(0).getLecturer().getId().equals(supervisor.getId())) {
      return;
    }

    if (!existing.isEmpty()) {
      caseSupervisors.deleteByPublicationCase(publicationCase);
    }

    caseSupervisors.save(CaseSupervisor.builder()
      .publicationCase(publicationCase)
      .lecturer(supervisor)
      .build());
  }

  private void clearRegistrationSubmissionState(PublicationRegistration registration) {
    registration.setSubmittedAt(null);
    registration.setPermissionAcceptedAt(null);
    registration.setSupervisorDecisionAt(null);
    registration.setSupervisorDecisionNote(null);
  }

  private void resetSupervisorDecisions(PublicationCase publicationCase) {
    List<CaseSupervisor> supervisors = caseSupervisors.findByPublicationCase(publicationCase);
    if (supervisors.isEmpty()) {
      return;
    }

    supervisors.forEach(supervisor -> {
      supervisor.setApprovedAt(null);
      supervisor.setRejectedAt(null);
      supervisor.setDecisionNote(null);
    });
    caseSupervisors.saveAll(supervisors);
  }

  private User resolveRequestedSupervisor(
    String requestedSupervisorEmail,
    Long requestedSupervisorUserId,
    List<Long> requestedSupervisorUserIds,
    List<String> requestedSupervisorEmails
  ) {
    String supervisorEmail = normalize(requestedSupervisorEmail);
    if (!supervisorEmail.isBlank()) {
      return findOrProvisionLecturer(supervisorEmail);
    }

    if (requestedSupervisorUserId != null) {
      return users.findById(requestedSupervisorUserId)
        .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Supervisor not found."));
    }

    if (requestedSupervisorEmails != null) {
      List<String> supervisorEmails = requestedSupervisorEmails.stream()
        .map(RegistrationService::normalize)
        .filter(email -> !email.isBlank())
        .distinct()
        .toList();
      if (supervisorEmails.isEmpty()) {
        throw new ResponseStatusException(BAD_REQUEST, "Supervisor is required.");
      }
      if (supervisorEmails.size() > 1) {
        throw new ResponseStatusException(BAD_REQUEST, "Only one supervisor is allowed.");
      }
      return findOrProvisionLecturer(supervisorEmails.get(0));
    }

    if (requestedSupervisorUserIds != null) {
      List<Long> supervisorUserIds = requestedSupervisorUserIds.stream()
        .filter(Objects::nonNull)
        .distinct()
        .toList();
      if (supervisorUserIds.isEmpty()) {
        throw new ResponseStatusException(BAD_REQUEST, "Supervisor is required.");
      }
      if (supervisorUserIds.size() > 1) {
        throw new ResponseStatusException(BAD_REQUEST, "Only one supervisor is allowed.");
      }
      return users.findById(supervisorUserIds.get(0))
        .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Supervisor not found."));
    }

    throw new ResponseStatusException(BAD_REQUEST, "Supervisor is required.");
  }

  private User findOrProvisionLecturer(String email) {
    return users.findByEmailIgnoreCase(email).orElseGet(() -> {
      StaffRegistry staff = staffRegistry.findByEmailIgnoreCase(email)
        .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Supervisor not found in staff registry."));
      if (staff.getRole() != Role.LECTURER) {
        throw new ResponseStatusException(BAD_REQUEST, "Selected staff is not a lecturer.");
      }

      User newUser = users.save(User.builder()
        .email(email)
        .role(Role.LECTURER)
        .roles(Set.of(Role.LECTURER))
        .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
        .authProvider(AuthProvider.AAD)
        .emailVerified(true)
        .build());

      lecturerProfiles.save(LecturerProfile.builder()
        .user(newUser)
        .name(staff.getFullName())
        .department(staff.getStudyProgram())
        .build());
      return newUser;
    });
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

  private static String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  private static String normalizeStudyProgram(String value) {
    String normalized = normalize(value);
    if (normalized.endsWith("systems")) {
      return normalized.substring(0, normalized.length() - 1);
    }
    return normalized;
  }

  public record CreateRegistrationCommand(
    PublicationType type,
    String title,
    Integer year,
    String articlePublishIn,
    String faculty,
    String studentIdNumber,
    String authorName,
    String supervisorEmail,
    Long supervisorUserId,
    List<Long> supervisorUserIds,
    List<String> supervisorEmails
  ) {
  }

  public record UpdateRegistrationCommand(
    String title,
    Integer year,
    String articlePublishIn,
    String faculty,
    String studentIdNumber,
    String authorName,
    String supervisorEmail,
    Long supervisorUserId,
    List<Long> supervisorUserIds,
    List<String> supervisorEmails
  ) {
  }
}
