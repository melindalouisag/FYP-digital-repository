package com.example.thesisrepo.service.workflow;

import com.example.thesisrepo.notification.WorkflowNotificationService;
import com.example.thesisrepo.publication.AuditEventType;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class WorkflowNotificationListenerTest {

  @Test
  void listenerSwallowsNotificationFailures() {
    WorkflowNotificationService notifications = mock(WorkflowNotificationService.class);
    WorkflowNotificationListener listener = new WorkflowNotificationListener(notifications);

    doThrow(new IllegalStateException("SMTP unavailable"))
      .when(notifications)
      .notifyByAuditEvent(9L, 3L, AuditEventType.REGISTRATION_SUBMITTED, "student@example.com");

    assertThatCode(() ->
      listener.onWorkflowNotificationRequested(new WorkflowNotificationRequestedEvent(
        9L,
        3L,
        AuditEventType.REGISTRATION_SUBMITTED,
        "student@example.com"
      ))
    ).doesNotThrowAnyException();

    verify(notifications).notifyByAuditEvent(9L, 3L, AuditEventType.REGISTRATION_SUBMITTED, "student@example.com");
  }
}
