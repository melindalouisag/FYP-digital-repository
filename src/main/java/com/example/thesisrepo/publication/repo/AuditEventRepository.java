package com.example.thesisrepo.publication.repo;

import com.example.thesisrepo.publication.AuditEvent;
import com.example.thesisrepo.publication.AuditEventType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {
  List<AuditEvent> findByCaseIdOrderByCreatedAtDesc(Long caseId);
  Optional<AuditEvent> findTopByCaseIdAndEventTypeOrderByCreatedAtDesc(Long caseId, AuditEventType eventType);
  List<AuditEvent> findTop20ByCaseIdInAndEventTypeInOrderByCreatedAtDesc(List<Long> caseIds, List<AuditEventType> eventTypes);
  List<AuditEvent> findTop20ByEventTypeInOrderByCreatedAtDesc(List<AuditEventType> eventTypes);
}
