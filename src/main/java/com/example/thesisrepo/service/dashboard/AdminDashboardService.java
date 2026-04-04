package com.example.thesisrepo.service.dashboard;

import com.example.thesisrepo.publication.*;
import com.example.thesisrepo.publication.repo.AuditEventRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.web.dto.AdminDashboardResponse;
import com.example.thesisrepo.web.dto.DashboardActionItemResponse;
import com.example.thesisrepo.web.dto.DashboardActivityItemResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminDashboardService {

  private static final Set<CaseStatus> REGISTRATION_QUEUE_STATUSES = EnumSet.of(CaseStatus.REGISTRATION_APPROVED);
  private static final Set<CaseStatus> REVIEW_QUEUE_STATUSES = EnumSet.of(
    CaseStatus.FORWARDED_TO_LIBRARY,
    CaseStatus.UNDER_LIBRARY_REVIEW,
    CaseStatus.NEEDS_REVISION_LIBRARY
  );
  private static final Set<CaseStatus> CLEARANCE_QUEUE_STATUSES = EnumSet.of(CaseStatus.CLEARANCE_SUBMITTED);
  private static final Set<CaseStatus> PUBLISH_QUEUE_STATUSES = EnumSet.of(CaseStatus.READY_TO_PUBLISH);
  private static final Set<CaseStatus> ACTIONABLE_STATUSES = EnumSet.of(
    CaseStatus.REGISTRATION_APPROVED,
    CaseStatus.FORWARDED_TO_LIBRARY,
    CaseStatus.UNDER_LIBRARY_REVIEW,
    CaseStatus.NEEDS_REVISION_LIBRARY,
    CaseStatus.CLEARANCE_SUBMITTED,
    CaseStatus.READY_TO_PUBLISH
  );
  private static final List<AuditEventType> RECENT_ACTIVITY_TYPES = List.of(
    AuditEventType.LIBRARY_APPROVED_REGISTRATION,
    AuditEventType.LIBRARY_CHECKLIST_REVIEWED,
    AuditEventType.CLEARANCE_APPROVED,
    AuditEventType.PUBLISHED
  );

  private final PublicationCaseRepository cases;
  private final PublicationRegistrationRepository registrations;
  private final AuditEventRepository auditEvents;

  public AdminDashboardResponse build() {
    List<PublicationCase> allCases = cases.findAll(
      Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id"))
    );
    Map<Long, PublicationCase> caseById = allCases.stream()
      .collect(Collectors.toMap(PublicationCase::getId, Function.identity()));

    return new AdminDashboardResponse(
      DashboardWorkflowSupport.averageProgress(allCases),
      allCases.stream().filter(DashboardWorkflowSupport::isActiveCase).count(),
      DashboardWorkflowSupport.publishedStudentCount(allCases),
      DashboardWorkflowSupport.totalStudentCount(allCases),
      countByStatuses(allCases, REGISTRATION_QUEUE_STATUSES),
      countByStatuses(allCases, REVIEW_QUEUE_STATUSES),
      countByStatuses(allCases, CLEARANCE_QUEUE_STATUSES),
      countByStatuses(allCases, PUBLISH_QUEUE_STATUSES),
      needsActionNow(allCases),
      DashboardWorkflowSupport.stageDistribution(allCases),
      recentActivity(caseById)
    );
  }

  private long countByStatuses(List<PublicationCase> allCases, Set<CaseStatus> statuses) {
    return allCases.stream().filter(c -> statuses.contains(c.getStatus())).count();
  }

  private List<DashboardActionItemResponse> needsActionNow(List<PublicationCase> allCases) {
    List<PublicationCase> items = allCases.stream()
      .filter(c -> ACTIONABLE_STATUSES.contains(c.getStatus()))
      .sorted(
        Comparator.comparingInt((PublicationCase c) -> DashboardWorkflowSupport.adminQueuePriority(c.getStatus()))
          .thenComparing(PublicationCase::getUpdatedAt, DashboardWorkflowSupport.recentInstantComparator())
          .thenComparing(PublicationCase::getId, Comparator.nullsLast(Comparator.reverseOrder()))
      )
      .limit(6)
      .toList();

    Map<Long, String> titleByCaseId = titleByCaseId(items);
    return items.stream()
      .map(publicationCase -> new DashboardActionItemResponse(
        publicationCase.getId(),
        titleByCaseId.getOrDefault(publicationCase.getId(), "Untitled Publication"),
        publicationCase.getStatus(),
        queueKey(publicationCase.getStatus()),
        queueLabel(publicationCase.getStatus()),
        queueDetail(publicationCase.getStatus()),
        publicationCase.getUpdatedAt()
      ))
      .toList();
  }

  private List<DashboardActivityItemResponse> recentActivity(Map<Long, PublicationCase> caseById) {
    if (caseById.isEmpty()) {
      return List.of();
    }

    Set<Long> caseIds = new LinkedHashSet<>();
    List<DashboardActivityItemResponse> items = auditEvents.findTop20ByEventTypeInOrderByCreatedAtDesc(RECENT_ACTIVITY_TYPES).stream()
      .map(event -> {
        PublicationCase publicationCase = caseById.get(event.getCaseId());
        if (publicationCase == null) {
          return null;
        }
        caseIds.add(publicationCase.getId());
        return event;
      })
      .filter(Objects::nonNull)
      .limit(10)
      .toList()
      .stream()
      .map(event -> toActivity(event, caseById))
      .filter(Objects::nonNull)
      .limit(6)
      .toList();

    if (items.isEmpty()) {
      return List.of();
    }

    Map<Long, String> titleByCaseId = titleByCaseId(
      caseIds.stream().map(caseById::get).filter(Objects::nonNull).toList()
    );

    return items.stream()
      .map(item -> new DashboardActivityItemResponse(
        item.caseId(),
        item.studentUserId(),
        titleByCaseId.getOrDefault(item.caseId(), item.title()),
        item.subtitle(),
        item.detail(),
        item.occurredAt(),
        item.status()
      ))
      .toList();
  }

  private DashboardActivityItemResponse toActivity(AuditEvent event, Map<Long, PublicationCase> caseById) {
    PublicationCase publicationCase = caseById.get(event.getCaseId());
    if (publicationCase == null) {
      return null;
    }

    return new DashboardActivityItemResponse(
      publicationCase.getId(),
      publicationCase.getStudent() != null ? publicationCase.getStudent().getId() : null,
      "Untitled Publication",
      null,
      describeAdminActivity(event.getEventType()),
      event.getCreatedAt(),
      publicationCase.getStatus()
    );
  }

  private Map<Long, String> titleByCaseId(List<PublicationCase> publicationCases) {
    if (publicationCases.isEmpty()) {
      return Map.of();
    }
    return registrations.findByPublicationCaseIn(publicationCases).stream()
      .collect(Collectors.toMap(
        registration -> registration.getPublicationCase().getId(),
        PublicationRegistration::getTitle
      ));
  }

  private String describeAdminActivity(AuditEventType eventType) {
    return switch (eventType) {
      case LIBRARY_APPROVED_REGISTRATION -> "Registration verified";
      case LIBRARY_CHECKLIST_REVIEWED -> "Checklist review completed";
      case CLEARANCE_APPROVED -> "Clearance approved";
      case PUBLISHED -> "Publication published";
      default -> "Workflow updated";
    };
  }

  private String queueKey(CaseStatus status) {
    return switch (status) {
      case REGISTRATION_APPROVED -> "registration";
      case FORWARDED_TO_LIBRARY, UNDER_LIBRARY_REVIEW, NEEDS_REVISION_LIBRARY -> "review";
      case CLEARANCE_SUBMITTED -> "clearance";
      case READY_TO_PUBLISH -> "publishing";
      default -> "review";
    };
  }

  private String queueLabel(CaseStatus status) {
    return switch (status) {
      case REGISTRATION_APPROVED -> "Registration Queue";
      case FORWARDED_TO_LIBRARY, UNDER_LIBRARY_REVIEW, NEEDS_REVISION_LIBRARY -> "Submission Review Queue";
      case CLEARANCE_SUBMITTED -> "Clearance Queue";
      case READY_TO_PUBLISH -> "Publishing Queue";
      default -> "Submission Review Queue";
    };
  }

  private String queueDetail(CaseStatus status) {
    return switch (status) {
      case REGISTRATION_APPROVED -> "Pending registration verification";
      case FORWARDED_TO_LIBRARY, UNDER_LIBRARY_REVIEW, NEEDS_REVISION_LIBRARY -> "Awaiting library checklist review";
      case CLEARANCE_SUBMITTED -> "Submitted clearance form awaiting review";
      case READY_TO_PUBLISH -> "Ready for repository release";
      default -> "Awaiting workflow action";
    };
  }
}
