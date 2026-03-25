package com.example.thesisrepo.service;

import com.example.thesisrepo.publication.ChecklistItemV2;
import com.example.thesisrepo.publication.ChecklistScope;
import com.example.thesisrepo.publication.ChecklistTemplate;
import com.example.thesisrepo.publication.repo.ChecklistItemV2Repository;
import com.example.thesisrepo.publication.repo.ChecklistResultRepository;
import com.example.thesisrepo.publication.repo.ChecklistTemplateRepository;
import com.example.thesisrepo.service.checklist.ChecklistTemplateLockService;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.ChecklistActivationResponse;
import com.example.thesisrepo.web.dto.ChecklistConflictResponse;
import com.example.thesisrepo.web.dto.ChecklistItemsSaveResponse;
import com.example.thesisrepo.web.dto.ChecklistTemplateActionResponse;
import com.example.thesisrepo.web.dto.ChecklistTemplateDeleteResponse;
import com.example.thesisrepo.web.dto.ChecklistTemplateDetailResponse;
import com.example.thesisrepo.web.dto.ChecklistTemplateLockResponse;
import com.example.thesisrepo.web.dto.ChecklistTemplateReleaseResponse;
import com.example.thesisrepo.web.dto.ChecklistTemplateSummaryResponse;
import com.example.thesisrepo.web.dto.ChecklistVersionResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@RequiredArgsConstructor
public class ChecklistTemplateService {

  private final ChecklistTemplateRepository checklistTemplates;
  private final ChecklistItemV2Repository checklistItems;
  private final ChecklistResultRepository checklistResults;
  private final ChecklistTemplateLockService checklistLocks;
  private final ObjectMapper objectMapper;

  @Transactional(readOnly = true)
  public List<ChecklistTemplateSummaryResponse> listTemplates(ChecklistScope type) {
    return checklistTemplates.findByPublicationTypeOrderByVersionDesc(type).stream()
      .map(this::toSummaryResponse)
      .toList();
  }

  @Transactional(readOnly = true)
  public List<ChecklistTemplateDetailResponse> listTemplatesWithItems(ChecklistScope type) {
    return checklistTemplates.findByPublicationTypeOrderByVersionDesc(type).stream()
      .map(template -> toDetailResponse(template, null))
      .toList();
  }

  @Transactional
  public ChecklistTemplateSummaryResponse createEmptyTemplate(ChecklistScope type) {
    int nextVersion = checklistTemplates.findTopByPublicationTypeOrderByVersionDesc(type)
      .map(ChecklistTemplate::getVersion)
      .orElse(0) + 1;

    ChecklistTemplate created = checklistTemplates.save(ChecklistTemplate.builder()
      .publicationType(type)
      .version(nextVersion)
      .isActive(false)
      .build());

    return toSummaryResponse(created);
  }

  @Transactional
  public ChecklistTemplateSummaryResponse createNewDraftTemplate(ChecklistScope type) {
    return createEmptyTemplate(type);
  }

  @Transactional
  public ChecklistVersionResponse createNewVersion(ChecklistScope type) {
    ChecklistTemplateSummaryResponse created = createNewDraftTemplate(type);
    return new ChecklistVersionResponse(created.id(), created.version());
  }

  @Transactional(readOnly = true)
  public ChecklistTemplateDetailResponse templateDetail(User admin, Long templateId) {
    ChecklistTemplate template = requireTemplate(templateId);
    return toDetailResponse(template, checklistLocks.current(template, admin));
  }

  @Transactional
  public ServiceResponse<ChecklistTemplateActionResponse> acquireLock(User admin, Long templateId) {
    ChecklistTemplate template = requireTemplate(templateId);
    if (template.isActive()) {
      throw new ResponseStatusException(BAD_REQUEST, "Active templates are read-only.");
    }

    ChecklistTemplateLockService.LockInfo lock = checklistLocks.acquire(template, admin);
    if (!lock.ownedByCurrentUser()) {
      return ServiceResponse.status(CONFLICT, lockConflict(lock));
    }

    return ServiceResponse.ok(new ChecklistTemplateLockResponse(
      templateId,
      true,
      toEditLockResponse(lock)
    ));
  }

