package com.example.thesisrepo.service;

import com.example.thesisrepo.reminder.CalendarEventType;
import com.example.thesisrepo.reminder.ReminderStatus;
import com.example.thesisrepo.reminder.StudentDashboardReminder;
import com.example.thesisrepo.reminder.StudentDashboardReminderRepository;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.CalendarEventRequest;
import com.example.thesisrepo.web.dto.CalendarEventResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@RequiredArgsConstructor
public class CalendarEventService {

  private final StudentDashboardReminderRepository reminders;

  @Transactional(readOnly = true)
  public List<CalendarEventResponse> listVisible(User user) {
    return reminders.findVisibleEvents(user, ReminderStatus.ACTIVE, CalendarEventType.DEADLINE).stream()
      .map(event -> toResponse(user, event))
      .toList();
  }

  @Transactional
  public CalendarEventResponse create(User user, CalendarEventRequest request) {
    validatePermissions(user, request);

    StudentDashboardReminder saved = reminders.save(StudentDashboardReminder.builder()
      .user(user)
      .title(request.title().trim())
      .description(normalizeText(request.description()))
      .reminderDate(request.eventDate())
      .reminderTime(request.eventTime())
      .eventType(request.eventType())
      .deadlineAction(request.deadlineAction())
      .publicationType(request.publicationType())
      .status(ReminderStatus.ACTIVE)
      .build());

    return toResponse(user, saved);
  }

  @Transactional
  public void delete(User user, Long eventId) {
    StudentDashboardReminder event = reminders.findById(eventId)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Calendar event not found"));

    if (event.getEventType() == CalendarEventType.DEADLINE) {
      if (user.getRole() != Role.ADMIN) {
        throw new ResponseStatusException(FORBIDDEN, "Only library admins can remove system deadlines.");
      }
    } else if (!event.getUser().getId().equals(user.getId())) {
      throw new ResponseStatusException(NOT_FOUND, "Calendar event not found");
    }

    reminders.delete(event);
  }

  private void validatePermissions(User user, CalendarEventRequest request) {
    if (request.eventType() == CalendarEventType.DEADLINE) {
      if (user.getRole() != Role.ADMIN) {
        throw new ResponseStatusException(FORBIDDEN, "Only library admins can create system deadlines.");
      }
      if (request.deadlineAction() == null) {
        throw new ResponseStatusException(BAD_REQUEST, "A deadline action is required for system deadlines.");
      }
      if (request.publicationType() == null) {
        throw new ResponseStatusException(BAD_REQUEST, "A publication type is required for system deadlines.");
      }
      return;
    }

    if (request.deadlineAction() != null || request.publicationType() != null) {
      throw new ResponseStatusException(BAD_REQUEST, "Personal calendar events cannot set deadline controls.");
    }
  }

  private CalendarEventResponse toResponse(User currentUser, StudentDashboardReminder event) {
    boolean canManage = event.getEventType() == CalendarEventType.DEADLINE
      ? currentUser.getRole() == Role.ADMIN
      : event.getUser().getId().equals(currentUser.getId());
    return new CalendarEventResponse(
      event.getId(),
      event.getUser().getId(),
      event.getTitle(),
      event.getDescription(),
      event.getReminderDate(),
      event.getReminderTime(),
      event.getEventType(),
      event.getDeadlineAction(),
      event.getPublicationType(),
      canManage,
      event.getCreatedAt(),
      event.getUpdatedAt()
    );
  }

  private String normalizeText(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
