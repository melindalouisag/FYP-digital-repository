package com.example.thesisrepo.reminder;

import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "student_dashboard_reminder")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentDashboardReminder {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @ManyToOne
  @JoinColumn(name = "case_id")
  private PublicationCase publicationCase;

  @Column(nullable = false, length = 160)
  private String title;

  @Column(name = "reminder_date", nullable = false)
  private LocalDate reminderDate;

  @Column(name = "reminder_time", nullable = false)
  private LocalTime reminderTime;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private ReminderStatus status;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;
}
