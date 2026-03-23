package com.example.thesisrepo.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record StudentCaseDetailResponse(
  @JsonProperty("case") StudentCaseSummaryResponse caseSummary,
  RegistrationDetailResponse registration,
  List<AssignedSupervisorResponse> supervisors,
  List<SubmissionSummaryResponse> versions,
  List<WorkflowCommentResponse> comments,
  ClearanceResponse clearance,
  List<TimelineItemDto> timeline
) {
}
