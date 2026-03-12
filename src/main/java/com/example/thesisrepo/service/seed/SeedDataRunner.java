package com.example.thesisrepo.service.seed;

import com.example.thesisrepo.profile.LecturerProfile;
import com.example.thesisrepo.profile.LecturerProfileRepository;
import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.StaffRegistry;
import com.example.thesisrepo.user.StaffRegistryRepository;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.CommandLineRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Component
@Profile("test")
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.seed", name = "enabled", havingValue = "true")
public class SeedDataRunner implements CommandLineRunner {
  private static final String STUDENT_DOMAIN = "@my.sampoernauniversity.ac.id";
  private static final String STAFF_DOMAIN = "@sampoernauniversity.ac.id";

  private final UserRepository users;
  private final StaffRegistryRepository staffRegistry;
  private final StudentProfileRepository studentProfiles;
  private final LecturerProfileRepository lecturerProfiles;
  private final PasswordEncoder encoder;

  @Value("${app.seed.admin-password:}")
  private String adminPassword;

  @Value("${app.seed.lecturer-password:}")
  private String lecturerPassword;

  @Value("${app.seed.student-password:}")
  private String studentPassword;

  @Override
  @Transactional
  public void run(String... args) {
    User admin = resolveOrCreateUser(Role.ADMIN, resolveSeedPassword(adminPassword));
    User lecturer = resolveOrCreateUser(Role.LECTURER, resolveSeedPassword(lecturerPassword));
    User student = resolveOrCreateUser(Role.STUDENT, resolveSeedPassword(studentPassword));

    ensureLecturerProfile(
      lecturer,
      "Lecturer One",
      "Information System",
      "Faculty of Engineering and Technology (FET)"
    );
    ensureStudentProfile(
      student,
      "Student One",
      "S-001",
      "Information System",
      "Faculty of Engineering and Technology (FET)"
    );

    // Avoid unused warnings while keeping deterministic base users.
    admin.getId();
  }

  private User resolveOrCreateUser(Role role, String rawPassword) {
    return users.findByRole(role).stream()
      .findFirst()
      .map(this::ensureVerified)
      .orElseGet(() -> ensureUser(resolveSeedEmail(role), rawPassword, role));
  }

  private User ensureVerified(User user) {
    if (user.isEmailVerified()) {
      return user;
    }
    user.setEmailVerified(true);
    return users.save(user);
  }

  private static String resolveSeedPassword(String configuredPassword) {
    if (configuredPassword == null || configuredPassword.isBlank()) {
      return UUID.randomUUID() + "-" + UUID.randomUUID();
    }
    return configuredPassword.trim();
  }

  private String resolveSeedEmail(Role role) {
    if (role == Role.STUDENT) {
      return "seed.student+" + UUID.randomUUID() + STUDENT_DOMAIN;
    }

    return staffRegistry.findAll().stream()
      .filter(entry -> entry.getRole() == role)
      .map(StaffRegistry::getEmail)
      .map(this::normalizeEmail)
      .filter(email -> !email.isBlank())
      .findFirst()
      .orElseGet(() ->
        "seed." + role.name().toLowerCase(Locale.ROOT) + "+" + UUID.randomUUID() + STAFF_DOMAIN
      );
  }

  private String normalizeEmail(String email) {
    return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
  }

  private User ensureUser(String email, String rawPassword, Role role) {
    return users.findByEmail(email).orElseGet(() -> users.save(
      User.builder()
        .email(email)
        .passwordHash(encoder.encode(rawPassword))
        .role(role)
        .roles(Set.of(role))
        .emailVerified(true)
        .build()
    ));
  }

  private void ensureStudentProfile(User user, String name, String studentNumber, String program, String faculty) {
    if (studentProfiles.findByUserId(user.getId()).isPresent()) {
      return;
    }
    studentProfiles.save(StudentProfile.builder()
      .user(user)
      .name(name)
      .studentId(studentNumber)
      .program(program)
      .faculty(faculty)
      .build());
  }

  private void ensureLecturerProfile(User user, String name, String department, String faculty) {
    if (lecturerProfiles.findByUserId(user.getId()).isPresent()) {
      return;
    }
    lecturerProfiles.save(LecturerProfile.builder()
      .user(user)
      .name(name)
      .department(department)
      .faculty(faculty)
      .build());
  }

}