  @Transactional
  public ChecklistTemplateReleaseResponse releaseLock(User admin, Long templateId) {
    ChecklistTemplate template = requireTemplate(templateId);
    checklistLocks.release(template, admin);
    return new ChecklistTemplateReleaseResponse(templateId, true);
  }

  @Transactional
  public ServiceResponse<ChecklistTemplateActionResponse> deleteTemplate(User admin, Long templateId) {
    ChecklistTemplate template = requireTemplate(templateId);
    ChecklistTemplateLockService.LockInfo lock = checklistLocks.current(template, admin);
    if (lock != null && !lock.ownedByCurrentUser()) {
      return ServiceResponse.status(CONFLICT, lockConflict(lock));
    }
    if (checklistResults.existsByChecklistItem_Template_Id(templateId)) {
      throw new ResponseStatusException(BAD_REQUEST, "Cannot delete template used by checklist results");
    }

    checklistItems.deleteByTemplate(template);
    checklistLocks.release(template, admin);
    checklistTemplates.delete(template);
    return ServiceResponse.ok(new ChecklistTemplateDeleteResponse(true, templateId));
  }

  @Transactional
  public ServiceResponse<ChecklistTemplateActionResponse> replaceTemplateItems(User admin, Long templateId, JsonNode payload) {
    ChecklistTemplate template = requireTemplate(templateId);
    if (template.isActive()) {
      throw new ResponseStatusException(BAD_REQUEST, "Cannot edit active template; create a new draft first.");
    }

    ChecklistTemplateLockService.LockInfo lock = checklistLocks.requireCurrentUserLock(template, admin);
    if (lock == null) {
      return ServiceResponse.status(CONFLICT, new ChecklistConflictResponse(
        "Start editing this draft first to acquire the lock.",
        templateId,
        null
      ));
    }
    if (!lock.ownedByCurrentUser()) {
      return ServiceResponse.status(CONFLICT, lockConflict(lock));
    }

    List<ReplaceItemCommand> items = readReplaceItems(payload);
    validateTemplateItems(items);

    checklistItems.deleteByTemplate(template);
    List<ReplaceItemCommand> normalized = normalizeOrder(items);
    int idx = 1;
    for (ReplaceItemCommand item : normalized) {
      checklistItems.save(ChecklistItemV2.builder()
        .template(template)
        .orderIndex(idx++)
        .section(item.section() != null ? item.section().trim() : null)
        .itemText(item.itemText().trim())
        .guidanceText(item.guidanceText() != null ? item.guidanceText().trim() : null)
        .isRequired(item.required())
        .build());
    }

    checklistLocks.release(template, admin);
    return ServiceResponse.ok(new ChecklistItemsSaveResponse(true, true));
  }

  @Transactional
  public ServiceResponse<ChecklistTemplateActionResponse> activateTemplate(User admin, Long templateId) {
    ChecklistTemplate toActivate = requireTemplate(templateId);
    ChecklistTemplateLockService.LockInfo lock = checklistLocks.current(toActivate, admin);
    if (lock != null && !lock.ownedByCurrentUser()) {
      return ServiceResponse.status(CONFLICT, lockConflict(lock));
    }

    int itemCount = checklistItems.findByTemplateOrderByOrderIndexAsc(toActivate).size();
    if (itemCount == 0) {
      throw new ResponseStatusException(BAD_REQUEST, "Template must have at least 1 item before activation");
    }

    checklistTemplates.findByPublicationTypeOrderByVersionDesc(toActivate.getPublicationType()).forEach(template -> {
      template.setActive(template.getId().equals(templateId));
      checklistTemplates.save(template);
    });
    checklistLocks.release(toActivate, admin);

    return ServiceResponse.ok(new ChecklistActivationResponse(templateId, true));
  }

  private ChecklistTemplate requireTemplate(Long templateId) {
    return checklistTemplates.findById(templateId)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Template not found"));
  }

