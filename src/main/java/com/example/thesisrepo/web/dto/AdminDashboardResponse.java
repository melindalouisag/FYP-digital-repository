package com.example.thesisrepo.web.dto;

import java.util.List;

public record AdminDashboardResponse(
  int workflowProgressPercent,
  long activeCaseCount,
  long publishedStudentCount,
  long totalStudentCount,
  long registrationQueueCount,
  long submissionReviewQueueCount,
  long clearanceQueueCount,
  long publishingQueueCount,
  List<DashboardActionItemResponse> needsActionNow,
  List<DashboardStageCountResponse> stageDistribution,
  List<DashboardActivityItemResponse> recentActivity
) {
}
