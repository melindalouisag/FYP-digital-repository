package com.example.thesisrepo.web;

import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.publication.PublishedItem;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublishedItemRepository;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class PublicRepositorySearchPaginationIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private PublicationCaseRepository cases;
  @Autowired private PublishedItemRepository publishedItems;

  private User student;

  @BeforeEach
  void setUp() {
    student = requireUser(Role.STUDENT);
  }

  @Test
  void searchReturnsPagedEnvelopeWithFiltersAndDefaultOrdering() throws Exception {
    createPublishedItem(
      "Applied Machine Learning",
      "Student Researcher",
      "Faculty of Engineering and Technology (FET)",
      "Information Systems",
      2025,
      "machine, ai",
      Instant.parse("2026-01-10T10:00:00Z")
    );
    PublishedItem newer = createPublishedItem(
      "Machine Learning in Practice",
      "Student Researcher",
      "Faculty of Engineering and Technology (FET)",
      "Information Systems",
      2025,
      "machine, ai, repository",
      Instant.parse("2026-02-15T10:00:00Z")
    );
    createPublishedItem(
      "Machine Learning Overview",
      "Student Researcher",
      "Faculty of Engineering and Technology (FET)",
      "Information Systems",
      2025,
      "machine",
      Instant.parse("2026-03-01T10:00:00Z")
    );

    String body = mockMvc.perform(get("/api/public/repository/search")
        .param("keyword", "machine,ai")
        .param("size", "1"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.page").value(0))
      .andExpect(jsonPath("$.size").value(1))
      .andExpect(jsonPath("$.totalElements").value(2))
      .andExpect(jsonPath("$.totalPages").value(2))
      .andExpect(jsonPath("$.hasNext").value(true))
      .andExpect(jsonPath("$.hasPrevious").value(false))
      .andExpect(jsonPath("$.items[0].id").value(newer.getId()))
      .andExpect(jsonPath("$.items[0].title").value("Machine Learning in Practice"))
      .andReturn()
      .getResponse()
      .getContentAsString();

    assertThat(body).doesNotContain("Machine Learning Overview");
    assertThat(body).doesNotContain("\"publicationCase\":");
    assertThat(body).doesNotContain("\"submissionVersion\":");
  }

  @Test
  void searchReturnsEmptyEnvelopeWhenNoResultsMatch() throws Exception {
    mockMvc.perform(get("/api/public/repository/search")
        .param("title", "nonexistent")
        .param("page", "0")
        .param("size", "2"))
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
  void searchSupportsOutOfRangePages() throws Exception {
    createPublishedItem(
      "Only Search Result",
      "Student Researcher",
      "Faculty of Engineering and Technology (FET)",
      "Information Systems",
      2025,
      "repository",
      Instant.parse("2026-01-10T10:00:00Z")
    );

    mockMvc.perform(get("/api/public/repository/search")
        .param("title", "only")
        .param("page", "5")
        .param("size", "2"))
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

  private PublishedItem createPublishedItem(
    String title,
    String authors,
    String faculty,
    String program,
    int year,
    String keywords,
    Instant publishedAt
  ) {
    PublicationCase publicationCase = cases.save(PublicationCase.builder()
      .student(student)
      .type(PublicationType.THESIS)
      .status(CaseStatus.PUBLISHED)
      .build());

    return publishedItems.save(PublishedItem.builder()
      .publicationCase(publicationCase)
      .publishedAt(publishedAt)
      .title(title)
      .authors(authors)
      .authorName(authors)
      .faculty(faculty)
      .program(program)
      .year(year)
      .keywords(keywords)
      .abstractText("Repository search test item")
      .build());
  }

  private User requireUser(Role role) {
    return users.findByRole(role).stream()
      .findFirst()
      .orElseThrow(() -> new IllegalStateException("No seeded user found for role " + role));
  }
}
