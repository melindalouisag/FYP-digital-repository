package com.example.thesisrepo.web.dto;

import java.util.List;

public record LecturerDashboardResponse(
  int supervisionProgressPercent,
  long activeSupervisedCaseCount,
  long publishedStudentCount,
  long totalStudentCount,
  long registrationApprovalCount,
  long submissionReviewCount,
  long studentCount,
  List<DashboardStageCountResponse> stageDistribution,
  List<DashboardActivityItemResponse> recentActivity
) {
}
