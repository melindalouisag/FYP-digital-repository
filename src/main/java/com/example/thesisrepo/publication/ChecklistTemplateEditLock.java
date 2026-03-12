package com.example.thesisrepo.publication;

import com.example.thesisrepo.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "checklist_template_edit_lock", uniqueConstraints = @UniqueConstraint(columnNames = "template_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChecklistTemplateEditLock {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @OneToOne(optional = false)
  @JoinColumn(name = "template_id", nullable = false, unique = true)
  private ChecklistTemplate template;

  @ManyToOne(optional = false)
  @JoinColumn(name = "locked_by_user_id", nullable = false)
  private User lockedBy;

  @Column(nullable = false)
  private Instant lockedAt;

  @Column(nullable = false)
  private Instant expiresAt;
}
