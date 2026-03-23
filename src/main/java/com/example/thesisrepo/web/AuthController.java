package com.example.thesisrepo.web;

import com.example.thesisrepo.config.AuthMode;
import com.example.thesisrepo.config.AuthProperties;
import com.example.thesisrepo.master.Faculty;
import com.example.thesisrepo.master.Program;
import com.example.thesisrepo.master.repo.FacultyRepository;
import com.example.thesisrepo.master.repo.ProgramRepository;
import com.example.thesisrepo.profile.LecturerProfile;
import com.example.thesisrepo.profile.LecturerProfileRepository;
import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.service.AuthRateLimitService;
import com.example.thesisrepo.service.CurrentUserService;
import com.example.thesisrepo.service.UserRoleService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import com.example.thesisrepo.web.dto.OperationResultResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;

@RestController
@RequestMapping({"/api/auth", "/auth"})
@RequiredArgsConstructor
public class AuthController {

  private static final String LOCAL_LOGIN_DISABLED_MESSAGE = "Local login is disabled. Use Microsoft SSO.";

  private final AuthenticationManager authenticationManager;
  private final CurrentUserService currentUserService;
  private final AuthRateLimitService authRateLimitService;
  private final AuthProperties authProperties;
  private final UserRepository userRepository;
  private final UserRoleService userRoles;

  private final StudentProfileRepository studentProfiles;
  private final LecturerProfileRepository lecturerProfiles;
  private final FacultyRepository faculties;
  private final ProgramRepository programs;

  @PostMapping(value = "/login", consumes = MediaType.APPLICATION_JSON_VALUE)
  public ResponseEntity<MeResponse> loginJson(@RequestBody LoginRequest request, HttpServletRequest httpRequest) {
    return authenticate(request.email(), request.password(), httpRequest);
  }

