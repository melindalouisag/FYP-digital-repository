package com.example.thesisrepo.web;

import com.example.thesisrepo.config.AuthMode;
import com.example.thesisrepo.config.AuthProperties;
import com.example.thesisrepo.service.CurrentUserService;
import com.example.thesisrepo.service.auth.AuthLoginService;
import com.example.thesisrepo.service.auth.AuthOnboardingService;
import com.example.thesisrepo.service.auth.AuthResponseFactory;
import com.example.thesisrepo.service.UserRoleService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.OperationResultResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.FORBIDDEN;

@RestController
@RequestMapping({"/api/auth", "/auth"})
@RequiredArgsConstructor
public class AuthController {

  private final CurrentUserService currentUserService;
  private final AuthLoginService authLoginService;
  private final AuthOnboardingService authOnboardingService;
  private final AuthResponseFactory authResponseFactory;
  private final AuthProperties authProperties;
  private final UserRoleService userRoles;

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
    User user = authLoginService.authenticate(email, password, request);
    return ResponseEntity.ok(authResponseFactory.toMeResponse(user, request));
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
    Role activeRole = authResponseFactory.requireActiveRole(user, httpRequest);
    authOnboardingService.completeOnboarding(
      user,
      activeRole,
      request.name(),
      request.faculty(),
      request.studyProgram(),
      request.program(),
      request.studentId(),
      request.department()
    );
    return ResponseEntity.ok(authResponseFactory.toMeResponse(user, httpRequest));
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
    return ResponseEntity.ok(authResponseFactory.toMeResponse(user, request));
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

    return ResponseEntity.ok(authResponseFactory.toMeResponse(user, httpRequest));
  }

  private static String firstNonBlank(String first, String second) {
    if (first != null && !first.trim().isEmpty()) {
      return first.trim();
    }
    return second == null ? "" : second.trim();
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
