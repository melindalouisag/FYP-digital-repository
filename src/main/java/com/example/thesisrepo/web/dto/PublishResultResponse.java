package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.CaseStatus;

public record PublishResultResponse(
  Long publishedId,
  CaseStatus status
) {
}
