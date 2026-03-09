package com.example.thesisrepo.web;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class UiRedirectControllerTest {

  @Test
  void loginForwardsToSpaWhenUiBaseUrlIsEmpty() {
    UiRedirectController controller = new UiRedirectController("");
    MockHttpServletRequest request = request("https", "repo.example.com", 443, "/login", "error=oauth_failed");

    String route = controller.login(request);

    assertThat(route).isEqualTo("forward:/index.html?error=oauth_failed");
  }

  @Test
  void loginForwardsToSpaWhenUiBaseUrlMatchesRequestOrigin() {
    UiRedirectController controller = new UiRedirectController("https://repo.example.com");
    MockHttpServletRequest request = request("https", "repo.example.com", 443, "/login", "error=access_denied");

    String route = controller.login(request);

    assertThat(route).isEqualTo("forward:/index.html?error=access_denied");
  }

  @Test
  void registerForwardsToSpaWhenUiBaseUrlMatchesRequestOrigin() {
    UiRedirectController controller = new UiRedirectController("https://repo.example.com");
    MockHttpServletRequest request = request("https", "repo.example.com", 443, "/register", "invitation=abc123");

    String route = controller.register(request);

    assertThat(route).isEqualTo("forward:/index.html?invitation=abc123");
  }

  @Test
  void loginRedirectsToUiBaseUrlWhenOriginDiffers() {
    UiRedirectController controller = new UiRedirectController("https://ui.example.com");
    MockHttpServletRequest request = request("https", "repo.example.com", 443, "/login", "error=oauth_failed");

    String route = controller.login(request);

    assertThat(route).isEqualTo("redirect:https://ui.example.com/login?error=oauth_failed");
  }

  @Test
  void registerRedirectsToUiBaseUrlWhenOriginDiffers() {
    UiRedirectController controller = new UiRedirectController("https://ui.example.com");
    MockHttpServletRequest request = request("https", "repo.example.com", 443, "/register", "invitation=abc123");

    String route = controller.register(request);

    assertThat(route).isEqualTo("redirect:https://ui.example.com/register?invitation=abc123");
  }

  private static MockHttpServletRequest request(
    String scheme,
    String serverName,
    int serverPort,
    String requestUri,
    String query
  ) {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", requestUri);
    request.setScheme(scheme);
    request.setServerName(serverName);
    request.setServerPort(serverPort);
    request.setQueryString(query);
    return request;
  }
}
