package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.PublicationType;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreateRegistrationRequest {
  private PublicationType type = PublicationType.THESIS;

  @NotBlank
  private String title;

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
