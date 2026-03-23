package com.example.thesisrepo.service;

import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.ClearanceForm;
import com.example.thesisrepo.publication.ClearanceStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.repo.ClearanceFormRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.service.workflow.AuditEventService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.AdminClearanceCaseSummaryResponse;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import com.example.thesisrepo.web.dto.PagedResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
@RequiredArgsConstructor
public class ClearanceService {

  private final PublicationCaseRepository cases;
  private final PublicationRegistrationRepository registrations;
  private final ClearanceFormRepository clearances;
  private final PublicationWorkflowGateService workflowGates;
  private final AuditEventService auditEvents;
  private final EntityManager entityManager;

  @Transactional(readOnly = true)
  public PagedResponse<AdminClearanceCaseSummaryResponse> clearanceQueue(Pageable pageable) {
    Page<PublicationCase> queuePage = cases.findByStatusIn(List.of(CaseStatus.CLEARANCE_SUBMITTED), pageable);
    List<PublicationCase> queue = queuePage.getContent();

    Map<Long, PublicationRegistration> registrationByCase = registrations.findByPublicationCaseIn(queue).stream()
      .collect(Collectors.toMap(r -> r.getPublicationCase().getId(), Function.identity()));

    List<AdminClearanceCaseSummaryResponse> items = queue.stream()
      .map(publicationCase -> toSummaryResponse(publicationCase, registrationByCase.get(publicationCase.getId())))
      .toList();
    return PagedResponse.from(queuePage, items);
  }

  @Transactional
  public CaseStatusResponse approveClearance(User admin, Long caseId) {
    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    workflowGates.ensureAdminCanApproveClearance(publicationCase);

    ClearanceForm form = clearances.findByPublicationCase(publicationCase)
      .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Clearance not submitted"));
    form.setStatus(ClearanceStatus.APPROVED);
    form.setApprovedAt(Instant.now());
    clearances.save(form);

    publicationCase.setStatus(CaseStatus.READY_TO_PUBLISH);
    cases.save(publicationCase);

    auditEvents.log(
      publicationCase.getId(),
      admin,
      Role.ADMIN,
      AuditEventType.CLEARANCE_APPROVED,
      "Library approved clearance"
    );

    entityManager.flush();
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
  }

  @Transactional
  public CaseStatusResponse requestCorrection(User admin, Long caseId, String reason) {
    String normalizedReason = requireText(reason, "Reason is required");

    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    workflowGates.ensureAdminCanRequestClearanceCorrection(publicationCase);

    ClearanceForm form = clearances.findByPublicationCase(publicationCase)
      .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Clearance not submitted"));
    form.setStatus(ClearanceStatus.NEEDS_CORRECTION);
    form.setNote(normalizedReason);
    clearances.save(form);

    publicationCase.setStatus(CaseStatus.APPROVED_FOR_CLEARANCE);
    cases.save(publicationCase);

    auditEvents.log(
      publicationCase.getId(),
      admin,
      Role.ADMIN,
      AuditEventType.CLEARANCE_CORRECTION_REQUESTED,
      normalizedReason
    );

    entityManager.flush();
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
  }

  private AdminClearanceCaseSummaryResponse toSummaryResponse(PublicationCase publicationCase, PublicationRegistration registration) {
    return new AdminClearanceCaseSummaryResponse(
      publicationCase.getId(),
      publicationCase.getType(),
      publicationCase.getStatus(),
      registration != null ? registration.getTitle() : null,
      publicationCase.getUpdatedAt(),
      publicationCase.getCreatedAt()
    );
  }

  private static String requireText(String value, String message) {
    if (value == null || value.isBlank()) {
      throw new ResponseStatusException(BAD_REQUEST, message);
    }
    return value.trim();
  }
}
