package com.example.thesisrepo.web;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.ChecklistItemV2;
import com.example.thesisrepo.publication.ChecklistScope;
import com.example.thesisrepo.publication.ChecklistTemplate;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.repo.AuditEventRepository;
import com.example.thesisrepo.publication.repo.ChecklistItemV2Repository;
import com.example.thesisrepo.publication.repo.ChecklistTemplateRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.publication.repo.SubmissionVersionRepository;
import com.example.thesisrepo.service.StorageService;
import com.example.thesisrepo.service.workflow.AuditEventService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockReset;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StudentSubmissionIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private StudentProfileRepository studentProfiles;
  @Autowired private PublicationCaseRepository cases;
  @Autowired private PublicationRegistrationRepository registrations;
  @Autowired private SubmissionVersionRepository submissionVersions;
  @Autowired private ChecklistTemplateRepository checklistTemplates;
  @Autowired private ChecklistItemV2Repository checklistItems;
  @Autowired private AuditEventRepository auditEvents;

  @SpyBean(reset = MockReset.BEFORE)
  private StorageService storageService;

  @SpyBean(reset = MockReset.BEFORE)
  private AuditEventService auditEventService;

  private User student;

  @BeforeEach
  void setUp() {
    student = requireUser(Role.STUDENT);
    ensureActiveTemplate(ChecklistScope.THESIS);
  }

  @Test
  void successfulUploadReturnsDtoResponsesAndAdvancesWorkflow() throws Exception {
    PublicationCase publicationCase = cases.save(PublicationCase.builder()
      .student(student)
      .type(PublicationType.THESIS)
      .status(CaseStatus.REGISTRATION_VERIFIED)
      .build());
    registrations.save(PublicationRegistration.builder()
      .publicationCase(publicationCase)
      .title("Submission Case")
      .studentIdNumber("S-001")
      .authorName("Student One")
      .faculty("Faculty of Engineering and Technology (FET)")
      .build());

    StudentProfile profile = studentProfiles.findByUserId(student.getId()).orElseThrow();
    MockHttpSession session = loginAsRole(Role.STUDENT);

    mockMvc.perform(multipart("/api/student/cases/{caseId}/submissions", publicationCase.getId())
        .file(pdfFile("submission.pdf"))
        .file(metadataPart(profile))
        .session(session))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.submissionId").isNumber())
      .andExpect(jsonPath("$.version").value(1));

    SubmissionVersion stored = submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(publicationCase).orElseThrow();
    assertThat(stored.getVersionNumber()).isEqualTo(1);
    assertThat(stored.getMetadataTitle()).isEqualTo("Submission Title");
    assertThat(stored.getMetadataStudyProgram()).isEqualTo(profile.getProgram());
    assertThat(storageService.exists(stored.getFilePath())).isTrue();
    assertThat(cases.findById(publicationCase.getId()).orElseThrow().getStatus()).isEqualTo(CaseStatus.UNDER_SUPERVISOR_REVIEW);
    assertThat(auditEvents.findByCaseIdOrderByCreatedAtDesc(publicationCase.getId()))
      .anyMatch(event -> event.getEventType() == AuditEventType.SUBMISSION_UPLOADED);

    mockMvc.perform(get("/api/student/cases/{caseId}/submissions", publicationCase.getId()).session(session))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[0].id").value(stored.getId()))
      .andExpect(jsonPath("$[0].metadataTitle").value("Submission Title"))
      .andExpect(jsonPath("$[0].metadataStudyProgram").value(profile.getProgram()))
      .andExpect(jsonPath("$[0].checklistTemplate.id").isNumber())
      .andExpect(jsonPath("$[0].filePath").doesNotExist())
      .andExpect(jsonPath("$[0].publicationCase").doesNotExist());

    mockMvc.perform(get("/api/student/cases/{caseId}", publicationCase.getId()).session(session))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.versions[0].id").value(stored.getId()))
      .andExpect(jsonPath("$.versions[0].contentType").value("application/pdf"))
      .andExpect(jsonPath("$.versions[0].fileSize").value(stored.getFileSize()))
      .andExpect(jsonPath("$.versions[0].metadataTitle").doesNotExist())
      .andExpect(jsonPath("$.versions[0].filePath").doesNotExist());
  }

  @Test
  void uploadIsStillForbiddenWhenWorkflowGateDoesNotAllowIt() throws Exception {
    PublicationCase publicationCase = cases.save(PublicationCase.builder()
      .student(student)
      .type(PublicationType.THESIS)
      .status(CaseStatus.REGISTRATION_PENDING)
      .build());

    MockHttpSession session = loginAsRole(Role.STUDENT);

    mockMvc.perform(multipart("/api/student/cases/{caseId}/submissions", publicationCase.getId())
        .file(pdfFile("submission.pdf"))
        .session(session))
      .andExpect(status().isBadRequest())
      .andExpect(result -> assertThat(result.getResponse().getErrorMessage())
        .contains("Registration must be verified by the library before submission."));

    assertThat(submissionVersions.findByPublicationCaseOrderByVersionNumberDesc(publicationCase)).isEmpty();
    assertThat(auditEvents.findByCaseIdOrderByCreatedAtDesc(publicationCase.getId()))
      .noneMatch(event -> event.getEventType() == AuditEventType.SUBMISSION_UPLOADED);
  }

  @Test
  void auditPersistenceFailureDeletesUploadedBlobAndRollsBackSubmission() throws Exception {
    PublicationCase publicationCase = cases.save(PublicationCase.builder()
      .student(student)
      .type(PublicationType.THESIS)
      .status(CaseStatus.REGISTRATION_VERIFIED)
      .build());

    MockHttpSession session = loginAsRole(Role.STUDENT);
    AtomicReference<String> storedKeyRef = new AtomicReference<>();

    doAnswer(invocation -> {
      String storedKey = (String) invocation.callRealMethod();
      storedKeyRef.set(storedKey);
      return storedKey;
    }).when(storageService).saveDocument(any());

    doThrow(new IllegalStateException("Simulated audit persistence failure"))
      .when(auditEventService)
      .log(eq(publicationCase.getId()), any(Long.class), any(User.class), eq(Role.STUDENT), eq(AuditEventType.SUBMISSION_UPLOADED), anyString());

    mockMvc.perform(multipart("/api/student/cases/{caseId}/submissions", publicationCase.getId())
        .file(pdfFile("submission.pdf"))
        .session(session))
      .andExpect(status().isInternalServerError());

    assertThat(storedKeyRef.get()).isNotBlank();
    assertThat(storageService.exists(storedKeyRef.get())).isFalse();
    assertThat(submissionVersions.findByPublicationCaseOrderByVersionNumberDesc(publicationCase)).isEmpty();
    assertThat(cases.findById(publicationCase.getId()).orElseThrow().getStatus()).isEqualTo(CaseStatus.REGISTRATION_VERIFIED);
  }

  private MockMultipartFile metadataPart(StudentProfile profile) {
    return new MockMultipartFile(
      "meta",
      "",
      MediaType.APPLICATION_JSON_VALUE,
      """
        {
          "metadataTitle":"Submission Title",
          "metadataAuthors":"Student One",
          "metadataKeywords":"repository, thesis",
          "metadataFaculty":"%s",
          "metadataStudyProgram":"%s",
          "metadataYear":2026,
          "abstractText":"Submission abstract."
        }
        """.formatted(profile.getFaculty(), profile.getProgram()).getBytes(StandardCharsets.UTF_8)
    );
  }

  private MockMultipartFile pdfFile(String filename) {
    return new MockMultipartFile(
      "file",
      filename,
      "application/pdf",
      "%PDF-1.4\nsubmission".getBytes(StandardCharsets.UTF_8)
    );
  }

  private void ensureActiveTemplate(ChecklistScope scope) {
    if (checklistTemplates.findFirstByPublicationTypeAndIsActiveTrue(scope).isPresent()) {
      return;
    }

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
  }

  private User requireUser(Role role) {
    return users.findByRole(role).stream()
      .findFirst()
      .orElseThrow(() -> new IllegalStateException("No seeded user found for role " + role));
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
}
