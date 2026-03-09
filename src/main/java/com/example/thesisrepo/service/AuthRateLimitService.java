package com.example.thesisrepo.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthRateLimitService {

  private static final Duration WINDOW = Duration.ofMinutes(1);

  private final Map<String, AttemptWindow> windows = new ConcurrentHashMap<>();

  @Value("${app.security.rate-limit.login.max-attempts:5}")
  private int loginMaxAttempts;

  @Value("${app.security.rate-limit.otp.max-attempts:5}")
  private int otpMaxAttempts;

  @Value("${app.security.rate-limit.window-seconds:60}")
  private long windowSeconds;

  public boolean allowLoginAttempt(String clientIp) {
    return tryConsume("login", clientIp, loginMaxAttempts, resolveWindow());
  }

  public boolean allowOtpVerificationAttempt(String clientIp) {
    return tryConsume("otp-verify", clientIp, otpMaxAttempts, resolveWindow());
  }

  @Scheduled(fixedRate = 300000)
  void evictExpiredWindows() {
    long now = System.currentTimeMillis();
    long staleBefore = now - resolveWindow().toMillis();
    windows.entrySet().removeIf(entry -> entry.getValue().isStale(staleBefore));
  }

  private boolean tryConsume(String scope, String clientIp, int maxAttempts, Duration window) {
    String normalizedIp = normalizeClientIp(clientIp);
    String key = scope + ":" + normalizedIp;
    AttemptWindow attemptWindow = windows.computeIfAbsent(key, ignored -> new AttemptWindow());
    long now = System.currentTimeMillis();
    long cutoff = now - window.toMillis();

    synchronized (attemptWindow) {
      attemptWindow.evictOlderThan(cutoff);
      if (attemptWindow.size() >= maxAttempts) {
        attemptWindow.touch(now);
        return false;
      }
      attemptWindow.add(now);
      return true;
    }
  }

  private static String normalizeClientIp(String clientIp) {
    if (clientIp == null || clientIp.isBlank()) {
      return "unknown";
    }
    return clientIp.trim();
  }

  private Duration resolveWindow() {
    if (windowSeconds <= 0) {
      return WINDOW;
    }
    return Duration.ofSeconds(windowSeconds);
  }

  private static final class AttemptWindow {
    private final Deque<Long> attempts = new ArrayDeque<>();
    private long lastSeenEpochMs = System.currentTimeMillis();

    void add(long epochMs) {
      attempts.addLast(epochMs);
      lastSeenEpochMs = epochMs;
    }

    void evictOlderThan(long cutoffEpochMs) {
      while (!attempts.isEmpty() && attempts.peekFirst() < cutoffEpochMs) {
        attempts.removeFirst();
      }
    }

    int size() {
      return attempts.size();
    }

    void touch(long epochMs) {
      lastSeenEpochMs = epochMs;
    }

    boolean isStale(long staleBeforeEpochMs) {
      synchronized (this) {
        evictOlderThan(staleBeforeEpochMs);
        return attempts.isEmpty() && lastSeenEpochMs < staleBeforeEpochMs;
      }
    }
  }
}
