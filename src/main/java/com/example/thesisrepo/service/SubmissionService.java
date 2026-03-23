package com.example.thesisrepo.service;

import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.ChecklistTemplate;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.SubmissionStatus;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.SubmissionVersionRepository;
import com.example.thesisrepo.service.workflow.AuditEventService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.SubmissionDetailResponse;
import com.example.thesisrepo.web.dto.SubmissionSummaryResponse;
import com.example.thesisrepo.web.dto.SubmissionUploadMetadataRequest;
import com.example.thesisrepo.web.dto.SubmissionUploadResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
@RequiredArgsConstructor
@Slf4j
public class SubmissionService {

  private final PublicationWorkflowGateService workflowGates;
  private final SubmissionVersionRepository submissionVersions;
  private final PublicationCaseRepository cases;
  private final StorageService storage;
  private final AuditEventService auditEvents;
  private final EntityManager entityManager;

  @Transactional
  public SubmissionUploadResponse uploadStudentSubmission(
    User student,
    Long caseId,
    MultipartFile file,
    SubmissionUploadMetadataRequest metadata
  ) {
    PublicationCase publicationCase = workflowGates.requireOwnedCase(student, caseId);
    workflowGates.ensureStudentCanUploadSubmission(publicationCase);
    CaseStatus previousStatus = publicationCase.getStatus();

    int nextVersion = workflowGates.nextSubmissionVersion(publicationCase);
    ChecklistTemplate checklistTemplate = submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(publicationCase)
      .map(SubmissionVersion::getChecklistTemplate)
      .orElseGet(() -> workflowGates.requireActiveTemplateForCaseType(publicationCase.getType()));

    String safeOriginalFilename;
    String storedPath;
    try {
      safeOriginalFilename = storage.sanitizeOriginalFilename(file.getOriginalFilename());
      storedPath = storage.saveDocument(file);
    } catch (IOException ex) {
      throw new ResponseStatusException(BAD_REQUEST, ex.getMessage(), ex);
    }

    try {
      SubmissionVersion version = submissionVersions.save(SubmissionVersion.builder()
        .publicationCase(publicationCase)
        .versionNumber(nextVersion)
        .filePath(storedPath)
        .originalFilename(safeOriginalFilename)
        .contentType(Optional.ofNullable(file.getContentType()).orElse("application/octet-stream"))
        .fileSize(file.getSize())
        .metadataTitle(metadata != null ? metadata.getMetadataTitle() : null)
        .metadataAuthors(metadata != null ? metadata.getMetadataAuthors() : null)
        .metadataKeywords(metadata != null ? metadata.getMetadataKeywords() : null)
        .metadataFaculty(metadata != null ? metadata.getMetadataFaculty() : null)
        .metadataStudyProgram(metadata != null ? metadata.getMetadataStudyProgram() : null)
        .metadataYear(metadata != null ? metadata.getMetadataYear() : null)
        .abstractText(metadata != null ? metadata.getAbstractText() : null)
        .checklistTemplate(checklistTemplate)
        .status(SubmissionStatus.SUBMITTED)
        .build());

      publicationCase.setStatus(workflowGates.nextStatusAfterStudentUpload(previousStatus));
      cases.save(publicationCase);

      auditEvents.log(
        publicationCase.getId(),
        version.getId(),
        student,
        Role.STUDENT,
        AuditEventType.SUBMISSION_UPLOADED,
        "Uploaded submission v" + version.getVersionNumber() + " (" + safeOriginalFilename + ")"
      );

      entityManager.flush();

      return new SubmissionUploadResponse(version.getId(), version.getVersionNumber());
    } catch (RuntimeException ex) {
      cleanupUploadedBlob(storedPath, ex);
      throw ex;
    }
  }

  @Transactional(readOnly = true)
  public List<SubmissionDetailResponse> listStudentSubmissions(User student, Long caseId) {
    PublicationCase publicationCase = workflowGates.requireOwnedCase(student, caseId);
    return submissionVersions.findByPublicationCaseOrderByVersionNumberDesc(publicationCase).stream()
      .map(this::toDetailResponse)
      .toList();
  }

  @Transactional(readOnly = true)
  public List<SubmissionSummaryResponse> listSubmissionSummaries(PublicationCase publicationCase) {
    return submissionVersions.findByPublicationCaseOrderByVersionNumberDesc(publicationCase).stream()
      .map(this::toSummaryResponse)
      .toList();
  }

  @Transactional(readOnly = true)
  public List<SubmissionDetailResponse> listSubmissionDetails(PublicationCase publicationCase) {
    return submissionVersions.findByPublicationCaseOrderByVersionNumberDesc(publicationCase).stream()
      .map(this::toDetailResponse)
      .toList();
  }

  private SubmissionSummaryResponse toSummaryResponse(SubmissionVersion version) {
    return new SubmissionSummaryResponse(
      version.getId(),
      version.getVersionNumber(),
      version.getOriginalFilename(),
      version.getContentType(),
      version.getFileSize(),
      version.getStatus(),
      version.getCreatedAt()
    );
  }

  private SubmissionDetailResponse toDetailResponse(SubmissionVersion version) {
    ChecklistTemplate checklistTemplate = version.getChecklistTemplate();
    SubmissionDetailResponse.ChecklistTemplateInfoResponse checklistTemplateResponse = checklistTemplate == null
      ? null
      : new SubmissionDetailResponse.ChecklistTemplateInfoResponse(
        checklistTemplate.getId(),
        checklistTemplate.getPublicationType(),
        checklistTemplate.getVersion(),
        checklistTemplate.isActive()
      );

    return new SubmissionDetailResponse(
      version.getId(),
      version.getVersionNumber(),
      version.getOriginalFilename(),
      version.getContentType(),
      version.getFileSize(),
      version.getStatus(),
      version.getCreatedAt(),
      version.getMetadataTitle(),
      version.getMetadataAuthors(),
      version.getMetadataKeywords(),
      version.getMetadataFaculty(),
      version.getMetadataStudyProgram(),
      version.getMetadataYear(),
      version.getAbstractText(),
      checklistTemplateResponse
    );
  }

  private void cleanupUploadedBlob(String storedPath, RuntimeException originalException) {
    if (storedPath == null || storedPath.isBlank()) {
      return;
    }

    try {
      storage.delete(storedPath);
      log.info("Deleted uploaded blob after submission persistence failure: {}", storedPath);
    } catch (IOException cleanupException) {
      originalException.addSuppressed(cleanupException);
      log.warn("Failed to delete uploaded blob after submission persistence failure: {}", storedPath, cleanupException);
    }
  }
}
