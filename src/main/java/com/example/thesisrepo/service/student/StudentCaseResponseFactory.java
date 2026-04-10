package com.example.thesisrepo.service.student;

import com.example.thesisrepo.profile.LecturerProfile;
import com.example.thesisrepo.profile.LecturerProfileRepository;
import com.example.thesisrepo.publication.CaseSupervisor;
import com.example.thesisrepo.publication.ChecklistItemV2;
import com.example.thesisrepo.publication.ChecklistResult;
import com.example.thesisrepo.publication.ClearanceForm;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.WorkflowComment;
import com.example.thesisrepo.service.SupervisorDirectoryService;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.AssignedSupervisorResponse;
import com.example.thesisrepo.web.dto.ChecklistResultResponse;
import com.example.thesisrepo.web.dto.ClearanceResponse;
import com.example.thesisrepo.web.dto.RegistrationDetailResponse;
import com.example.thesisrepo.web.dto.StudentCaseSummaryResponse;
import com.example.thesisrepo.web.dto.StudentSupervisorResponse;
import com.example.thesisrepo.web.dto.WorkflowCommentResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class StudentCaseResponseFactory {

  private final LecturerProfileRepository lecturerProfiles;

  public StudentCaseSummaryResponse toCaseSummary(PublicationCase publicationCase, PublicationRegistration registration) {
    return new StudentCaseSummaryResponse(
      publicationCase.getId(),
      publicationCase.getType(),
      publicationCase.getStatus(),
      registration != null ? registration.getTitle() : null,
      publicationCase.getUpdatedAt(),
      publicationCase.getCreatedAt()
    );
  }

  public StudentSupervisorResponse toSupervisorResponse(SupervisorDirectoryService.SupervisorDirectoryEntry supervisor) {
    return new StudentSupervisorResponse(
      supervisor.userId(),
      supervisor.email(),
      supervisor.name(),
      supervisor.faculty(),
      supervisor.studyProgram()
    );
  }

  public AssignedSupervisorResponse toAssignedSupervisor(CaseSupervisor supervisor) {
    User lecturer = supervisor.getLecturer();
    LecturerProfile profile = lecturerProfiles.findByUserId(lecturer.getId()).orElse(null);
    String name = profile != null && hasText(profile.getName())
      ? profile.getName()
      : lecturer.getEmail();
    return new AssignedSupervisorResponse(
      lecturer.getId(),
      lecturer.getEmail(),
      name
    );
  }

  public RegistrationDetailResponse toRegistrationDetail(PublicationRegistration registration) {
    if (registration == null) {
      return null;
    }
    return new RegistrationDetailResponse(
      registration.getId(),
      registration.getTitle(),
      registration.getYear(),
      registration.getArticlePublishIn(),
      registration.getFaculty(),
      registration.getStudentIdNumber(),
      registration.getAuthorName(),
      registration.getPermissionAcceptedAt(),
      registration.getSubmittedAt(),
      registration.getSupervisorDecisionAt(),
      registration.getSupervisorDecisionNote()
    );
  }

  public WorkflowCommentResponse toWorkflowCommentResponse(WorkflowComment comment) {
    String authorEmail = hasText(comment.getAuthorEmail())
      ? comment.getAuthorEmail()
      : (comment.getAuthor() != null ? comment.getAuthor().getEmail() : null);
    return new WorkflowCommentResponse(
      comment.getId(),
      comment.getSubmissionVersion() != null ? comment.getSubmissionVersion().getId() : null,
      comment.getAuthorRole(),
      authorEmail,
      comment.getBody(),
      comment.getCreatedAt()
    );
  }

  public ChecklistResultResponse toChecklistResultResponse(ChecklistResult result) {
    ChecklistItemV2 item = result.getChecklistItem();
    return new ChecklistResultResponse(
      result.getId(),
      new ChecklistResultResponse.ChecklistItemResponse(
        item.getId(),
        item.getSection(),
        item.getItemText(),
        item.getGuidanceText()
      ),
      result.getPassFail(),
      result.getNote()
    );
  }

  public ClearanceResponse toClearanceResponse(ClearanceForm clearance) {
    if (clearance == null) {
      return null;
    }
    return new ClearanceResponse(
      clearance.getId(),
      clearance.getStatus(),
      clearance.getNote(),
      clearance.getSubmittedAt(),
      clearance.getApprovedAt()
    );
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
