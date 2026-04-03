package com.example.thesisrepo.web;

import com.example.thesisrepo.service.CalendarEventService;
import com.example.thesisrepo.service.CurrentUserService;
import com.example.thesisrepo.web.dto.CalendarEventRequest;
import com.example.thesisrepo.web.dto.CalendarEventResponse;
import com.example.thesisrepo.web.dto.OperationResultResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/calendar/events")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('STUDENT', 'LECTURER', 'ADMIN')")
public class CalendarEventController {

  private final CurrentUserService currentUser;
  private final CalendarEventService calendarEventService;

  @GetMapping
  public List<CalendarEventResponse> listEvents() {
    return calendarEventService.listVisible(currentUser.requireCurrentUser());
  }

  @PostMapping
  public ResponseEntity<CalendarEventResponse> createEvent(@Valid @RequestBody CalendarEventRequest request) {
    return ResponseEntity.ok(calendarEventService.create(currentUser.requireCurrentUser(), request));
  }

  @DeleteMapping("/{eventId}")
  public ResponseEntity<OperationResultResponse> deleteEvent(@PathVariable Long eventId) {
    calendarEventService.delete(currentUser.requireCurrentUser(), eventId);
    return ResponseEntity.ok(new OperationResultResponse(true));
  }
}
