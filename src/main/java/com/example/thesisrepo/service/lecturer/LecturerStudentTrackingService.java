package com.example.thesisrepo.service.lecturer;

import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.LecturerApprovalQueueRowDto;
import com.example.thesisrepo.web.dto.LecturerStudentGroupDto;
import com.example.thesisrepo.web.dto.PagedResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LecturerStudentTrackingService {

  private final LecturerStudentQueryService queryService;

  public PagedResponse<LecturerApprovalQueueRowDto> approvalQueueDetail(User lecturer, int page, int size) {
    return queryService.approvalQueueDetail(lecturer, page, size);
  }

  public List<LecturerStudentGroupDto> pendingSupervisor(User lecturer, Integer year) {
    return queryService.pendingSupervisor(lecturer, year);
  }

  public List<LecturerStudentGroupDto> libraryTracking(User lecturer, Integer year) {
    return queryService.libraryTracking(lecturer, year);
  }

  public List<LecturerStudentGroupDto> myStudents(User lecturer, Integer year) {
    return queryService.myStudents(lecturer, year);
  }

  public ResponseEntity<Resource> downloadLatestSubmission(User lecturer, Long caseId) {
    return queryService.downloadLatestSubmission(lecturer, caseId);
  }

  public ResponseEntity<Resource> downloadSubmission(User lecturer, Long caseId, Long submissionId) {
    return queryService.downloadSubmission(lecturer, caseId, submissionId);
  }
}
