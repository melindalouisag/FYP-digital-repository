package com.example.thesisrepo.web;

import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.ClearanceForm;
import com.example.thesisrepo.publication.ClearanceStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.publication.SubmissionStatus;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.repo.AuditEventRepository;
import com.example.thesisrepo.publication.repo.ClearanceFormRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.publication.repo.PublishedItemRepository;
import com.example.thesisrepo.publication.repo.SubmissionVersionRepository;
import com.example.thesisrepo.publication.repo.WorkflowCommentRepository;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminClearancePublishingIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private PublicationCaseRepository cases;
  @Autowired private PublicationRegistrationRepository registrations;
  @Autowired private ClearanceFormRepository clearances;
  @Autowired private SubmissionVersionRepository submissionVersions;
  @Autowired private PublishedItemRepository publishedItems;
  @Autowired private WorkflowCommentRepository comments;
  @Autowired private AuditEventRepository auditEvents;

  private User student;

  @BeforeEach
  void setUp() {
    student = requireUser(Role.STUDENT);
  }

  @Test
  void clearanceQueueAndActionsUseStableDtosAndEnforceTransitions() throws Exception {
    MockHttpSession adminSession = loginAsRole(Role.ADMIN);
    MockHttpSession lecturerSession = loginAsRole(Role.LECTURER);

    PublicationCase queueCase = createCase(CaseStatus.CLEARANCE_SUBMITTED, "Clearance Queue Case");
    clearances.save(ClearanceForm.builder()
      .publicationCase(queueCase)
      .status(ClearanceStatus.SUBMITTED)
      .submittedAt(Instant.now())
      .note("Ready for review")
      .build());

    String queueBody = mockMvc.perform(get("/api/admin/clearance").session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.items[*].id", hasItem(queueCase.getId().intValue())))
      .andExpect(jsonPath("$.items[*].title", hasItem("Clearance Queue Case")))
      .andExpect(jsonPath("$.items[*].status", hasItem("CLEARANCE_SUBMITTED")))
      .andReturn().getResponse().getContentAsString();

    assertThat(queueBody).doesNotContain("\"student\":");
    assertThat(queueBody).doesNotContain("\"supervisors\":");

    mockMvc.perform(post("/api/admin/clearance/{caseId}/approve", queueCase.getId()).session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.caseId").value(queueCase.getId()))
      .andExpect(jsonPath("$.status").value("READY_TO_PUBLISH"));

    assertThat(cases.findById(queueCase.getId()).orElseThrow().getStatus()).isEqualTo(CaseStatus.READY_TO_PUBLISH);
    assertThat(clearances.findByPublicationCase(queueCase).orElseThrow().getStatus()).isEqualTo(ClearanceStatus.APPROVED);
    assertThat(auditEvents.findByCaseIdOrderByCreatedAtDesc(queueCase.getId()))
      .anyMatch(event -> event.getEventType() == AuditEventType.CLEARANCE_APPROVED);

    PublicationCase correctionCase = createCase(CaseStatus.CLEARANCE_SUBMITTED, "Correction Queue Case");
    clearances.save(ClearanceForm.builder()
      .publicationCase(correctionCase)
      .status(ClearanceStatus.SUBMITTED)
      .submittedAt(Instant.now())
      .build());

    mockMvc.perform(post("/api/admin/clearance/{caseId}/request-correction", correctionCase.getId())
        .session(adminSession)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {"reason":"Please upload the signed clearance form."}
          """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.caseId").value(correctionCase.getId()))
      .andExpect(jsonPath("$.status").value("APPROVED_FOR_CLEARANCE"));

    assertThat(cases.findById(correctionCase.getId()).orElseThrow().getStatus()).isEqualTo(CaseStatus.APPROVED_FOR_CLEARANCE);
    assertThat(clearances.findByPublicationCase(correctionCase).orElseThrow().getStatus()).isEqualTo(ClearanceStatus.NEEDS_CORRECTION);
    assertThat(clearances.findByPublicationCase(correctionCase).orElseThrow().getNote())
      .isEqualTo("Please upload the signed clearance form.");
    assertThat(auditEvents.findByCaseIdOrderByCreatedAtDesc(correctionCase.getId()))
      .anyMatch(event -> event.getEventType() == AuditEventType.CLEARANCE_CORRECTION_REQUESTED);

    PublicationCase invalidCase = createCase(CaseStatus.APPROVED_FOR_CLEARANCE, "Invalid Clearance Case");
    clearances.save(ClearanceForm.builder()
      .publicationCase(invalidCase)
      .status(ClearanceStatus.SUBMITTED)
      .submittedAt(Instant.now())
      .build());

    mockMvc.perform(post("/api/admin/clearance/{caseId}/request-correction", invalidCase.getId())
        .session(adminSession)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {"reason":"Should fail outside the clearance queue."}
          """))
      .andExpect(status().isConflict());

    mockMvc.perform(get("/api/admin/clearance").session(lecturerSession))
      .andExpect(status().isForbidden());
  }

  @Test
  void publishEndpointsUseStableDtosAndEnforceTransitions() throws Exception {
    MockHttpSession adminSession = loginAsRole(Role.ADMIN);
    MockHttpSession lecturerSession = loginAsRole(Role.LECTURER);

    PublicationCase readyCase = createCase(CaseStatus.READY_TO_PUBLISH, "Publish Ready Case");
    clearances.save(ClearanceForm.builder()
      .publicationCase(readyCase)
      .status(ClearanceStatus.APPROVED)
      .submittedAt(Instant.now().minusSeconds(3600))
      .approvedAt(Instant.now())
      .build());
    SubmissionVersion approvedVersion = createSubmission(readyCase, SubmissionStatus.APPROVED, "publish-ready.pdf");

    mockMvc.perform(get("/api/admin/publish").session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[*].caseId", hasItem(readyCase.getId().intValue())))
      .andExpect(jsonPath("$[*].title", hasItem("Publish Ready Case")));

    String detailBody = mockMvc.perform(get("/api/admin/publish/{caseId}", readyCase.getId()).session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.caseId").value(readyCase.getId()))
      .andExpect(jsonPath("$.title").value("Publish Ready Case"))
      .andExpect(jsonPath("$.latestSubmission.id").value(approvedVersion.getId()))
      .andExpect(jsonPath("$.latestSubmission.downloadUrl").value("/api/admin/cases/" + readyCase.getId() + "/file/latest"))
      .andReturn().getResponse().getContentAsString();

    assertThat(detailBody).doesNotContain("publicationCase");
    assertThat(detailBody).doesNotContain("filePath");

    mockMvc.perform(post("/api/admin/publish/{caseId}", readyCase.getId()).session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.publishedId", notNullValue()))
      .andExpect(jsonPath("$.status").value("PUBLISHED"));

    assertThat(cases.findById(readyCase.getId()).orElseThrow().getStatus()).isEqualTo(CaseStatus.PUBLISHED);
    assertThat(publishedItems.existsByPublicationCase_Id(readyCase.getId())).isTrue();
    assertThat(auditEvents.findByCaseIdOrderByCreatedAtDesc(readyCase.getId()))
      .anyMatch(event -> event.getEventType() == AuditEventType.PUBLISHED);

    mockMvc.perform(post("/api/admin/publish/{caseId}/unpublish", readyCase.getId())
        .session(adminSession)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {"reason":"Metadata and abstract need correction."}
          """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.caseId").value(readyCase.getId()))
      .andExpect(jsonPath("$.status").value("NEEDS_REVISION_LIBRARY"));

    assertThat(cases.findById(readyCase.getId()).orElseThrow().getStatus()).isEqualTo(CaseStatus.NEEDS_REVISION_LIBRARY);
    assertThat(publishedItems.existsByPublicationCase_Id(readyCase.getId())).isFalse();
    assertThat(comments.findByPublicationCaseOrderByCreatedAtAsc(readyCase))
      .extracting(comment -> comment.getBody())
      .contains("Metadata and abstract need correction.");
    assertThat(auditEvents.findByCaseIdOrderByCreatedAtDesc(readyCase.getId()))
      .anyMatch(event -> event.getEventType() == AuditEventType.UNPUBLISHED_FOR_CORRECTION);

    PublicationCase invalidCase = createCase(CaseStatus.READY_TO_PUBLISH, "Not Yet Published");
    clearances.save(ClearanceForm.builder()
      .publicationCase(invalidCase)
      .status(ClearanceStatus.APPROVED)
      .submittedAt(Instant.now().minusSeconds(3600))
      .approvedAt(Instant.now())
      .build());
    createSubmission(invalidCase, SubmissionStatus.APPROVED, "invalid-publish.pdf");

    mockMvc.perform(post("/api/admin/publish/{caseId}/unpublish", invalidCase.getId())
        .session(adminSession)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {"reason":"Should fail before publish."}
          """))
      .andExpect(status().isConflict());

    mockMvc.perform(post("/api/admin/publish/{caseId}", invalidCase.getId()).session(lecturerSession))
      .andExpect(status().isForbidden());
  }

  private PublicationCase createCase(CaseStatus status, String title) {
    PublicationCase publicationCase = cases.save(PublicationCase.builder()
      .student(student)
      .type(PublicationType.THESIS)
      .status(status)
      .build());

    registrations.save(PublicationRegistration.builder()
      .publicationCase(publicationCase)
      .title(title)
      .year(2026)
      .faculty("Faculty of Engineering and Technology (FET)")
      .studentIdNumber("S-" + UUID.randomUUID().toString().substring(0, 8))
      .authorName("Admin Publish Student")
      .build());

    return publicationCase;
  }

  private SubmissionVersion createSubmission(PublicationCase publicationCase, SubmissionStatus status, String filename) {
    return submissionVersions.save(SubmissionVersion.builder()
      .publicationCase(publicationCase)
      .versionNumber(1)
      .filePath("test/admin/" + UUID.randomUUID() + ".pdf")
      .originalFilename(filename)
      .contentType("application/pdf")
      .fileSize(8192L)
      .status(status)
      .metadataTitle("Published Thesis")
      .metadataAuthors("Student Author")
      .metadataKeywords("repository, thesis")
      .metadataFaculty("Faculty of Engineering and Technology (FET)")
      .metadataYear(2026)
      .abstractText("Repository-ready abstract")
      .build());
  }

  private MockHttpSession loginAsRole(Role role) throws Exception {
    return login(requireUser(role).getEmail(), passwordForRole(role));
  }

  private MockHttpSession login(String username, String password) throws Exception {
    return (MockHttpSession) mockMvc.perform(post("/api/auth/login")
        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
        .param("username", username)
        .param("password", password))
      .andExpect(status().isOk())
      .andReturn()
      .getRequest()
      .getSession(false);
  }

  private String passwordForRole(Role role) {
    return switch (role) {
      case STUDENT -> "test-only-student-password";
      case LECTURER -> "test-only-lecturer-password";
      case ADMIN -> "test-only-admin-password";
    };
  }

  private User requireUser(Role role) {
    return users.findByRole(role).stream()
      .findFirst()
      .orElseThrow(() -> new IllegalStateException("No seeded user found for role " + role));
  }
}
