package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.reminder.ReminderStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

public record StudentReminderResponse(
  Long id,
  Long userId,
  Long caseId,
  String caseTitle,
  String title,
  LocalDate reminderDate,
  LocalTime reminderTime,
  ReminderStatus status,
  Instant createdAt,
  Instant updatedAt
) {
}
