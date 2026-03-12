package com.example.thesisrepo.web;

import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.Set;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerIntegrationTest {

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private UserRepository users;

  @Autowired
  private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

  @Test
  void studentLoginSucceeds() throws Exception {
    performLogin(emailForRole(Role.STUDENT), "test-only-student-password")
      .andExpect(jsonPath("$.role").value("STUDENT"));
  }

  @Test
  void lecturerLoginSucceeds() throws Exception {
    performLogin(emailForRole(Role.LECTURER), "test-only-lecturer-password")
      .andExpect(jsonPath("$.role").value("LECTURER"));
  }

  @Test
  void adminLoginSucceeds() throws Exception {
    performLogin(emailForRole(Role.ADMIN), "test-only-admin-password")
      .andExpect(jsonPath("$.role").value("ADMIN"));
  }

  @Test
  void multiRoleUserMustChooseRoleBeforeAccessingProtectedAreas() throws Exception {
    User dualRoleUser = users.save(User.builder()
      .email("dual-role+" + UUID.randomUUID() + "@my.sampoernauniversity.ac.id")
      .passwordHash(passwordEncoder.encode("test-only-dual-role-password"))
      .role(Role.STUDENT)
      .roles(Set.of(Role.STUDENT, Role.ADMIN))
      .emailVerified(true)
      .build());

    MockHttpSession session = (MockHttpSession) performLogin(dualRoleUser.getEmail(), "test-only-dual-role-password")
      .andExpect(jsonPath("$.roleSelectionRequired").value(true))
      .andExpect(jsonPath("$.availableRoles").isArray())
      .andReturn()
      .getRequest()
      .getSession(false);

    mockMvc.perform(get("/api/admin/checklists")
        .param("type", "THESIS")
        .session(session))
      .andExpect(status().isForbidden());

    mockMvc.perform(post("/api/auth/select-role")
        .session(session)
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"role\":\"ADMIN\"}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.role").value("ADMIN"))
      .andExpect(jsonPath("$.roleSelectionRequired").value(false));

    mockMvc.perform(get("/api/admin/checklists")
        .param("type", "THESIS")
        .session(session))
      .andExpect(status().isOk());
  }

  private String emailForRole(Role role) {
    return users.findByRole(role).stream()
      .findFirst()
      .map(User::getEmail)
      .orElseThrow(() -> new IllegalStateException("No seeded user found for role " + role));
  }

  private ResultActions performLogin(String username, String password) throws Exception {
    return mockMvc.perform(
        post("/api/auth/login")
          .contentType(MediaType.APPLICATION_FORM_URLENCODED)
          .accept(MediaType.APPLICATION_JSON)
          .param("username", username)
          .param("password", password)
      )
      .andExpect(status().isOk())
      .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
  }
}
