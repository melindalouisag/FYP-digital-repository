package com.example.thesisrepo.notification;

import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseSupervisor;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.SubmissionVersionRepository;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class WorkflowNotificationService {

  private final NotificationService notificationService;
  private final PublicationCaseRepository cases;
  private final SubmissionVersionRepository submissionVersions;
  private final CaseSupervisorRepository caseSupervisors;
  private final UserRepository users;

  public void notifyByAuditEvent(Long caseId, Long submissionVersionId, AuditEventType eventType, String actorEmail) {
    if (caseId == null || eventType == null) {
      return;
    }

    PublicationCase c = cases.findById(caseId).orElse(null);
    if (c == null) {
      return;
    }
    String studentEmail = normalizeEmail(c.getStudent() != null ? c.getStudent().getEmail() : null);
    String lecturerEmail = normalizeEmail(actorEmail);

    switch (eventType) {
      case REGISTRATION_SUBMITTED -> {
        notifyStudent(c, NotificationEvent.REGISTRATION_SUBMITTED, studentEmail, lecturerEmail);
        notifyLecturers(c, NotificationEvent.LECTURER_SELECTED_SUPERVISOR, studentEmail, lecturerEmail);
        notifyAdmins(NotificationEvent.ADMIN_NEW_REGISTRATION, studentEmail, lecturerEmail);
      }
      case SUPERVISOR_APPROVED_REGISTRATION ->
        notifyStudent(c, NotificationEvent.SUPERVISOR_APPROVED_REGISTRATION, studentEmail, lecturerEmail);
      case SUPERVISOR_REJECTED_REGISTRATION ->
        notifyStudent(c, NotificationEvent.SUPERVISOR_FEEDBACK, studentEmail, lecturerEmail);
      case LIBRARY_APPROVED_REGISTRATION ->
        notifyStudent(c, NotificationEvent.LIBRARY_APPROVED_REGISTRATION, studentEmail, lecturerEmail);
      case LIBRARY_REJECTED_REGISTRATION ->
        notifyStudent(c, NotificationEvent.LIBRARY_FEEDBACK, studentEmail, lecturerEmail);
      case SUBMISSION_UPLOADED -> {
        notifyStudent(c, NotificationEvent.SUBMISSION_UPLOADED, studentEmail, lecturerEmail);
        notifyLecturers(c, NotificationEvent.LECTURER_NEW_SUBMISSION, studentEmail, lecturerEmail);
        if (isResubmission(submissionVersionId)) {
          notifyAdmins(NotificationEvent.ADMIN_RESUBMISSION, studentEmail, lecturerEmail);
        }
      }
      case SUPERVISOR_REQUESTED_REVISION ->
        notifyStudent(c, NotificationEvent.SUPERVISOR_FEEDBACK, studentEmail, lecturerEmail);
      case SUPERVISOR_MARKED_READY ->
        notifyStudent(c, NotificationEvent.SUPERVISOR_APPROVED_SUBMISSION, studentEmail, lecturerEmail);
      case SUPERVISOR_FORWARDED_TO_LIBRARY -> {
        notifyStudent(c, NotificationEvent.SUPERVISOR_APPROVED_SUBMISSION, studentEmail, lecturerEmail);
        notifyAdmins(NotificationEvent.ADMIN_SUPERVISOR_FORWARD, studentEmail, lecturerEmail);
      }
      case LIBRARY_REQUESTED_REVISION, LIBRARY_REJECTED, UNPUBLISHED_FOR_CORRECTION, CLEARANCE_CORRECTION_REQUESTED ->
        notifyStudent(c, NotificationEvent.LIBRARY_FEEDBACK, studentEmail, lecturerEmail);
      case LIBRARY_APPROVED_FOR_CLEARANCE -> {
        notifyStudent(c, NotificationEvent.LIBRARY_APPROVED_SUBMISSION, studentEmail, lecturerEmail);
        notifyLecturers(c, NotificationEvent.LECTURER_LIBRARY_APPROVAL, studentEmail, lecturerEmail);
      }
      case CLEARANCE_SUBMITTED ->
        notifyAdmins(NotificationEvent.ADMIN_CLEARANCE_SIGNED, studentEmail, lecturerEmail);
      case CLEARANCE_APPROVED ->
        notifyStudent(c, NotificationEvent.CLEARANCE_APPROVED, studentEmail, lecturerEmail);
      default -> {
        // No notification mapping for this audit event.
      }
    }
  }

  private boolean isResubmission(Long submissionVersionId) {
    if (submissionVersionId == null) {
      return false;
    }
    return submissionVersions.findById(submissionVersionId)
      .map(SubmissionVersion::getVersionNumber)
      .map(version -> version != null && version > 1)
      .orElse(false);
  }

  private void notifyStudent(PublicationCase c, NotificationEvent event, String studentEmail, String lecturerEmail) {
    String email = c.getStudent() != null ? c.getStudent().getEmail() : null;
    notificationService.notify(event, normalizeEmail(email), studentEmail, lecturerEmail);
  }

  private void notifyLecturers(PublicationCase c, NotificationEvent event, String studentEmail, String lecturerEmail) {
    List<String> emails = caseSupervisors.findByPublicationCase(c).stream()
      .map(CaseSupervisor::getLecturer)
      .filter(lecturer -> lecturer != null && lecturer.getEmail() != null)
      .map(lecturer -> normalizeEmail(lecturer.getEmail()))
      .filter(email -> !email.isBlank())
      .distinct()
      .toList();

    emails.forEach(email -> notificationService.notify(event, email, studentEmail, lecturerEmail));
  }

  private void notifyAdmins(NotificationEvent event, String studentEmail, String lecturerEmail) {
    List<String> emails = users.findByRole(Role.ADMIN).stream()
      .map(admin -> normalizeEmail(admin.getEmail()))
      .filter(email -> !email.isBlank())
      .distinct()
      .toList();

    emails.forEach(email -> notificationService.notify(event, email, studentEmail, lecturerEmail));
  }

  private String normalizeEmail(String email) {
    return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
  }
}
