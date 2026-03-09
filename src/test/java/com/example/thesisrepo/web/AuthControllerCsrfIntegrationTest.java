package com.example.thesisrepo.web;

import com.example.thesisrepo.master.Faculty;
import com.example.thesisrepo.master.Program;
import com.example.thesisrepo.master.repo.FacultyRepository;
import com.example.thesisrepo.master.repo.ProgramRepository;
import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.user.AuthProvider;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.UserRequestPostProcessor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.event.ApplicationEventsTestExecutionListener;
import org.springframework.test.context.support.DependencyInjectionTestExecutionListener;
import org.springframework.test.context.support.DirtiesContextBeforeModesTestExecutionListener;
import org.springframework.test.context.support.DirtiesContextTestExecutionListener;
import org.springframework.test.context.web.ServletTestExecutionListener;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

@SpringBootTest(properties = "app.security.csrf.enabled=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestExecutionListeners(
  listeners = {
    ServletTestExecutionListener.class,
    DirtiesContextBeforeModesTestExecutionListener.class,
    ApplicationEventsTestExecutionListener.class,
    DependencyInjectionTestExecutionListener.class,
    DirtiesContextTestExecutionListener.class
  },
  mergeMode = TestExecutionListeners.MergeMode.REPLACE_DEFAULTS
)
class AuthControllerCsrfIntegrationTest {

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @Autowired
  private UserRepository users;

  @Autowired
  private StudentProfileRepository studentProfiles;

  @Autowired
  private FacultyRepository faculties;

  @Autowired
  private ProgramRepository programs;

  @Test
  void authenticatedStudentCanReachOnboardingRoute() throws Exception {
    User user = createStudentWithoutProfile();

    mockMvc.perform(get("/onboarding").with(authenticatedStudent(user)))
      .andExpect(status().isOk())
      .andExpect(forwardedUrl("/index.html"));
  }

  @Test
  void onboardingSubmitSucceedsWithBootstrappedCsrfToken() throws Exception {
    User user = createStudentWithoutProfile();
    Program program = ensureProgram();
    CsrfBootstrap csrfBootstrap = bootstrapCsrfToken(user);
    String studentId = "S-" + UUID.randomUUID().toString().substring(0, 8);

    mockMvc.perform(
        post("/api/auth/onboarding")
          .with(authenticatedStudent(user))
          .cookie(csrfBootstrap.cookie())
          .contentType(MediaType.APPLICATION_JSON)
          .accept(MediaType.APPLICATION_JSON)
          .header("X-XSRF-TOKEN", csrfBootstrap.token())
          .header("X-CSRF-TOKEN", csrfBootstrap.token())
          .content("""
            {
              "name": "Onboarding Student",
              "faculty": "%s",
              "studyProgram": "%s",
              "studentId": "%s"
            }
            """.formatted(program.getFaculty().getName(), program.getName(), studentId))
      )
      .andExpect(status().isOk())
      .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
      .andExpect(jsonPath("$.profileComplete").value(true))
      .andExpect(jsonPath("$.faculty").value(program.getFaculty().getName()))
      .andExpect(jsonPath("$.program").value(program.getName()))
      .andExpect(jsonPath("$.studentId").value(studentId));

    StudentProfile profile = studentProfiles.findByUserId(user.getId()).orElseThrow();
    assertThat(profile.getName()).isEqualTo("Onboarding Student");
    assertThat(profile.getFaculty()).isEqualTo(program.getFaculty().getName());
    assertThat(profile.getProgram()).isEqualTo(program.getName());
    assertThat(profile.getStudentId()).isEqualTo(studentId);
  }

  @Test
  void onboardingSubmitWithoutCsrfTokenIsRejected() throws Exception {
    User user = createStudentWithoutProfile();
    Program program = ensureProgram();

    mockMvc.perform(
        post("/api/auth/onboarding")
          .with(authenticatedStudent(user))
          .contentType(MediaType.APPLICATION_JSON)
          .accept(MediaType.APPLICATION_JSON)
          .content("""
            {
              "name": "Onboarding Student",
              "faculty": "%s",
              "studyProgram": "%s",
              "studentId": "S-12345"
            }
            """.formatted(program.getFaculty().getName(), program.getName()))
      )
      .andExpect(status().isForbidden())
      .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
      .andExpect(jsonPath("$.error").value("Your secure session token is missing or expired. Refresh the page and try again."));
  }

  private User createStudentWithoutProfile() {
    return users.save(User.builder()
      .email("onboarding.student+" + UUID.randomUUID() + "@my.sampoernauniversity.ac.id")
      .passwordHash("unused-for-csrf-test")
      .role(Role.STUDENT)
      .authProvider(AuthProvider.AAD)
      .emailVerified(true)
      .build());
  }

  private UserRequestPostProcessor authenticatedStudent(User user) {
    return user(user.getEmail()).roles(user.getRole().name());
  }

  private CsrfBootstrap bootstrapCsrfToken(User user) throws Exception {
    MvcResult result = mockMvc.perform(
        get("/api/auth/csrf")
          .with(authenticatedStudent(user))
          .accept(MediaType.APPLICATION_JSON)
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.token").isString())
      .andReturn();

    Cookie cookie = result.getResponse().getCookie("XSRF-TOKEN");
    assertThat(cookie).isNotNull();
    String token = objectMapper.readTree(result.getResponse().getContentAsString()).path("token").asText();
    assertThat(token).isNotBlank();
    return new CsrfBootstrap(cookie, token);
  }

  private Program ensureProgram() {
    Faculty faculty = faculties.findByActiveTrueOrderByNameAsc().stream()
      .findFirst()
      .orElseGet(() -> faculties.save(Faculty.builder()
        .code("TEST")
        .name("Test Faculty")
        .active(true)
        .build()));

    return programs.findByActiveTrueAndFaculty_IdOrderByNameAsc(faculty.getId()).stream()
      .findFirst()
      .orElseGet(() -> programs.save(Program.builder()
        .faculty(faculty)
        .code("TEST-PROGRAM")
        .name("Test Program")
        .active(true)
        .build()));
  }

  private record CsrfBootstrap(Cookie cookie, String token) {}
}
