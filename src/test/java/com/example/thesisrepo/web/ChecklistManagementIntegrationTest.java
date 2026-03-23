package com.example.thesisrepo.web;

import com.example.thesisrepo.publication.ChecklistScope;
import com.example.thesisrepo.publication.ChecklistTemplate;
import com.example.thesisrepo.publication.repo.ChecklistItemV2Repository;
import com.example.thesisrepo.publication.repo.ChecklistTemplateRepository;
import com.example.thesisrepo.user.AuthProvider;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChecklistManagementIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private ChecklistTemplateRepository checklistTemplates;
  @Autowired private ChecklistItemV2Repository checklistItems;
  @Autowired private UserRepository users;
  @Autowired private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

  @Test
  void createEmptyCreatesVersionOneDraftWhenTypeHasNoTemplates() throws Exception {
    MockHttpSession admin = loginAsAdmin();
    String body = mockMvc.perform(post("/api/admin/checklists/OTHER/create-empty").session(admin))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();

    JsonNode json = objectMapper.readTree(body);
    assertThat(json.get("version").asInt()).isEqualTo(1);
    assertThat(json.get("active").asBoolean()).isFalse();
    assertThat(json.get("itemCount").asInt()).isEqualTo(0);
  }

  @Test
  void newDraftCreatesNextVersionWhenTemplatesExist() throws Exception {
    ChecklistTemplate active = ensureActiveTemplate(ChecklistScope.THESIS);
    int topVersion = checklistTemplates.findTopByPublicationTypeOrderByVersionDesc(ChecklistScope.THESIS)
      .map(ChecklistTemplate::getVersion).orElse(active.getVersion());

    MockHttpSession admin = loginAsAdmin();
    String body = mockMvc.perform(post("/api/admin/checklists/THESIS/new-draft").session(admin))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();

    JsonNode json = objectMapper.readTree(body);
    assertThat(json.get("version").asInt()).isEqualTo(topVersion + 1);
    assertThat(json.get("active").asBoolean()).isFalse();
  }

  @Test
  void newVersionAndTemplateDetailUseStableDtoShapeWithoutEntityLeakage() throws Exception {
    MockHttpSession admin = loginAsAdmin();
    ChecklistTemplate active = ensureActiveTemplate(ChecklistScope.THESIS);

    String fullBody = mockMvc.perform(get("/api/admin/checklists/full?type=THESIS").session(admin))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();
    JsonNode fullJson = objectMapper.readTree(fullBody);
    JsonNode activeEntry = null;
    for (JsonNode entry : fullJson) {
      if (entry.path("template").path("id").asLong() == active.getId()) {
        activeEntry = entry;
        break;
      }
    }
    assertThat(activeEntry).isNotNull();
    assertThat(activeEntry.path("template").path("active").asBoolean()).isTrue();
    assertThat(activeEntry.path("items").get(0).path("required").asBoolean()).isTrue();
    assertThat(activeEntry.path("items").get(0).has("template")).isFalse();

    String createBody = mockMvc.perform(post("/api/admin/checklists/THESIS/new-version").session(admin))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.templateId", notNullValue()))
      .andExpect(jsonPath("$.version", notNullValue()))
      .andReturn().getResponse().getContentAsString();

    Long templateId = objectMapper.readTree(createBody).get("templateId").asLong();

    String detailBody = mockMvc.perform(get("/api/admin/checklists/templates/{templateId}", templateId).session(admin))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.template.id").value(templateId))
      .andExpect(jsonPath("$.template.active").value(false))
      .andExpect(jsonPath("$.items").isArray())
      .andReturn().getResponse().getContentAsString();

    assertThat(fullBody).doesNotContain("\"isRequired\":");
    assertThat(detailBody).doesNotContain("\"isRequired\":");
    assertThat(detailBody).doesNotContain("\"template\":{\"template\"");
  }

  @Test
  void cannotEditItemsOnActiveTemplate() throws Exception {
    ChecklistTemplate active = ensureActiveTemplate(ChecklistScope.THESIS);
    MockHttpSession admin = loginAsAdmin();

    String body = mockMvc.perform(put("/api/admin/checklists/templates/{templateId}/items", active.getId())
        .session(admin)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          [{"orderIndex":1,"section":"S","itemText":"X","guidanceText":"G","required":true}]
          """))
      .andExpect(status().isBadRequest())
      .andReturn().getResponse().getErrorMessage();

    assertThat(body).isEqualTo("Cannot edit active template; create a new draft first.");
  }

  @Test
  void activateSwitchesActiveTemplateAndKeepsOlderVersions() throws Exception {
    ChecklistTemplate oldActive = ensureActiveTemplate(ChecklistScope.ARTICLE);
    MockHttpSession admin = loginAsAdmin();

    String cloneBody = mockMvc.perform(post("/api/admin/checklists/ARTICLE/new-draft").session(admin))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();
    Long draftId = objectMapper.readTree(cloneBody).get("id").asLong();

    mockMvc.perform(post("/api/admin/checklists/templates/{templateId}/lock", draftId).session(admin))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.templateId").value(draftId))
      .andExpect(jsonPath("$.locked").value(true))
      .andExpect(jsonPath("$.lock.templateId").value(draftId))
      .andExpect(jsonPath("$.lock.ownedByCurrentUser").value(true));

    mockMvc.perform(put("/api/admin/checklists/templates/{templateId}/items", draftId)
        .session(admin)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          [{"orderIndex":1,"section":"New","itemText":"Article check","guidanceText":"Guidance","required":true}]
          """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.ok").value(true))
      .andExpect(jsonPath("$.lockReleased").value(true));

    mockMvc.perform(post("/api/admin/checklists/templates/{templateId}/activate", draftId).session(admin))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.templateId").value(draftId))
      .andExpect(jsonPath("$.active").value(true));

    ChecklistTemplate activeAfter = checklistTemplates.findFirstByPublicationTypeAndIsActiveTrue(ChecklistScope.ARTICLE).orElseThrow();
    assertThat(activeAfter.getId()).isEqualTo(draftId);
    ChecklistTemplate oldActiveAfter = checklistTemplates.findById(oldActive.getId()).orElseThrow();
    assertThat(oldActiveAfter.isActive()).isFalse();
    assertThat(checklistItems.findByTemplateOrderByOrderIndexAsc(activeAfter)).hasSize(1);
    assertThat(checklistTemplates.findByPublicationTypeOrderByVersionDesc(ChecklistScope.ARTICLE)).hasSizeGreaterThanOrEqualTo(2);
  }

  @Test
  void deleteDraftTemplateRemovesVersion() throws Exception {
    MockHttpSession admin = loginAsAdmin();

    ensureActiveTemplate(ChecklistScope.THESIS);
    String cloneBody = mockMvc.perform(post("/api/admin/checklists/THESIS/new-draft").session(admin))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();
    Long draftId = objectMapper.readTree(cloneBody).get("id").asLong();

    mockMvc.perform(delete("/api/admin/checklists/templates/{templateId}", draftId).session(admin))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.deleted").value(true))
      .andExpect(jsonPath("$.templateId").value(draftId));

    assertThat(checklistTemplates.findById(draftId)).isEmpty();
  }

  @Test
  void draftLockBlocksSecondAdminUntilFirstAdminSaves() throws Exception {
    MockHttpSession firstAdmin = loginAsAdmin();
    User secondAdmin = createAdminUser("test-only-second-admin-password");
    MockHttpSession secondAdminSession = login(secondAdmin.getEmail(), "test-only-second-admin-password");

    String cloneBody = mockMvc.perform(post("/api/admin/checklists/THESIS/new-draft").session(firstAdmin))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();
    Long draftId = objectMapper.readTree(cloneBody).get("id").asLong();

    mockMvc.perform(post("/api/admin/checklists/templates/{templateId}/lock", draftId).session(firstAdmin))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.templateId").value(draftId))
      .andExpect(jsonPath("$.lock.ownedByCurrentUser").value(true));

    mockMvc.perform(post("/api/admin/checklists/templates/{templateId}/lock", draftId).session(secondAdminSession))
      .andExpect(status().isConflict())
      .andExpect(jsonPath("$.error").exists())
      .andExpect(jsonPath("$.lock.lockedByEmail").value(emailForRole(Role.ADMIN)))
      .andExpect(result -> assertThat(result.getResponse().getContentAsString()).contains(emailForRole(Role.ADMIN)));

    mockMvc.perform(put("/api/admin/checklists/templates/{templateId}/items", draftId)
        .session(firstAdmin)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          [{"orderIndex":1,"section":"Locked","itemText":"First admin item","guidanceText":"Guide","required":true}]
          """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.ok").value(true))
      .andExpect(jsonPath("$.lockReleased").value(true));

    mockMvc.perform(post("/api/admin/checklists/templates/{templateId}/lock", draftId).session(secondAdminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.templateId").value(draftId))
      .andExpect(jsonPath("$.lock.ownedByCurrentUser").value(true));
  }

  @Test
  void saveAndReloadPreservesRequiredFlags() throws Exception {
    MockHttpSession admin = loginAsAdmin();

    String cloneBody = mockMvc.perform(post("/api/admin/checklists/THESIS/new-draft").session(admin))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();
    Long draftId = objectMapper.readTree(cloneBody).get("id").asLong();

    mockMvc.perform(post("/api/admin/checklists/templates/{templateId}/lock", draftId).session(admin))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.templateId").value(draftId))
      .andExpect(jsonPath("$.lock.ownedByCurrentUser").value(true));

    mockMvc.perform(put("/api/admin/checklists/templates/{templateId}/items", draftId)
        .session(admin)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          [
            {"orderIndex":1,"section":"Formatting","itemText":"Title","guidanceText":"Times New Roman","required":true},
            {"orderIndex":2,"section":"Formatting","itemText":"SU logo","guidanceText":"Use official asset","required":false}
          ]
          """))
      .andExpect(status().isOk());

    String afterSaveBody = mockMvc.perform(get("/api/admin/checklists/templates/{templateId}", draftId).session(admin))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();

    JsonNode afterSaveItems = objectMapper.readTree(afterSaveBody).get("items");
    assertThat(afterSaveItems).hasSize(2);
    assertThat(afterSaveItems.get(0).get("required").asBoolean()).isTrue();
    assertThat(afterSaveItems.get(1).get("required").asBoolean()).isFalse();

    mockMvc.perform(post("/api/admin/checklists/templates/{templateId}/lock", draftId).session(admin))
      .andExpect(status().isOk());

    String reopenedBody = mockMvc.perform(get("/api/admin/checklists/templates/{templateId}", draftId).session(admin))
      .andExpect(status().isOk())
      .andReturn().getResponse().getContentAsString();

    JsonNode reopenedItems = objectMapper.readTree(reopenedBody).get("items");
    assertThat(reopenedItems).hasSize(2);
    assertThat(reopenedItems.get(0).get("required").asBoolean()).isTrue();
    assertThat(reopenedItems.get(1).get("required").asBoolean()).isFalse();

    mockMvc.perform(delete("/api/admin/checklists/templates/{templateId}/lock", draftId).session(admin))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.templateId").value(draftId))
      .andExpect(jsonPath("$.released").value(true));
  }

  private ChecklistTemplate ensureActiveTemplate(ChecklistScope scope) {
    return checklistTemplates.findFirstByPublicationTypeAndIsActiveTrue(scope)
      .orElseGet(() -> {
        ChecklistTemplate template = checklistTemplates.save(ChecklistTemplate.builder()
          .publicationType(scope)
          .version(1)
          .isActive(true)
          .build());
        checklistItems.save(com.example.thesisrepo.publication.ChecklistItemV2.builder()
          .template(template)
          .orderIndex(1)
          .section("General")
          .itemText("Seed item")
          .guidanceText("Seed guidance")
          .isRequired(true)
          .build());
        return template;
      });
  }

  private MockHttpSession loginAsAdmin() throws Exception {
    return login(emailForRole(Role.ADMIN), "test-only-admin-password");
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

  private String emailForRole(Role role) {
    return users.findByRole(role).stream()
      .findFirst()
      .map(User::getEmail)
      .orElseThrow(() -> new IllegalStateException("No seeded user found for role " + role));
  }

  private User createAdminUser(String rawPassword) {
    return users.save(User.builder()
      .email("admin+" + UUID.randomUUID() + "@sampoernauniversity.ac.id")
      .passwordHash(passwordEncoder.encode(rawPassword))
      .role(Role.ADMIN)
      .roles(Set.of(Role.ADMIN))
      .authProvider(AuthProvider.LOCAL)
      .emailVerified(true)
      .build());
  }
}
