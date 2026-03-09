package com.example.thesisrepo.web;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.util.UriComponentsBuilder;

@Controller
public class UiRedirectController {

  private final String uiBaseUrl;
  private final URI uiBaseUri;

  public UiRedirectController(@Value("${app.ui.base-url:}") String uiBaseUrl) {
    this.uiBaseUrl = normalizeBaseUrl(uiBaseUrl);
    this.uiBaseUri = parseUri(this.uiBaseUrl);
  }

  @GetMapping("/login")
  public String login(HttpServletRequest request) {
    return routeToUiOrSpa("/login", request);
  }

  @GetMapping("/register")
  public String register(HttpServletRequest request) {
    return routeToUiOrSpa("/register", request);
  }

  private String routeToUiOrSpa(String path, HttpServletRequest request) {
    if (shouldForwardToSpa(request)) {
      return buildForwardTarget(request);
    }

    UriComponentsBuilder target = UriComponentsBuilder.fromUriString(uiBaseUrl).path(path);
    if (StringUtils.hasText(request.getQueryString())) {
      target.query(request.getQueryString());
    }

    return "redirect:" + target.build(true).toUriString();
  }

  private boolean shouldForwardToSpa(HttpServletRequest request) {
    if (!StringUtils.hasText(uiBaseUrl)) {
      return true;
    }
    return isSameOrigin(request);
  }

  private boolean isSameOrigin(HttpServletRequest request) {
    if (uiBaseUri == null || !uiBaseUri.isAbsolute() || !StringUtils.hasText(uiBaseUri.getHost())) {
      return false;
    }

    String requestScheme = request.getScheme();
    String requestHost = request.getServerName();
    int requestPort = normalizePort(requestScheme, request.getServerPort());
    int basePort = normalizePort(uiBaseUri.getScheme(), uiBaseUri.getPort());

    return equalsIgnoreCase(uiBaseUri.getScheme(), requestScheme)
      && equalsIgnoreCase(uiBaseUri.getHost(), requestHost)
      && basePort == requestPort;
  }

  private static String buildForwardTarget(HttpServletRequest request) {
    String query = request.getQueryString();
    if (!StringUtils.hasText(query)) {
      return "forward:/index.html";
    }
    String target = UriComponentsBuilder.fromPath("/index.html")
      .query(query)
      .build(true)
      .toUriString();
    return "forward:" + target;
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

  private static URI parseUri(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    try {
      return UriComponentsBuilder.fromUriString(value).build(true).toUri();
    } catch (IllegalArgumentException ignored) {
      return null;
    }
  }

  private static int normalizePort(String scheme, int port) {
    if (port > 0) {
      return port;
    }
    if ("http".equalsIgnoreCase(scheme)) {
      return 80;
    }
    if ("https".equalsIgnoreCase(scheme)) {
      return 443;
    }
    return port;
  }

  private static boolean equalsIgnoreCase(String a, String b) {
    if (a == null || b == null) {
      return false;
    }
    return a.equalsIgnoreCase(b);
  }
}
