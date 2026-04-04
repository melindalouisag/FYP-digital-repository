package com.example.thesisrepo.service.dashboard;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.*;
import com.example.thesisrepo.publication.repo.AuditEventRepository;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.publication.repo.SubmissionVersionRepository;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.DashboardActivityItemResponse;
import com.example.thesisrepo.web.dto.LecturerDashboardResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LecturerDashboardService {

  private static final Set<CaseStatus> SUPERVISOR_REVIEW_STATUSES = EnumSet.of(
    CaseStatus.UNDER_SUPERVISOR_REVIEW,
    CaseStatus.NEEDS_REVISION_SUPERVISOR,
    CaseStatus.READY_TO_FORWARD
  );

  private static final List<AuditEventType> RECENT_ACTIVITY_TYPES = List.of(
    AuditEventType.REGISTRATION_SUBMITTED,
    AuditEventType.SUBMISSION_UPLOADED,
    AuditEventType.SUPERVISOR_FORWARDED_TO_LIBRARY
  );

  private final CaseSupervisorRepository caseSupervisors;
  private final PublicationRegistrationRepository registrations;
  private final SubmissionVersionRepository submissionVersions;
  private final AuditEventRepository auditEvents;
  private final StudentProfileRepository studentProfiles;

  public LecturerDashboardResponse build(User lecturer, Integer year) {
    List<PublicationCase> supervisedCases = filteredSupervisedCases(lecturer, year);
    Map<Long, PublicationRegistration> registrationByCaseId = supervisedCases.isEmpty()
      ? Map.of()
      : registrations.findByPublicationCaseIn(supervisedCases).stream()
        .collect(Collectors.toMap(r -> r.getPublicationCase().getId(), Function.identity()));

    long submissionReviewCount = supervisedCases.stream()
      .filter(c -> SUPERVISOR_REVIEW_STATUSES.contains(c.getStatus()))
      .count();
    long studentCount = supervisedCases.stream()
      .map(c -> c.getStudent().getId())
      .distinct()
      .count();

    return new LecturerDashboardResponse(
      DashboardWorkflowSupport.averageProgress(supervisedCases),
      supervisedCases.stream().filter(DashboardWorkflowSupport::isActiveCase).count(),
      DashboardWorkflowSupport.publishedStudentCount(supervisedCases),
      DashboardWorkflowSupport.totalStudentCount(supervisedCases),
      caseSupervisors.findPendingApprovalsForLecturer(lecturer.getId()).size(),
      submissionReviewCount,
      studentCount,
      DashboardWorkflowSupport.stageDistribution(supervisedCases),
      recentActivity(supervisedCases, registrationByCaseId)
    );
  }

  private List<PublicationCase> filteredSupervisedCases(User lecturer, Integer year) {
    List<PublicationCase> supervisedCases = caseSupervisors.findByLecturer(lecturer).stream()
      .map(CaseSupervisor::getPublicationCase)
      .collect(Collectors.collectingAndThen(
        Collectors.toMap(PublicationCase::getId, Function.identity(), (left, right) -> left, LinkedHashMap::new),
        map -> new ArrayList<>(map.values())
      ));

    Map<Long, PublicationRegistration> registrationByCaseId = supervisedCases.isEmpty()
      ? Map.of()
      : registrations.findByPublicationCaseIn(supervisedCases).stream()
        .collect(Collectors.toMap(r -> r.getPublicationCase().getId(), Function.identity()));

    return supervisedCases.stream()
      .filter(c -> {
        if (year == null) {
          return true;
        }
        PublicationRegistration registration = registrationByCaseId.get(c.getId());
        return registration != null && Objects.equals(registration.getYear(), year);
      })
      .sorted(DashboardWorkflowSupport.recentCaseComparator())
      .toList();
  }

  private List<DashboardActivityItemResponse> recentActivity(
    List<PublicationCase> supervisedCases,
    Map<Long, PublicationRegistration> registrationByCaseId
  ) {
    if (supervisedCases.isEmpty()) {
      return List.of();
    }

    Map<Long, PublicationCase> caseById = supervisedCases.stream()
      .collect(Collectors.toMap(PublicationCase::getId, Function.identity()));
    Map<Long, StudentProfile> profileByStudentId = studentProfiles.findByUserIdIn(
        supervisedCases.stream().map(c -> c.getStudent().getId()).distinct().toList()
      ).stream()
      .collect(Collectors.toMap(StudentProfile::getUserId, Function.identity()));

    return auditEvents.findTop20ByCaseIdInAndEventTypeInOrderByCreatedAtDesc(
        supervisedCases.stream().map(PublicationCase::getId).toList(),
        RECENT_ACTIVITY_TYPES
      ).stream()
      .map(event -> toActivity(event, caseById, registrationByCaseId, profileByStudentId))
      .filter(Objects::nonNull)
      .limit(6)
      .toList();
  }

  private DashboardActivityItemResponse toActivity(
    AuditEvent event,
    Map<Long, PublicationCase> caseById,
    Map<Long, PublicationRegistration> registrationByCaseId,
    Map<Long, StudentProfile> profileByStudentId
  ) {
    PublicationCase publicationCase = caseById.get(event.getCaseId());
    if (publicationCase == null) {
      return null;
    }

    PublicationRegistration registration = registrationByCaseId.get(publicationCase.getId());
    StudentProfile studentProfile = profileByStudentId.get(publicationCase.getStudent().getId());
    String studentName = studentProfile != null && studentProfile.getName() != null && !studentProfile.getName().isBlank()
      ? studentProfile.getName()
      : publicationCase.getStudent().getEmail();
    String title = registration != null && registration.getTitle() != null && !registration.getTitle().isBlank()
      ? registration.getTitle()
      : "Untitled Publication";

    return new DashboardActivityItemResponse(
      publicationCase.getId(),
      publicationCase.getStudent().getId(),
      title,
      studentName,
      describeLecturerActivity(event, publicationCase),
      event.getCreatedAt(),
      publicationCase.getStatus()
    );
  }

  private String describeLecturerActivity(AuditEvent event, PublicationCase publicationCase) {
    return switch (event.getEventType()) {
      case REGISTRATION_SUBMITTED -> "Registration submitted";
      case SUBMISSION_UPLOADED -> submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(publicationCase)
        .map(version -> version.getVersionNumber() != null && version.getVersionNumber() > 1
          ? "Revised submission uploaded"
          : "Submission uploaded")
        .orElse("Submission uploaded");
      case SUPERVISOR_FORWARDED_TO_LIBRARY -> "Forwarded to library";
      default -> event.getMessage() != null && !event.getMessage().isBlank() ? event.getMessage() : "Workflow updated";
    };
  }
}
