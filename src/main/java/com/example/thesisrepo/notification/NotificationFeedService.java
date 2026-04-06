package com.example.thesisrepo.notification;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.AuditEvent;
import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.CaseSupervisor;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.repo.AuditEventRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.NotificationItemResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationFeedService {

  private static final int DEFAULT_LIMIT = 8;
  private static final int MAX_LIMIT = 20;

  private static final List<AuditEventType> STUDENT_EVENT_TYPES = List.of(
    AuditEventType.SUPERVISOR_APPROVED_REGISTRATION,
    AuditEventType.SUPERVISOR_REJECTED_REGISTRATION,
    AuditEventType.LIBRARY_APPROVED_REGISTRATION,
    AuditEventType.LIBRARY_REJECTED_REGISTRATION,
    AuditEventType.SUPERVISOR_REQUESTED_REVISION,
    AuditEventType.LIBRARY_REQUESTED_REVISION,
    AuditEventType.LIBRARY_APPROVED_FOR_CLEARANCE,
    AuditEventType.CLEARANCE_CORRECTION_REQUESTED,
    AuditEventType.CLEARANCE_APPROVED,
    AuditEventType.UNPUBLISHED_FOR_CORRECTION,
    AuditEventType.PUBLISHED
  );

  private static final List<AuditEventType> LECTURER_EVENT_TYPES = List.of(
    AuditEventType.REGISTRATION_SUBMITTED,
    AuditEventType.SUBMISSION_UPLOADED,
    AuditEventType.LIBRARY_REQUESTED_REVISION,
    AuditEventType.LIBRARY_APPROVED_FOR_CLEARANCE,
    AuditEventType.PUBLISHED
  );

  private static final List<AuditEventType> ADMIN_EVENT_TYPES = List.of(
    AuditEventType.SUPERVISOR_APPROVED_REGISTRATION,
    AuditEventType.SUPERVISOR_FORWARDED_TO_LIBRARY,
    AuditEventType.SUBMISSION_UPLOADED,
    AuditEventType.CLEARANCE_SUBMITTED
  );

  private final PublicationCaseRepository cases;
  private final PublicationRegistrationRepository registrations;
  private final AuditEventRepository auditEvents;
  private final CaseSupervisorRepository caseSupervisors;
  private final StudentProfileRepository studentProfiles;

  public List<NotificationItemResponse> feed(User user, Integer requestedLimit) {
    if (user == null || user.getRole() == null) {
      return List.of();
    }

    int limit = normalizeLimit(requestedLimit);
    return switch (user.getRole()) {
      case STUDENT -> studentFeed(user, limit);
      case LECTURER -> lecturerFeed(user, limit);
      case ADMIN -> adminFeed(limit);
    };
  }

  private List<NotificationItemResponse> studentFeed(User student, int limit) {
    List<PublicationCase> publicationCases = cases.findByStudentOrderByUpdatedAtDesc(student);
    if (publicationCases.isEmpty()) {
      return List.of();
    }

    Map<Long, PublicationCase> caseById = toCaseMap(publicationCases);
    Map<Long, String> titleByCaseId = titlesByCaseId(publicationCases);

    return auditEvents.findTop50ByCaseIdInAndEventTypeInOrderByCreatedAtDesc(
        publicationCases.stream().map(PublicationCase::getId).toList(),
        STUDENT_EVENT_TYPES
      ).stream()
      .map(event -> toStudentNotification(event, caseById.get(event.getCaseId()), titleByCaseId.get(event.getCaseId())))
      .filter(Objects::nonNull)
      .limit(limit)
      .toList();
  }

  private List<NotificationItemResponse> lecturerFeed(User lecturer, int limit) {
    List<PublicationCase> publicationCases = caseSupervisors.findByLecturer(lecturer).stream()
      .map(CaseSupervisor::getPublicationCase)
      .collect(Collectors.collectingAndThen(
        Collectors.toMap(PublicationCase::getId, Function.identity(), (left, right) -> left, LinkedHashMap::new),
        map -> new ArrayList<>(map.values())
      ));
    if (publicationCases.isEmpty()) {
      return List.of();
    }

    Map<Long, PublicationCase> caseById = toCaseMap(publicationCases);
    Map<Long, String> titleByCaseId = titlesByCaseId(publicationCases);
    Map<Long, String> studentNameByCaseId = studentNamesByCaseId(publicationCases);

    return auditEvents.findTop50ByCaseIdInAndEventTypeInOrderByCreatedAtDesc(
        publicationCases.stream().map(PublicationCase::getId).toList(),
        LECTURER_EVENT_TYPES
      ).stream()
      .map(event -> toLecturerNotification(
        event,
        caseById.get(event.getCaseId()),
        titleByCaseId.get(event.getCaseId()),
        studentNameByCaseId.get(event.getCaseId())
      ))
      .filter(Objects::nonNull)
      .limit(limit)
      .toList();
  }

  private List<NotificationItemResponse> adminFeed(int limit) {
    List<AuditEvent> events = auditEvents.findTop50ByEventTypeInOrderByCreatedAtDesc(ADMIN_EVENT_TYPES);
    if (events.isEmpty()) {
      return List.of();
    }

    Set<Long> caseIds = events.stream()
      .map(AuditEvent::getCaseId)
      .filter(Objects::nonNull)
      .collect(Collectors.toCollection(LinkedHashSet::new));
    Map<Long, PublicationCase> caseById = toCaseMap(cases.findAllById(caseIds));
    List<PublicationCase> publicationCases = new ArrayList<>(caseById.values());
    Map<Long, String> titleByCaseId = titlesByCaseId(publicationCases);
    Map<Long, String> studentNameByCaseId = studentNamesByCaseId(publicationCases);

    return events.stream()
      .map(event -> toAdminNotification(
        event,
        caseById.get(event.getCaseId()),
        titleByCaseId.get(event.getCaseId()),
        studentNameByCaseId.get(event.getCaseId())
      ))
      .filter(Objects::nonNull)
      .limit(limit)
      .toList();
  }

  private NotificationItemResponse toStudentNotification(AuditEvent event, PublicationCase publicationCase, String caseTitle) {
    if (event == null || publicationCase == null) {
      return null;
    }

    String title = switch (event.getEventType()) {
      case SUPERVISOR_APPROVED_REGISTRATION -> "Registration approved by supervisor";
      case SUPERVISOR_REJECTED_REGISTRATION -> "Registration revision requested by supervisor";
      case LIBRARY_APPROVED_REGISTRATION -> "Registration verified by library";
      case LIBRARY_REJECTED_REGISTRATION -> "Registration revision requested by library";
      case SUPERVISOR_REQUESTED_REVISION -> "Supervisor requested a file revision";
      case LIBRARY_REQUESTED_REVISION -> "Library requested a file revision";
      case LIBRARY_APPROVED_FOR_CLEARANCE -> "Submission approved for clearance";
      case CLEARANCE_CORRECTION_REQUESTED -> "Clearance correction requested";
      case CLEARANCE_APPROVED -> "Clearance approved";
      case UNPUBLISHED_FOR_CORRECTION -> "Publication returned for correction";
      case PUBLISHED -> "Publication published";
      default -> null;
    };
    if (title == null) {
      return null;
    }

    return new NotificationItemResponse(
      publicationCase.getId(),
      event.getEventType(),
      title,
      combineDetail(caseTitle, event.getMessage()),
      event.getCreatedAt(),
      publicationCase.getStatus()
    );
  }

  private NotificationItemResponse toLecturerNotification(
    AuditEvent event,
    PublicationCase publicationCase,
    String caseTitle,
    String studentName
  ) {
    if (event == null || publicationCase == null) {
      return null;
    }

    String title = switch (event.getEventType()) {
      case REGISTRATION_SUBMITTED -> "New registration awaiting approval";
      case SUBMISSION_UPLOADED -> isResubmissionMessage(event.getMessage())
        ? "Student resubmitted a file"
        : "New submission uploaded";
      case LIBRARY_REQUESTED_REVISION -> "Library requested another revision";
      case LIBRARY_APPROVED_FOR_CLEARANCE -> "Library approved a submission";
      case PUBLISHED -> "Publication published";
      default -> null;
    };
    if (title == null) {
      return null;
    }

    return new NotificationItemResponse(
      publicationCase.getId(),
      event.getEventType(),
      title,
      combineDetail(joinWithSeparator(studentName, caseTitle), event.getMessage()),
      event.getCreatedAt(),
      publicationCase.getStatus()
    );
  }

  private NotificationItemResponse toAdminNotification(
    AuditEvent event,
    PublicationCase publicationCase,
    String caseTitle,
    String studentName
  ) {
    if (event == null || publicationCase == null) {
      return null;
    }

    String title = switch (event.getEventType()) {
      case SUPERVISOR_APPROVED_REGISTRATION -> "Registration ready for library verification";
      case SUPERVISOR_FORWARDED_TO_LIBRARY -> "Submission ready for library review";
      case SUBMISSION_UPLOADED -> isAdminRelevantUpload(publicationCase.getStatus())
        ? "Student uploaded a revision"
        : null;
      case CLEARANCE_SUBMITTED -> "Clearance form awaiting review";
      default -> null;
    };
    if (title == null) {
      return null;
    }

    return new NotificationItemResponse(
      publicationCase.getId(),
      event.getEventType(),
      title,
      combineDetail(joinWithSeparator(studentName, caseTitle), event.getMessage()),
      event.getCreatedAt(),
      publicationCase.getStatus()
    );
  }

  private Map<Long, PublicationCase> toCaseMap(Iterable<PublicationCase> publicationCases) {
    Map<Long, PublicationCase> caseById = new LinkedHashMap<>();
    publicationCases.forEach(publicationCase -> caseById.put(publicationCase.getId(), publicationCase));
    return caseById;
  }

  private Map<Long, String> titlesByCaseId(List<PublicationCase> publicationCases) {
    if (publicationCases.isEmpty()) {
      return Map.of();
    }

    Map<Long, String> titleByCaseId = registrations.findByPublicationCaseIn(publicationCases).stream()
      .filter(registration -> hasText(registration.getTitle()))
      .collect(Collectors.toMap(
        registration -> registration.getPublicationCase().getId(),
        PublicationRegistration::getTitle
      ));

    publicationCases.forEach(publicationCase ->
      titleByCaseId.putIfAbsent(publicationCase.getId(), "Untitled Publication")
    );
    return titleByCaseId;
  }

  private Map<Long, String> studentNamesByCaseId(List<PublicationCase> publicationCases) {
    if (publicationCases.isEmpty()) {
      return Map.of();
    }

    Map<Long, StudentProfile> profilesByUserId = studentProfiles.findByUserIdIn(
        publicationCases.stream()
          .map(publicationCase -> publicationCase.getStudent().getId())
          .distinct()
          .toList()
      ).stream()
      .collect(Collectors.toMap(StudentProfile::getUserId, Function.identity()));

    Map<Long, String> namesByCaseId = new LinkedHashMap<>();
    publicationCases.forEach(publicationCase -> {
      StudentProfile profile = profilesByUserId.get(publicationCase.getStudent().getId());
      String name = profile != null && hasText(profile.getName())
        ? profile.getName()
        : publicationCase.getStudent().getEmail();
      namesByCaseId.put(publicationCase.getId(), name);
    });
    return namesByCaseId;
  }

  private String combineDetail(String primary, String secondary) {
    return truncate(joinWithSeparator(primary, summarizeMessage(secondary)));
  }

  private String joinWithSeparator(String first, String second) {
    if (!hasText(first)) {
      return second;
    }
    if (!hasText(second)) {
      return first;
    }
    return first.trim() + " • " + second.trim();
  }

  private String summarizeMessage(String message) {
    if (!hasText(message)) {
      return null;
    }
    String trimmed = message.trim();
    return trimmed.length() <= 120 ? trimmed : trimmed.substring(0, 117) + "...";
  }

  private String truncate(String value) {
    if (!hasText(value)) {
      return "Workflow updated";
    }
    String trimmed = value.trim();
    return trimmed.length() <= 160 ? trimmed : trimmed.substring(0, 157) + "...";
  }

  private boolean isResubmissionMessage(String message) {
    if (!hasText(message)) {
      return false;
    }
    return !message.contains("submission v1 ");
  }

  private boolean isAdminRelevantUpload(CaseStatus status) {
    return status == CaseStatus.UNDER_LIBRARY_REVIEW
      || status == CaseStatus.NEEDS_REVISION_LIBRARY
      || status == CaseStatus.APPROVED_FOR_CLEARANCE
      || status == CaseStatus.CLEARANCE_SUBMITTED
      || status == CaseStatus.READY_TO_PUBLISH
      || status == CaseStatus.PUBLISHED;
  }

  private int normalizeLimit(Integer requestedLimit) {
    if (requestedLimit == null || requestedLimit < 1) {
      return DEFAULT_LIMIT;
    }
    return Math.min(requestedLimit, MAX_LIMIT);
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
