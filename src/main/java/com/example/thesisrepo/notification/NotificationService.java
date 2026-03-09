package com.example.thesisrepo.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

  @Qualifier("notificationEmailService")
  private final EmailService emailService;

  public void notify(NotificationEvent event, String email) {
    notify(event, email, null, null);
  }

  public void notify(NotificationEvent event, String email, String studentEmail, String lecturerEmail) {
    if (event == null || email == null || email.isBlank()) {
      return;
    }

    String subject;
    String message;

    switch (event) {
      case ACCOUNT_CREATED -> {
        subject = "Account Created";
        message = "Your account has been successfully created.";
      }
      case REGISTRATION_SUBMITTED -> {
        subject = "Registration Submitted";
        message = "Your publication registration has been submitted.";
      }
      case SUPERVISOR_APPROVED_REGISTRATION -> {
        subject = "Supervisor Approval";
        message = "Your registration was approved by your supervisor.";
      }
      case LIBRARY_APPROVED_REGISTRATION -> {
        subject = "Registration Approved";
        message = "Your registration has been approved by the library.";
      }
      case SUBMISSION_UPLOADED -> {
        subject = "Submission Uploaded";
        message = "Your submission has been uploaded successfully.";
      }
      case SUPERVISOR_FEEDBACK -> {
        subject = "Supervisor Feedback";
        message = "Your submission has supervisor feedback for revision.";
      }
      case SUPERVISOR_APPROVED_SUBMISSION -> {
        subject = "Supervisor Approved Submission";
        message = "Your supervisor approved your submission.";
      }
      case LIBRARY_FEEDBACK -> {
        subject = "Library Feedback";
        message = "Your submission has feedback from the library.";
      }
      case LIBRARY_APPROVED_SUBMISSION -> {
        subject = "Submission Approved";
        message = "Your submission was approved by the library.";
      }
      case CLEARANCE_APPROVED -> {
        subject = "Clearance Approved";
        message = "Your library clearance has been approved.";
      }
      case LECTURER_SELECTED_SUPERVISOR -> {
        subject = "Supervisor Selected";
        message = studentLabel(studentEmail) + " selected you as supervisor. View the publication registration for approval.";
      }
      case LECTURER_NEW_SUBMISSION -> {
        subject = "New Submission";
        message = studentLabel(studentEmail) + " uploaded a new submission.";
      }
      case LECTURER_LIBRARY_APPROVAL -> {
        subject = "Library Approval";
        message = studentPossessive(studentEmail) + " submission was approved by the library.";
      }
      case ADMIN_NEW_REGISTRATION -> {
        subject = "New Registration";
        message = studentLabel(studentEmail) + " submitted a new registration and is waiting for admin approval.";
      }
      case ADMIN_SUPERVISOR_FORWARD -> {
        subject = "Forwarded to Library";
        message = lecturerLabel(lecturerEmail) + " forwarded a submission for library review.";
      }
      case ADMIN_RESUBMISSION -> {
        subject = "Student Resubmission";
        message = studentLabel(studentEmail) + " submitted a revision for review.";
      }
      case ADMIN_CLEARANCE_SIGNED -> {
        subject = "Clearance Submitted";
        message = studentLabel(studentEmail) + " submitted a clearance form.";
      }
      default -> {
        return;
      }
    }

    try {
      emailService.sendEmail(email, subject, message);
    } catch (Exception ex) {
      log.warn("Failed to send notification {} to {}: {}", event, email, ex.getMessage());
    }
  }

  private String studentLabel(String studentEmail) {
    return hasText(studentEmail) ? studentEmail : "A student";
  }

  private String studentPossessive(String studentEmail) {
    return hasText(studentEmail) ? studentEmail + "'s" : "A student's";
  }

  private String lecturerLabel(String lecturerEmail) {
    return hasText(lecturerEmail) ? lecturerEmail : "A supervisor";
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
