package com.example.thesisrepo.service.workflow;

import com.example.thesisrepo.notification.WorkflowNotificationService;
import com.example.thesisrepo.publication.AuditEvent;
import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.repo.AuditEventRepository;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditEventService {

  private final AuditEventRepository auditEvents;
  private final ApplicationEventPublisher eventPublisher;

  public void log(
    Long caseId,
    Long submissionVersionId,
    User actorUser,
    Role actorRole,
    AuditEventType eventType,
    String message
  ) {
    auditEvents.save(AuditEvent.builder()
      .caseId(caseId)
      .submissionVersionId(submissionVersionId)
      .actorUserId(actorUser != null ? actorUser.getId() : null)
      .actorEmail(actorUser != null ? actorUser.getEmail() : null)
      .actorRole(actorRole)
      .eventType(eventType)
      .message(message)
      .build());

    eventPublisher.publishEvent(new WorkflowNotificationRequestedEvent(
      caseId,
      submissionVersionId,
      eventType,
      actorUser != null ? actorUser.getEmail() : null
    ));
  }

  public void log(Long caseId, User actorUser, Role actorRole, AuditEventType eventType, String message) {
    log(caseId, null, actorUser, actorRole, eventType, message);
  }
}
