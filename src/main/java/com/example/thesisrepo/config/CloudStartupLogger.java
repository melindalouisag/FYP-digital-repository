package com.example.thesisrepo.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;

@Component
public class CloudStartupLogger implements ApplicationRunner {
  private static final Logger log = LoggerFactory.getLogger(CloudStartupLogger.class);

  private final DataSource dataSource;
  private final Environment environment;

  public CloudStartupLogger(DataSource dataSource, Environment environment) {
    this.dataSource = dataSource;
    this.environment = environment;
  }

  @Override
  public void run(ApplicationArguments args) throws Exception {
    logDatabaseStatus();
    logSmtpStatus();
  }

  private void logDatabaseStatus() {
    try (Connection connection = dataSource.getConnection()) {
      boolean valid = connection.isValid(5);
      if (valid) {
        log.info("Database connection successful");
      } else {
        log.warn("Database connection opened but did not validate successfully");
      }
    } catch (Exception ex) {
      log.error("Database connectivity check failed.");
    }
  }

  private void logSmtpStatus() {
    String mailHost = environment.getProperty("spring.mail.host");
    String mailUsername = environment.getProperty("spring.mail.username");
    String mailFrom = environment.getProperty("app.email.from");

    if (!isConfigured(mailHost)) {
      log.info("SMTP is not configured. Email notifications are disabled.");
      return;
    }

    if (!isConfigured(mailFrom)) {
      log.warn("SMTP host is configured but MAIL_FROM is empty. Provider defaults will be used if available.");
    }

    if (!isConfigured(mailUsername)) {
      log.info("SMTP host is configured without username. Ensure your provider supports this mode.");
    }

    log.info("SMTP configuration detected (host={})", mailHost.trim());
  }

  private static boolean isConfigured(String value) {
    if (value == null) {
      return false;
    }
    String trimmed = value.trim();
    return !trimmed.isEmpty() && !trimmed.matches("^\\$\\{.+}$");
  }
}
