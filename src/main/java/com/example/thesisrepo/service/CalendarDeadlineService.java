package com.example.thesisrepo.service;

import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.reminder.CalendarEventType;
import com.example.thesisrepo.reminder.DeadlineActionType;
import com.example.thesisrepo.reminder.ReminderStatus;
import com.example.thesisrepo.reminder.StudentDashboardReminder;
import com.example.thesisrepo.reminder.StudentDashboardReminderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
@RequiredArgsConstructor
public class CalendarDeadlineService {

  private final StudentDashboardReminderRepository reminders;

  public void ensureRegistrationOpen(PublicationType publicationType) {
    if (isBlocked(publicationType, DeadlineActionType.REGISTRATION_DEADLINE)) {
      throw new ResponseStatusException(BAD_REQUEST, "The registration deadline has passed.");
    }
  }

  public void ensureSubmissionOpen(PublicationType publicationType) {
    if (isBlocked(publicationType, DeadlineActionType.SUBMISSION_DEADLINE)) {
      throw new ResponseStatusException(BAD_REQUEST, "The submission deadline has passed.");
    }
  }

  public Optional<LocalDateTime> latestDeadline(PublicationType publicationType, DeadlineActionType deadlineAction) {
    return reminders.findTopByEventTypeAndDeadlineActionAndPublicationTypeAndStatusOrderByReminderDateDescReminderTimeDescIdDesc(
        CalendarEventType.DEADLINE,
        deadlineAction,
        publicationType,
        ReminderStatus.ACTIVE
      )
      .map(this::toDateTime);
  }

  public boolean isBlocked(PublicationType publicationType, DeadlineActionType deadlineAction) {
    return latestDeadline(publicationType, deadlineAction)
      .map(deadline -> !deadline.isAfter(LocalDateTime.now()))
      .orElse(false);
  }

  private LocalDateTime toDateTime(StudentDashboardReminder reminder) {
    return LocalDateTime.of(reminder.getReminderDate(), reminder.getReminderTime());
  }
}
