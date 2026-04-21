package com.example.thesisrepo.web.dto;

import java.util.List;

public record AdminStudentTrackingGroupDto(
  Long studentUserId,
  String studentName,
  String studentIdNumber,
  String faculty,
  String program,
  List<AdminCaseQueueDto> cases
) {
}
