package com.example.thesisrepo.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;

public record StudentReminderRequest(
  @NotBlank @Size(max = 160) String title,
  @NotNull LocalDate reminderDate,
  @NotNull LocalTime reminderTime,
  @Positive Long caseId
) {
}
