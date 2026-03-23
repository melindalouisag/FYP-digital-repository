package com.example.thesisrepo.web;

import com.example.thesisrepo.profile.LecturerProfile;
import com.example.thesisrepo.profile.LecturerProfileRepository;
import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.CaseSupervisor;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class LecturerApprovalQueuePaginationIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private StudentProfileRepository studentProfiles;
  @Autowired private LecturerProfileRepository lecturerProfiles;
  @Autowired private PublicationCaseRepository cases;
  @Autowired private PublicationRegistrationRepository registrations;
  @Autowired private CaseSupervisorRepository caseSupervisors;
  @Autowired private PasswordEncoder passwordEncoder;
  @Autowired private TransactionTemplate transactionTemplate;

  private User student;
  private StudentProfile studentProfile;

  @BeforeEach
  void setUp() {
    student = requireUser(Role.STUDENT);
    studentProfile = studentProfiles.findByUserId(student.getId()).orElseThrow();
  }

  @Test
  void approvalQueueReturnsPagedEnvelopeWithBackendSort() throws Exception {
    User lecturer = createLecturerUser("test-only-lecturer-approval-page-password");
    MockHttpSession lecturerSession = login(lecturer.getEmail(), "test-only-lecturer-approval-page-password");

    PublicationCase newest = createApprovalCase(lecturer, "Newest Approval", Instant.parse("2026-01-03T09:00:00Z"));
    PublicationCase earlierTie = createApprovalCase(lecturer, "Earlier Tie", Instant.parse("2026-01-02T09:00:00Z"));
    PublicationCase laterTie = createApprovalCase(lecturer, "Later Tie", Instant.parse("2026-01-02T09:00:00Z"));
    createCase(lecturer, CaseStatus.REGISTRATION_APPROVED, "Excluded Case", Instant.parse("2026-01-04T09:00:00Z"));

    String expectedStudentName = hasText(studentProfile.getName()) ? studentProfile.getName() : student.getEmail();

    String body = mockMvc.perform(get("/api/lecturer/approval-queue")
        .param("size", "2")
        .session(lecturerSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.page").value(0))
      .andExpect(jsonPath("$.size").value(2))
      .andExpect(jsonPath("$.totalElements").value(3))
      .andExpect(jsonPath("$.totalPages").value(2))
      .andExpect(jsonPath("$.hasNext").value(true))
      .andExpect(jsonPath("$.hasPrevious").value(false))
      .andExpect(jsonPath("$.items[0].caseId").value(newest.getId()))
      .andExpect(jsonPath("$.items[0].registrationTitle").value("Newest Approval"))
      .andExpect(jsonPath("$.items[0].registrationSubmittedAt").value("2026-01-03T09:00:00Z"))
      .andExpect(jsonPath("$.items[0].studentUserId").value(student.getId()))
      .andExpect(jsonPath("$.items[0].studentName").value(expectedStudentName))
      .andExpect(jsonPath("$.items[1].caseId").value(laterTie.getId()))
      .andExpect(jsonPath("$.items[1].registrationSubmittedAt").value("2026-01-02T09:00:00Z"))
      .andReturn()
      .getResponse()
      .getContentAsString();

    assertThat(laterTie.getId()).isGreaterThan(earlierTie.getId());
    assertThat(body).doesNotContain("publicationCase");
    assertThat(body).doesNotContain("\"student\":");
  }

  @Test
  void approvalQueueReturnsEmptyEnvelopeWhenQueueIsEmpty() throws Exception {
    User lecturer = createLecturerUser("test-only-lecturer-approval-empty-password");
    MockHttpSession lecturerSession = login(lecturer.getEmail(), "test-only-lecturer-approval-empty-password");

    mockMvc.perform(get("/api/lecturer/approval-queue")
        .param("page", "0")
        .param("size", "2")
        .session(lecturerSession))
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
  void approvalQueueSupportsOutOfRangePages() throws Exception {
    User lecturer = createLecturerUser("test-only-lecturer-approval-range-password");
    MockHttpSession lecturerSession = login(lecturer.getEmail(), "test-only-lecturer-approval-range-password");
    createApprovalCase(lecturer, "Only Approval", Instant.parse("2026-01-03T09:00:00Z"));

    mockMvc.perform(get("/api/lecturer/approval-queue")
        .param("page", "5")
        .param("size", "2")
        .session(lecturerSession))
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
  void approvalQueueRemainsLecturerOnly() throws Exception {
    MockHttpSession adminSession = login(requireUser(Role.ADMIN).getEmail(), "test-only-admin-password");

    mockMvc.perform(get("/api/lecturer/approval-queue").session(adminSession))
      .andExpect(status().isForbidden());
  }

  private PublicationCase createApprovalCase(User lecturer, String title, Instant submittedAt) {
    return createCase(lecturer, CaseStatus.REGISTRATION_PENDING, title, submittedAt);
  }

  private PublicationCase createCase(User lecturer, CaseStatus status, String title, Instant submittedAt) {
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

    caseSupervisors.save(CaseSupervisor.builder()
      .publicationCase(publicationCase)
      .lecturer(lecturer)
      .build());

    return publicationCase;
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

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
