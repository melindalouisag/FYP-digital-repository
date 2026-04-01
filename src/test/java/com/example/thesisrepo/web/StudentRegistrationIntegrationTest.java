package com.example.thesisrepo.web;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.CaseSupervisor;
import com.example.thesisrepo.publication.ClearanceForm;
import com.example.thesisrepo.publication.ClearanceStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.publication.WorkflowComment;
import com.example.thesisrepo.publication.repo.AuditEventRepository;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
import com.example.thesisrepo.publication.repo.ClearanceFormRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
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
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StudentRegistrationIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private StudentProfileRepository studentProfiles;
  @Autowired private PublicationCaseRepository cases;
  @Autowired private PublicationRegistrationRepository registrations;
  @Autowired private CaseSupervisorRepository caseSupervisors;
  @Autowired private WorkflowCommentRepository comments;
  @Autowired private ClearanceFormRepository clearances;
  @Autowired private AuditEventRepository auditEvents;
  @Autowired private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
  @Autowired private TransactionTemplate transactionTemplate;

  private User lecturer;
  private StudentProfile seedStudentProfile;

  @BeforeEach
  void setUp() {
    lecturer = requireUser(Role.LECTURER);
    User seedStudent = requireUser(Role.STUDENT);
    seedStudentProfile = studentProfiles.findByUserId(seedStudent.getId()).orElseThrow();
  }

  @Test
  void createUpdateSubmitAndCaseDetailUseStableDtoShape() throws Exception {
    StudentLogin studentLogin = createStudentLogin("test-only-registration-happy-path-password");
    MockHttpSession session = studentLogin.session();

    String createResponse = mockMvc.perform(post("/api/student/registrations")
        .contentType(MediaType.APPLICATION_JSON)
        .session(session)
        .content("""
          {
            "type":"THESIS",
            "title":"Initial Registration Title",
            "year":2025,
            "faculty":"%s",
            "authorName":"Student One",
            "studentIdNumber":"S-1001",
            "supervisorEmail":"%s"
          }
          """.formatted(seedStudentProfile.getFaculty(), lecturer.getEmail())))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.caseId").isNumber())
      .andExpect(jsonPath("$.status").value("REGISTRATION_DRAFT"))
      .andReturn().getResponse().getContentAsString();

    Long caseId = extractCaseId(createResponse);
    PublicationCase createdCase = cases.findById(caseId).orElseThrow();
    PublicationRegistration createdRegistration = registrations.findByPublicationCase(createdCase).orElseThrow();
    assertThat(createdRegistration.getTitle()).isEqualTo("Initial Registration Title");
    assertThat(caseSupervisors.findByPublicationCase(createdCase))
      .singleElement()
      .extracting(supervisor -> supervisor.getLecturer().getEmail())
      .isEqualTo(lecturer.getEmail());

    mockMvc.perform(get("/api/student/cases").session(session))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.items[0].id").value(caseId))
      .andExpect(jsonPath("$.items[0].title").value("Initial Registration Title"))
      .andExpect(jsonPath("$.items[0].student").doesNotExist());

    mockMvc.perform(put("/api/student/registrations/{caseId}", caseId)
        .contentType(MediaType.APPLICATION_JSON)
        .session(session)
        .content("""
          {
            "title":"Updated Registration Title",
            "year":2026,
            "faculty":"%s",
            "authorName":"Updated Student",
            "studentIdNumber":"S-2002",
            "articlePublishIn":"Journal of Repository Testing",
            "supervisorEmail":"%s"
          }
          """.formatted(seedStudentProfile.getFaculty(), lecturer.getEmail())))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.caseId").value(caseId))
      .andExpect(jsonPath("$.status").value("REGISTRATION_DRAFT"));

    PublicationRegistration updatedRegistration = registrations.findByPublicationCase(createdCase).orElseThrow();
    assertThat(updatedRegistration.getTitle()).isEqualTo("Updated Registration Title");
    assertThat(updatedRegistration.getYear()).isEqualTo(2026);
    assertThat(updatedRegistration.getArticlePublishIn()).isEqualTo("Journal of Repository Testing");

    comments.save(WorkflowComment.builder()
      .publicationCase(createdCase)
      .author(lecturer)
      .authorRole(Role.LECTURER)
      .body("Please ensure the metadata is complete.")
      .build());
    clearances.save(ClearanceForm.builder()
      .publicationCase(createdCase)
      .status(ClearanceStatus.DRAFT)
      .note("Clearance draft note")
      .build());

    mockMvc.perform(get("/api/student/cases/{caseId}", caseId).session(session))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.case.id").value(caseId))
      .andExpect(jsonPath("$.case.status").value("REGISTRATION_DRAFT"))
      .andExpect(jsonPath("$.registration.title").value("Updated Registration Title"))
      .andExpect(jsonPath("$.registration.articlePublishIn").value("Journal of Repository Testing"))
      .andExpect(jsonPath("$.supervisors[0].email").value(lecturer.getEmail()))
      .andExpect(jsonPath("$.comments[0].authorRole").value("LECTURER"))
      .andExpect(jsonPath("$.comments[0].authorEmail").value(lecturer.getEmail()))
      .andExpect(jsonPath("$.comments[0].body").value("Please ensure the metadata is complete."))
      .andExpect(jsonPath("$.clearance.status").value("DRAFT"))
      .andExpect(jsonPath("$.timeline").isArray())
      .andExpect(jsonPath("$.registration.publicationCase").doesNotExist())
      .andExpect(jsonPath("$.comments[0].publicationCase").doesNotExist())
      .andExpect(jsonPath("$.comments[0].author").doesNotExist())
      .andExpect(jsonPath("$.comments[0].submissionVersion").doesNotExist())
      .andExpect(jsonPath("$.clearance.publicationCase").doesNotExist())
      .andExpect(jsonPath("$.case.student").doesNotExist());

    mockMvc.perform(post("/api/student/registrations/{caseId}/submit", caseId)
        .contentType(MediaType.APPLICATION_JSON)
        .session(session)
        .content("""
          {"permissionAccepted":true}
          """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.caseId").value(caseId))
      .andExpect(jsonPath("$.status").value("REGISTRATION_PENDING"));

    PublicationCase submittedCase = cases.findById(caseId).orElseThrow();
    PublicationRegistration submittedRegistration = registrations.findByPublicationCase(submittedCase).orElseThrow();
    assertThat(submittedCase.getStatus()).isEqualTo(CaseStatus.REGISTRATION_PENDING);
    assertThat(submittedRegistration.getPermissionAcceptedAt()).isNotNull();
    assertThat(submittedRegistration.getSubmittedAt()).isNotNull();
    assertThat(auditEvents.findByCaseIdOrderByCreatedAtDesc(caseId))
      .anyMatch(event -> event.getEventType() == AuditEventType.REGISTRATION_SUBMITTED);
  }

  @Test
  void submitRegistrationRequiresPermissionAccepted() throws Exception {
    StudentLogin studentLogin = createStudentLogin("test-only-registration-permission-password");
    MockHttpSession session = studentLogin.session();

    Long caseId = createDraftRegistration(session, "Permission Gate Case");

    mockMvc.perform(post("/api/student/registrations/{caseId}/submit", caseId)
        .contentType(MediaType.APPLICATION_JSON)
        .session(session)
        .content("""
          {"permissionAccepted":false}
          """))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.message").value("Validation failed."))
      .andExpect(jsonPath("$.fieldErrors[0].field").value("permissionAccepted"))
      .andExpect(jsonPath("$.fieldErrors[0].message").value("Permission must be accepted."));

    PublicationCase draftCase = cases.findById(caseId).orElseThrow();
    PublicationRegistration registration = registrations.findByPublicationCase(draftCase).orElseThrow();
    assertThat(draftCase.getStatus()).isEqualTo(CaseStatus.REGISTRATION_DRAFT);
    assertThat(registration.getSubmittedAt()).isNull();
    assertThat(auditEvents.findByCaseIdOrderByCreatedAtDesc(caseId))
      .noneMatch(event -> event.getEventType() == AuditEventType.REGISTRATION_SUBMITTED);
  }

  @Test
  void registrationValidationErrorsReturnStructuredFieldMessages() throws Exception {
    StudentLogin studentLogin = createStudentLogin("test-only-registration-validation-password");

    mockMvc.perform(post("/api/student/registrations")
        .contentType(MediaType.APPLICATION_JSON)
        .session(studentLogin.session())
        .content("""
          {
            "type":null,
            "title":"  ",
            "year":1800,
            "supervisorEmail":"%s"
          }
          """.formatted(lecturer.getEmail())))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.message").value("Validation failed."))
      .andExpect(jsonPath("$.fieldErrors[*].field", containsInAnyOrder("title", "type", "year")));
  }

  @Test
  void studentCannotAccessAnotherStudentsTouchedRegistrationEndpoints() throws Exception {
    StudentLogin ownerLogin = createStudentLogin("test-only-registration-owner-password");
    MockHttpSession ownerSession = ownerLogin.session();
    Long caseId = createDraftRegistration(ownerSession, "Owned By Someone Else");

    StudentLogin otherLogin = createStudentLogin("test-only-registration-other-password");
    MockHttpSession otherSession = otherLogin.session();

    mockMvc.perform(get("/api/student/cases/{caseId}", caseId).session(otherSession))
      .andExpect(status().isForbidden());

    mockMvc.perform(put("/api/student/registrations/{caseId}", caseId)
        .contentType(MediaType.APPLICATION_JSON)
        .session(otherSession)
        .content("""
          {
            "title":"Unauthorized Update",
            "faculty":"%s",
            "authorName":"Other Student",
            "studentIdNumber":"S-9999",
            "supervisorEmail":"%s"
          }
          """.formatted(seedStudentProfile.getFaculty(), lecturer.getEmail())))
      .andExpect(status().isForbidden());
  }

  private Long createDraftRegistration(MockHttpSession session, String title) throws Exception {
    String response = mockMvc.perform(post("/api/student/registrations")
        .contentType(MediaType.APPLICATION_JSON)
        .session(session)
        .content("""
          {
            "type":"THESIS",
            "title":"%s",
            "faculty":"%s",
            "authorName":"Student One",
            "studentIdNumber":"S-3003",
            "supervisorEmail":"%s"
          }
          """.formatted(title, seedStudentProfile.getFaculty(), lecturer.getEmail())))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();

    return extractCaseId(response);
  }

  private Long extractCaseId(String responseBody) {
    return Long.valueOf(responseBody.replaceAll(".*\"caseId\":(\\d+).*", "$1"));
  }

  private StudentLogin createStudentLogin(String rawPassword) throws Exception {
    User user = createStudentUser(rawPassword);
    return new StudentLogin(user, login(user.getEmail(), rawPassword));
  }

  private User createStudentUser(String rawPassword) {
    return transactionTemplate.execute(status -> {
      User created = users.save(User.builder()
        .email("student+" + UUID.randomUUID() + "@my.sampoernauniversity.ac.id")
        .passwordHash(passwordEncoder.encode(rawPassword))
        .role(Role.STUDENT)
        .roles(Set.of(Role.STUDENT))
        .emailVerified(true)
        .build());

      studentProfiles.save(StudentProfile.builder()
        .user(created)
        .name("Integration Student")
        .studentId("S-" + UUID.randomUUID().toString().substring(0, 8))
        .program(seedStudentProfile.getProgram())
        .faculty(seedStudentProfile.getFaculty())
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

  private record StudentLogin(User user, MockHttpSession session) {
  }
}
