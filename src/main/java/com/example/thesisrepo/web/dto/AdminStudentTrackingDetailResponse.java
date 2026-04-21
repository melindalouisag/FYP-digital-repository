package com.example.thesisrepo.web.dto;

import java.util.List;

public record AdminStudentTrackingDetailResponse(
  Long studentUserId,
  String studentName,
  String studentIdNumber,
  String faculty,
  String program,
  List<AdminCaseQueueDto> cases,
  Long selectedCaseId,
  AdminCaseDetailResponse selectedCase
) {
}
