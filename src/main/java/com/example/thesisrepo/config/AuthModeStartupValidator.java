package com.example.thesisrepo.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

@Component
public class AuthModeStartupValidator implements ApplicationRunner {

  private final AuthProperties authProperties;
  private final Environment environment;

  public AuthModeStartupValidator(AuthProperties authProperties, Environment environment) {
    this.authProperties = authProperties;
    this.environment = environment;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (environment.acceptsProfiles(Profiles.of("test"))) {
      return;
    }

    AuthMode mode = authProperties.getMode() == null ? AuthMode.SSO : authProperties.getMode();
    if (mode == AuthMode.LOCAL || mode == AuthMode.HYBRID) {
      throw new IllegalStateException("APP_AUTH_MODE must be SSO (or AAD alias) for non-test runtime.");
    }
  }
}
