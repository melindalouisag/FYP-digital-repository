package com.example.thesisrepo.service.student;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.ClearanceForm;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
import com.example.thesisrepo.publication.repo.ChecklistResultRepository;
import com.example.thesisrepo.publication.repo.ClearanceFormRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.publication.repo.SubmissionVersionRepository;
import com.example.thesisrepo.publication.repo.WorkflowCommentRepository;
import com.example.thesisrepo.service.SubmissionDownloadResponseService;
import com.example.thesisrepo.service.SubmissionService;
import com.example.thesisrepo.service.SupervisorDirectoryService;
import com.example.thesisrepo.service.workflow.CaseTimelineService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.ChecklistResultResponse;
import com.example.thesisrepo.web.dto.PagedResponse;
import com.example.thesisrepo.web.dto.StudentCaseDetailResponse;
import com.example.thesisrepo.web.dto.StudentCaseSummaryResponse;
import com.example.thesisrepo.web.dto.StudentSupervisorResponse;
import com.example.thesisrepo.web.dto.SubmissionSummaryResponse;
import com.example.thesisrepo.web.dto.WorkflowCommentResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@RequiredArgsConstructor
public class StudentCaseReadService {

  private static final int DEFAULT_PAGE_SIZE = 10;
  private static final int MAX_PAGE_SIZE = 50;

  private final PublicationCaseRepository cases;
  private final PublicationRegistrationRepository registrations;
  private final CaseSupervisorRepository caseSupervisors;
  private final SubmissionVersionRepository submissionVersions;
  private final WorkflowCommentRepository comments;
  private final ChecklistResultRepository checklistResults;
  private final ClearanceFormRepository clearances;
  private final StudentProfileRepository studentProfiles;
  private final SubmissionService submissionService;
  private final SupervisorDirectoryService supervisorDirectoryService;
  private final PublicationWorkflowGateService workflowGates;
  private final CaseTimelineService timelineService;
  private final SubmissionDownloadResponseService submissionDownloadResponseService;
  private final StudentCaseResponseFactory responseFactory;

  @Transactional(readOnly = true)
  public PagedResponse<StudentCaseSummaryResponse> listCases(User student, int page, int size) {
    Page<PublicationCase> casePage = cases.findByStudent(
      student,
      PageRequest.of(
        Math.max(page, 0),
        normalizePageSize(size),
        Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id"))
      )
    );

    Map<Long, PublicationRegistration> registrationByCaseId = loadRegistrations(casePage.getContent());
    List<StudentCaseSummaryResponse> items = casePage.getContent().stream()
      .map(publicationCase -> responseFactory.toCaseSummary(
        publicationCase,
        registrationByCaseId.get(publicationCase.getId())
      ))
      .toList();
    return PagedResponse.from(casePage, items);
  }

  @Transactional(readOnly = true)
  public List<StudentSupervisorResponse> listSupervisors(User student) {
    StudentProfile studentProfile = studentProfiles.findByUserId(student.getId()).orElse(null);
    String studentProgram = normalize(studentProfile != null ? studentProfile.getProgram() : null);
    if (studentProgram.isBlank()) {
      return List.of();
    }

    return supervisorDirectoryService
      .listActiveSupervisors(null, studentProgram)
      .stream()
      .map(responseFactory::toSupervisorResponse)
      .toList();
  }

  @Transactional(readOnly = true)
  public StudentCaseDetailResponse caseDetail(User student, Long caseId) {
    PublicationCase publicationCase = workflowGates.requireOwnedCase(student, caseId);
    PublicationRegistration registration = registrations.findByPublicationCase(publicationCase).orElse(null);
    List<SubmissionSummaryResponse> versions = submissionService.listSubmissionSummaries(publicationCase);
    List<WorkflowCommentResponse> caseComments = comments.findByPublicationCaseOrderByCreatedAtAsc(publicationCase).stream()
      .map(responseFactory::toWorkflowCommentResponse)
      .toList();
    ClearanceForm clearance = clearances.findByPublicationCase(publicationCase).orElse(null);

    return new StudentCaseDetailResponse(
      responseFactory.toCaseSummary(publicationCase, registration),
      responseFactory.toRegistrationDetail(registration),
      caseSupervisors.findByPublicationCase(publicationCase).stream()
        .map(responseFactory::toAssignedSupervisor)
        .toList(),
      versions,
      caseComments,
      responseFactory.toClearanceResponse(clearance),
      timelineService.buildTimeline(publicationCase)
    );
  }

  @Transactional(readOnly = true)
  public ResponseEntity<Resource> downloadSubmission(User student, Long caseId, Long submissionId) {
    PublicationCase publicationCase = workflowGates.requireOwnedCase(student, caseId);
    SubmissionVersion submission = submissionVersions.findById(submissionId)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Submission not found"));
    if (!submission.getPublicationCase().getId().equals(publicationCase.getId())) {
      throw new ResponseStatusException(BAD_REQUEST, "Submission does not belong to this publication");
    }
    return submissionDownloadResponseService.buildResponse(submission);
  }

  @Transactional(readOnly = true)
  public List<ChecklistResultResponse> checklistResults(User student, Long caseId) {
    PublicationCase publicationCase = workflowGates.requireOwnedCase(student, caseId);
    return checklistResults(publicationCase);
  }

  private List<ChecklistResultResponse> checklistResults(PublicationCase publicationCase) {
    SubmissionVersion latest = submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(publicationCase)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "No submissions"));

    return checklistResults.findBySubmissionVersion(latest).stream()
      .map(responseFactory::toChecklistResultResponse)
      .toList();
  }

  private Map<Long, PublicationRegistration> loadRegistrations(List<PublicationCase> publicationCases) {
    if (publicationCases.isEmpty()) {
      return Map.of();
    }

    return registrations.findByPublicationCaseIn(publicationCases).stream()
      .collect(Collectors.toMap(
        registration -> registration.getPublicationCase().getId(),
        Function.identity()
      ));
  }

  private static int normalizePageSize(int requestedSize) {
    if (requestedSize < 1) {
      return DEFAULT_PAGE_SIZE;
    }
    return Math.min(requestedSize, MAX_PAGE_SIZE);
  }

  private static String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }
}
