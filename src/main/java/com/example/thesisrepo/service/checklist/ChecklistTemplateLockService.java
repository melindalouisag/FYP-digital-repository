package com.example.thesisrepo.service.checklist;

import com.example.thesisrepo.publication.ChecklistTemplate;
import com.example.thesisrepo.publication.ChecklistTemplateEditLock;
import com.example.thesisrepo.publication.repo.ChecklistTemplateEditLockRepository;
import com.example.thesisrepo.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class ChecklistTemplateLockService {
  private static final Duration LOCK_TTL = Duration.ofMinutes(10);

  private final ChecklistTemplateEditLockRepository locks;

  @Transactional
  public LockInfo acquire(ChecklistTemplate template, User user) {
    ChecklistTemplateEditLock lock = locks.findByTemplate(template).orElse(null);
    Instant now = Instant.now();
    if (lock != null && isExpired(lock, now)) {
      locks.delete(lock);
      lock = null;
    }

    if (lock != null && !lock.getLockedBy().getId().equals(user.getId())) {
      return toInfo(lock, user);
    }

    ChecklistTemplateEditLock saved = locks.save(lock != null
      ? refresh(lock, user, now)
      : ChecklistTemplateEditLock.builder()
        .template(template)
        .lockedBy(user)
        .lockedAt(now)
        .expiresAt(now.plus(LOCK_TTL))
        .build());
    return toInfo(saved, user);
  }

  @Transactional
  public LockInfo current(ChecklistTemplate template, User user) {
    ChecklistTemplateEditLock lock = locks.findByTemplate(template).orElse(null);
    Instant now = Instant.now();
    if (lock != null && isExpired(lock, now)) {
      locks.delete(lock);
      return null;
    }
    return lock == null ? null : toInfo(lock, user);
  }

  @Transactional
  public void release(ChecklistTemplate template, User user) {
    ChecklistTemplateEditLock lock = locks.findByTemplate(template).orElse(null);
    Instant now = Instant.now();
    if (lock == null) {
      return;
    }
    if (isExpired(lock, now) || lock.getLockedBy().getId().equals(user.getId())) {
      locks.delete(lock);
    }
  }

  @Transactional
  public LockInfo requireCurrentUserLock(ChecklistTemplate template, User user) {
    LockInfo info = current(template, user);
    if (info == null) {
      return null;
    }
    if (!info.ownedByCurrentUser()) {
      return info;
    }

    ChecklistTemplateEditLock lock = locks.findByTemplate(template).orElse(null);
    if (lock == null) {
      return null;
    }
    LockInfo refreshed = toInfo(refresh(lock, user, Instant.now()), user);
    locks.save(lock);
    return refreshed;
  }

  private static ChecklistTemplateEditLock refresh(ChecklistTemplateEditLock lock, User user, Instant now) {
    lock.setLockedBy(user);
    lock.setLockedAt(now);
    lock.setExpiresAt(now.plus(LOCK_TTL));
    return lock;
  }

  private static boolean isExpired(ChecklistTemplateEditLock lock, Instant now) {
    return lock.getExpiresAt() == null || !lock.getExpiresAt().isAfter(now);
  }

  private static LockInfo toInfo(ChecklistTemplateEditLock lock, User currentUser) {
    return new LockInfo(
      lock.getTemplate().getId(),
      lock.getLockedBy().getId(),
      lock.getLockedBy().getEmail(),
      lock.getLockedAt(),
      lock.getExpiresAt(),
      currentUser != null && lock.getLockedBy().getId().equals(currentUser.getId())
    );
  }

  public record LockInfo(
    Long templateId,
    Long lockedByUserId,
    String lockedByEmail,
    Instant lockedAt,
    Instant expiresAt,
    boolean ownedByCurrentUser
  ) {}
}
