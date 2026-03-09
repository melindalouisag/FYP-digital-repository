package com.example.thesisrepo.web;

import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

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
