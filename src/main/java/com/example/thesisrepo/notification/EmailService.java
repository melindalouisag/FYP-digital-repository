package com.example.thesisrepo.notification;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.concurrent.atomic.AtomicBoolean;

@Service("notificationEmailService")
@RequiredArgsConstructor
public class EmailService {

  private static final Logger log = LoggerFactory.getLogger(EmailService.class);

  private final ObjectProvider<JavaMailSender> mailSenderProvider;

  @Value("${spring.mail.host:}")
  private String mailHost;

  @Value("${app.email.from:}")
  private String fromAddress;

  private final AtomicBoolean smtpDisabledNoticeLogged = new AtomicBoolean(false);

  public void sendEmail(String to, String subject, String message) {
    if (to == null || to.isBlank()) {
      return;
    }

    if (!isSmtpConfigured()) {
      logSmtpDisabledNotice();
      return;
    }

    JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
    if (mailSender == null) {
      log.warn("SMTP host is configured but JavaMailSender is unavailable. Notification email skipped.");
      return;
    }

    try {
      SimpleMailMessage mail = new SimpleMailMessage();
      mail.setTo(to);
      mail.setSubject(subject);
      mail.setText(message);
      if (StringUtils.hasText(fromAddress)) {
        mail.setFrom(fromAddress.trim());
      }
      mailSender.send(mail);
    } catch (Exception ex) {
      log.warn("Notification email send failed for {}: {}", to, ex.getMessage());
    }
  }

  private boolean isSmtpConfigured() {
    return StringUtils.hasText(mailHost);
  }

  private void logSmtpDisabledNotice() {
    if (smtpDisabledNoticeLogged.compareAndSet(false, true)) {
      log.info("SMTP is not configured. Workflow notifications will be skipped.");
    }
  }
}
