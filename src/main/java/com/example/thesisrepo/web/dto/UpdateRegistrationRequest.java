package com.example.thesisrepo.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class UpdateRegistrationRequest {
  @NotBlank(message = "Title is required.")
  private String title;

  @Min(value = 1900, message = "Year must be between 1900 and 2100.")
  @Max(value = 2100, message = "Year must be between 1900 and 2100.")
  private Integer year;
  private String articlePublishIn;
  private String faculty;
  private String studentIdNumber;
  private String authorName;
  private String supervisorEmail;
  private Long supervisorUserId;
  private List<Long> supervisorUserIds;
  private List<String> supervisorEmails;
}
