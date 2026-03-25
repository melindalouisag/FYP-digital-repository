package com.example.thesisrepo.web;

import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.publication.PublishedItem;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublishedItemRepository;
import com.example.thesisrepo.support.PostgresIntegrationTestSupport;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class PublicRepositorySearchPostgresIntegrationTest extends PostgresIntegrationTestSupport {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private PublicationCaseRepository cases;
  @Autowired private PublishedItemRepository publishedItems;

  private User student;

  @BeforeEach
  void setUp() {
    publishedItems.deleteAll();
    cases.deleteAll();
    student = requireUser(Role.STUDENT);
  }

  @Test
  void searchRanksExactTitleMatchesAheadOfNewerPartialMatchesOnPostgres() throws Exception {
    createPublishedItem(
      "Applied Machine Learning for Archives",
      "Student Researcher",
      "Faculty of Engineering and Technology (FET)",
      "Information Systems",
      2025,
      "machine, archives",
      Instant.parse("2026-03-10T10:00:00Z"),
      "Repository search study."
    );
    PublishedItem exactTitle = createPublishedItem(
      "Machine Learning",
      "Student Researcher",
      "Faculty of Engineering and Technology (FET)",
      "Information Systems",
      2024,
      "machine, learning",
      Instant.parse("2026-01-10T10:00:00Z"),
      "Focused full-text search study."
    );

    mockMvc.perform(get("/api/public/repository/search")
        .param("title", "machine learning")
        .param("size", "2"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.totalElements").value(2))
      .andExpect(jsonPath("$.items[0].id").value(exactTitle.getId()))
      .andExpect(jsonPath("$.items[0].title").value("Machine Learning"));
  }

  @Test
  void searchCombinesFiltersPaginationAndDiscoveryRankingOnPostgres() throws Exception {
    PublishedItem titleMatch = createPublishedItem(
      "Neural Search for Institutional Repositories",
      "Student Researcher",
      "Faculty of Engineering and Technology (FET)",
      "Information Systems",
      2025,
      "",
      Instant.parse("2026-01-10T10:00:00Z"),
      "A study on repository discovery quality."
    );
    createPublishedItem(
      "Repository Ranking Study",
      "Student Researcher",
      "Faculty of Engineering and Technology (FET)",
      "Information Systems",
      2025,
      "",
      Instant.parse("2026-03-01T10:00:00Z"),
      "This study evaluates neural search ranking for digital repositories."
    );
    createPublishedItem(
      "Neural Search for Institutional Repositories",
      "Student Researcher",
      "Faculty of Business",
      "Management",
      2025,
      "",
      Instant.parse("2026-03-05T10:00:00Z"),
      "Same topic, wrong faculty filter."
    );

    mockMvc.perform(get("/api/public/repository/search")
        .param("keyword", "neural search")
        .param("faculty", "Faculty of Engineering and Technology (FET)")
        .param("program", "Information Systems")
        .param("year", "2025")
        .param("page", "0")
        .param("size", "1"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.page").value(0))
      .andExpect(jsonPath("$.size").value(1))
      .andExpect(jsonPath("$.totalElements").value(2))
      .andExpect(jsonPath("$.totalPages").value(2))
      .andExpect(jsonPath("$.items[0].id").value(titleMatch.getId()))
      .andExpect(jsonPath("$.items[0].faculty").value("Faculty of Engineering and Technology (FET)"));

    mockMvc.perform(get("/api/public/repository/search")
        .param("keyword", "neural search")
        .param("faculty", "Faculty of Engineering and Technology (FET)")
        .param("program", "Information Systems")
        .param("year", "2025")
        .param("page", "1")
        .param("size", "1"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.page").value(1))
      .andExpect(jsonPath("$.items").isArray())
      .andExpect(jsonPath("$.items.length()").value(1))
      .andExpect(jsonPath("$.hasPrevious").value(true))
      .andExpect(jsonPath("$.hasNext").value(false));
  }

  @Test
  void searchSupportsOutOfRangePagesOnPostgres() throws Exception {
    createPublishedItem(
      "Repository Search Result",
      "Student Researcher",
      "Faculty of Engineering and Technology (FET)",
      "Information Systems",
      2025,
      "repository",
      Instant.parse("2026-01-10T10:00:00Z"),
      "Repository search test item."
    );

    mockMvc.perform(get("/api/public/repository/search")
        .param("title", "repository")
        .param("page", "5")
        .param("size", "2"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.items").isArray())
      .andExpect(jsonPath("$.items").isEmpty())
      .andExpect(jsonPath("$.page").value(5))
      .andExpect(jsonPath("$.size").value(2))
      .andExpect(jsonPath("$.totalElements").value(1))
      .andExpect(jsonPath("$.totalPages").value(1))
      .andExpect(jsonPath("$.hasPrevious").value(true))
      .andExpect(jsonPath("$.hasNext").value(false));
  }

  private PublishedItem createPublishedItem(
    String title,
    String authors,
    String faculty,
    String program,
    int year,
    String keywords,
    Instant publishedAt,
    String abstractText
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
      .abstractText(abstractText)
      .build());
  }

  private User requireUser(Role role) {
    return users.findByRole(role).stream()
      .findFirst()
      .orElseThrow(() -> new IllegalStateException("No seeded user found for role " + role));
  }
}
