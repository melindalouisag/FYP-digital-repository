package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.reminder.CalendarEventType;
import com.example.thesisrepo.reminder.DeadlineActionType;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

public record CalendarEventResponse(
  Long id,
  Long ownerUserId,
  String title,
  String description,
  LocalDate eventDate,
  LocalTime eventTime,
  CalendarEventType eventType,
  DeadlineActionType deadlineAction,
  PublicationType publicationType,
  boolean canManage,
  Instant createdAt,
  Instant updatedAt
) {
}