  private ChecklistTemplateSummaryResponse toSummaryResponse(ChecklistTemplate template) {
    int itemCount = checklistItems.findByTemplateOrderByOrderIndexAsc(template).size();
    return new ChecklistTemplateSummaryResponse(
      template.getId(),
      template.getPublicationType(),
      template.getVersion(),
      template.isActive(),
      template.getCreatedAt(),
      itemCount
    );
  }

  private ChecklistTemplateDetailResponse toDetailResponse(ChecklistTemplate template, ChecklistTemplateLockService.LockInfo lockInfo) {
    return new ChecklistTemplateDetailResponse(
      new ChecklistTemplateDetailResponse.TemplateResponse(
        template.getId(),
        template.getPublicationType(),
        template.getVersion(),
        template.isActive(),
        template.getCreatedAt()
      ),
      checklistItems.findByTemplateOrderByOrderIndexAsc(template).stream()
        .map(item -> new ChecklistTemplateDetailResponse.ItemResponse(
          item.getId(),
          item.getOrderIndex(),
          item.getSection(),
          item.getItemText(),
          item.getGuidanceText(),
          item.isRequired()
        ))
        .toList(),
      toEditLockResponse(lockInfo)
    );
  }

  private ChecklistTemplateDetailResponse.EditLockResponse toEditLockResponse(ChecklistTemplateLockService.LockInfo lockInfo) {
    if (lockInfo == null) {
      return null;
    }
    return new ChecklistTemplateDetailResponse.EditLockResponse(
      lockInfo.templateId(),
      lockInfo.lockedByUserId(),
      lockInfo.lockedByEmail(),
      lockInfo.lockedAt(),
      lockInfo.expiresAt(),
      lockInfo.ownedByCurrentUser()
    );
  }

  private ChecklistConflictResponse lockConflict(ChecklistTemplateLockService.LockInfo lock) {
    return new ChecklistConflictResponse(
      "This draft is currently being edited by " + lock.lockedByEmail() + ". Try again after the lock is released.",
      null,
      toEditLockResponse(lock)
    );
  }

  private List<ReplaceItemCommand> readReplaceItems(JsonNode payload) {
    if (payload == null || payload.isNull()) {
      return List.of();
    }

    JsonNode itemNode = payload.isArray() ? payload : payload.get("items");
    if (itemNode == null || !itemNode.isArray()) {
      throw new ResponseStatusException(BAD_REQUEST, "Expected checklist items array payload");
    }
    return objectMapper.convertValue(
      itemNode,
      objectMapper.getTypeFactory().constructCollectionType(List.class, ReplaceItemCommand.class)
    );
  }

  private static List<ReplaceItemCommand> normalizeOrder(List<ReplaceItemCommand> items) {
    if (items.stream().allMatch(item -> item.orderIndex() == null)) {
      return items;
    }
    return items.stream()
      .sorted(Comparator.comparing(item -> item.orderIndex() == null ? Integer.MAX_VALUE : item.orderIndex()))
      .toList();
  }

  private static void validateTemplateItems(List<ReplaceItemCommand> items) {
    Set<Integer> orderIndexes = new HashSet<>();
    for (ReplaceItemCommand item : items) {
      if (item == null) {
        throw new ResponseStatusException(BAD_REQUEST, "Checklist item payload cannot be null");
      }
      if (!hasText(item.itemText())) {
        throw new ResponseStatusException(BAD_REQUEST, "itemText is required");
      }
      if (item.itemText().trim().length() > 500) {
        throw new ResponseStatusException(BAD_REQUEST, "itemText max length is 500");
      }
      if (item.section() != null && item.section().length() > 100) {
        throw new ResponseStatusException(BAD_REQUEST, "section max length is 100");
      }
      if (item.guidanceText() != null && item.guidanceText().length() > 2000) {
        throw new ResponseStatusException(BAD_REQUEST, "guidanceText max length is 2000");
      }
      if (item.orderIndex() != null && !orderIndexes.add(item.orderIndex())) {
        throw new ResponseStatusException(BAD_REQUEST, "orderIndex values must be unique");
      }
    }
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  public record ReplaceItemCommand(
    Integer orderIndex,
    String section,
    String itemText,
    String guidanceText,
    boolean required
  ) {
  }
}
