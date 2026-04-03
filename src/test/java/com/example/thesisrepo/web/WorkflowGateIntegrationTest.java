package com.example.thesisrepo.web;

import com.example.thesisrepo.profile.LecturerProfile;
import com.example.thesisrepo.profile.LecturerProfileRepository;
import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.*;
import com.example.thesisrepo.publication.repo.*;
import com.example.thesisrepo.reminder.StudentDashboardReminderRepository;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkflowGateIntegrationTest {
  private static final String STUDENT_PASSWORD = "test-only-student-password";
  private static final String LECTURER_PASSWORD = "test-only-lecturer-password";
  private static final String ADMIN_PASSWORD = "test-only-admin-password";

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private PublicationCaseRepository cases;
  @Autowired private PublicationRegistrationRepository registrations;
  @Autowired private CaseSupervisorRepository caseSupervisors;
  @Autowired private SubmissionVersionRepository versions;
  @Autowired private PublishedItemRepository publishedItems;
  @Autowired private ChecklistTemplateRepository checklistTemplates;
  @Autowired private ChecklistItemV2Repository checklistItems;
  @Autowired private AuditEventRepository auditEvents;
  @Autowired private LecturerProfileRepository lecturerProfiles;
  @Autowired private StudentProfileRepository studentProfiles;
  @Autowired private StudentDashboardReminderRepository reminders;
  @Autowired private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
  @Autowired private com.example.thesisrepo.service.workflow.PublicationWorkflowGateService workflowGates;
  @Autowired private TransactionTemplate transactionTemplate;

  private User student;
  private User lecturer;

  @BeforeEach
  void setup() {
    reminders.deleteAll();
    student = requireUser(Role.STUDENT);
    lecturer = requireUser(Role.LECTURER);
    ensureActiveTemplate(ChecklistScope.THESIS);
  }

  @Test
  void submittingRegistrationCreatesAuditEvent() throws Exception {
    StudentLogin studentLogin = createStudentLogin("test-only-audit-student-password");
    MockHttpSession studentSession = studentLogin.session();

    String response = mockMvc.perform(post("/api/student/registrations")
        .contentType(MediaType.APPLICATION_JSON)
        .session(studentSession)
        .content("""
          {"type":"THESIS","title":"Audit Registration","supervisorUserIds":[%d]}
          """.formatted(lecturer.getId())))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();

    Long caseId = Long.valueOf(response.replaceAll(".*\"caseId\":(\\d+).*", "$1"));

    mockMvc.perform(post("/api/student/registrations/{caseId}/submit", caseId)
        .contentType(MediaType.APPLICATION_JSON)
        .session(studentSession)
        .content("{\"permissionAccepted\":true}"))
      .andExpect(status().isOk());

    assertThat(auditEvents.findByCaseIdOrderByCreatedAtDesc(caseId))
      .anyMatch(event ->
        event.getEventType() == AuditEventType.REGISTRATION_SUBMITTED
          && event.getActorRole() == Role.STUDENT
          && event.getActorEmail() != null);
  }

  @Test
  void studentCannotUploadWhenRegistrationNotApproved() throws Exception {
    StudentLogin studentLogin = createStudentLogin("test-only-gate-student-password");
    MockHttpSession session = studentLogin.session();

    String response = mockMvc.perform(post("/api/student/registrations")
        .contentType(MediaType.APPLICATION_JSON)
        .session(session)
        .content("""
          {"type":"THESIS","title":"Gate Test","supervisorUserIds":[%d]}
          """.formatted(lecturer.getId())))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();

    Long caseId = Long.valueOf(response.replaceAll(".*\"caseId\":(\\d+).*", "$1"));

    mockMvc.perform(multipart("/api/student/cases/{caseId}/submissions", caseId)
        .file(new MockMultipartFile("file", "test.pdf", "application/pdf", "%PDF-1.4\ncontent".getBytes()))
        .session(session))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.message", containsString("Registration must be verified by the library before submission.")));
  }

  @Test
  void adminReviewQueueExcludesSupervisorStageUntilLecturerForwards() throws Exception {
    StudentLogin studentLogin = createStudentLogin("test-only-forward-student-password");
    MockHttpSession studentSession = studentLogin.session();
    MockHttpSession lecturerSession = loginAsRole(Role.LECTURER);
    MockHttpSession adminSession = loginAsRole(Role.ADMIN);

    String response = mockMvc.perform(post("/api/student/registrations")
        .contentType(MediaType.APPLICATION_JSON)
        .session(studentSession)
        .content("""
          {"type":"THESIS","title":"Forward Gate","supervisorUserIds":[%d]}
          """.formatted(lecturer.getId())))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();

    Long caseId = Long.valueOf(response.replaceAll(".*\"caseId\":(\\d+).*", "$1"));

    mockMvc.perform(post("/api/student/registrations/{caseId}/submit", caseId)
        .contentType(MediaType.APPLICATION_JSON)
        .session(studentSession)
        .content("{\"permissionAccepted\":true}"))
      .andExpect(status().isOk());

    mockMvc.perform(post("/api/lecturer/approvals/{caseId}/approve", caseId)
        .session(lecturerSession))
      .andExpect(status().isOk());

    mockMvc.perform(post("/api/admin/registration-approvals/{caseId}/approve", caseId)
        .session(adminSession))
      .andExpect(status().isOk());

    mockMvc.perform(multipart("/api/student/cases/{caseId}/submissions", caseId)
        .file(new MockMultipartFile("file", "submission.pdf", "application/pdf", "%PDF-1.4\ncontent".getBytes()))
        .file(submissionMetadataPart(student))
        .session(studentSession))
      .andExpect(status().isOk());

    mockMvc.perform(get("/api/admin/review").session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.items[*].id", not(hasItem(caseId.intValue()))));

    mockMvc.perform(post("/api/lecturer/cases/{caseId}/approve-and-forward", caseId)
        .session(lecturerSession))
      .andExpect(status().isOk());

    mockMvc.perform(get("/api/admin/review").session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.items[*].id", hasItem(caseId.intValue())));
  }

  @Test
  void registrationRejectsSupervisorOutsideStudentStudyProgram() throws Exception {
    LecturerProfile lecturerProfile = lecturerProfiles.findByUserId(lecturer.getId()).orElseThrow();
    String originalDepartment = lecturerProfile.getDepartment();
    String originalFaculty = lecturerProfile.getFaculty();

    try {
      lecturerProfile.setDepartment("Accounting");
      lecturerProfile.setFaculty("Faculty of Engineering and Technology (FET)");
      lecturerProfiles.save(lecturerProfile);

      StudentLogin studentLogin = createStudentLogin("test-only-program-match-password");
      MockHttpSession studentSession = studentLogin.session();

      mockMvc.perform(post("/api/student/registrations")
          .contentType(MediaType.APPLICATION_JSON)
          .session(studentSession)
          .content("""
            {"type":"THESIS","title":"Program Match Test","supervisorUserIds":[%d]}
            """.formatted(lecturer.getId())))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message", containsString("Supervisor must be from the same study program.")));
    } finally {
      lecturerProfile.setDepartment(originalDepartment);
      lecturerProfile.setFaculty(originalFaculty);
      lecturerProfiles.save(lecturerProfile);
    }
  }

  @Test
  void registrationRejectsMultipleSupervisorEmails() throws Exception {
    StudentLogin studentLogin = createStudentLogin("test-only-multi-supervisor-password");
    MockHttpSession studentSession = studentLogin.session();

    mockMvc.perform(post("/api/student/registrations")
        .contentType(MediaType.APPLICATION_JSON)
        .session(studentSession)
        .content("""
          {
            "type":"THESIS",
            "title":"Multiple Supervisor Test",
            "supervisorEmails":["%s","%s"]
          }
          """.formatted(lecturer.getEmail(), student.getEmail())))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.message", containsString("Only one supervisor is allowed.")));
  }

  @Test
  void registrationAcceptsSingleSupervisorEmail() throws Exception {
    StudentLogin studentLogin = createStudentLogin("test-only-single-supervisor-password");
    MockHttpSession studentSession = studentLogin.session();

    mockMvc.perform(post("/api/student/registrations")
        .contentType(MediaType.APPLICATION_JSON)
        .session(studentSession)
        .content("""
          {
            "type":"THESIS",
            "title":"Single Supervisor Email",
            "supervisorEmail":"%s"
          }
          """.formatted(lecturer.getEmail())))
      .andExpect(status().isOk());
  }

  @Test
  void studentCannotCreateSecondThesisRegistration() throws Exception {
    User extraStudent = createStudentUser("test-only-extra-student-password");
    MockHttpSession studentSession = login(extraStudent.getEmail(), "test-only-extra-student-password");

    mockMvc.perform(post("/api/student/registrations")
        .contentType(MediaType.APPLICATION_JSON)
        .session(studentSession)
        .content("""
          {"type":"THESIS","title":"First Thesis","supervisorEmail":"%s"}
          """.formatted(lecturer.getEmail())))
      .andExpect(status().isOk());

    mockMvc.perform(post("/api/student/registrations")
        .contentType(MediaType.APPLICATION_JSON)
        .session(studentSession)
      .content("""
          {"type":"THESIS","title":"Second Thesis","supervisorEmail":"%s"}
          """.formatted(lecturer.getEmail())))
      .andExpect(status().isConflict())
      .andExpect(jsonPath("$.message", containsString("You already have a THESIS registration in progress")));
  }

  @Test
  void studentCanCreateMultipleArticleRegistrations() throws Exception {
    User extraStudent = createStudentUser("test-only-article-student-password");
    MockHttpSession studentSession = login(extraStudent.getEmail(), "test-only-article-student-password");

    mockMvc.perform(post("/api/student/registrations")
        .contentType(MediaType.APPLICATION_JSON)
        .session(studentSession)
        .content("""
          {"type":"ARTICLE","title":"Article One","supervisorEmail":"%s"}
          """.formatted(lecturer.getEmail())))
      .andExpect(status().isOk());

    mockMvc.perform(post("/api/student/registrations")
        .contentType(MediaType.APPLICATION_JSON)
        .session(studentSession)
        .content("""
          {"type":"ARTICLE","title":"Article Two","supervisorEmail":"%s"}
          """.formatted(lecturer.getEmail())))
      .andExpect(status().isOk());
  }

  @Test
  void editingPendingRegistrationResetsCaseToDraftAndClearsSubmissionMarkers() throws Exception {
    User extraStudent = createStudentUser("test-only-pending-edit-password");
    MockHttpSession studentSession = login(extraStudent.getEmail(), "test-only-pending-edit-password");

    String response = mockMvc.perform(post("/api/student/registrations")
        .contentType(MediaType.APPLICATION_JSON)
        .session(studentSession)
        .content("""
          {"type":"ARTICLE","title":"Pending Edit","supervisorEmail":"%s"}
          """.formatted(lecturer.getEmail())))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();

    Long caseId = Long.valueOf(response.replaceAll(".*\"caseId\":(\\d+).*", "$1"));

    mockMvc.perform(post("/api/student/registrations/{caseId}/submit", caseId)
        .contentType(MediaType.APPLICATION_JSON)
        .session(studentSession)
        .content("{\"permissionAccepted\":true}"))
      .andExpect(status().isOk());

    PublicationCase pendingCase = cases.findById(caseId).orElseThrow();
    PublicationRegistration registration = registrations.findByPublicationCase(pendingCase).orElseThrow();
    registration.setPermissionAcceptedAt(Instant.now());
    registration.setSubmittedAt(Instant.now());
    registration.setSupervisorDecisionAt(Instant.now());
    registration.setSupervisorDecisionNote("Old lecturer note");
    registrations.save(registration);

    CaseSupervisor supervisor = caseSupervisors.findByPublicationCase(pendingCase).get(0);
    supervisor.setApprovedAt(Instant.now());
    supervisor.setDecisionNote("Old approval");
    caseSupervisors.save(supervisor);

    mockMvc.perform(put("/api/student/registrations/{caseId}", caseId)
        .contentType(MediaType.APPLICATION_JSON)
        .session(studentSession)
        .content("""
          {
            "title":"Pending Edit Updated",
            "year":2026,
            "faculty":"Faculty of Engineering and Technology (FET)",
            "authorName":"Student One",
            "studentIdNumber":"S-NEW-01",
            "supervisorEmail":"%s"
          }
          """.formatted(lecturer.getEmail())))
      .andExpect(status().isOk());

    PublicationCase updatedCase = cases.findById(caseId).orElseThrow();
    PublicationRegistration updatedRegistration = registrations.findByPublicationCase(updatedCase).orElseThrow();
    CaseSupervisor updatedSupervisor = caseSupervisors.findByPublicationCase(updatedCase).get(0);

    assertThat(updatedCase.getStatus()).isEqualTo(CaseStatus.REGISTRATION_DRAFT);
    assertThat(updatedRegistration.getSubmittedAt()).isNull();
    assertThat(updatedRegistration.getPermissionAcceptedAt()).isNull();
    assertThat(updatedRegistration.getSupervisorDecisionAt()).isNull();
    assertThat(updatedRegistration.getSupervisorDecisionNote()).isNull();
    assertThat(updatedSupervisor.getApprovedAt()).isNull();
    assertThat(updatedSupervisor.getRejectedAt()).isNull();
    assertThat(updatedSupervisor.getDecisionNote()).isNull();
  }

  @Test
  void publicCannotDownloadRepositoryFile() throws Exception {
    PublicationCase c = cases.save(PublicationCase.builder()
      .student(student)
      .type(PublicationType.THESIS)
      .status(CaseStatus.PUBLISHED)
      .build());

    SubmissionVersion submission = versions.save(SubmissionVersion.builder()
      .publicationCase(c)
      .versionNumber(1)
      .filePath("file:///tmp/non-existing.pdf")
      .originalFilename("paper.pdf")
      .contentType("application/pdf")
      .fileSize(10L)
      .status(SubmissionStatus.APPROVED)
      .build());

    PublishedItem item = publishedItems.save(PublishedItem.builder()
      .publicationCase(c)
      .submissionVersion(submission)
      .publishedAt(Instant.now())
      .title("Published")
      .authors("A")
      .build());

    mockMvc.perform(get("/api/public/repository/{id}/download", item.getId()))
      .andExpect(status().isUnauthorized());
  }

  @Test
  void checklistEditingCreatesNewVersionAndKeepsOldUnchanged() throws Exception {
    MockHttpSession adminSession = loginAsRole(Role.ADMIN);

    ChecklistTemplate active = checklistTemplates.findFirstByPublicationTypeAndIsActiveTrue(ChecklistScope.THESIS).orElseThrow();
    int oldVersion = active.getVersion();
    int oldCount = checklistItems.findByTemplateOrderByOrderIndexAsc(active).size();

    String newVersionResponse = mockMvc.perform(post("/api/admin/checklists/THESIS/new-version")
        .session(adminSession))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();

    Long newTemplateId = Long.valueOf(newVersionResponse.replaceAll(".*\"templateId\":(\\d+).*", "$1"));

    mockMvc.perform(post("/api/admin/checklists/templates/{templateId}/lock", newTemplateId)
        .session(adminSession))
      .andExpect(status().isOk());

    mockMvc.perform(put("/api/admin/checklists/templates/{templateId}/items", newTemplateId)
        .session(adminSession)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {"items":[{"section":"Doc","itemText":"New item 1","guidanceText":"Guide","required":true}]}
          """))
      .andExpect(status().isOk());

    ChecklistTemplate oldTemplate = checklistTemplates.findByPublicationTypeOrderByVersionDesc(ChecklistScope.THESIS).stream()
      .filter(t -> t.getVersion() == oldVersion)
      .findFirst().orElseThrow();

    ChecklistTemplate edited = checklistTemplates.findById(newTemplateId).orElseThrow();
    assertThat(edited.getVersion()).isGreaterThan(oldVersion);
    assertThat(checklistItems.findByTemplateOrderByOrderIndexAsc(oldTemplate)).hasSize(oldCount);
    assertThat(checklistItems.findByTemplateOrderByOrderIndexAsc(edited)).hasSize(1);
  }

  @Test
  void studentReuploadAfterLibraryRevisionStaysInLibraryReview() throws Exception {
    PublicationCase c = cases.save(PublicationCase.builder()
      .student(student)
      .type(PublicationType.THESIS)
      .status(CaseStatus.NEEDS_REVISION_LIBRARY)
      .build());

    MockHttpSession session = loginAsRole(Role.STUDENT);

    mockMvc.perform(multipart("/api/student/cases/{caseId}/submissions", c.getId())
        .file(new MockMultipartFile("file", "revised.pdf", "application/pdf", "%PDF-1.4\ncontent".getBytes()))
        .file(submissionMetadataPart(student))
        .session(session))
      .andExpect(status().isOk());

    PublicationCase updated = cases.findById(c.getId()).orElseThrow();
    assertThat(updated.getStatus()).isEqualTo(CaseStatus.UNDER_LIBRARY_REVIEW);
    assertThat(auditEvents.findByCaseIdOrderByCreatedAtDesc(c.getId()))
      .anyMatch(event ->
        event.getEventType() == AuditEventType.SUBMISSION_UPLOADED
          && event.getSubmissionVersionId() != null
          && event.getActorRole() == Role.STUDENT);
  }

  @Test
  void uploadSubmissionStoresStudyProgramMetadata() throws Exception {
    PublicationCase c = cases.save(PublicationCase.builder()
      .student(student)
      .type(PublicationType.THESIS)
      .status(CaseStatus.REGISTRATION_VERIFIED)
      .build());

    String faculty = studentProfiles.findByUserId(student.getId()).orElseThrow().getFaculty();
    String studyProgram = studentProfiles.findByUserId(student.getId()).orElseThrow().getProgram();
    MockHttpSession session = loginAsRole(Role.STUDENT);

    mockMvc.perform(multipart("/api/student/cases/{caseId}/submissions", c.getId())
        .file(new MockMultipartFile("file", "submission.pdf", "application/pdf", "%PDF-1.4\ncontent".getBytes(StandardCharsets.UTF_8)))
        .file(new MockMultipartFile(
          "meta",
          "",
          "application/json",
          """
            {
              "metadataTitle":"Submission Title",
              "metadataAuthors":"Student One",
              "metadataKeywords":"repository, thesis, archive",
              "metadataFaculty":"%s",
              "metadataStudyProgram":"%s",
              "metadataYear":2026,
              "abstractText":"Submission abstract."
            }
            """.formatted(faculty, studyProgram).getBytes(StandardCharsets.UTF_8)))
        .session(session))
      .andExpect(status().isOk());

    SubmissionVersion stored = versions.findTopByPublicationCaseOrderByVersionNumberDesc(c).orElseThrow();
    assertThat(stored.getMetadataFaculty()).isEqualTo(faculty);
    assertThat(stored.getMetadataStudyProgram()).isEqualTo(studyProgram);
  }

  @Test
  void nextStatusAfterStudentUploadMapsToExpectedStage() {
    assertThat(workflowGates.nextStatusAfterStudentUpload(CaseStatus.NEEDS_REVISION_LIBRARY))
      .isEqualTo(CaseStatus.UNDER_LIBRARY_REVIEW);
    assertThat(workflowGates.nextStatusAfterStudentUpload(CaseStatus.NEEDS_REVISION_SUPERVISOR))
      .isEqualTo(CaseStatus.UNDER_SUPERVISOR_REVIEW);
    assertThat(workflowGates.nextStatusAfterStudentUpload(CaseStatus.REGISTRATION_VERIFIED))
      .isEqualTo(CaseStatus.UNDER_SUPERVISOR_REVIEW);
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

  private MockMultipartFile submissionMetadataPart(User studentUser) {
    StudentProfile profile = studentProfiles.findByUserId(studentUser.getId()).orElseThrow();
    return new MockMultipartFile(
      "meta",
      "",
      MediaType.APPLICATION_JSON_VALUE,
      """
        {
          "metadataTitle":"Submission Title",
          "metadataAuthors":"Student One",
          "metadataKeywords":"repository, thesis, archive",
          "metadataFaculty":"%s",
          "metadataStudyProgram":"%s",
          "metadataYear":2026,
          "abstractText":"Submission abstract."
        }
        """.formatted(profile.getFaculty(), profile.getProgram()).getBytes(StandardCharsets.UTF_8)
    );
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

  private MockHttpSession loginAsRole(Role role) throws Exception {
    return login(requireUser(role).getEmail(), passwordForRole(role));
  }

  private User createStudentUser(String rawPassword) {
    return transactionTemplate.execute(status -> {
      StudentProfile seedProfile = studentProfiles.findByUserId(student.getId()).orElseThrow();
      User created = users.save(User.builder()
        .email("student+" + UUID.randomUUID() + "@my.sampoernauniversity.ac.id")
        .passwordHash(passwordEncoder.encode(rawPassword))
        .role(Role.STUDENT)
        .roles(Set.of(Role.STUDENT))
        .emailVerified(true)
        .build());

      studentProfiles.save(StudentProfile.builder()
        .user(created)
        .name("Extra Student")
        .studentId("S-" + UUID.randomUUID().toString().substring(0, 8))
        .program(seedProfile.getProgram())
        .faculty(seedProfile.getFaculty())
        .build());

      return created;
    });
  }

  private StudentLogin createStudentLogin(String rawPassword) throws Exception {
    User user = createStudentUser(rawPassword);
    return new StudentLogin(user, login(user.getEmail(), rawPassword));
  }

  private User requireUser(Role role) {
    return users.findByRole(role).stream()
      .findFirst()
      .orElseThrow(() -> new IllegalStateException("No seeded user found for role " + role));
  }

  private String passwordForRole(Role role) {
    return switch (role) {
      case STUDENT -> STUDENT_PASSWORD;
      case LECTURER -> LECTURER_PASSWORD;
      case ADMIN -> ADMIN_PASSWORD;
    };
  }

  private record StudentLogin(User user, MockHttpSession session) {}
}
