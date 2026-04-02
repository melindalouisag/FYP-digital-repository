package com.example.thesisrepo.web.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

import java.util.Arrays;

@Data
public class SubmissionUploadMetadataRequest {
  private String metadataTitle;
  private String metadataAuthors;
  private String metadataKeywords;
  private String metadataFaculty;
  private String metadataStudyProgram;
  private Integer metadataYear;
  private String abstractText;

  @JsonIgnore
  public boolean hasMinimumKeywords() {
    if (metadataKeywords == null || metadataKeywords.isBlank()) {
      return false;
    }

    return Arrays.stream(metadataKeywords.split(","))
      .map(String::trim)
      .filter(keyword -> !keyword.isBlank())
      .count() >= 3;
  }
}
