package com.example.thesisrepo.web;

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
class AdminReviewQueuePaginationIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private PublicationCaseRepository cases;
  @Autowired private PublicationRegistrationRepository registrations;

  private User student;

  @BeforeEach
  void setUp() {
    student = requireUser(Role.STUDENT);
  }

  @Test
  void reviewQueueReturnsPagedEnvelopeWithStableOrderingAndFilters() throws Exception {
    MockHttpSession adminSession = loginAsRole(Role.ADMIN);

    PublicationCase first = createCase(CaseStatus.UNDER_LIBRARY_REVIEW, PublicationType.THESIS, "Older Review Case");
    PublicationCase second = createCase(CaseStatus.FORWARDED_TO_LIBRARY, PublicationType.ARTICLE, "Newer Review Case");
    createCase(CaseStatus.PUBLISHED, PublicationType.THESIS, "Excluded Review Case");

    String body = mockMvc.perform(get("/api/admin/review")
        .param("size", "1")
        .session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.page").value(0))
      .andExpect(jsonPath("$.size").value(1))
      .andExpect(jsonPath("$.totalElements").value(2))
      .andExpect(jsonPath("$.totalPages").value(2))
      .andExpect(jsonPath("$.hasNext").value(true))
      .andExpect(jsonPath("$.hasPrevious").value(false))
      .andExpect(jsonPath("$.items[0].id").value(second.getId()))
      .andExpect(jsonPath("$.items[0].title").value("Newer Review Case"))
      .andExpect(jsonPath("$.items[0].status").value("FORWARDED_TO_LIBRARY"))
      .andReturn()
      .getResponse()
      .getContentAsString();

    mockMvc.perform(get("/api/admin/review")
        .param("status", "UNDER_LIBRARY_REVIEW")
        .param("type", "THESIS")
        .param("size", "5")
        .session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.totalElements").value(1))
      .andExpect(jsonPath("$.items[0].id").value(first.getId()))
      .andExpect(jsonPath("$.items[0].title").value("Older Review Case"));

    assertThat(second.getId()).isGreaterThan(first.getId());
    assertThat(body).doesNotContain("\"student\":");
    assertThat(body).doesNotContain("\"publicationCase\":");
  }

  @Test
  void reviewQueueReturnsEmptyEnvelopeWhenQueueIsEmpty() throws Exception {
    MockHttpSession adminSession = loginAsRole(Role.ADMIN);

    mockMvc.perform(get("/api/admin/review")
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
  void reviewQueueSupportsOutOfRangePages() throws Exception {
    MockHttpSession adminSession = loginAsRole(Role.ADMIN);
    createCase(CaseStatus.UNDER_LIBRARY_REVIEW, PublicationType.THESIS, "Only Review Case");

    mockMvc.perform(get("/api/admin/review")
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
  void reviewQueueRemainsAdminOnly() throws Exception {
    MockHttpSession lecturerSession = loginAsRole(Role.LECTURER);

    mockMvc.perform(get("/api/admin/review").session(lecturerSession))
      .andExpect(status().isForbidden());
  }

  private PublicationCase createCase(CaseStatus status, PublicationType type, String title) {
    PublicationCase publicationCase = cases.save(PublicationCase.builder()
      .student(student)
      .type(type)
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
