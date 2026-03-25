package com.example.thesisrepo.web;

import com.example.thesisrepo.profile.LecturerProfile;
import com.example.thesisrepo.profile.LecturerProfileRepository;
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
class LecturerReviewQueuePaginationIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private PublicationCaseRepository cases;
  @Autowired private PublicationRegistrationRepository registrations;
  @Autowired private CaseSupervisorRepository caseSupervisors;
  @Autowired private LecturerProfileRepository lecturerProfiles;
  @Autowired private PasswordEncoder passwordEncoder;
  @Autowired private TransactionTemplate transactionTemplate;

  private User student;

  @BeforeEach
  void setUp() {
    student = requireUser(Role.STUDENT);
  }

  @Test
  void reviewQueueReturnsPagedEnvelopeWithStableOrderingAndOwnCasesOnly() throws Exception {
    User lecturer = createLecturerUser("test-only-lecturer-review-page-password");
    User otherLecturer = createLecturerUser("test-only-lecturer-review-other-page-password");
    MockHttpSession lecturerSession = login(lecturer.getEmail(), "test-only-lecturer-review-page-password");

    PublicationCase first = createCase(lecturer, CaseStatus.UNDER_SUPERVISOR_REVIEW, "Older Lecturer Review");
    PublicationCase second = createCase(lecturer, CaseStatus.NEEDS_REVISION_SUPERVISOR, "Newer Lecturer Review");
    createCase(lecturer, CaseStatus.READY_TO_FORWARD, "Excluded Ready Case");
    createCase(otherLecturer, CaseStatus.UNDER_SUPERVISOR_REVIEW, "Other Lecturer Case");

    String body = mockMvc.perform(get("/api/lecturer/review")
        .param("size", "1")
        .session(lecturerSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.page").value(0))
      .andExpect(jsonPath("$.size").value(1))
      .andExpect(jsonPath("$.totalElements").value(2))
      .andExpect(jsonPath("$.totalPages").value(2))
      .andExpect(jsonPath("$.hasNext").value(true))
      .andExpect(jsonPath("$.hasPrevious").value(false))
      .andExpect(jsonPath("$.items[0].id").value(second.getId()))
      .andExpect(jsonPath("$.items[0].title").value("Newer Lecturer Review"))
      .andExpect(jsonPath("$.items[0].status").value("NEEDS_REVISION_SUPERVISOR"))
      .andReturn()
      .getResponse()
      .getContentAsString();

    assertThat(second.getId()).isGreaterThan(first.getId());
    assertThat(body).doesNotContain("Other Lecturer Case");
    assertThat(body).doesNotContain("\"student\":");
  }

  @Test
  void reviewQueueReturnsEmptyEnvelopeWhenLecturerHasNoReviewCases() throws Exception {
    User lecturer = createLecturerUser("test-only-lecturer-review-empty-password");
    MockHttpSession lecturerSession = login(lecturer.getEmail(), "test-only-lecturer-review-empty-password");

    mockMvc.perform(get("/api/lecturer/review")
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
  void reviewQueueSupportsOutOfRangePages() throws Exception {
    User lecturer = createLecturerUser("test-only-lecturer-review-range-password");
    MockHttpSession lecturerSession = login(lecturer.getEmail(), "test-only-lecturer-review-range-password");
    createCase(lecturer, CaseStatus.UNDER_SUPERVISOR_REVIEW, "Only Lecturer Review");

    mockMvc.perform(get("/api/lecturer/review")
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
  void reviewQueueRemainsLecturerOnly() throws Exception {
    MockHttpSession studentSession = login(requireUser(Role.STUDENT).getEmail(), "test-only-student-password");

    mockMvc.perform(get("/api/lecturer/review").session(studentSession))
      .andExpect(status().isForbidden());
  }

  private PublicationCase createCase(User lecturer, CaseStatus status, String title) {
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
      .authorName("Lecturer Review Student")
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
        .name("Pagination Lecturer")
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
