package com.example.thesisrepo.web.dto;

import java.util.List;

public record LecturerDashboardResponse(
  int supervisionProgressPercent,
  long activeSupervisedCaseCount,
  long registrationApprovalCount,
  long submissionReviewCount,
  long studentCount,
  List<DashboardStageCountResponse> stageDistribution,
  List<DashboardActivityItemResponse> recentActivity
) {
}
