package com.example.thesisrepo.service;

import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.reminder.ReminderStatus;
import com.example.thesisrepo.reminder.StudentDashboardReminder;
import com.example.thesisrepo.reminder.StudentDashboardReminderRepository;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.StudentReminderRequest;
import com.example.thesisrepo.web.dto.StudentReminderResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class StudentReminderService {

  private final StudentDashboardReminderRepository reminders;
  private final PublicationCaseRepository cases;
  private final PublicationRegistrationRepository registrations;

  @Transactional(readOnly = true)
  public List<StudentReminderResponse> list(User student) {
    List<StudentDashboardReminder> items = reminders.findByUser(student).stream()
      .sorted(
        Comparator.comparing(StudentDashboardReminder::getStatus, this::compareStatus)
          .thenComparing(StudentDashboardReminder::getReminderDate)
          .thenComparing(StudentDashboardReminder::getReminderTime)
          .thenComparing(StudentDashboardReminder::getCreatedAt)
      )
      .toList();

    List<PublicationCase> linkedCases = items.stream()
      .map(StudentDashboardReminder::getPublicationCase)
      .filter(java.util.Objects::nonNull)
      .toList();

    Map<Long, String> caseTitleById = linkedCases.isEmpty()
      ? Map.of()
      : registrations.findByPublicationCaseIn(linkedCases).stream()
        .collect(Collectors.toMap(
          registration -> registration.getPublicationCase().getId(),
          PublicationRegistration::getTitle
        ));

    return items.stream()
      .map(reminder -> toResponse(reminder, caseTitleById.get(reminder.getPublicationCase() != null ? reminder.getPublicationCase().getId() : null)))
      .toList();
  }

  public StudentReminderResponse create(User student, StudentReminderRequest request) {
    PublicationCase publicationCase = resolveOwnedCase(student, request.caseId());
    StudentDashboardReminder reminder = reminders.save(StudentDashboardReminder.builder()
      .user(student)
      .publicationCase(publicationCase)
      .title(request.title().trim())
      .reminderDate(request.reminderDate())
      .reminderTime(request.reminderTime())
      .status(ReminderStatus.ACTIVE)
      .build());
    return toResponse(reminder, resolveCaseTitle(publicationCase));
  }

  public StudentReminderResponse update(User student, Long reminderId, StudentReminderRequest request) {
    StudentDashboardReminder reminder = ownedReminder(student, reminderId);
    PublicationCase publicationCase = resolveOwnedCase(student, request.caseId());
    reminder.setTitle(request.title().trim());
    reminder.setReminderDate(request.reminderDate());
    reminder.setReminderTime(request.reminderTime());
    reminder.setPublicationCase(publicationCase);
    StudentDashboardReminder saved = reminders.save(reminder);
    return toResponse(saved, resolveCaseTitle(publicationCase));
  }

  public StudentReminderResponse markDone(User student, Long reminderId) {
    StudentDashboardReminder reminder = ownedReminder(student, reminderId);
    reminder.setStatus(ReminderStatus.DONE);
    StudentDashboardReminder saved = reminders.save(reminder);
    return toResponse(saved, resolveCaseTitle(saved.getPublicationCase()));
  }

  public void delete(User student, Long reminderId) {
    reminders.delete(ownedReminder(student, reminderId));
  }

  private StudentDashboardReminder ownedReminder(User student, Long reminderId) {
    return reminders.findByIdAndUser(reminderId, student)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reminder not found"));
  }

  private PublicationCase resolveOwnedCase(User student, Long caseId) {
    if (caseId == null) {
      return null;
    }
    return cases.findByIdAndStudent(caseId, student)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Related case not found"));
  }

  private String resolveCaseTitle(PublicationCase publicationCase) {
    if (publicationCase == null) {
      return null;
    }
    return registrations.findByPublicationCase(publicationCase)
      .map(PublicationRegistration::getTitle)
      .orElse(null);
  }

  private StudentReminderResponse toResponse(StudentDashboardReminder reminder, String caseTitle) {
    return new StudentReminderResponse(
      reminder.getId(),
      reminder.getUser().getId(),
      reminder.getPublicationCase() != null ? reminder.getPublicationCase().getId() : null,
      caseTitle,
      reminder.getTitle(),
      reminder.getReminderDate(),
      reminder.getReminderTime(),
      reminder.getStatus(),
      reminder.getCreatedAt(),
      reminder.getUpdatedAt()
    );
  }

  private int compareStatus(ReminderStatus left, ReminderStatus right) {
    return Integer.compare(statusRank(left), statusRank(right));
  }

  private int statusRank(ReminderStatus status) {
    return status == ReminderStatus.ACTIVE ? 0 : 1;
  }
}
