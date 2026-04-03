package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.reminder.CalendarEventType;
import com.example.thesisrepo.reminder.DeadlineActionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;

public record CalendarEventRequest(
  @NotBlank @Size(max = 160) String title,
  @Size(max = 4000) String description,
  @NotNull LocalDate eventDate,
  @NotNull LocalTime eventTime,
  @NotNull CalendarEventType eventType,
  DeadlineActionType deadlineAction,
  PublicationType publicationType
) {
}
