package com.example.thesisrepo.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "app.auth")
public class AuthProperties {
  private AuthMode mode = AuthMode.SSO;
}
