package com.example.thesisrepo.service.registration;

import com.example.thesisrepo.profile.LecturerProfile;
import com.example.thesisrepo.profile.LecturerProfileRepository;
import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.CaseSupervisor;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.service.RegistrationService;
import com.example.thesisrepo.user.AuthProvider;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.StaffRegistry;
import com.example.thesisrepo.user.StaffRegistryRepository;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;

@Service
@RequiredArgsConstructor
public class RegistrationSupportService {

  private final PublicationCaseRepository cases;
  private final CaseSupervisorRepository caseSupervisors;
  private final StudentProfileRepository studentProfiles;
  private final LecturerProfileRepository lecturerProfiles;
  private final UserRepository users;
  private final StaffRegistryRepository staffRegistry;
  private final PasswordEncoder passwordEncoder;

  public String requireStudentProgram(User student) {
    StudentProfile studentProfile = studentProfiles.findByUserId(student.getId()).orElse(null);
    String studentProgram = normalize(studentProfile != null ? studentProfile.getProgram() : null);
    if (studentProfile == null || studentProgram.isBlank()) {
      throw new ResponseStatusException(BAD_REQUEST, "Student profile must include study program before selecting supervisors");
    }
    return studentProgram;
  }

  public void ensureStudentCanCreateRegistration(User student, PublicationType type) {
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
        "You already have a THESIS registration in progress. Edit the existing registration instead of creating a new one."
      );
    }

    throw new ResponseStatusException(
      CONFLICT,
      "You already have THESIS registrations in progress. Use an existing registration instead of creating a new one."
    );
  }

  public User resolveRequestedSupervisor(
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
        .map(RegistrationSupportService::normalize)
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

  public void validateSupervisorForStudent(User supervisor, String studentProgram) {
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

  public void replaceSupervisorAssignment(PublicationCase publicationCase, User supervisor) {
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

  public void clearRegistrationSubmissionState(PublicationRegistration registration) {
    registration.setSubmittedAt(null);
    registration.setPermissionAcceptedAt(null);
    registration.setSupervisorDecisionAt(null);
    registration.setSupervisorDecisionNote(null);
  }

  public void resetSupervisorDecisions(PublicationCase publicationCase) {
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
}
