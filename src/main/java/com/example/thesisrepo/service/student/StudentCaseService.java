package com.example.thesisrepo.service.student;

import java.util.List;

import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import com.example.thesisrepo.web.dto.ChecklistResultResponse;
import com.example.thesisrepo.web.dto.PagedResponse;
import com.example.thesisrepo.web.dto.StudentCaseDetailResponse;
import com.example.thesisrepo.web.dto.StudentCaseSummaryResponse;
import com.example.thesisrepo.web.dto.StudentSupervisorResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class StudentCaseService {

  private final StudentCaseReadService readService;
  private final StudentCaseCommandService commandService;

  public PagedResponse<StudentCaseSummaryResponse> listCases(User student, int page, int size) {
    return readService.listCases(student, page, size);
  }

  public List<StudentSupervisorResponse> listSupervisors(User student) {
    return readService.listSupervisors(student);
  }

  public StudentCaseDetailResponse caseDetail(User student, Long caseId) {
    return readService.caseDetail(student, caseId);
  }

  public ResponseEntity<Resource> downloadSubmission(User student, Long caseId, Long submissionId) {
    return readService.downloadSubmission(student, caseId, submissionId);
  }

  public List<ChecklistResultResponse> checklistResults(User student, Long caseId) {
    return readService.checklistResults(student, caseId);
  }

  public CaseStatusResponse submitClearance(User student, Long caseId, String note) {
    return commandService.submitClearance(student, caseId, note);
  }
}
