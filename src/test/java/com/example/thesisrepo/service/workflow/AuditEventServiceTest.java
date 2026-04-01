package com.example.thesisrepo.service.workflow;

import com.example.thesisrepo.publication.AuditEvent;
import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.repo.AuditEventRepository;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuditEventServiceTest {

  @Test
  void logPersistsAuditEventAndPublishesWorkflowNotificationRequest() {
    AuditEventRepository auditEvents = mock(AuditEventRepository.class);
    ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
    AuditEventService service = new AuditEventService(auditEvents, eventPublisher);

    User actor = User.builder()
      .id(11L)
      .email("student@example.com")
      .role(Role.STUDENT)
      .build();

    when(auditEvents.save(any(AuditEvent.class))).thenAnswer(invocation -> invocation.getArgument(0));

    service.log(25L, 7L, actor, Role.STUDENT, AuditEventType.REGISTRATION_SUBMITTED, "Registration submitted");

    verify(auditEvents).save(any(AuditEvent.class));
    verify(eventPublisher).publishEvent(any(WorkflowNotificationRequestedEvent.class));
  }

  @Test
  void notificationEventIncludesCaseSubmissionAndActorContext() {
    AuditEventRepository auditEvents = mock(AuditEventRepository.class);
    ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
    AuditEventService service = new AuditEventService(auditEvents, eventPublisher);

    User actor = User.builder()
      .id(12L)
      .email("lecturer@example.com")
      .role(Role.LECTURER)
      .build();

    when(auditEvents.save(any(AuditEvent.class))).thenAnswer(invocation -> invocation.getArgument(0));

    service.log(30L, 4L, actor, Role.LECTURER, AuditEventType.SUPERVISOR_FORWARDED_TO_LIBRARY, "Forwarded");

    org.mockito.ArgumentCaptor<WorkflowNotificationRequestedEvent> eventCaptor =
      org.mockito.ArgumentCaptor.forClass(WorkflowNotificationRequestedEvent.class);
    verify(eventPublisher).publishEvent(eventCaptor.capture());

    WorkflowNotificationRequestedEvent published = eventCaptor.getValue();
    assertThat(published.caseId()).isEqualTo(30L);
    assertThat(published.submissionVersionId()).isEqualTo(4L);
    assertThat(published.eventType()).isEqualTo(AuditEventType.SUPERVISOR_FORWARDED_TO_LIBRARY);
    assertThat(published.actorEmail()).isEqualTo("lecturer@example.com");
  }
}
