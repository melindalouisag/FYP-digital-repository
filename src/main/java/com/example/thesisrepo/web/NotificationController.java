package com.example.thesisrepo.web;

import com.example.thesisrepo.notification.NotificationFeedService;
import com.example.thesisrepo.service.CurrentUserService;
import com.example.thesisrepo.web.dto.NotificationItemResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class NotificationController {

  private final CurrentUserService currentUser;
  private final NotificationFeedService notificationFeedService;

  @GetMapping
  public List<NotificationItemResponse> feed(@RequestParam(required = false) Integer limit) {
    return notificationFeedService.feed(currentUser.requireCurrentUser(), limit);
  }
}
