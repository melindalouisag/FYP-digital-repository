package com.example.thesisrepo.web;

import com.example.thesisrepo.service.CurrentUserService;
import com.example.thesisrepo.service.StudentReminderService;
import com.example.thesisrepo.web.dto.OperationResultResponse;
import com.example.thesisrepo.web.dto.StudentReminderRequest;
import com.example.thesisrepo.web.dto.StudentReminderResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/student/reminders")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentReminderController {

  private final CurrentUserService currentUser;
  private final StudentReminderService studentReminderService;

  @GetMapping
  public List<StudentReminderResponse> listReminders() {
    return studentReminderService.list(currentUser.requireCurrentUser());
  }

  @PostMapping
  public ResponseEntity<StudentReminderResponse> createReminder(@Valid @RequestBody StudentReminderRequest request) {
    return ResponseEntity.ok(studentReminderService.create(currentUser.requireCurrentUser(), request));
  }

  @PutMapping("/{reminderId}")
  public ResponseEntity<StudentReminderResponse> updateReminder(
    @PathVariable Long reminderId,
    @Valid @RequestBody StudentReminderRequest request
  ) {
    return ResponseEntity.ok(studentReminderService.update(currentUser.requireCurrentUser(), reminderId, request));
  }

  @PostMapping("/{reminderId}/done")
  public ResponseEntity<StudentReminderResponse> markReminderDone(@PathVariable Long reminderId) {
    return ResponseEntity.ok(studentReminderService.markDone(currentUser.requireCurrentUser(), reminderId));
  }

  @DeleteMapping("/{reminderId}")
  public ResponseEntity<OperationResultResponse> deleteReminder(@PathVariable Long reminderId) {
    studentReminderService.delete(currentUser.requireCurrentUser(), reminderId);
    return ResponseEntity.ok(new OperationResultResponse(true));
  }
}
