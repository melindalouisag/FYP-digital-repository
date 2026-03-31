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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StudentReminderIntegrationTest {
  private static final String STUDENT_PASSWORD = "test-only-student-password";

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private StudentProfileRepository studentProfiles;
  @Autowired private PublicationCaseRepository cases;
  @Autowired private PublicationRegistrationRepository registrations;
  @Autowired private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
  @Autowired private TransactionTemplate transactionTemplate;

  private User seedStudent;

  @BeforeEach
  void setup() {
    seedStudent = requireUser(Role.STUDENT);
  }

  @Test
  void studentReminderCrudPersistsAcrossReloadAndEnforcesOwnership() throws Exception {
    StudentLogin ownerLogin = createStudentLogin("test-only-reminder-owner-password");
    StudentLogin otherLogin = createStudentLogin("test-only-reminder-other-password");

    PublicationCase linkedCase = cases.save(PublicationCase.builder()
      .student(ownerLogin.user())
      .type(PublicationType.THESIS)
      .status(CaseStatus.UNDER_SUPERVISOR_REVIEW)
      .build());
    registrations.save(PublicationRegistration.builder()
      .publicationCase(linkedCase)
      .title("Reminder Linked Case")
      .build());

    String createResponse = mockMvc.perform(post("/api/student/reminders")
        .contentType(MediaType.APPLICATION_JSON)
        .session(ownerLogin.session())
        .content("""
          {
            "title":"Submit revised document",
            "reminderDate":"2026-04-05",
            "reminderTime":"09:30",
            "caseId":%d
          }
          """.formatted(linkedCase.getId())))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.title").value("Submit revised document"))
      .andExpect(jsonPath("$.caseId").value(linkedCase.getId()))
      .andExpect(jsonPath("$.caseTitle").value("Reminder Linked Case"))
      .andExpect(jsonPath("$.status").value("ACTIVE"))
      .andReturn()
      .getResponse()
      .getContentAsString();

    Long reminderId = Long.valueOf(createResponse.replaceAll(".*\"id\":(\\d+).*", "$1"));

    mockMvc.perform(get("/api/student/reminders").session(ownerLogin.session()))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[*].id", hasItem(reminderId.intValue())))
      .andExpect(jsonPath("$[*].title", hasItem("Submit revised document")))
      .andExpect(jsonPath("$[*].caseTitle", hasItem("Reminder Linked Case")));

    mockMvc.perform(put("/api/student/reminders/{reminderId}", reminderId)
        .contentType(MediaType.APPLICATION_JSON)
        .session(ownerLogin.session())
        .content("""
          {
            "title":"Upload corrected submission",
            "reminderDate":"2026-04-06",
            "reminderTime":"10:45",
            "caseId":%d
          }
          """.formatted(linkedCase.getId())))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.title").value("Upload corrected submission"))
      .andExpect(jsonPath("$.reminderDate").value("2026-04-06"))
      .andExpect(jsonPath("$.reminderTime").value("10:45:00"));

    mockMvc.perform(post("/api/student/reminders/{reminderId}/done", reminderId)
        .session(ownerLogin.session()))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("DONE"));

    mockMvc.perform(get("/api/student/reminders").session(ownerLogin.session()))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[*].id", hasItem(reminderId.intValue())))
      .andExpect(jsonPath("$[*].title", hasItem("Upload corrected submission")))
      .andExpect(jsonPath("$[*].status", hasItem("DONE")));

    mockMvc.perform(get("/api/student/reminders").session(otherLogin.session()))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[*].id", not(hasItem(reminderId.intValue()))));

    mockMvc.perform(put("/api/student/reminders/{reminderId}", reminderId)
        .contentType(MediaType.APPLICATION_JSON)
        .session(otherLogin.session())
        .content("""
          {
            "title":"Unauthorized update",
            "reminderDate":"2026-04-07",
            "reminderTime":"11:00",
            "caseId":null
          }
          """))
      .andExpect(status().isNotFound());

    mockMvc.perform(delete("/api/student/reminders/{reminderId}", reminderId)
        .session(otherLogin.session()))
      .andExpect(status().isNotFound());

    mockMvc.perform(delete("/api/student/reminders/{reminderId}", reminderId)
        .session(ownerLogin.session()))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.ok").value(true));

    mockMvc.perform(get("/api/student/reminders").session(ownerLogin.session()))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[*].id", not(hasItem(reminderId.intValue()))));
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

  private StudentLogin createStudentLogin(String rawPassword) throws Exception {
    User user = createStudentUser(rawPassword);
    return new StudentLogin(user, login(user.getEmail(), rawPassword));
  }

  private User createStudentUser(String rawPassword) {
    return transactionTemplate.execute(status -> {
      StudentProfile seedProfile = studentProfiles.findByUserId(seedStudent.getId()).orElseThrow();
      User created = users.save(User.builder()
        .email("student+" + UUID.randomUUID() + "@my.sampoernauniversity.ac.id")
        .passwordHash(passwordEncoder.encode(rawPassword))
        .role(Role.STUDENT)
        .roles(Set.of(Role.STUDENT))
        .emailVerified(true)
        .build());

      studentProfiles.save(StudentProfile.builder()
        .user(created)
        .name("Reminder Student")
        .studentId("S-" + UUID.randomUUID().toString().substring(0, 8))
        .program(seedProfile.getProgram())
        .faculty(seedProfile.getFaculty())
        .build());

      return created;
    });
  }

  private User requireUser(Role role) {
    return users.findByRole(role).stream()
      .findFirst()
      .orElseThrow(() -> new IllegalStateException("No seeded user found for role " + role));
  }

  private record StudentLogin(User user, MockHttpSession session) {}
}
