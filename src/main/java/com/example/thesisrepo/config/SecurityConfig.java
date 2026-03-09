package com.example.thesisrepo.config;

import com.example.thesisrepo.service.OidcProvisioningUserService;
import com.example.thesisrepo.service.UserDetailsServiceImpl;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpMethod;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.header.writers.XXssProtectionHeaderWriter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.InvalidCsrfTokenException;
import org.springframework.security.web.csrf.MissingCsrfTokenException;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

  private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);
  private static final String CSRF_FAILURE_MESSAGE = "Your secure session token is missing or expired. Refresh the page and try again.";

  private final UserDetailsServiceImpl userDetailsService;
  private final OidcProvisioningUserService oidcUserService;
  private final RoleBasedAuthSuccessHandler successHandler;
  private final AuthProperties authProperties;
  private final String uiBaseUrl;
  private final List<String> allowedCorsOrigins;
  private final String contentSecurityPolicy;
  private final boolean csrfEnabled;

  public SecurityConfig(
    UserDetailsServiceImpl userDetailsService,
    OidcProvisioningUserService oidcUserService,
    RoleBasedAuthSuccessHandler successHandler,
    AuthProperties authProperties,
    @Value("${app.ui.base-url:}") String uiBaseUrl,
    @Value("${app.security.cors.allowed-origins:${FRONTEND_URL:${APP_UI_BASE_URL:http://localhost:5173}}}") String allowedCorsOrigins,
    @Value("${app.security.csp:default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://login.microsoftonline.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'}") String contentSecurityPolicy,
    @Value("${app.security.csrf.enabled:true}") boolean csrfEnabled
  ) {
    this.userDetailsService = userDetailsService;
    this.oidcUserService = oidcUserService;
    this.successHandler = successHandler;
    this.authProperties = authProperties;
    this.uiBaseUrl = normalizeBaseUrl(uiBaseUrl);
    this.allowedCorsOrigins = parseAllowedOrigins(allowedCorsOrigins);
    this.contentSecurityPolicy = StringUtils.hasText(contentSecurityPolicy)
      ? contentSecurityPolicy.trim()
      : "default-src 'self'";
    this.csrfEnabled = csrfEnabled;
  }

  @Bean
  public DaoAuthenticationProvider authenticationProvider(PasswordEncoder passwordEncoder) {
    DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
    provider.setUserDetailsService(userDetailsService);
    provider.setPasswordEncoder(passwordEncoder);
    return provider;
  }

  @Bean
  public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
    return authConfig.getAuthenticationManager();
  }

  @Bean
  public SecurityFilterChain securityFilterChain(
    HttpSecurity http,
    PasswordEncoder passwordEncoder,
    ObjectProvider<ClientRegistrationRepository> clientRegistrationRepository
  ) throws Exception {
    AuthMode mode = authProperties.getMode() == null ? AuthMode.SSO : authProperties.getMode();
    boolean localEnabled = isLocalLoginEnabled(mode);
    boolean ssoEnabled = isSsoEnabled(mode);

    String loginRedirect = resolveUiRoute("/login");

    http
      .cors(Customizer.withDefaults())
      .headers(headers -> headers
        .contentTypeOptions(Customizer.withDefaults())
        .frameOptions(frame -> frame.deny())
        .xssProtection(xss -> xss.headerValue(XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
        .contentSecurityPolicy(csp -> csp.policyDirectives(contentSecurityPolicy))
      );

    if (csrfEnabled) {
      CookieCsrfTokenRepository csrfTokenRepository = createCsrfTokenRepository();
      http
        .csrf(csrf -> csrf
          .csrfTokenRepository(csrfTokenRepository)
        )
        .addFilterAfter(new CsrfCookieFilter(), CsrfFilter.class);
    } else {
      http.csrf(AbstractHttpConfigurer::disable);
    }

    http
      .authenticationProvider(authenticationProvider(passwordEncoder))
      .authorizeHttpRequests(auth -> auth
        // SPA + public assets
        .requestMatchers(
          "/",
          "/index.html",
          "/assets/**",
          "/favicon.ico",
          "/login",
          "/register",
          "/error"
        ).permitAll()

        // Platform health checks
        .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()

        // OAuth endpoints must be public
        .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()

        // Auth endpoints public (login/register/logout/me)
        .requestMatchers("/api/auth/**").permitAll()
        .requestMatchers("/auth/**").permitAll()

        // Public repo endpoints
        .requestMatchers(HttpMethod.GET, "/api/public/repository/*/download").authenticated()
        .requestMatchers("/api/public/**").permitAll()
        .requestMatchers("/api/supervisors/**").hasAnyRole("STUDENT", "ADMIN")

        // Role APIs
        .requestMatchers("/api/student/**").hasRole("STUDENT")
        .requestMatchers("/api/lecturer/**").hasRole("LECTURER")
        .requestMatchers("/api/admin/**").hasRole("ADMIN")

        .anyRequest().authenticated()
      )
      .exceptionHandling(ex -> ex.authenticationEntryPoint((request, response, authException) -> {
        if (isApiRequest(request)) {
          response.sendError(HttpStatus.UNAUTHORIZED.value(), HttpStatus.UNAUTHORIZED.getReasonPhrase());
          return;
        }
        response.sendRedirect(loginRedirect);
      }).accessDeniedHandler((request, response, accessDeniedException) -> {
        if (isApiRequest(request)) {
          logApiAccessDenied(request, accessDeniedException);
          writeJsonError(
            response,
            HttpStatus.FORBIDDEN,
            isCsrfFailure(accessDeniedException) ? CSRF_FAILURE_MESSAGE : HttpStatus.FORBIDDEN.getReasonPhrase()
          );
          return;
        }

        if (isCsrfFailure(accessDeniedException)) {
          logApiAccessDenied(request, accessDeniedException);
        }
        response.sendError(HttpStatus.FORBIDDEN.value(), HttpStatus.FORBIDDEN.getReasonPhrase());
      }))
      .logout(logout -> logout
        .logoutUrl("/logout")
        .logoutSuccessHandler((request, response, authentication) -> {
          request.getSession().invalidate();
          // If ?redirect= is specified, go there (e.g. Register flow)
          String redirectParam = request.getParameter("redirect");
          if (redirectParam != null && redirectParam.startsWith("/")) {
            response.sendRedirect(redirectParam);
            return;
          }
          // Default: redirect to homepage
          response.sendRedirect(resolveUiRoute("/"));
        })
        .invalidateHttpSession(true)
        .deleteCookies("JSESSIONID")
        .permitAll()
      );

    if (localEnabled) {
      http.formLogin(form -> form
        .loginPage("/login")
        .permitAll()
      );
    } else {
      http.formLogin(AbstractHttpConfigurer::disable);
      http.httpBasic(AbstractHttpConfigurer::disable);
    }

    if (ssoEnabled && clientRegistrationRepository.getIfAvailable() != null) {
      var resolver = new org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver(
        clientRegistrationRepository.getIfAvailable(), "/oauth2/authorization");
      resolver.setAuthorizationRequestCustomizer(customizer ->
        customizer.additionalParameters(params -> params.put("prompt", "select_account")));

      http.oauth2Login(oauth -> oauth
        .loginPage("/login")
        .authorizationEndpoint(auth -> auth.authorizationRequestResolver(resolver))
        .userInfoEndpoint(userInfo -> userInfo.oidcUserService(oidcUserService))
        .successHandler(successHandler)
        .failureHandler(oauthFailureHandler())
      );
    }

    return http.build();
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration configuration = new CorsConfiguration();
    configuration.setAllowedOrigins(allowedCorsOrigins);
    configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Requested-With", "X-CSRF-TOKEN", "X-XSRF-TOKEN"));
    configuration.setExposedHeaders(List.of("Location"));
    configuration.setAllowCredentials(true);
    configuration.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
  }

  @Bean
  public AuthenticationFailureHandler oauthFailureHandler() {
    return (request, response, exception) -> {
      String message = resolveOAuthErrorMessage(exception);
      String encoded = URLEncoder.encode(message, StandardCharsets.UTF_8);
      response.sendRedirect(resolveUiRoute("/login") + "?error=" + encoded);
    };
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

  private static CookieCsrfTokenRepository createCsrfTokenRepository() {
    CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
    repository.setCookiePath("/");
    return repository;
  }

  private static String normalizeBaseUrl(String value) {
    if (!StringUtils.hasText(value)) {
      return "";
    }
    String trimmed = value.trim();
    while (trimmed.endsWith("/")) {
      trimmed = trimmed.substring(0, trimmed.length() - 1);
    }
    return trimmed;
  }

  private static boolean isApiRequest(HttpServletRequest request) {
    String contextPath = request.getContextPath();
    String uri = request.getRequestURI();
    if (StringUtils.hasText(contextPath) && uri.startsWith(contextPath)) {
      uri = uri.substring(contextPath.length());
    }
    return uri.startsWith("/api/");
  }

  private static List<String> parseAllowedOrigins(String value) {
    if (!StringUtils.hasText(value)) {
      return List.of("http://localhost:5173");
    }
    List<String> parsed = Arrays.stream(value.split(","))
      .map(String::trim)
      .filter(StringUtils::hasText)
      .distinct()
      .toList();
    return parsed.isEmpty() ? List.of("http://localhost:5173") : parsed;
  }

  private String resolveUiRoute(String path) {
    if (StringUtils.hasText(uiBaseUrl)) {
      return uiBaseUrl + path;
    }
    return path;
  }

  private static String resolveOAuthErrorMessage(Exception exception) {
    if (exception == null || !StringUtils.hasText(exception.getMessage())) {
      return "SSO login failed";
    }

    String message = exception.getMessage().trim();
    String lower = message.toLowerCase(Locale.ROOT);

    if (lower.contains("invalid_token_response")) {
      return "Microsoft sign-in failed. Verify AAD tenant/client settings and redirect URI.";
    }
    if (lower.contains("domain_not_allowed")) {
      return "Only university accounts are allowed.";
    }
    if (lower.contains("staff_access_disabled")) {
      return "Lecturer access is not enabled. Supervisors are selected from the directory.";
    }

    return message.length() > 220 ? message.substring(0, 220) + "..." : message;
  }

  private static boolean isCsrfFailure(AccessDeniedException exception) {
    return exception instanceof MissingCsrfTokenException || exception instanceof InvalidCsrfTokenException;
  }

  private static void logApiAccessDenied(HttpServletRequest request, AccessDeniedException exception) {
    String principal = request.getUserPrincipal() != null ? request.getUserPrincipal().getName() : "anonymous";
    if (isCsrfFailure(exception)) {
      log.warn("CSRF rejected {} {} for principal={}", request.getMethod(), request.getRequestURI(), principal);
      return;
    }
    log.warn("Access denied {} {} for principal={}", request.getMethod(), request.getRequestURI(), principal);
  }

  private static void writeJsonError(HttpServletResponse response, HttpStatus status, String message) throws IOException {
    response.setStatus(status.value());
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.getWriter().write("{\"error\":\"" + escapeJson(message) + "\"}");
  }

  private static String escapeJson(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  private static final class CsrfCookieFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain
    ) throws ServletException, IOException {
      CsrfToken csrfToken = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
      if (csrfToken != null) {
        csrfToken.getToken();
      }
      filterChain.doFilter(request, response);
    }
  }
}
