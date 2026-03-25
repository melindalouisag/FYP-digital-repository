package com.example.thesisrepo.web;

import com.example.thesisrepo.publication.DownloadEvent;
import com.example.thesisrepo.publication.PublishedItem;
import com.example.thesisrepo.publication.repo.DownloadEventRepository;
import com.example.thesisrepo.publication.repo.PublishedItemRepository;
import com.example.thesisrepo.service.CurrentUserService;
import com.example.thesisrepo.service.PublicRepositorySearchCriteria;
import com.example.thesisrepo.service.PublicRepositorySearchService;
import com.example.thesisrepo.service.StorageService;
import com.example.thesisrepo.web.dto.PagedResponse;
import com.example.thesisrepo.web.dto.PublicRepositoryItemDetailDto;
import com.example.thesisrepo.web.dto.PublicRepositoryItemDto;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.time.Instant;
import java.util.Optional;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicController {

  private static final int DEFAULT_PAGE_SIZE = 10;
  private static final int MAX_PAGE_SIZE = 50;

  private final PublishedItemRepository publishedItems;
  private final DownloadEventRepository downloadEvents;
  private final StorageService storageService;
  private final CurrentUserService currentUserService;
  private final PublicRepositorySearchService publicRepositorySearchService;

  @GetMapping("/repository/search")
  public ResponseEntity<PagedResponse<PublicRepositoryItemDto>> searchRepository(
    @RequestParam(required = false) String title,
    @RequestParam(required = false) String author,
    @RequestParam(required = false) String faculty,
    @RequestParam(required = false) String program,
    @RequestParam(required = false) Integer year,
    @RequestParam(required = false) String keyword,
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
  ) {
    return ResponseEntity.ok(publicRepositorySearchService.search(
      new PublicRepositorySearchCriteria(title, author, faculty, program, year, keyword),
      PageRequest.of(Math.max(page, 0), normalizePageSize(size))
    ));
  }

  @GetMapping("/repository/{id}")
  public ResponseEntity<PublicRepositoryItemDetailDto> repositoryDetail(@PathVariable Long id) {
    PublishedItem item = publishedItems.findById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Published item not found"));
    return ResponseEntity.ok(toPublicDetail(item));
  }

  @GetMapping("/repository/{id}/download")
  @PreAuthorize("hasAnyRole('STUDENT','LECTURER','ADMIN')")
  public ResponseEntity<Resource> download(@PathVariable Long id, HttpServletRequest request) {
    PublishedItem item = publishedItems.findById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Published item not found"));

    if (item.getSubmissionVersion() == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No file attached");
    }

    String ipAddress = resolveClientIp(request);
    String userAgent = request.getHeader("User-Agent");
    downloadEvents.save(DownloadEvent.builder()
      .publishedItem(item)
      .user(currentUserService.requireCurrentUser())
      .downloadedAt(Instant.now())
      .ipAddress(ipAddress)
      .userAgent(userAgent)
      .build());

    String storedKey = item.getSubmissionVersion().getFilePath();
    if (!storageService.exists(storedKey)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
    }

    try {
      Resource resource = storageService.openAsResource(storedKey);
      String fileName = Optional.ofNullable(item.getSubmissionVersion().getOriginalFilename())
        .filter(name -> !name.isBlank())
        .orElse(defaultFilename(storedKey, "document.pdf"));
      String safeFilename = sanitizeFilename(fileName, "document.pdf");

      return ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeFilename + "\"")
        .body(resource);
    } catch (IOException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Cannot read file", e);
    }
  }

  private PublicRepositoryItemDetailDto toPublicDetail(PublishedItem item) {
    return new PublicRepositoryItemDetailDto(
      item.getId(),
      item.getTitle(),
      item.getAuthors(),
      item.getAuthorName(),
      item.getFaculty(),
      item.getProgram(),
      item.getYear(),
      item.getKeywords(),
      item.getAbstractText(),
      item.getPublishedAt(),
      item.getPublicationCase().getId()
    );
  }

  private static String resolveClientIp(HttpServletRequest request) {
    String forwarded = request.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) {
      return forwarded.split(",")[0].trim();
    }
    return request.getRemoteAddr();
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  private static String defaultFilename(String storedKey, String fallback) {
    if (!hasText(storedKey)) {
      return fallback;
    }
    int idx = storedKey.lastIndexOf('/');
    String name = idx >= 0 ? storedKey.substring(idx + 1) : storedKey;
    return hasText(name) ? name : fallback;
  }

  private static String sanitizeFilename(String candidate, String fallback) {
    String value = hasText(candidate) ? candidate.trim() : fallback;
    return value.replaceAll("[\\\\/\\r\\n\\t\"]", "_");
  }

  private int normalizePageSize(int requestedSize) {
    if (requestedSize < 1) {
      return DEFAULT_PAGE_SIZE;
    }
    return Math.min(requestedSize, MAX_PAGE_SIZE);
  }
}
