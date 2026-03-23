package com.example.thesisrepo.web.dto;

import lombok.Data;

@Data
public class SubmissionUploadMetadataRequest {
  private String metadataTitle;
  private String metadataAuthors;
  private String metadataKeywords;
  private String metadataFaculty;
  private String metadataStudyProgram;
  private Integer metadataYear;
  private String abstractText;
}
