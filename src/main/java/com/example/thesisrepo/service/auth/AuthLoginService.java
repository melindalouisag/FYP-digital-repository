package com.example.thesisrepo.service.auth;

import com.example.thesisrepo.config.AuthMode;
import com.example.thesisrepo.config.AuthProperties;
import com.example.thesisrepo.service.AuthRateLimitService;
import com.example.thesisrepo.service.UserRoleService;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;

@Service
@RequiredArgsConstructor
public class AuthLoginService {

  private static final String LOCAL_LOGIN_DISABLED_MESSAGE = "Local login is disabled. Use Microsoft SSO.";

  private final AuthenticationManager authenticationManager;
  private final AuthRateLimitService authRateLimitService;
  private final AuthProperties authProperties;
  private final UserRepository userRepository;
  private final UserRoleService userRoles;

  public User authenticate(String email, String password, HttpServletRequest request) {
    String clientIp = resolveClientIp(request);
    if (!authRateLimitService.allowLoginAttempt(clientIp)) {
      throw new ResponseStatusException(TOO_MANY_REQUESTS, "Too many login attempts. Please try again in 1 minute.");
    }

    if (!isLocalLoginEnabled(authProperties.getMode())) {
      throw new ResponseStatusException(CONFLICT, LOCAL_LOGIN_DISABLED_MESSAGE);
    }

    String normalizedEmail = normalizeText(email).toLowerCase(Locale.ROOT);
    String normalizedPassword = normalizeText(password);
    if (normalizedEmail.isBlank() || normalizedPassword.isBlank()) {
      throw new ResponseStatusException(BAD_REQUEST, "Email and password are required.");
    }

    Authentication authentication = authenticationManager.authenticate(
      new UsernamePasswordAuthenticationToken(normalizedEmail, normalizedPassword)
    );

    User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
      .orElseThrow(() -> new ResponseStatusException(FORBIDDEN, "Invalid credentials."));

    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    request.getSession(true).setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
    userRoles.initializeSession(request, user);
    return user;
  }

  private static String normalizeText(String value) {
    return value == null ? "" : value.trim();
  }

  private static String resolveClientIp(HttpServletRequest request) {
    String forwarded = request.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) {
      return forwarded.split(",")[0].trim();
    }
    return request.getRemoteAddr();
  }

  private static boolean isLocalLoginEnabled(AuthMode mode) {
    if (mode == null) {
      return false;
    }
    return mode == AuthMode.LOCAL || mode == AuthMode.HYBRID;
  }
}
