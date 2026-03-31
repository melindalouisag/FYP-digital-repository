package com.example.thesisrepo.reminder;

import com.example.thesisrepo.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StudentDashboardReminderRepository extends JpaRepository<StudentDashboardReminder, Long> {
  List<StudentDashboardReminder> findByUser(User user);
  Optional<StudentDashboardReminder> findByIdAndUser(Long id, User user);
}
