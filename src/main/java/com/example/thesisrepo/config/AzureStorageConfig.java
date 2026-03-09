package com.example.thesisrepo.config;

import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.azure.storage.blob.models.PublicAccessType;
import com.azure.storage.common.StorageSharedKeyCredential;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import java.net.URI;

@Configuration
@ConditionalOnProperty(prefix = "file.storage", name = "provider", havingValue = "azure")
public class AzureStorageConfig {
  private static final Logger log = LoggerFactory.getLogger(AzureStorageConfig.class);

  @Value("${azure.storage.account-name:}")
  private String accountName;

  @Value("${azure.storage.account-key:}")
  private String accountKey;

  @Value("${azure.storage.connection-string:}")
  private String connectionString;

  @Value("${azure.storage.container-name:}")
  private String containerName;

  @Bean
  public BlobServiceClient blobServiceClient() {
    try {
      if (StringUtils.hasText(connectionString)) {
        return new BlobServiceClientBuilder()
          .connectionString(connectionString.trim())
          .buildClient();
      }

      if (!StringUtils.hasText(accountName)) {
        throw new IllegalStateException("AZURE_STORAGE_ACCOUNT is not configured.");
      }
      if (!StringUtils.hasText(accountKey)) {
        throw new IllegalStateException("AZURE_STORAGE_KEY is not configured.");
      }

      String normalizedAccountName = accountName.trim();
      String endpoint = "https://" + normalizedAccountName + ".blob.core.windows.net";
      StorageSharedKeyCredential credential =
        new StorageSharedKeyCredential(normalizedAccountName, accountKey.trim());

      return new BlobServiceClientBuilder()
        .endpoint(endpoint)
        .credential(credential)
        .buildClient();
    } catch (IllegalStateException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to create Azure Blob service client from the configured environment.");
    }
  }

  @Bean
  public BlobContainerClient blobContainerClient(BlobServiceClient blobServiceClient) {
    if (!StringUtils.hasText(containerName)) {
      throw new IllegalStateException("AZURE_STORAGE_CONTAINER is not configured.");
    }

    String normalizedContainer = containerName.trim();
    try {
      BlobContainerClient blobContainerClient = blobServiceClient.getBlobContainerClient(normalizedContainer);
      blobContainerClient.createIfNotExists();
      PublicAccessType accessType = blobContainerClient.getProperties().getBlobPublicAccess();
      if (accessType != null) {
        throw new IllegalStateException("Azure Blob container must be private.");
      }

      log.info(
        "Storage provider configured: provider=azure, account={}, container={}",
        resolveAccountName(blobServiceClient),
        normalizedContainer
      );
      return blobContainerClient;
    } catch (IllegalStateException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new IllegalStateException("Azure Blob container is not reachable: " + normalizedContainer);
    }
  }

  private String resolveAccountName(BlobServiceClient blobServiceClient) {
    if (StringUtils.hasText(accountName)) {
      return accountName.trim();
    }
    try {
      URI accountUri = URI.create(blobServiceClient.getAccountUrl());
      String host = accountUri.getHost();
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