  @PostMapping(value = "/login", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
  public ResponseEntity<MeResponse> loginForm(
    @RequestParam(name = "username", required = false) String username,
    @RequestParam(name = "email", required = false) String email,
    @RequestParam(name = "password") String password,
    HttpServletRequest httpRequest
  ) {
    return authenticate(firstNonBlank(email, username), password, httpRequest);
  }

  private ResponseEntity<MeResponse> authenticate(String email, String password, HttpServletRequest request) {
    String clientIp = resolveClientIp(request);
    if (!authRateLimitService.allowLoginAttempt(clientIp)) {
      throw new ResponseStatusException(TOO_MANY_REQUESTS, "Too many login attempts. Please try again in 1 minute.");
    }

    if (!isLocalLoginEnabled()) {
      throw new ResponseStatusException(CONFLICT, LOCAL_LOGIN_DISABLED_MESSAGE);
    }

    String normalizedEmail = normalizeText(email).toLowerCase(Locale.ROOT);
    String normalizedPassword = normalizeText(password);
    if (normalizedEmail.isBlank() || normalizedPassword.isBlank()) {
      throw new ResponseStatusException(BAD_REQUEST, "Email and password are required.");
    }

    Authentication auth = authenticationManager.authenticate(
      new UsernamePasswordAuthenticationToken(normalizedEmail, normalizedPassword)
    );

    User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
      .orElseThrow(() -> new ResponseStatusException(FORBIDDEN, "Invalid credentials."));

    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(auth);
    SecurityContextHolder.setContext(context);
    request.getSession(true).setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
    userRoles.initializeSession(request, user);

    return ResponseEntity.ok(toMeResponse(user, request));
  }

  @PostMapping("/register")
  public ResponseEntity<ErrorMessageResponse> register(@RequestBody RegisterRequest request) {
    return ResponseEntity.status(FORBIDDEN).body(
      new ErrorMessageResponse("Self-registration is disabled. Use Sign up with Sampoerna University email.")
    );
  }

  @PostMapping("/onboarding")
  @PreAuthorize("isAuthenticated()")
  @Transactional
  public ResponseEntity<MeResponse> onboarding(@RequestBody OnboardingRequest request, HttpServletRequest httpRequest) {
    User user = currentUserService.requireCurrentUser();
    Role activeRole = requireActiveRole(user, httpRequest);

    String name = normalizeText(request.name());
    String facultyName = normalizeText(request.faculty());
    if (name.isBlank() || facultyName.isBlank()) {
      throw new ResponseStatusException(BAD_REQUEST, "Name and faculty are required.");
    }

    Faculty faculty = faculties.findByActiveTrueAndNameIgnoreCase(facultyName)
      .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Invalid faculty/program"));

    if (activeRole == Role.STUDENT) {
      String programName = firstNonBlank(request.studyProgram(), request.program(), request.department());
      String studentId = normalizeText(request.studentId());
      if (programName.isBlank() || studentId.isBlank()) {
        throw new ResponseStatusException(BAD_REQUEST, "Program and student ID are required for students.");
      }

      Program program = programs.findByActiveTrueAndFaculty_IdAndNameIgnoreCase(faculty.getId(), programName)
        .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Invalid faculty/program"));

      studentProfiles.findByStudentId(studentId)
        .filter(existing -> !existing.getUserId().equals(user.getId()))
        .ifPresent(existing -> {
          throw new ResponseStatusException(CONFLICT, "Student ID is already used by another account.");
        });

      StudentProfile profile = studentProfiles.findByUserId(user.getId())
        .orElseGet(() -> StudentProfile.builder().user(user).build());
      profile.setName(name);
      profile.setFaculty(faculty.getName());
      profile.setProgram(program.getName());
      profile.setStudentId(studentId);
      studentProfiles.save(profile);
    } else if (activeRole == Role.LECTURER) {
      String departmentName = firstNonBlank(request.studyProgram(), request.department(), request.program());
      if (departmentName.isBlank()) {
        throw new ResponseStatusException(BAD_REQUEST, "Study program is required for lecturers.");
      }

      Program department = programs.findByActiveTrueAndFaculty_IdAndNameIgnoreCase(faculty.getId(), departmentName)
        .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Invalid faculty/program"));

      LecturerProfile profile = lecturerProfiles.findByUserId(user.getId())
        .orElseGet(() -> LecturerProfile.builder().user(user).build());
      profile.setName(name);
      profile.setFaculty(faculty.getName());
      profile.setDepartment(department.getName());
      lecturerProfiles.save(profile);
    } else {
      throw new ResponseStatusException(BAD_REQUEST, "Onboarding is not required for this role.");
    }

    return ResponseEntity.ok(toMeResponse(user, httpRequest));
  }

  @PostMapping("/logout")
  public ResponseEntity<OperationResultResponse> logout(HttpServletRequest request) throws Exception {
    request.logout();
    SecurityContextHolder.clearContext();
    return ResponseEntity.ok(new OperationResultResponse(true));
  }

  @GetMapping("/config")
  public ResponseEntity<AuthConfigResponse> config() {
    AuthMode mode = authProperties.getMode() == null ? AuthMode.SSO : authProperties.getMode();
    return ResponseEntity.ok(new AuthConfigResponse(
      mode.name(),
      isLocalLoginEnabled(mode),
      isSsoEnabled(mode),
      "/oauth2/authorization/azure"
    ));
  }

  @GetMapping("/csrf")
  public ResponseEntity<CsrfTokenResponse> csrf(CsrfToken csrfToken) {
    return ResponseEntity.ok(new CsrfTokenResponse(csrfToken.getToken()));
  }

  @GetMapping("/me")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<MeResponse> me(HttpServletRequest request) {
    User user = currentUserService.requireCurrentUser();
    return ResponseEntity.ok(toMeResponse(user, request));
  }

  @PostMapping("/select-role")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<MeResponse> selectRole(@RequestBody SelectRoleRequest request, HttpServletRequest httpRequest) {
    User user = currentUserService.requireCurrentUser();
    if (request.role() == null) {
      throw new ResponseStatusException(BAD_REQUEST, "Role is required.");
    }

    try {
      userRoles.selectActiveRole(httpRequest, user, request.role());
    } catch (IllegalArgumentException ex) {
      throw new ResponseStatusException(FORBIDDEN, ex.getMessage(), ex);
    }

    return ResponseEntity.ok(toMeResponse(user, httpRequest));
  }

  private MeResponse toMeResponse(User user, HttpServletRequest request) {
    Role activeRole = requireDisplayRole(user, request);
    boolean roleSelectionRequired = request != null
      ? userRoles.isRoleSelectionRequired(user, request)
      : false;
    java.util.List<String> availableRoles = request != null
      ? userRoles.availableRoleNames(user, request)
      : userRoles.resolveAvailableRoles(user).stream().map(Enum::name).toList();

    if (activeRole == Role.ADMIN) {
      return new MeResponse(
        user.getId(),
        user.getEmail(),
        activeRole.name(),
        user.getAuthProvider().name(),
        true,
        user.isEmailVerified(),
        null,
        null,
        null,
        null,
        null,
        null,
        availableRoles,
        roleSelectionRequired
      );
    }

    if (activeRole == Role.STUDENT) {
      StudentProfile profile = studentProfiles.findByUserId(user.getId()).orElse(null);
      String name = profile != null ? normalizeText(profile.getName()) : "";
      String faculty = profile != null ? normalizeText(profile.getFaculty()) : "";
      String program = profile != null ? normalizeText(profile.getProgram()) : "";
      String studentId = profile != null ? normalizeText(profile.getStudentId()) : "";
      boolean complete = !name.isBlank() && !faculty.isBlank() && !program.isBlank() && !studentId.isBlank();
      return new MeResponse(
        user.getId(),
        user.getEmail(),
        activeRole.name(),
        user.getAuthProvider().name(),
        complete,
        user.isEmailVerified(),
        emptyToNull(name),
        emptyToNull(name),
        emptyToNull(faculty),
        emptyToNull(program),
        null,
        emptyToNull(studentId),
        availableRoles,
        roleSelectionRequired
      );
    }

    if (activeRole == Role.LECTURER) {
      LecturerProfile profile = lecturerProfiles.findByUserId(user.getId()).orElse(null);
      String name = profile != null ? normalizeText(profile.getName()) : "";
      String faculty = profile != null ? normalizeText(profile.getFaculty()) : "";
      String department = profile != null ? normalizeText(profile.getDepartment()) : "";
      return new MeResponse(
        user.getId(),
        user.getEmail(),
        activeRole.name(),
        user.getAuthProvider().name(),
        true,
        user.isEmailVerified(),
        emptyToNull(name),
        emptyToNull(name),
        emptyToNull(faculty),
        null,
        emptyToNull(department),
        null,
        availableRoles,
        roleSelectionRequired
      );
    }

    return new MeResponse(
      user.getId(),
      user.getEmail(),
      activeRole != null ? activeRole.name() : user.getRole().name(),
      user.getAuthProvider().name(),
      false,
      user.isEmailVerified(),
      null,
      null,
      null,
      null,
      null,
      null,
      availableRoles,
      roleSelectionRequired
    );
  }

  private Role requireDisplayRole(User user, HttpServletRequest request) {
    if (request == null) {
      return user.getRole();
    }
    Role displayRole = userRoles.resolveDisplayRole(user, request);
    return displayRole != null ? displayRole : user.getRole();
  }

  private Role requireActiveRole(User user, HttpServletRequest request) {
    if (request != null && userRoles.isRoleSelectionRequired(user, request)) {
      throw new ResponseStatusException(CONFLICT, "Please choose a role before continuing.");
    }
    return request != null ? requireDisplayRole(user, request) : user.getRole();
  }

  private static String normalizeText(String value) {
    return value == null ? "" : value.trim();
  }

  private static String firstNonBlank(String first, String second) {
    if (first != null && !first.trim().isEmpty()) {
      return first.trim();
    }
    return second == null ? "" : second.trim();
  }

  private static String firstNonBlank(String first, String second, String third) {
    String value = firstNonBlank(first, second);
    if (!value.isBlank()) {
      return value;
    }
    return third == null ? "" : third.trim();
  }

  private static String emptyToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  private static String resolveClientIp(HttpServletRequest request) {
    String forwarded = request.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) {
      return forwarded.split(",")[0].trim();
    }
    return request.getRemoteAddr();
  }

