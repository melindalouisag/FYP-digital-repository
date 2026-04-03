package com.example.thesisrepo.web;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.reminder.StudentDashboardReminderRepository;
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

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CalendarEventIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private StudentProfileRepository studentProfiles;
  @Autowired private StudentDashboardReminderRepository reminders;
  @Autowired private PasswordEncoder passwordEncoder;
  @Autowired private TransactionTemplate transactionTemplate;

  private User seedStudent;

  @BeforeEach
  void setup() {
    reminders.deleteAll();
    seedStudent = requireUser(Role.STUDENT);
  }

  @Test
  void personalEventsStayPrivateWhileLibraryDeadlinesStayShared() throws Exception {
    StudentLogin ownerLogin = createStudentLogin("test-only-calendar-owner-password");
    StudentLogin otherLogin = createStudentLogin("test-only-calendar-other-password");
    MockHttpSession adminSession = login(requireUser(Role.ADMIN).getEmail(), "test-only-admin-password");

    String personalResponse = mockMvc.perform(post("/api/calendar/events")
        .contentType(MediaType.APPLICATION_JSON)
        .session(ownerLogin.session())
        .content("""
          {
            "title":"Prepare library visit",
            "description":"Bring final draft.",
            "eventDate":"2026-04-08",
            "eventTime":"10:15",
            "eventType":"PERSONAL"
          }
          """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.title").value("Prepare library visit"))
      .andExpect(jsonPath("$.eventType").value("PERSONAL"))
      .andReturn()
      .getResponse()
      .getContentAsString();

    Long personalEventId = Long.valueOf(personalResponse.replaceAll(".*\"id\":(\\d+).*", "$1"));

    String deadlineResponse = mockMvc.perform(post("/api/calendar/events")
        .contentType(MediaType.APPLICATION_JSON)
        .session(adminSession)
        .content("""
          {
            "title":"Thesis submission deadline",
            "description":"Final PDF upload closes.",
            "eventDate":"2026-04-10",
            "eventTime":"17:00",
            "eventType":"DEADLINE",
            "deadlineAction":"SUBMISSION_DEADLINE",
            "publicationType":"THESIS"
          }
          """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.eventType").value("DEADLINE"))
      .andExpect(jsonPath("$.deadlineAction").value("SUBMISSION_DEADLINE"))
      .andExpect(jsonPath("$.publicationType").value("THESIS"))
      .andReturn()
      .getResponse()
      .getContentAsString();

    Long deadlineEventId = Long.valueOf(deadlineResponse.replaceAll(".*\"id\":(\\d+).*", "$1"));

    mockMvc.perform(get("/api/calendar/events").session(ownerLogin.session()))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[*].title", hasItem("Prepare library visit")))
      .andExpect(jsonPath("$[*].title", hasItem("Thesis submission deadline")));

    mockMvc.perform(get("/api/calendar/events").session(otherLogin.session()))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[*].title", not(hasItem("Prepare library visit"))))
      .andExpect(jsonPath("$[*].title", hasItem("Thesis submission deadline")));

    mockMvc.perform(delete("/api/calendar/events/{eventId}", personalEventId).session(ownerLogin.session()))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.ok").value(true));

    mockMvc.perform(delete("/api/calendar/events/{eventId}", deadlineEventId).session(adminSession))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.ok").value(true));
  }

  private User requireUser(Role role) {
    return users.findByRole(role).stream()
      .findFirst()
      .orElseThrow(() -> new IllegalStateException("No seeded user found for role " + role));
  }

  private StudentLogin createStudentLogin(String rawPassword) throws Exception {
    User user = createStudentUser(rawPassword);
    return new StudentLogin(user, login(user.getEmail(), rawPassword));
  }

  private User createStudentUser(String rawPassword) {
    StudentProfile seedProfile = studentProfiles.findByUserId(seedStudent.getId()).orElseThrow();
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
        .name("Calendar Student")
        .studentId("S-" + UUID.randomUUID().toString().substring(0, 8))
        .program(seedProfile.getProgram())
        .faculty(seedProfile.getFaculty())
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

  private record StudentLogin(User user, MockHttpSession session) {
  }
}
