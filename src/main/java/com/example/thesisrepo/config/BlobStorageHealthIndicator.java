package com.example.thesisrepo.config;

import com.azure.storage.blob.BlobContainerClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;

@Component("blobStorage")
@ConditionalOnBean(BlobContainerClient.class)
@ConditionalOnProperty(prefix = "file.storage", name = "provider", havingValue = "azure")
public class BlobStorageHealthIndicator implements HealthIndicator {

  private final BlobContainerClient blobContainerClient;
  private final String configuredAccountName;

  public BlobStorageHealthIndicator(
    BlobContainerClient blobContainerClient,
    @Value("${azure.storage.account-name:}") String configuredAccountName
  ) {
    this.blobContainerClient = blobContainerClient;
    this.configuredAccountName = configuredAccountName;
  }

  @Override
  public Health health() {
    String container = blobContainerClient.getBlobContainerName();
    String account = resolveAccountName();
    try {
      blobContainerClient.getProperties();
      return Health.up()
        .withDetail("provider", "azure")
        .withDetail("account", account)
        .withDetail("container", container)
        .build();
    } catch (Exception ex) {
      return Health.down()
        .withDetail("provider", "azure")
        .withDetail("account", account)
        .withDetail("container", container)
        .withDetail("error", "Azure Blob container is unreachable")
        .build();
    }
  }

  private String resolveAccountName() {
    if (StringUtils.hasText(configuredAccountName)) {
      return configuredAccountName.trim();
    }
    try {
      URI url = URI.create(blobContainerClient.getBlobContainerUrl());
      String host = url.getHost();
      if (!StringUtils.hasText(host)) {
        return "unknown";
      }
      int dotIndex = host.indexOf('.');
      return dotIndex > 0 ? host.substring(0, dotIndex) : host;
    } catch (Exception ex) {
      return "unknown";
    }
  }
}
