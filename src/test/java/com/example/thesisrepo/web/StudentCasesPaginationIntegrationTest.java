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
import org.springframework.security.crypto.password.PasswordEncoder;
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
class StudentCasesPaginationIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private StudentProfileRepository studentProfiles;
  @Autowired private PublicationCaseRepository cases;
  @Autowired private PublicationRegistrationRepository registrations;
  @Autowired private PasswordEncoder passwordEncoder;
  @Autowired private TransactionTemplate transactionTemplate;

  private StudentProfile seedStudentProfile;

  @BeforeEach
  void setUp() {
    User seedStudent = requireUser(Role.STUDENT);
    seedStudentProfile = studentProfiles.findByUserId(seedStudent.getId()).orElseThrow();
  }

  @Test
  void listCasesReturnsPagedEnvelopeWithDefaultOrderingAndOwnCasesOnly() throws Exception {
    StudentLogin owner = createStudentLogin("test-only-student-cases-page-password");
    StudentLogin otherStudent = createStudentLogin("test-only-student-cases-other-password");

    PublicationCase first = createCase(owner.user(), "Older Student Case", PublicationType.THESIS, CaseStatus.REGISTRATION_DRAFT);
    PublicationCase second = createCase(owner.user(), "Newer Student Case", PublicationType.ARTICLE, CaseStatus.REGISTRATION_PENDING);
    createCase(otherStudent.user(), "Other Student Case", PublicationType.THESIS, CaseStatus.REGISTRATION_DRAFT);

    String body = mockMvc.perform(get("/api/student/cases")
        .param("size", "1")
        .session(owner.session()))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.page").value(0))
      .andExpect(jsonPath("$.size").value(1))
      .andExpect(jsonPath("$.totalElements").value(2))
      .andExpect(jsonPath("$.totalPages").value(2))
      .andExpect(jsonPath("$.hasNext").value(true))
      .andExpect(jsonPath("$.hasPrevious").value(false))
      .andExpect(jsonPath("$.items[0].id").value(second.getId()))
      .andExpect(jsonPath("$.items[0].title").value("Newer Student Case"))
      .andExpect(jsonPath("$.items[0].status").value("REGISTRATION_PENDING"))
      .andReturn()
      .getResponse()
      .getContentAsString();

    assertThat(second.getId()).isGreaterThan(first.getId());
    assertThat(body).doesNotContain("Other Student Case");
    assertThat(body).doesNotContain("\"student\":");
  }

  @Test
  void listCasesReturnsEmptyEnvelopeWhenStudentHasNoCases() throws Exception {
    StudentLogin student = createStudentLogin("test-only-student-cases-empty-password");

    mockMvc.perform(get("/api/student/cases")
        .param("page", "0")
        .param("size", "2")
        .session(student.session()))
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
  void listCasesSupportsOutOfRangePages() throws Exception {
    StudentLogin student = createStudentLogin("test-only-student-cases-range-password");
    createCase(student.user(), "Only Student Case", PublicationType.THESIS, CaseStatus.REGISTRATION_DRAFT);

    mockMvc.perform(get("/api/student/cases")
        .param("page", "5")
        .param("size", "2")
        .session(student.session()))
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
  void listCasesRemainsStudentOnly() throws Exception {
    MockHttpSession lecturerSession = login(requireUser(Role.LECTURER).getEmail(), "test-only-lecturer-password");

    mockMvc.perform(get("/api/student/cases").session(lecturerSession))
      .andExpect(status().isForbidden());
  }

  private PublicationCase createCase(User student, String title, PublicationType type, CaseStatus status) {
    PublicationCase publicationCase = cases.save(PublicationCase.builder()
      .student(student)
      .type(type)
      .status(status)
      .build());

    registrations.save(PublicationRegistration.builder()
      .publicationCase(publicationCase)
      .title(title)
      .year(2026)
      .faculty(seedStudentProfile.getFaculty())
      .studentIdNumber("S-" + UUID.randomUUID().toString().substring(0, 8))
      .authorName("Student Pagination")
      .build());

    return publicationCase;
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
        .name("Pagination Student")
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
