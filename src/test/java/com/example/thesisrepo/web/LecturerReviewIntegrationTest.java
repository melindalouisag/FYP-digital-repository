package com.example.thesisrepo.web;

import com.example.thesisrepo.profile.LecturerProfile;
import com.example.thesisrepo.profile.LecturerProfileRepository;
import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.CaseSupervisor;
import com.example.thesisrepo.publication.ChecklistItemV2;
import com.example.thesisrepo.publication.ChecklistScope;
import com.example.thesisrepo.publication.ChecklistTemplate;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.publication.SubmissionStatus;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.WorkflowComment;
import com.example.thesisrepo.publication.repo.AuditEventRepository;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
import com.example.thesisrepo.publication.repo.ChecklistItemV2Repository;
import com.example.thesisrepo.publication.repo.ChecklistTemplateRepository;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Set;
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
class LecturerReviewIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private PublicationCaseRepository cases;
  @Autowired private PublicationRegistrationRepository registrations;
  @Autowired private CaseSupervisorRepository caseSupervisors;
  @Autowired private SubmissionVersionRepository submissionVersions;
  @Autowired private WorkflowCommentRepository comments;
  @Autowired private AuditEventRepository auditEvents;
  @Autowired private ChecklistTemplateRepository checklistTemplates;
  @Autowired private ChecklistItemV2Repository checklistItems;
  @Autowired private LecturerProfileRepository lecturerProfiles;
  @Autowired private PasswordEncoder passwordEncoder;
  @Autowired private TransactionTemplate transactionTemplate;

  private User student;
  private ChecklistTemplate activeTemplate;

  @BeforeEach
  void setUp() {
    student = requireUser(Role.STUDENT);
    activeTemplate = ensureActiveTemplate(ChecklistScope.THESIS);
  }

  @Test
  void lecturerQueueAndSubmissionEndpointsReturnStableDtos() throws Exception {
    User lecturer = createLecturerUser("test-only-lecturer-review-dto-password");
    MockHttpSession lecturerSession = login(lecturer.getEmail(), "test-only-lecturer-review-dto-password");

    PublicationCase reviewCase = createLecturerCase(lecturer, CaseStatus.UNDER_SUPERVISOR_REVIEW, "Lecturer DTO Case");
    SubmissionVersion version = createSubmission(reviewCase, 1, SubmissionStatus.SUBMITTED);

    mockMvc.perform(get("/api/lecturer/review").session(lecturerSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.items[*].id", hasItem(reviewCase.getId().intValue())))
      .andExpect(jsonPath("$.items[*].title", hasItem("Lecturer DTO Case")));

    mockMvc.perform(get("/api/lecturer/students").session(lecturerSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[*].caseId", hasItem(reviewCase.getId().intValue())))
      .andExpect(jsonPath("$[*].studentId", hasItem(student.getId().intValue())));

    String submissionsBody = mockMvc.perform(get("/api/lecturer/cases/{caseId}/submissions", reviewCase.getId()).session(lecturerSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[0].id").value(version.getId()))
      .andExpect(jsonPath("$[0].versionNumber").value(1))
      .andExpect(jsonPath("$[0].originalFilename").value("lecturer-review.pdf"))
      .andExpect(jsonPath("$[0].status").value("SUBMITTED"))
      .andExpect(jsonPath("$[0].contentType").value("application/pdf"))
      .andExpect(jsonPath("$[0].fileSize").value(2048))
      .andReturn().getResponse().getContentAsString();

    assertThat(submissionsBody).doesNotContain("publicationCase");
    assertThat(submissionsBody).doesNotContain("filePath");
    assertThat(submissionsBody).doesNotContain("checklistTemplate");
  }

  @Test
  void lecturerReviewActionsReturnStableDtosAndEnforceAssignment() throws Exception {
    User lecturer = createLecturerUser("test-only-lecturer-review-actions-password");
    User otherLecturer = createLecturerUser("test-only-lecturer-review-other-password");
    MockHttpSession lecturerSession = login(lecturer.getEmail(), "test-only-lecturer-review-actions-password");
    MockHttpSession otherLecturerSession = login(otherLecturer.getEmail(), "test-only-lecturer-review-other-password");

    PublicationCase commentCase = createLecturerCase(lecturer, CaseStatus.UNDER_SUPERVISOR_REVIEW, "Comment Case");
    PublicationCase revisionCase = createLecturerCase(lecturer, CaseStatus.UNDER_SUPERVISOR_REVIEW, "Revision Case");
    PublicationCase readyCase = createLecturerCase(lecturer, CaseStatus.UNDER_SUPERVISOR_REVIEW, "Ready Case");
    PublicationCase forwardCase = createLecturerCase(lecturer, CaseStatus.READY_TO_FORWARD, "Forward Case");

    mockMvc.perform(post("/api/lecturer/cases/{caseId}/comment", commentCase.getId())
        .session(lecturerSession)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {"body":"Please revise the abstract section."}
          """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.ok").value(true));

    assertThat(comments.findByPublicationCaseOrderByCreatedAtAsc(commentCase))
      .singleElement()
      .extracting(WorkflowComment::getBody)
      .isEqualTo("Please revise the abstract section.");
    assertThat(auditEvents.findByCaseIdOrderByCreatedAtDesc(commentCase.getId()))
      .anyMatch(event -> event.getEventType() == AuditEventType.FEEDBACK_ADDED);

    mockMvc.perform(post("/api/lecturer/cases/{caseId}/request-revision", revisionCase.getId())
        .session(lecturerSession)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {"reason":"Metadata is incomplete."}
          """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.caseId").value(revisionCase.getId()))
      .andExpect(jsonPath("$.status").value("NEEDS_REVISION_SUPERVISOR"));

    mockMvc.perform(post("/api/lecturer/cases/{caseId}/mark-ready", readyCase.getId())
        .session(lecturerSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.caseId").value(readyCase.getId()))
      .andExpect(jsonPath("$.status").value("READY_TO_FORWARD"));

    mockMvc.perform(post("/api/lecturer/cases/{caseId}/approve-and-forward", forwardCase.getId())
        .session(lecturerSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.caseId").value(forwardCase.getId()))
      .andExpect(jsonPath("$.status").value("FORWARDED_TO_LIBRARY"));

    mockMvc.perform(post("/api/lecturer/cases/{caseId}/request-revision", readyCase.getId())
        .session(lecturerSession)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {"reason":"Too late for revision."}
          """))
      .andExpect(status().isConflict());

    mockMvc.perform(get("/api/lecturer/cases/{caseId}/submissions", commentCase.getId()).session(otherLecturerSession))
      .andExpect(status().isForbidden());
  }

  private PublicationCase createLecturerCase(User lecturer, CaseStatus status, String title) {
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
      .authorName("Student Reviewer")
      .build());

    caseSupervisors.save(CaseSupervisor.builder()
      .publicationCase(publicationCase)
      .lecturer(lecturer)
      .build());

    return publicationCase;
  }

  private SubmissionVersion createSubmission(PublicationCase publicationCase, int versionNumber, SubmissionStatus status) {
    return submissionVersions.save(SubmissionVersion.builder()
      .publicationCase(publicationCase)
      .versionNumber(versionNumber)
      .filePath("test/lecturer/" + UUID.randomUUID() + ".pdf")
      .originalFilename("lecturer-review.pdf")
      .contentType("application/pdf")
      .fileSize(2048L)
      .status(status)
      .checklistTemplate(activeTemplate)
      .metadataTitle("Submission For Lecturer Review")
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

  private User createLecturerUser(String rawPassword) {
    return transactionTemplate.execute(status -> {
      User created = users.save(User.builder()
        .email("lecturer+" + UUID.randomUUID() + "@sampoernauniversity.ac.id")
        .passwordHash(passwordEncoder.encode(rawPassword))
        .role(Role.LECTURER)
        .roles(Set.of(Role.LECTURER))
        .emailVerified(true)
        .build());

      lecturerProfiles.save(LecturerProfile.builder()
        .user(created)
        .name("Integration Lecturer")
        .department("Informatics")
        .faculty("Faculty of Engineering and Technology (FET)")
        .build());
      return created;
    });
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

  private User requireUser(Role role) {
    return users.findByRole(role).stream()
      .findFirst()
      .orElseThrow(() -> new IllegalStateException("No seeded user found for role " + role));
  }
}
