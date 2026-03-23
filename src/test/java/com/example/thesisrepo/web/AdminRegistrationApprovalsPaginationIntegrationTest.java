package com.example.thesisrepo.web;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
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
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class AdminRegistrationApprovalsPaginationIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private StudentProfileRepository studentProfiles;
  @Autowired private PublicationCaseRepository cases;
  @Autowired private PublicationRegistrationRepository registrations;

  private User student;
  private StudentProfile studentProfile;

  @BeforeEach
  void setUp() {
    student = requireUser(Role.STUDENT);
    studentProfile = studentProfiles.findByUserId(student.getId()).orElseThrow();
  }

  @Test
  void registrationApprovalsReturnsPagedEnvelopeWithBackendSort() throws Exception {
    MockHttpSession adminSession = loginAsRole(Role.ADMIN);

    PublicationCase newest = createApprovalCase("Newest Approval", Instant.parse("2026-01-03T09:00:00Z"));
    PublicationCase earlierTie = createApprovalCase("Earlier Tie", Instant.parse("2026-01-02T09:00:00Z"));
    PublicationCase laterTie = createApprovalCase("Later Tie", Instant.parse("2026-01-02T09:00:00Z"));
    createCase(CaseStatus.REGISTRATION_PENDING, "Excluded Pending Case", Instant.parse("2026-01-04T09:00:00Z"));

    String body = mockMvc.perform(get("/api/admin/registration-approvals")
        .param("size", "2")
        .session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.page").value(0))
      .andExpect(jsonPath("$.size").value(2))
      .andExpect(jsonPath("$.totalElements").value(3))
      .andExpect(jsonPath("$.totalPages").value(2))
      .andExpect(jsonPath("$.hasNext").value(true))
      .andExpect(jsonPath("$.hasPrevious").value(false))
      .andExpect(jsonPath("$.items[0].caseId").value(newest.getId()))
      .andExpect(jsonPath("$.items[0].title").value("Newest Approval"))
      .andExpect(jsonPath("$.items[0].submittedAt").value("2026-01-03T09:00:00Z"))
      .andExpect(jsonPath("$.items[0].studentUserId").value(student.getId()))
      .andExpect(jsonPath("$.items[0].studentName").value(studentProfile.getName()))
      .andExpect(jsonPath("$.items[0].studentIdNumber").value(studentProfile.getStudentId()))
      .andExpect(jsonPath("$.items[1].caseId").value(laterTie.getId()))
      .andExpect(jsonPath("$.items[1].submittedAt").value("2026-01-02T09:00:00Z"))
      .andReturn()
      .getResponse()
      .getContentAsString();

    assertThat(laterTie.getId()).isGreaterThan(earlierTie.getId());
    assertThat(body).doesNotContain("publicationCase");
    assertThat(body).doesNotContain("\"student\":");
  }

  @Test
  void registrationApprovalsReturnsEmptyEnvelopeWhenQueueIsEmpty() throws Exception {
    MockHttpSession adminSession = loginAsRole(Role.ADMIN);

    mockMvc.perform(get("/api/admin/registration-approvals")
        .param("page", "0")
        .param("size", "2")
        .session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.items").isArray())
      .andExpect(jsonPath("$.items").isEmpty())
      .andExpect(jsonPath("$.page").value(0))
      .andExpect(jsonPath("$.size").value(2))
      .andExpect(jsonPath("$.totalElements").value(0))
      .andExpect(jsonPath("$.totalPages").value(0))
      .andExpect(jsonPath("$.hasNext").value(false))
      .andExpect(jsonPath("$.hasPrevious").value(false));
  }

  @Test
  void registrationApprovalsSupportsOutOfRangePages() throws Exception {
    MockHttpSession adminSession = loginAsRole(Role.ADMIN);
    createApprovalCase("Only Approval", Instant.parse("2026-01-03T09:00:00Z"));

    mockMvc.perform(get("/api/admin/registration-approvals")
        .param("page", "5")
        .param("size", "2")
        .session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.items").isArray())
      .andExpect(jsonPath("$.items").isEmpty())
      .andExpect(jsonPath("$.page").value(5))
      .andExpect(jsonPath("$.size").value(2))
      .andExpect(jsonPath("$.totalElements").value(1))
      .andExpect(jsonPath("$.totalPages").value(1))
      .andExpect(jsonPath("$.hasNext").value(false))
      .andExpect(jsonPath("$.hasPrevious").value(true));
  }

  @Test
  void registrationApprovalsRemainsAdminOnly() throws Exception {
    MockHttpSession lecturerSession = loginAsRole(Role.LECTURER);

    mockMvc.perform(get("/api/admin/registration-approvals").session(lecturerSession))
      .andExpect(status().isForbidden());
  }

  private PublicationCase createApprovalCase(String title, Instant submittedAt) {
    return createCase(CaseStatus.REGISTRATION_APPROVED, title, submittedAt);
  }

  private PublicationCase createCase(CaseStatus status, String title, Instant submittedAt) {
    PublicationCase publicationCase = cases.save(PublicationCase.builder()
      .student(student)
      .type(PublicationType.THESIS)
      .status(status)
      .build());

    registrations.save(PublicationRegistration.builder()
      .publicationCase(publicationCase)
      .title(title)
      .year(2026)
      .faculty(studentProfile.getFaculty())
      .studentIdNumber(studentProfile.getStudentId())
      .authorName(studentProfile.getName())
      .submittedAt(submittedAt)
      .build());

    return publicationCase;
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
