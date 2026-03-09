package com.example.thesisrepo.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.MutablePropertySources;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Normalizes Railway/Postgres environment variables into Spring datasource properties.
 */
public class RailwayDatasourceInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

  private static final Logger log = LoggerFactory.getLogger(RailwayDatasourceInitializer.class);
  private static final String PROPERTY_SOURCE_NAME = "railwayDatasourceOverrides";

  @Override
  public void initialize(ConfigurableApplicationContext applicationContext) {
    ConfigurableEnvironment environment = applicationContext.getEnvironment();
    if (isTestProfile(environment)) {
      return;
    }

    String configuredDatasourceUrl = trimToNull(environment.getProperty("spring.datasource.url"));
    if (configuredDatasourceUrl != null && configuredDatasourceUrl.startsWith("jdbc:hsqldb:")) {
      return;
    }

    ResolvedDatasource resolved = resolveDatasource(environment);
    Map<String, Object> overrides = new LinkedHashMap<>();
    putIfHasText(overrides, "spring.datasource.url", resolved.url());
    putIfHasText(overrides, "spring.datasource.username", resolved.username());
    putIfHasText(overrides, "spring.datasource.password", resolved.password());

    if (overrides.isEmpty()) {
      return;
    }

    MutablePropertySources propertySources = environment.getPropertySources();
    if (propertySources.contains(PROPERTY_SOURCE_NAME)) {
      propertySources.remove(PROPERTY_SOURCE_NAME);
    }
    propertySources.addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, overrides));

    if (resolved.fromDatabaseUrl()) {
      log.info("Datasource configured from DATABASE_URL.");
    } else {
      log.info("Datasource configured from PGHOST/PGPORT/PGDATABASE.");
    }
  }

  private static ResolvedDatasource resolveDatasource(ConfigurableEnvironment environment) {
    String pgUser = trimToNull(environment.getProperty("PGUSER"));
    String pgPassword = trimToNull(environment.getProperty("PGPASSWORD"));

    String databaseUrl = trimToNull(environment.getProperty("DATABASE_URL"));
    if (databaseUrl != null) {
      ParsedDatabaseUrl parsed = parseDatabaseUrl(databaseUrl);
      if (parsed != null) {
        return new ResolvedDatasource(
          parsed.jdbcUrl(),
          firstNonBlank(pgUser, parsed.username()),
          firstNonBlank(pgPassword, parsed.password()),
          true
        );
      }
    }

    String pgHost = trimToNull(environment.getProperty("PGHOST"));
    String pgDatabase = trimToNull(environment.getProperty("PGDATABASE"));
    if (pgHost != null && pgDatabase != null) {
      String pgPort = firstNonBlank(trimToNull(environment.getProperty("PGPORT")), "5432");
      String jdbcUrl = "jdbc:postgresql://" + pgHost + ":" + pgPort + "/" + pgDatabase;
      return new ResolvedDatasource(jdbcUrl, pgUser, pgPassword, false);
    }

    return ResolvedDatasource.empty();
  }

  private static ParsedDatabaseUrl parseDatabaseUrl(String rawValue) {
    String value = rawValue.trim();
    String lower = value.toLowerCase(Locale.ROOT);

    if (lower.startsWith("jdbc:postgresql://")) {
      return new ParsedDatabaseUrl(value, null, null);
    }

    if (!lower.startsWith("postgres://") && !lower.startsWith("postgresql://")) {
      return null;
    }

    URI uri;
    try {
      uri = URI.create(value);
    } catch (IllegalArgumentException ex) {
      return null;
    }

    String host = trimToNull(uri.getHost());
    String path = trimToNull(uri.getPath());
    if (host == null || path == null || "/".equals(path)) {
      return null;
    }

    int port = uri.getPort() > 0 ? uri.getPort() : 5432;
    String database = path.startsWith("/") ? path.substring(1) : path;
    String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + "/" + database;
    if (trimToNull(uri.getQuery()) != null) {
      jdbcUrl += "?" + uri.getQuery();
    }

    String username = null;
    String password = null;
    String userInfo = trimToNull(uri.getUserInfo());
    if (userInfo != null) {
      String[] parts = userInfo.split(":", 2);
      username = decodeUrl(parts[0]);
      if (parts.length == 2) {
        password = decodeUrl(parts[1]);
      }
    }

    return new ParsedDatabaseUrl(jdbcUrl, username, password);
  }

  private static String decodeUrl(String value) {
    return URLDecoder.decode(value, StandardCharsets.UTF_8);
  }

  private static boolean isTestProfile(ConfigurableEnvironment environment) {
    for (String profile : environment.getActiveProfiles()) {
      if ("test".equalsIgnoreCase(profile)) {
        return true;
      }
    }
    return false;
  }

  private static String firstNonBlank(String preferred, String fallback) {
    return preferred != null ? preferred : fallback;
  }

  private static void putIfHasText(Map<String, Object> target, String key, String value) {
    if (value != null) {
      target.put(key, value);
    }
  }

  private static String trimToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private record ParsedDatabaseUrl(String jdbcUrl, String username, String password) {}

  private record ResolvedDatasource(String url, String username, String password, boolean fromDatabaseUrl) {
    private static ResolvedDatasource empty() {
      return new ResolvedDatasource(null, null, null, false);
    }
  }
}