  private boolean isLocalLoginEnabled() {
    return isLocalLoginEnabled(authProperties.getMode());
  }

  private static boolean isLocalLoginEnabled(AuthMode mode) {
    if (mode == null) {
      return false;
    }
    return mode == AuthMode.LOCAL || mode == AuthMode.HYBRID;
  }

  private static boolean isSsoEnabled(AuthMode mode) {
    if (mode == null) {
      return true;
    }
    return mode == AuthMode.SSO || mode == AuthMode.AAD || mode == AuthMode.HYBRID;
  }

  public record LoginRequest(String email, String password) {}

  public record RegisterRequest(
    String email,
    String password,
    String name,
    Role role,
    String studentId,
    String program,
    String faculty,
    String department,
    String fullName
  ) {}

  public record OnboardingRequest(
    String name,
    String faculty,
    String studyProgram,
    String program,
    String studentId,
    String department
  ) {}

  public record SelectRoleRequest(Role role) {}

  public record MeResponse(
    Long id,
    String email,
    String role,
    String authProvider,
    boolean profileComplete,
    boolean emailVerified,
    String name,
    String fullName,
    String faculty,
    String program,
    String department,
    String studentId,
    java.util.List<String> availableRoles,
    boolean roleSelectionRequired
  ) {}

  public record AuthConfigResponse(
    String mode,
    boolean localEnabled,
    boolean ssoEnabled,
    String ssoUrl
  ) {}

  public record ErrorMessageResponse(String error) {}

  public record CsrfTokenResponse(String token) {}
}
