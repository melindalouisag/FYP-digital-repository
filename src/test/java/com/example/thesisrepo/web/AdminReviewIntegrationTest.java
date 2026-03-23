package com.example.thesisrepo.web;

import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.ChecklistItemV2;
import com.example.thesisrepo.publication.ChecklistScope;
import com.example.thesisrepo.publication.ChecklistTemplate;
import com.example.thesisrepo.publication.ClearanceForm;
import com.example.thesisrepo.publication.ClearanceStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.publication.SubmissionStatus;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.WorkflowComment;
import com.example.thesisrepo.publication.repo.AuditEventRepository;
import com.example.thesisrepo.publication.repo.ChecklistItemV2Repository;
import com.example.thesisrepo.publication.repo.ChecklistResultRepository;
import com.example.thesisrepo.publication.repo.ChecklistTemplateRepository;
import com.example.thesisrepo.publication.repo.ClearanceFormRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
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

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminReviewIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private PublicationCaseRepository cases;
  @Autowired private PublicationRegistrationRepository registrations;
  @Autowired private SubmissionVersionRepository submissionVersions;
  @Autowired private WorkflowCommentRepository comments;
  @Autowired private ClearanceFormRepository clearances;
  @Autowired private ChecklistTemplateRepository checklistTemplates;
  @Autowired private ChecklistItemV2Repository checklistItems;
  @Autowired private ChecklistResultRepository checklistResults;
  @Autowired private AuditEventRepository auditEvents;

  private User student;
  private User admin;
  private ChecklistTemplate activeTemplate;

  @BeforeEach
  void setUp() {
    student = requireUser(Role.STUDENT);
    admin = requireUser(Role.ADMIN);
    activeTemplate = ensureActiveTemplate(ChecklistScope.THESIS);
  }

  @Test
  void adminReviewDetailUsesStableDtoShapeWithoutEntityLeakage() throws Exception {
    MockHttpSession adminSession = loginAsRole(Role.ADMIN);

    PublicationCase reviewCase = createAdminReviewCase(CaseStatus.UNDER_LIBRARY_REVIEW, "Admin Detail Case");
    SubmissionVersion version = createSubmission(reviewCase, 1, SubmissionStatus.UNDER_REVIEW, "admin-review.pdf");
    comments.save(WorkflowComment.builder()
      .publicationCase(reviewCase)
      .submissionVersion(version)
      .author(admin)
      .authorRole(Role.ADMIN)
      .authorEmail(admin.getEmail())
      .body("Checklist reviewed.")
      .build());
    clearances.save(ClearanceForm.builder()
      .publicationCase(reviewCase)
      .status(ClearanceStatus.DRAFT)
      .note("Clearance pending")
      .build());

    mockMvc.perform(get("/api/admin/review").session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[*].id", hasItem(reviewCase.getId().intValue())))
      .andExpect(jsonPath("$[*].title", hasItem("Admin Detail Case")));

    String detailBody = mockMvc.perform(get("/api/admin/cases/{caseId}", reviewCase.getId()).session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.case.id").value(reviewCase.getId()))
      .andExpect(jsonPath("$.case.status").value("UNDER_LIBRARY_REVIEW"))
      .andExpect(jsonPath("$.case.title").value("Admin Detail Case"))
      .andExpect(jsonPath("$.registration.title").value("Admin Detail Case"))
      .andExpect(jsonPath("$.submissions[0].id").value(version.getId()))
      .andExpect(jsonPath("$.submissions[0].checklistTemplate.id").value(activeTemplate.getId()))
      .andExpect(jsonPath("$.comments[0].authorRole").value("ADMIN"))
      .andExpect(jsonPath("$.comments[0].submissionVersionId").value(version.getId()))
      .andExpect(jsonPath("$.clearance.status").value("DRAFT"))
      .andExpect(jsonPath("$.timeline").isArray())
      .andReturn().getResponse().getContentAsString();

    assertThat(detailBody).doesNotContain("publicationCase");
    assertThat(detailBody).doesNotContain("filePath");
    assertThat(detailBody).doesNotContain("\"author\":");
    assertThat(detailBody).doesNotContain("\"student\":");
  }

  @Test
  void adminReviewActionsReturnStableDtosAndEnforceReviewStage() throws Exception {
    MockHttpSession adminSession = loginAsRole(Role.ADMIN);
    MockHttpSession lecturerSession = loginAsRole(Role.LECTURER);

    PublicationCase checklistCase = createAdminReviewCase(CaseStatus.FORWARDED_TO_LIBRARY, "Checklist Case");
    SubmissionVersion checklistSubmission = createSubmission(checklistCase, 1, SubmissionStatus.SUBMITTED, "checklist-case.pdf");

    List<ChecklistItemV2> templateItems = checklistItems.findByTemplateOrderByOrderIndexAsc(activeTemplate);
    mockMvc.perform(post("/api/admin/cases/{caseId}/checklist-results", checklistCase.getId())
        .session(adminSession)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "submissionVersionId": %d,
            "results": [
              { "checklistItemId": %d, "pass": true, "note": "Looks good" }
            ]
          }
          """.formatted(checklistSubmission.getId(), templateItems.get(0).getId())))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.ok").value(true));

    assertThat(checklistResults.findBySubmissionVersion(checklistSubmission)).hasSize(1);
    assertThat(cases.findById(checklistCase.getId()).orElseThrow().getStatus()).isEqualTo(CaseStatus.UNDER_LIBRARY_REVIEW);
    assertThat(submissionVersions.findById(checklistSubmission.getId()).orElseThrow().getStatus()).isEqualTo(SubmissionStatus.UNDER_REVIEW);
    assertThat(auditEvents.findByCaseIdOrderByCreatedAtDesc(checklistCase.getId()))
      .anyMatch(event -> event.getEventType() == AuditEventType.LIBRARY_CHECKLIST_REVIEWED);

    PublicationCase approveCase = createAdminReviewCase(CaseStatus.UNDER_LIBRARY_REVIEW, "Approve Case");
    SubmissionVersion approveSubmission = createSubmission(approveCase, 1, SubmissionStatus.UNDER_REVIEW, "approve-case.pdf");

    mockMvc.perform(post("/api/admin/cases/{caseId}/approve", approveCase.getId()).session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.caseId").value(approveCase.getId()))
      .andExpect(jsonPath("$.status").value("APPROVED_FOR_CLEARANCE"));

    assertThat(submissionVersions.findById(approveSubmission.getId()).orElseThrow().getStatus()).isEqualTo(SubmissionStatus.APPROVED);

    PublicationCase revisionCase = createAdminReviewCase(CaseStatus.UNDER_LIBRARY_REVIEW, "Revision Case");
    createSubmission(revisionCase, 1, SubmissionStatus.UNDER_REVIEW, "revision-case.pdf");

    mockMvc.perform(post("/api/admin/cases/{caseId}/request-revision", revisionCase.getId())
        .session(adminSession)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {"reason":"Please correct the formatting."}
          """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.caseId").value(revisionCase.getId()))
      .andExpect(jsonPath("$.status").value("NEEDS_REVISION_LIBRARY"));

    PublicationCase invalidCase = createAdminReviewCase(CaseStatus.REGISTRATION_VERIFIED, "Invalid Review Stage");
    createSubmission(invalidCase, 1, SubmissionStatus.SUBMITTED, "invalid-case.pdf");

    mockMvc.perform(post("/api/admin/cases/{caseId}/approve", invalidCase.getId()).session(adminSession))
      .andExpect(status().isConflict());

    mockMvc.perform(get("/api/admin/cases/{caseId}", checklistCase.getId()).session(lecturerSession))
      .andExpect(status().isForbidden());
  }

  private PublicationCase createAdminReviewCase(CaseStatus status, String title) {
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
      .authorName("Admin Review Student")
      .build());

    return publicationCase;
  }

  private SubmissionVersion createSubmission(PublicationCase publicationCase, int versionNumber, SubmissionStatus status, String filename) {
    return submissionVersions.save(SubmissionVersion.builder()
      .publicationCase(publicationCase)
      .versionNumber(versionNumber)
      .filePath("test/admin/" + UUID.randomUUID() + ".pdf")
      .originalFilename(filename)
      .contentType("application/pdf")
      .fileSize(4096L)
      .status(status)
      .checklistTemplate(activeTemplate)
      .metadataTitle("Admin Review Submission")
      .build());
  }

  private ChecklistTemplate ensureActiveTemplate(ChecklistScope scope) {
    return checklistTemplates.findFirstByPublicationTypeAndIsActiveTrue(scope).orElseGet(() -> {
      ChecklistTemplate template = checklistTemplates.save(ChecklistTemplate.builder()
        .publicationType(scope)
        .version(1)
        .isActive(true)
        .build());

      checklistItems.save(ChecklistItemV2.builder()
        .template(template)
        .orderIndex(1)
        .section("General")
        .itemText("Seed item")
        .guidanceText("Seed guidance")
        .isRequired(true)
        .build());
      return template;
    });
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
