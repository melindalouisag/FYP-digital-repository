package com.example.thesisrepo.service;

import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.service.libraryreview.LibraryChecklistService;
import com.example.thesisrepo.service.libraryreview.LibraryReviewDecisionService;
import com.example.thesisrepo.service.libraryreview.LibraryReviewReadService;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.AdminCaseDetailResponse;
import com.example.thesisrepo.web.dto.AdminStudentGroupDto;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import com.example.thesisrepo.web.dto.OperationResultResponse;
import com.example.thesisrepo.web.dto.PagedResponse;
import com.example.thesisrepo.web.dto.StudentCaseSummaryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LibraryReviewService {

  private final LibraryReviewReadService libraryReviewReadService;
  private final LibraryChecklistService libraryChecklistService;
  private final LibraryReviewDecisionService libraryReviewDecisionService;

  public PagedResponse<StudentCaseSummaryResponse> reviewQueue(Pageable pageable, CaseStatus status, PublicationType type) {
    return libraryReviewReadService.reviewQueue(pageable, status, type);
  }

  public List<AdminStudentGroupDto> reviewQueueGrouped() {
    return libraryReviewReadService.reviewQueueGrouped();
  }

  public AdminCaseDetailResponse caseDetail(Long caseId) {
    return libraryReviewReadService.caseDetail(caseId);
  }

  public OperationResultResponse saveChecklistResults(User admin, Long caseId, SaveChecklistResultsCommand command) {
    return libraryChecklistService.saveChecklistResults(admin, caseId, command);
  }

  public CaseStatusResponse requestRevision(User admin, Long caseId, String reason) {
    return libraryReviewDecisionService.requestRevision(admin, caseId, reason);
  }

  public CaseStatusResponse approveCase(User admin, Long caseId) {
    return libraryReviewDecisionService.approveCase(admin, caseId);
  }

  public CaseStatusResponse rejectCase(User admin, Long caseId, String reason) {
    return libraryReviewDecisionService.rejectCase(admin, caseId, reason);
  }

  public record SaveChecklistResultsCommand(
    Long submissionVersionId,
    List<ChecklistEntryCommand> results
  ) {
    public SaveChecklistResultsCommand {
      results = results == null ? List.of() : List.copyOf(results);
    }
  }

  public record ChecklistEntryCommand(
    Long checklistItemId,
    boolean pass,
    String note
  ) {
  }
}
