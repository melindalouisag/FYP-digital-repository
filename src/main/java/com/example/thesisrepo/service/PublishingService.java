package com.example.thesisrepo.service;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.PublishedItem;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.repo.AuditEventRepository;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
import com.example.thesisrepo.publication.repo.ChecklistResultRepository;
import com.example.thesisrepo.publication.repo.ClearanceFormRepository;
import com.example.thesisrepo.publication.repo.DownloadEventRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.publication.repo.PublishedItemRepository;
import com.example.thesisrepo.publication.repo.SubmissionVersionRepository;
import com.example.thesisrepo.publication.repo.WorkflowCommentRepository;
import com.example.thesisrepo.reminder.StudentDashboardReminderRepository;
import com.example.thesisrepo.service.workflow.AuditEventService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.AdminPublishDetailDto;
import com.example.thesisrepo.web.dto.AdminPublishQueueDto;
import com.example.thesisrepo.web.dto.OperationResultResponse;
import com.example.thesisrepo.web.dto.PagedResponse;
import com.example.thesisrepo.web.dto.PublishResultResponse;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PublishingService {
  private static final Logger log = LoggerFactory.getLogger(PublishingService.class);

  private final PublicationCaseRepository cases;
  private final PublicationRegistrationRepository registrations;
  private final SubmissionVersionRepository submissionVersions;
  private final PublishedItemRepository publishedItems;
  private final DownloadEventRepository downloadEvents;
  private final ChecklistResultRepository checklistResults;
  private final ClearanceFormRepository clearances;
  private final CaseSupervisorRepository caseSupervisors;
  private final StudentProfileRepository studentProfiles;
  private final WorkflowCommentRepository comments;
  private final AuditEventRepository auditEventRepository;
  private final StudentDashboardReminderRepository reminders;
  private final PublicationWorkflowGateService workflowGates;
  private final AuditEventService auditEvents;
  private final StorageService storageService;
  private final EntityManager entityManager;

  @Transactional(readOnly = true)
  public PagedResponse<AdminPublishQueueDto> publishQueue(Pageable pageable) {
    Page<PublicationCase> queuePage = cases.findByStatusIn(List.of(CaseStatus.READY_TO_PUBLISH), pageable);
    List<PublicationCase> publishCases = queuePage.getContent();

    Map<Long, PublicationRegistration> registrationByCase = registrations.findByPublicationCaseIn(publishCases).stream()
      .collect(Collectors.toMap(r -> r.getPublicationCase().getId(), Function.identity()));

    List<AdminPublishQueueDto> items = publishCases.stream()
      .map(publicationCase -> new AdminPublishQueueDto(
        publicationCase.getId(),
        resolvePublishTitle(publicationCase, registrationByCase.get(publicationCase.getId())),
        publicationCase.getType(),
        publicationCase.getStatus(),
        publicationCase.getUpdatedAt()
      ))
      .toList();
    return PagedResponse.from(queuePage, items);
  }

  @Transactional(readOnly = true)
  public AdminPublishDetailDto publishDetail(Long caseId) {
    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    PublicationRegistration registration = registrations.findByPublicationCase(publicationCase).orElse(null);
    SubmissionVersion latest = submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(publicationCase).orElse(null);

    AdminPublishDetailDto.Metadata metadata = new AdminPublishDetailDto.Metadata(
      latest != null ? latest.getMetadataTitle() : null,
      latest != null ? latest.getMetadataAuthors() : null,
      latest != null ? latest.getMetadataKeywords() : null,
      latest != null ? latest.getMetadataFaculty() : null,
      latest != null ? latest.getMetadataYear() : null,
      latest != null ? latest.getAbstractText() : null
    );

    AdminPublishDetailDto.SubmissionFile file = latest == null ? null : new AdminPublishDetailDto.SubmissionFile(
      latest.getId(),
      latest.getOriginalFilename(),
      latest.getCreatedAt(),
      latest.getFileSize(),
      "/api/admin/cases/" + caseId + "/file/latest"
    );

    return new AdminPublishDetailDto(
      publicationCase.getId(),
      resolvePublishTitle(publicationCase, registration),
      publicationCase.getType(),
      publicationCase.getStatus(),
      publicationCase.getUpdatedAt(),
      metadata,
      file
    );
  }

  @Transactional
  public PublishResultResponse publish(User admin, Long caseId) {
    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    SubmissionVersion latest = workflowGates.ensureAdminCanPublish(publicationCase);
    String studentProgram = studentProfiles.findByUserId(publicationCase.getStudent().getId())
      .map(StudentProfile::getProgram)
      .orElse(null);

    PublishedItem item = publishedItems.save(PublishedItem.builder()
      .publicationCase(publicationCase)
      .submissionVersion(latest)
      .publishedAt(Instant.now())
      .title(Optional.ofNullable(latest.getMetadataTitle()).orElse("Untitled"))
      .authors(Optional.ofNullable(latest.getMetadataAuthors()).orElse(publicationCase.getStudent().getEmail()))
      .authorName(Optional.ofNullable(latest.getMetadataAuthors()).orElse(publicationCase.getStudent().getEmail()))
      .faculty(latest.getMetadataFaculty())
      .program(studentProgram)
      .year(latest.getMetadataYear())
      .keywords(latest.getMetadataKeywords())
      .abstractText(latest.getAbstractText())
      .build());

    publicationCase.setStatus(CaseStatus.PUBLISHED);
    cases.save(publicationCase);

    auditEvents.log(
      publicationCase.getId(),
      latest.getId(),
      admin,
      Role.ADMIN,
      AuditEventType.PUBLISHED,
      "Published to repository"
    );

    entityManager.flush();
    return new PublishResultResponse(item.getId(), publicationCase.getStatus());
  }

  @Transactional
  public OperationResultResponse unpublish(Long caseId) {
    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    workflowGates.ensureAdminCanUnpublish(publicationCase);
    List<SubmissionVersion> versions = submissionVersions.findByPublicationCaseOrderByVersionNumberDesc(publicationCase);
    List<String> storedFiles = versions.stream()
      .map(SubmissionVersion::getFilePath)
      .filter(PublishingService::hasText)
      .toList();

    publishedItems.findByPublicationCase_Id(caseId)
      .ifPresent(downloadEvents::deleteByPublishedItem);
    publishedItems.deleteByPublicationCase_Id(caseId);
    auditEventRepository.deleteByCaseId(caseId);
    comments.deleteByPublicationCase(publicationCase);
    if (!versions.isEmpty()) {
      checklistResults.deleteBySubmissionVersionIn(versions);
    }
    clearances.deleteByPublicationCase(publicationCase);
    registrations.deleteByPublicationCase(publicationCase);
    caseSupervisors.deleteByPublicationCase(publicationCase);
    reminders.deleteByPublicationCase(publicationCase);
    submissionVersions.deleteByPublicationCase(publicationCase);
    cases.delete(publicationCase);

    entityManager.flush();
    deleteStoredFiles(storedFiles);
    return new OperationResultResponse(true);
  }

  private String resolvePublishTitle(PublicationCase publicationCase, PublicationRegistration registration) {
    if (registration != null && hasText(registration.getTitle())) {
      return registration.getTitle();
    }
    return submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(publicationCase)
      .map(SubmissionVersion::getMetadataTitle)
      .filter(PublishingService::hasText)
      .orElse(null);
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  private void deleteStoredFiles(List<String> storedFiles) {
    for (String storedFile : storedFiles) {
      try {
        storageService.delete(storedFile);
      } catch (IOException ex) {
        log.warn("Failed to delete stored submission file during unpublish cleanup: {}", storedFile, ex);
      }
    }
  }
}
