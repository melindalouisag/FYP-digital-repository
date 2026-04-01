package com.example.thesisrepo.service;

import com.azure.core.util.Context;
import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.models.BlobHttpHeaders;
import com.azure.storage.blob.options.BlobParallelUploadOptions;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class StorageService {
  private static final Logger log = LoggerFactory.getLogger(StorageService.class);

  private final BlobContainerClient blobContainerClient;
  private final Environment environment;

  public StorageService(ObjectProvider<BlobContainerClient> blobContainerClientProvider, Environment environment) {
    this.blobContainerClient = blobContainerClientProvider.getIfAvailable();
    this.environment = environment;
  }

  @Value("${file.storage.provider:}")
  private String provider;

  @Value("${file.max-size-bytes:5242880}")
  private long maxSizeBytes;

  @Value("${azure.storage.container-name:}")
  private String azureContainerName;

  @Value("${azure.storage.prefix:documents}")
  private String azurePrefix;

  private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
    "application/pdf"
  );

  private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".pdf");
  private static final Set<String> BLOCKED_EXTENSIONS = Set.of(".exe", ".sh", ".js", ".bat", ".cmd", ".com");

  private final Map<String, StoredObject> inMemoryStore = new ConcurrentHashMap<>();
  private String normalizedAzurePrefix = "";
  private String normalizedProvider = "azure";

  @PostConstruct
  void initializeStorage() {
    if (!hasText(provider)) {
      throw new IllegalStateException("FILE_STORAGE_PROVIDER must be configured. Allowed values: azure (runtime), memory (test only).");
    }

    normalizedProvider = provider.trim().toLowerCase(Locale.ROOT);
    boolean testProfileActive = environment.acceptsProfiles(Profiles.of("test"));

    switch (normalizedProvider) {
      case "memory" -> {
        if (!testProfileActive) {
          throw new IllegalStateException("FILE_STORAGE_PROVIDER=memory is allowed only when the test profile is active.");
        }
        log.info("Storage provider configured: memory (test profile only)");
        return;
      }
      case "azure" -> {
        initializeAzureStorage();
        return;
      }
      default -> throw new IllegalStateException("Unsupported FILE_STORAGE_PROVIDER value: " + normalizedProvider + ". Allowed values: azure (runtime), memory (test only).");
    }
  }

  public String saveDocument(MultipartFile file) throws IOException {
    String safeOriginalFilename = sanitizeOriginalFilename(file.getOriginalFilename());
    String ext = extension(safeOriginalFilename);
    String nowBucket = LocalDate.now().toString().substring(0, 7);
    String objectKey = nowBucket + "/" + UUID.randomUUID() + ext;
    return saveWithKey(file, objectKey);
  }

  public String saveWithKey(MultipartFile file, String objectKey) throws IOException {
    validatePdf(file);
    String normalizedObjectKey = normalizeObjectKey(objectKey);
    if (usesMemoryStorage()) {
      return saveToMemory(file, normalizedObjectKey);
    }
    return saveToAzure(file, normalizedObjectKey);
  }

  public boolean exists(String storedKey) {
    if (!hasText(storedKey)) {
      return false;
    }

    if (usesMemoryStorage()) {
      try {
        return inMemoryStore.containsKey(normalizeObjectKey(storedKey));
      } catch (IOException ex) {
        return false;
      }
    }

    return blobContainerClient.getBlobClient(toBlobName(storedKey)).exists();
  }

  public Resource openAsResource(String storedKey) throws IOException {
    if (!hasText(storedKey)) {
      throw new IOException("Stored key is empty");
    }

    if (usesMemoryStorage()) {
      String normalizedKey = normalizeObjectKey(storedKey);
      StoredObject storedObject = inMemoryStore.get(normalizedKey);
      if (storedObject == null) {
        throw new IOException("File not found");
      }
      return new ByteArrayResource(storedObject.bytes());
    }

    BlobClient blobClient = blobContainerClient.getBlobClient(toBlobName(storedKey));
    if (!blobClient.exists()) {
      throw new IOException("File not found");
    }
    return new InputStreamResource(blobClient.openInputStream());
  }

  public void delete(String storedKey) throws IOException {
    if (!hasText(storedKey)) {
      return;
    }

    if (usesMemoryStorage()) {
      inMemoryStore.remove(normalizeObjectKey(storedKey));
      return;
    }

    BlobClient blobClient = blobContainerClient.getBlobClient(toBlobName(storedKey));
    if (blobClient.exists()) {
      blobClient.delete();
    }
  }

  private String saveToAzure(MultipartFile file, String objectKey) throws IOException {
    String blobName = buildBlobName(objectKey);
    BlobClient blobClient = blobContainerClient.getBlobClient(blobName);
    log.info("Uploading file to Azure Blob Storage: {}", blobName);
    try (var inputStream = file.getInputStream()) {
      BlobHttpHeaders headers = new BlobHttpHeaders()
        .setContentType(file.getContentType());

      BlobParallelUploadOptions uploadOptions = new BlobParallelUploadOptions(inputStream, file.getSize())
        .setHeaders(headers);

      blobClient.uploadWithResponse(uploadOptions, Context.NONE);
    }
    log.info("Upload completed: {}", blobName);
    log.info("File uploaded to Azure with content type: {}", file.getContentType());
    return blobName;
  }

  private String saveToMemory(MultipartFile file, String objectKey) throws IOException {
    byte[] bytes = file.getBytes();
    inMemoryStore.put(objectKey, new StoredObject(bytes, file.getContentType()));
    log.info("Stored file in memory provider: {}", objectKey);
    return objectKey;
  }

  private void initializeAzureStorage() {
    if (blobContainerClient == null) {
      throw new IllegalStateException("Azure Blob Storage client is not available.");
    }

    normalizedAzurePrefix = normalizePrefix(azurePrefix);
    String resolvedContainerName = hasText(azureContainerName)
      ? azureContainerName
      : blobContainerClient.getBlobContainerName();

    log.info(
      "Storage provider configured: azure (container={}, prefix={})",
      resolvedContainerName,
      normalizedAzurePrefix.isBlank() ? "<none>" : normalizedAzurePrefix
    );
  }

  private void validatePdf(MultipartFile file) throws IOException {
    if (file == null || file.isEmpty()) {
      throw new IOException("File is required");
    }
    if (file.getSize() > maxSizeBytes) {
      throw new IOException("File exceeds maximum size of " + maxSizeBytes + " bytes");
    }

    String safeOriginalFilename = sanitizeOriginalFilename(file.getOriginalFilename());
    String rawExt = rawExtension(safeOriginalFilename);
    if (BLOCKED_EXTENSIONS.contains(rawExt)) {
      throw new IOException("Executable or script files are not allowed.");
    }

    String ext = extension(safeOriginalFilename);
    if (!ALLOWED_EXTENSIONS.contains(ext)) {
      throw new IOException("Only PDF files are accepted.");
    }

    String contentType = file.getContentType();
    if (contentType != null
      && !contentType.isBlank()
      && !"application/octet-stream".equalsIgnoreCase(contentType)
      && !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
      throw new IOException("Only PDF files are accepted.");
    }

    if (!hasPdfMagicBytes(file)) {
      throw new IOException("Only PDF files are accepted.");
    }
  }

  public String sanitizeOriginalFilename(String originalFilename) throws IOException {
    String fallback = "document.pdf";
    if (!hasText(originalFilename)) {
      return fallback;
    }

    String candidate = originalFilename.trim();
    if (containsPathTraversal(candidate)) {
      throw new IOException("Invalid file name");
    }

    String normalized = normalizeSlashes(candidate);
    int slashIndex = normalized.lastIndexOf('/');
    String basename = slashIndex >= 0 ? normalized.substring(slashIndex + 1) : normalized;

    basename = basename
      .replaceAll("[\\r\\n\\t\\x00]", "")
      .replaceAll("[^A-Za-z0-9._-]", "_");

    while (basename.startsWith(".")) {
      basename = basename.substring(1);
    }

    if (!hasText(basename)) {
      return fallback;
    }

    if (basename.length() > 150) {
      basename = basename.substring(0, 150);
    }

    return basename;
  }

  private String normalizeObjectKey(String objectKey) throws IOException {
    if (!hasText(objectKey)) {
      throw new IOException("Invalid storage key");
    }
    String normalized = trimLeadingSlashes(normalizeSlashes(objectKey));
    Path normalizedPath = Paths.get(normalized).normalize();
    if (normalizedPath.isAbsolute() || normalizedPath.startsWith("..")) {
      throw new IOException("Invalid storage key");
    }
    String candidate = normalizedPath.toString().replace('\\', '/');
    if (!hasText(candidate) || ".".equals(candidate)) {
      throw new IOException("Invalid storage key");
    }
    return candidate;
  }

  private String normalizePrefix(String prefix) {
    if (!hasText(prefix)) {
      return "";
    }

    String normalized = trimTrailingSlashes(trimLeadingSlashes(normalizeSlashes(prefix)));
    if (!hasText(normalized)) {
      return "";
    }

    Path normalizedPath = Paths.get(normalized).normalize();
    if (normalizedPath.isAbsolute() || normalizedPath.startsWith("..")) {
      throw new IllegalStateException("Invalid AZURE_STORAGE_PREFIX value");
    }
    String candidate = normalizedPath.toString().replace('\\', '/');
    return ".".equals(candidate) ? "" : candidate;
  }

  private String toBlobName(String storedKey) {
    String normalized = trimLeadingSlashes(normalizeSlashes(storedKey));
    if (normalizedAzurePrefix.isBlank()) {
      return normalized;
    }
    if (normalized.equals(normalizedAzurePrefix) || normalized.startsWith(normalizedAzurePrefix + "/")) {
      return normalized;
    }
    return buildBlobName(normalized);
  }

  private String buildBlobName(String objectKey) {
    return normalizedAzurePrefix.isBlank() ? objectKey : normalizedAzurePrefix + "/" + objectKey;
  }

  private boolean usesMemoryStorage() {
    return "memory".equals(normalizedProvider);
  }

  private static String normalizeSlashes(String value) {
    return value.trim().replace('\\', '/');
  }

  private static String trimLeadingSlashes(String value) {
    String normalized = value;
    while (normalized.startsWith("/")) {
      normalized = normalized.substring(1);
    }
    return normalized;
  }

  private static String trimTrailingSlashes(String value) {
    String normalized = value;
    while (normalized.endsWith("/")) {
      normalized = normalized.substring(0, normalized.length() - 1);
    }
    return normalized;
  }

  private String extension(String originalFilename) {
    if (originalFilename == null || !originalFilename.contains(".")) {
      return ".bin";
    }
    String ext = originalFilename.substring(originalFilename.lastIndexOf('.')).toLowerCase(Locale.ROOT);
    if (".pdf".equals(ext)) {
      return ext;
    }
    return ".bin";
  }

  private static String rawExtension(String filename) {
    if (filename == null || !filename.contains(".")) {
      return "";
    }
    return filename.substring(filename.lastIndexOf('.')).toLowerCase(Locale.ROOT);
  }

  private static boolean containsPathTraversal(String value) {
    if (!hasText(value)) {
      return false;
    }
    String normalized = value.replace('\\', '/');
    return normalized.startsWith("..")
      || normalized.contains("../")
      || normalized.contains("/..")
      || normalized.endsWith("/..");
  }

  private static boolean hasPdfMagicBytes(MultipartFile file) {
    byte[] expected = "%PDF-".getBytes();
    byte[] header = new byte[expected.length];
    try (BufferedInputStream inputStream = new BufferedInputStream(file.getInputStream())) {
      int read = inputStream.read(header);
      if (read < expected.length) {
        return false;
      }
      return Arrays.equals(header, expected);
    } catch (IOException ex) {
      return false;
    }
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  private record StoredObject(byte[] bytes, String contentType) {}
}
