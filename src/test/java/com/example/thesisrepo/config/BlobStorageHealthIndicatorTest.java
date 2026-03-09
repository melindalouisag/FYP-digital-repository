package com.example.thesisrepo.config;

import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.models.BlobContainerProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BlobStorageHealthIndicatorTest {

  @Test
  void reportsUpWhenContainerReachable() {
    BlobContainerClient containerClient = mock(BlobContainerClient.class);
    when(containerClient.getBlobContainerName()).thenReturn("thesis-files");
    when(containerClient.getBlobContainerUrl()).thenReturn("https://exampleacct.blob.core.windows.net/thesis-files");
    when(containerClient.getProperties()).thenReturn(mock(BlobContainerProperties.class));

    Health health = new BlobStorageHealthIndicator(containerClient, "").health();

    assertThat(health.getStatus()).isEqualTo(Status.UP);
    assertThat(health.getDetails()).containsEntry("provider", "azure");
    assertThat(health.getDetails()).containsEntry("account", "exampleacct");
    assertThat(health.getDetails()).containsEntry("container", "thesis-files");
  }

  @Test
  void reportsDownWhenContainerUnreachable() {
    BlobContainerClient containerClient = mock(BlobContainerClient.class);
    when(containerClient.getBlobContainerName()).thenReturn("thesis-files");
    when(containerClient.getBlobContainerUrl()).thenReturn("https://exampleacct.blob.core.windows.net/thesis-files");
    when(containerClient.getProperties()).thenThrow(new RuntimeException("Connection failed"));

    Health health = new BlobStorageHealthIndicator(containerClient, "").health();

    assertThat(health.getStatus()).isEqualTo(Status.DOWN);
    assertThat(health.getDetails()).containsEntry("provider", "azure");
    assertThat(health.getDetails()).containsEntry("error", "Azure Blob container is unreachable");
  }
}
