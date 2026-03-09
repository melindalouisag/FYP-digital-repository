package com.example.thesisrepo.service;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.specialized.BlobInputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.core.io.Resource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StorageServiceAzureOnlyTest {

  private BlobContainerClient blobContainerClient;
  private BlobClient blobClient;
  private Environment environment;
  private StorageService storageService;

  @BeforeEach
  void setUp() {
    blobContainerClient = mock(BlobContainerClient.class);
    blobClient = mock(BlobClient.class);
    environment = mock(Environment.class);

    DefaultListableBeanFactory beanFactory = new DefaultListableBeanFactory();
    beanFactory.registerSingleton("blobContainerClient", blobContainerClient);
    ObjectProvider<BlobContainerClient> provider = beanFactory.getBeanProvider(BlobContainerClient.class);

    storageService = new StorageService(provider, environment);
    ReflectionTestUtils.setField(storageService, "maxSizeBytes", 5_242_880L);
    ReflectionTestUtils.setField(storageService, "azureContainerName", "thesis-files");
    ReflectionTestUtils.setField(storageService, "azurePrefix", "documents");
  }

  @Test
  void failsFastWhenProviderMissing() {
    when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);
    ReflectionTestUtils.setField(storageService, "provider", "");

    assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(storageService, "initializeStorage"))
      .isInstanceOf(IllegalStateException.class)
      .hasMessageContaining("FILE_STORAGE_PROVIDER must be configured");
  }

  @Test
  void rejectsMemoryProviderOutsideTestProfile() {
    when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);
    ReflectionTestUtils.setField(storageService, "provider", "memory");

    assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(storageService, "initializeStorage"))
      .isInstanceOf(IllegalStateException.class)
      .hasMessageContaining("allowed only when the test profile is active");
  }

  @Test
  void uploadUsesAzureBlobClient() throws Exception {
    initializeAzureProvider();
    when(blobContainerClient.getBlobClient("documents/2026/sample.pdf")).thenReturn(blobClient);

    String storedKey = storageService.saveWithKey(pdfFile("sample.pdf"), "2026/sample.pdf");

    assertThat(storedKey).isEqualTo("documents/2026/sample.pdf");
    verify(blobClient, times(1)).uploadWithResponse(any(), any());
  }

  @Test
  void openAsResourceReadsFromAzureBlobClient() throws Exception {
    initializeAzureProvider();
    BlobInputStream blobInputStream = mock(BlobInputStream.class);
    when(blobContainerClient.getBlobClient("documents/2026/sample.pdf")).thenReturn(blobClient);
    when(blobClient.exists()).thenReturn(true);
    when(blobClient.openInputStream()).thenReturn(blobInputStream);

    Resource resource = storageService.openAsResource("2026/sample.pdf");

    assertThat(resource.getInputStream()).isSameAs(blobInputStream);
    verify(blobClient, times(1)).openInputStream();
  }

  @Test
  void existsChecksAzureBlobClient() {
    initializeAzureProvider();
    when(blobContainerClient.getBlobClient("documents/2026/sample.pdf")).thenReturn(blobClient);
    when(blobClient.exists()).thenReturn(true);

    assertThat(storageService.exists("2026/sample.pdf")).isTrue();
    verify(blobClient, times(1)).exists();
  }

  private void initializeAzureProvider() {
    when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);
    when(blobContainerClient.getBlobContainerName()).thenReturn("thesis-files");
    ReflectionTestUtils.setField(storageService, "provider", "azure");
    ReflectionTestUtils.invokeMethod(storageService, "initializeStorage");
  }

  private MockMultipartFile pdfFile(String filename) {
    byte[] bytes = "%PDF-1.7\nblob-test".getBytes(StandardCharsets.UTF_8);
    return new MockMultipartFile("file", filename, "application/pdf", bytes);
  }
}
