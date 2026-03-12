package com.example.thesisrepo.publication.repo;

import com.example.thesisrepo.publication.ChecklistTemplate;
import com.example.thesisrepo.publication.ChecklistTemplateEditLock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ChecklistTemplateEditLockRepository extends JpaRepository<ChecklistTemplateEditLock, Long> {
  Optional<ChecklistTemplateEditLock> findByTemplate(ChecklistTemplate template);
  void deleteByTemplate(ChecklistTemplate template);
}
