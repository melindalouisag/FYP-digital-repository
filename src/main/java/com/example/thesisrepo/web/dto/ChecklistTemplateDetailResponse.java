package com.example.thesisrepo.web.dto;

import com.example.thesisrepo.publication.ChecklistScope;

import java.time.Instant;
import java.util.List;

public record ChecklistTemplateDetailResponse(
  TemplateResponse template,
  List<ItemResponse> items,
  EditLockResponse editLock
) {
  public record TemplateResponse(
    Long id,
    ChecklistScope publicationType,
    Integer version,
    boolean active,
    Instant createdAt
  ) {
  }

  public record ItemResponse(
    Long id,
    Integer orderIndex,
    String section,
    String itemText,
    String guidanceText,
    boolean required
  ) {
  }

  public record EditLockResponse(
    Long templateId,
    Long lockedByUserId,
    String lockedByEmail,
    Instant lockedAt,
    Instant expiresAt,
    boolean ownedByCurrentUser
  ) {
  }
}
