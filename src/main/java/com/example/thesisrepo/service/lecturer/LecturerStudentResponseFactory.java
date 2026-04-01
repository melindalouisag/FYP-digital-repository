package com.example.thesisrepo.service.lecturer;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.LecturerApprovalQueueRowDto;
import com.example.thesisrepo.web.dto.LecturerCaseWorkItemDto;
import com.example.thesisrepo.web.dto.LecturerStudentGroupDto;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
public class LecturerStudentResponseFactory {

  public LecturerApprovalQueueRowDto toApprovalQueueRow(PublicationRegistration registration, StudentProfile profile) {
    PublicationCase publicationCase = registration.getPublicationCase();
    return new LecturerApprovalQueueRowDto(
      publicationCase.getId(),
      publicationCase.getType(),
      publicationCase.getStatus(),
      publicationCase.getUpdatedAt(),
      publicationCase.getStudent().getId(),
      publicationCase.getStudent().getEmail(),
      profile != null && hasText(profile.getName()) ? profile.getName() : publicationCase.getStudent().getEmail(),
      profile != null ? profile.getStudentId() : null,
      profile != null ? profile.getFaculty() : null,
      profile != null ? profile.getProgram() : null,
      registration.getTitle(),
      registration.getYear(),
      registration.getSubmittedAt()
    );
  }

  public LecturerCaseWorkItemDto toCaseWorkItem(
    PublicationCase publicationCase,
    PublicationRegistration registration,
    Instant latestSubmissionAt,
    Instant lastLecturerFeedbackAt,
    Instant lecturerForwardedAt,
    Instant lastLibraryFeedbackAt,
    Instant libraryApprovedAt
  ) {
    return new LecturerCaseWorkItemDto(
      publicationCase.getId(),
      publicationCase.getType(),
      publicationCase.getStatus(),
      publicationCase.getUpdatedAt(),
      registration != null ? registration.getTitle() : null,
      registration != null ? registration.getYear() : null,
      latestSubmissionAt,
      lastLecturerFeedbackAt,
      lecturerForwardedAt,
      lastLibraryFeedbackAt,
      libraryApprovedAt
    );
  }

  public LecturerStudentGroupDto toStudentGroup(User student, StudentProfile profile, List<LecturerCaseWorkItemDto> items) {
    return new LecturerStudentGroupDto(
      student.getId(),
      student.getEmail(),
      profile != null && hasText(profile.getName()) ? profile.getName() : student.getEmail(),
      profile != null ? profile.getStudentId() : null,
      profile != null ? profile.getFaculty() : null,
      profile != null ? profile.getProgram() : null,
      items
    );
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
