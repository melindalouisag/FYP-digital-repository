package com.example.thesisrepo.service.workflow;

import com.example.thesisrepo.publication.AuditEventType;

public record WorkflowNotificationRequestedEvent(
  Long caseId,
  Long submissionVersionId,
  AuditEventType eventType,
  String actorEmail
) {
}
