package com.example.thesisrepo.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AdminCaseDetailResponse(
  @JsonProperty("case") StudentCaseSummaryResponse caseSummary,
  RegistrationDetailResponse registration,
  List<SubmissionDetailResponse> submissions,
  List<WorkflowCommentResponse> comments,
  ClearanceResponse clearance,
  List<TimelineItemDto> timeline
) {
}
