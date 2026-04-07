package com.example.thesisrepo.service.dashboard;

import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.web.dto.DashboardStageCountResponse;

import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DashboardWorkflowSupport {

  private static final Map<CaseStatus, Integer> PROGRESS_BY_STATUS = Map.ofEntries(
    Map.entry(CaseStatus.REGISTRATION_DRAFT, 10),
    Map.entry(CaseStatus.REGISTRATION_PENDING, 20),
    Map.entry(CaseStatus.REGISTRATION_APPROVED, 30),
    Map.entry(CaseStatus.REGISTRATION_VERIFIED, 40),
    Map.entry(CaseStatus.UNDER_SUPERVISOR_REVIEW, 55),
    Map.entry(CaseStatus.NEEDS_REVISION_SUPERVISOR, 55),
    Map.entry(CaseStatus.READY_TO_FORWARD, 65),
    Map.entry(CaseStatus.FORWARDED_TO_LIBRARY, 70),
    Map.entry(CaseStatus.UNDER_LIBRARY_REVIEW, 75),
    Map.entry(CaseStatus.NEEDS_REVISION_LIBRARY, 75),
    Map.entry(CaseStatus.APPROVED_FOR_CLEARANCE, 85),
    Map.entry(CaseStatus.CLEARANCE_SUBMITTED, 90),
    Map.entry(CaseStatus.CLEARANCE_APPROVED, 95),
    Map.entry(CaseStatus.READY_TO_PUBLISH, 98),
    Map.entry(CaseStatus.PUBLISHED, 100),
    Map.entry(CaseStatus.REJECTED, 15)
  );

  private DashboardWorkflowSupport() {
  }

  public static int averageProgress(Collection<PublicationCase> cases) {
    List<PublicationCase> activeCases = cases.stream()
      .filter(DashboardWorkflowSupport::isActiveCase)
      .toList();
    if (activeCases.isEmpty()) {
      return 0;
    }
    double average = activeCases.stream()
      .mapToInt(c -> progressPercent(c.getStatus()))
      .average()
      .orElse(0);
    return (int) Math.round(average);
  }

  public static boolean isActiveCase(PublicationCase publicationCase) {
    return publicationCase != null && isActiveStatus(publicationCase.getStatus());
  }

  public static boolean isActiveStatus(CaseStatus status) {
    return status != CaseStatus.PUBLISHED;
  }

  public static int progressPercent(CaseStatus status) {
    return PROGRESS_BY_STATUS.getOrDefault(status, 0);
  }

  public static List<DashboardStageCountResponse> stageDistribution(Collection<PublicationCase> cases) {
    long registration = cases.stream().filter(c -> stageBucket(c.getStatus()) == StageBucket.REGISTRATION).count();
    long supervisor = cases.stream().filter(c -> stageBucket(c.getStatus()) == StageBucket.SUPERVISOR_REVIEW).count();
    long library = cases.stream().filter(c -> stageBucket(c.getStatus()) == StageBucket.LIBRARY_REVIEW).count();
    long clearance = cases.stream().filter(c -> stageBucket(c.getStatus()) == StageBucket.CLEARANCE).count();
    long published = cases.stream().filter(c -> stageBucket(c.getStatus()) == StageBucket.PUBLISHED).count();
    return List.of(
      new DashboardStageCountResponse("Registration", registration),
      new DashboardStageCountResponse("Supervisor Review", supervisor),
      new DashboardStageCountResponse("Library Review", library),
      new DashboardStageCountResponse("Clearance", clearance),
      new DashboardStageCountResponse("Published", published)
    );
  }

  public static long totalStudentCount(Collection<PublicationCase> cases) {
    return cases.stream()
      .map(PublicationCase::getStudent)
      .filter(Objects::nonNull)
      .map(student -> student.getId())
      .filter(Objects::nonNull)
      .distinct()
      .count();
  }

  public static long publishedStudentCount(Collection<PublicationCase> cases) {
    return cases.stream()
      .filter(c -> c.getStatus() == CaseStatus.PUBLISHED)
      .map(PublicationCase::getStudent)
      .filter(Objects::nonNull)
      .map(student -> student.getId())
      .filter(Objects::nonNull)
      .distinct()
      .count();
  }

  public static int adminQueuePriority(CaseStatus status) {
    return switch (status) {
      case READY_TO_PUBLISH -> 0;
      case CLEARANCE_SUBMITTED -> 1;
      case NEEDS_REVISION_LIBRARY -> 2;
      case UNDER_LIBRARY_REVIEW -> 3;
      case FORWARDED_TO_LIBRARY -> 4;
      case REGISTRATION_APPROVED -> 5;
      default -> 99;
    };
  }

  public static Comparator<PublicationCase> recentCaseComparator() {
    return Comparator
      .comparing(PublicationCase::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
      .thenComparing(PublicationCase::getId, Comparator.nullsLast(Comparator.reverseOrder()));
  }

  public static Comparator<Instant> recentInstantComparator() {
    return Comparator.nullsLast(Comparator.reverseOrder());
  }

  private static StageBucket stageBucket(CaseStatus status) {
    return switch (status) {
      case REGISTRATION_DRAFT, REGISTRATION_PENDING, REGISTRATION_APPROVED, REGISTRATION_VERIFIED, REJECTED -> StageBucket.REGISTRATION;
      case UNDER_SUPERVISOR_REVIEW, NEEDS_REVISION_SUPERVISOR, READY_TO_FORWARD -> StageBucket.SUPERVISOR_REVIEW;
      case FORWARDED_TO_LIBRARY, UNDER_LIBRARY_REVIEW, NEEDS_REVISION_LIBRARY -> StageBucket.LIBRARY_REVIEW;
      case APPROVED_FOR_CLEARANCE, CLEARANCE_SUBMITTED, CLEARANCE_APPROVED, READY_TO_PUBLISH -> StageBucket.CLEARANCE;
      case PUBLISHED -> StageBucket.PUBLISHED;
    };
  }

  private enum StageBucket {
    REGISTRATION,
    SUPERVISOR_REVIEW,
    LIBRARY_REVIEW,
    CLEARANCE,
    PUBLISHED
  }
}
