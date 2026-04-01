package com.example.thesisrepo.service.workflow;

import com.example.thesisrepo.notification.WorkflowNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@Slf4j
@RequiredArgsConstructor
public class WorkflowNotificationListener {

  private final WorkflowNotificationService notifications;

  @Async
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void onWorkflowNotificationRequested(WorkflowNotificationRequestedEvent event) {
    try {
      notifications.notifyByAuditEvent(
        event.caseId(),
        event.submissionVersionId(),
        event.eventType(),
        event.actorEmail()
      );
    } catch (Exception exception) {
      log.error(
        "Workflow notification dispatch failed caseId={} eventType={} message={}",
        event.caseId(),
        event.eventType(),
        exception.getMessage(),
        exception
      );
    }
  }
}
