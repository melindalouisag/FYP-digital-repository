package com.example.thesisrepo.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthModeStartupValidatorTest {

  @Test
  void rejectsLocalModeOutsideTestProfile() {
    AuthProperties properties = new AuthProperties();
    properties.setMode(AuthMode.LOCAL);
    Environment environment = mock(Environment.class);
    when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);

    AuthModeStartupValidator validator = new AuthModeStartupValidator(properties, environment);

    assertThatThrownBy(() -> validator.run(new DefaultApplicationArguments(new String[0])))
      .isInstanceOf(IllegalStateException.class)
      .hasMessageContaining("APP_AUTH_MODE must be SSO");
  }

  @Test
  void allowsSsoModeOutsideTestProfile() {
    AuthProperties properties = new AuthProperties();
    properties.setMode(AuthMode.SSO);
    Environment environment = mock(Environment.class);
    when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);

    AuthModeStartupValidator validator = new AuthModeStartupValidator(properties, environment);

    assertThatCode(() -> validator.run(new DefaultApplicationArguments(new String[0])))
      .doesNotThrowAnyException();
  }

  @Test
  void allowsLocalModeInTestProfile() {
    AuthProperties properties = new AuthProperties();
    properties.setMode(AuthMode.LOCAL);
    Environment environment = mock(Environment.class);
    when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);

    AuthModeStartupValidator validator = new AuthModeStartupValidator(properties, environment);

    assertThatCode(() -> validator.run(new DefaultApplicationArguments(new String[0])))
      .doesNotThrowAnyException();
  }
}
