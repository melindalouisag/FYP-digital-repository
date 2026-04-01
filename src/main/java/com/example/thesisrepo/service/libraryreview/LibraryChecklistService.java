package com.example.thesisrepo.service.libraryreview;

import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.ChecklistItemV2;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.ReviewOutcome;
import com.example.thesisrepo.publication.SubmissionStatus;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.repo.ChecklistItemV2Repository;
import com.example.thesisrepo.publication.repo.ChecklistResultRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.SubmissionVersionRepository;
import com.example.thesisrepo.service.LibraryReviewService.ChecklistEntryCommand;
import com.example.thesisrepo.service.LibraryReviewService.SaveChecklistResultsCommand;
import com.example.thesisrepo.service.workflow.AuditEventService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.OperationResultResponse;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
@RequiredArgsConstructor
public class LibraryChecklistService {

  private final PublicationCaseRepository cases;
  private final SubmissionVersionRepository submissionVersions;
  private final ChecklistItemV2Repository checklistItems;
  private final ChecklistResultRepository checklistResults;
  private final PublicationWorkflowGateService workflowGates;
  private final AuditEventService auditEvents;
  private final EntityManager entityManager;

  @Transactional
  public OperationResultResponse saveChecklistResults(User admin, Long caseId, SaveChecklistResultsCommand command) {
    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    workflowGates.ensureAdminCanSaveChecklist(publicationCase);

    SubmissionVersion version = submissionVersions.findById(command.submissionVersionId())
      .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Submission version not found"));
    workflowGates.ensureSubmissionBelongsToCase(version, publicationCase);

    Long templateId = version.getChecklistTemplate() != null ? version.getChecklistTemplate().getId() : null;
    checklistResults.deleteBySubmissionVersion(version);

    for (ChecklistEntryCommand entry : command.results()) {
      ChecklistItemV2 item = checklistItems.findById(entry.checklistItemId())
        .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Checklist item not found"));
      if (templateId != null && !item.getTemplate().getId().equals(templateId)) {
        throw new ResponseStatusException(BAD_REQUEST, "Checklist item does not belong to this submission template version");
      }

      checklistResults.save(com.example.thesisrepo.publication.ChecklistResult.builder()
        .submissionVersion(version)
        .checklistItem(item)
        .passFail(entry.pass() ? ReviewOutcome.PASS : ReviewOutcome.FAIL)
        .note(entry.note())
        .build());
    }

    version.setStatus(SubmissionStatus.UNDER_REVIEW);
    submissionVersions.save(version);
    publicationCase.setStatus(CaseStatus.UNDER_LIBRARY_REVIEW);
    cases.save(publicationCase);

    auditEvents.log(
      publicationCase.getId(),
      version.getId(),
      admin,
      Role.ADMIN,
      AuditEventType.LIBRARY_CHECKLIST_REVIEWED,
      "Checklist results saved for submission v" + version.getVersionNumber()
    );

    entityManager.flush();
    return new OperationResultResponse(true);
  }
}
