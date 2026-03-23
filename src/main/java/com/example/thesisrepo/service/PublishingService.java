package com.example.thesisrepo.service;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.PublishedItem;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.WorkflowComment;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.publication.repo.PublishedItemRepository;
import com.example.thesisrepo.publication.repo.SubmissionVersionRepository;
import com.example.thesisrepo.publication.repo.WorkflowCommentRepository;
import com.example.thesisrepo.service.workflow.AuditEventService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.AdminPublishDetailDto;
import com.example.thesisrepo.web.dto.AdminPublishQueueDto;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import com.example.thesisrepo.web.dto.PublishResultResponse;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
@RequiredArgsConstructor
public class PublishingService {

  private final PublicationCaseRepository cases;
  private final PublicationRegistrationRepository registrations;
  private final SubmissionVersionRepository submissionVersions;
  private final PublishedItemRepository publishedItems;
  private final StudentProfileRepository studentProfiles;
  private final WorkflowCommentRepository comments;
  private final PublicationWorkflowGateService workflowGates;
  private final AuditEventService auditEvents;
  private final EntityManager entityManager;

  @Transactional(readOnly = true)
  public List<AdminPublishQueueDto> publishQueue() {
    List<PublicationCase> publishCases = cases.findByStatusInOrderByUpdatedAtDesc(List.of(CaseStatus.READY_TO_PUBLISH));
    if (publishCases.isEmpty()) {
      return List.of();
    }

    Map<Long, PublicationRegistration> registrationByCase = registrations.findByPublicationCaseIn(publishCases).stream()
      .collect(Collectors.toMap(r -> r.getPublicationCase().getId(), Function.identity()));

    return publishCases.stream()
      .map(publicationCase -> new AdminPublishQueueDto(
        publicationCase.getId(),
        resolvePublishTitle(publicationCase, registrationByCase.get(publicationCase.getId())),
        publicationCase.getType(),
        publicationCase.getStatus(),
        publicationCase.getUpdatedAt()
      ))
      .toList();
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
  public CaseStatusResponse unpublish(User admin, Long caseId, String reason) {
    String normalizedReason = requireMinLength(reason, 5, "Reason is required (min 5 characters)");

    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    workflowGates.ensureAdminCanUnpublish(publicationCase);

    publishedItems.deleteByPublicationCase_Id(caseId);
    publicationCase.setStatus(CaseStatus.NEEDS_REVISION_LIBRARY);
    cases.save(publicationCase);

    WorkflowComment comment = comments.save(WorkflowComment.builder()
      .publicationCase(publicationCase)
      .author(admin)
      .authorRole(Role.ADMIN)
      .authorEmail(admin.getEmail())
      .body(normalizedReason)
      .build());

    auditEvents.log(
      publicationCase.getId(),
      admin,
      Role.ADMIN,
      AuditEventType.UNPUBLISHED_FOR_CORRECTION,
      comment.getBody()
    );

    entityManager.flush();
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
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

  private static String requireMinLength(String value, int minLength, String message) {
    if (value == null || value.trim().length() < minLength) {
      throw new ResponseStatusException(BAD_REQUEST, message);
    }
    return value.trim();
  }
}
