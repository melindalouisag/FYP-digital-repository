package com.example.thesisrepo.reminder;

import com.example.thesisrepo.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StudentDashboardReminderRepository extends JpaRepository<StudentDashboardReminder, Long> {
  List<StudentDashboardReminder> findByUser(User user);
  Optional<StudentDashboardReminder> findByIdAndUser(Long id, User user);
  Optional<StudentDashboardReminder> findTopByEventTypeAndDeadlineActionAndPublicationTypeAndStatusOrderByReminderDateDescReminderTimeDescIdDesc(
    CalendarEventType eventType,
    DeadlineActionType deadlineAction,
    com.example.thesisrepo.publication.PublicationType publicationType,
    ReminderStatus status
  );

  @Query("""
    select reminder
    from StudentDashboardReminder reminder
    where reminder.status = :status
      and (reminder.user = :user or reminder.eventType = :globalEventType)
    order by reminder.reminderDate asc, reminder.reminderTime asc, reminder.id asc
    """)
  List<StudentDashboardReminder> findVisibleEvents(
    @Param("user") User user,
    @Param("status") ReminderStatus status,
    @Param("globalEventType") CalendarEventType globalEventType
  );
}
