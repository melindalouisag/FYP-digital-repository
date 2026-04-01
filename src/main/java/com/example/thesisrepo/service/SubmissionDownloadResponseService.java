package com.example.thesisrepo.service;

import com.example.thesisrepo.publication.SubmissionVersion;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;

import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@RequiredArgsConstructor
public class SubmissionDownloadResponseService {

  private final StorageService storageService;

  public ResponseEntity<Resource> buildResponse(SubmissionVersion submission) {
    try {
      String storedKey = submission.getFilePath();
      if (!storageService.exists(storedKey)) {
        throw new ResponseStatusException(NOT_FOUND, "Submission file is missing");
      }

      String contentType = submission.getContentType();
      MediaType mediaType = hasText(contentType)
        ? MediaType.parseMediaType(contentType)
        : MediaType.APPLICATION_OCTET_STREAM;

      String filename = sanitizeFilename(submission.getOriginalFilename(), "submission-" + submission.getId() + ".pdf");
      Resource resource = storageService.openAsResource(storedKey);
      ResponseEntity.BodyBuilder response = ResponseEntity.ok()
        .contentType(mediaType)
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
        .header(HttpHeaders.CACHE_CONTROL, "no-store");

      if (submission.getFileSize() != null && submission.getFileSize() > 0) {
        response.contentLength(submission.getFileSize());
      }

      return response.body(resource);
    } catch (ResponseStatusException ex) {
      throw ex;
    } catch (IOException ex) {
      throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Failed to read submission file", ex);
    }
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  private static String sanitizeFilename(String candidate, String fallback) {
    String value = hasText(candidate) ? candidate.trim() : fallback;
    return value.replaceAll("[\\\\/\\r\\n\\t\"]", "_");
  }
}
