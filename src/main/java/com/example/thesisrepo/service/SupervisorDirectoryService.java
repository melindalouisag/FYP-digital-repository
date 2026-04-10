package com.example.thesisrepo.service;

import com.example.thesisrepo.profile.LecturerProfile;
import com.example.thesisrepo.profile.LecturerProfileRepository;
import com.example.thesisrepo.user.StaffRegistry;
import com.example.thesisrepo.user.StaffRegistryRepository;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class SupervisorDirectoryService {

  private final UserRepository users;
  private final StaffRegistryRepository staffRegistryRepository;
  private final LecturerProfileRepository lecturerProfiles;
  private final UserRoleService userRoles;

  public List<SupervisorDirectoryEntry> listActiveSupervisors(String faculty, String studyProgram) {
    return users.findAll().stream()
      .filter(userRoles::isLecturerCapable)
      .map(this::toEntry)
      .filter(entry -> matchesStudyProgram(entry.studyProgram(), studyProgram))
      .filter(entry -> matchesFaculty(entry.faculty(), faculty))
      .sorted(Comparator.comparing(SupervisorDirectoryEntry::name, String.CASE_INSENSITIVE_ORDER))
      .toList();
  }

  public SupervisorDirectoryEntry findActiveByEmail(String email) {
    String normalizedEmail = normalize(email);
    return users.findByEmailIgnoreCase(normalizedEmail)
      .filter(userRoles::isLecturerCapable)
      .map(this::toEntry)
      .orElse(null);
  }

  public boolean isEligibleForStudent(SupervisorDirectoryEntry supervisor, String studentFaculty, String studentStudyProgram) {
    if (supervisor == null) {
      return false;
    }
    return matchesStudyProgram(supervisor.studyProgram(), studentStudyProgram);
  }

  private SupervisorDirectoryEntry toEntry(User user) {
    LecturerProfile lecturerProfile = lecturerProfiles.findByUserId(user.getId()).orElse(null);
    StaffRegistry staffEntry = staffRegistryRepository.findByEmailIgnoreCase(normalize(user.getEmail())).orElse(null);

    return new SupervisorDirectoryEntry(
      user.getId(),
      user.getEmail(),
      resolveDisplayName(user.getEmail(), lecturerProfile, staffEntry),
      resolveFaculty(lecturerProfile),
      resolveStudyProgram(lecturerProfile, staffEntry)
    );
  }

  private static String resolveDisplayName(String email, LecturerProfile lecturerProfile, StaffRegistry staffEntry) {
    if (lecturerProfile != null && StringUtils.hasText(lecturerProfile.getName())) {
      return lecturerProfile.getName().trim();
    }
    if (staffEntry != null && StringUtils.hasText(staffEntry.getFullName())) {
      return staffEntry.getFullName().trim();
    }

    String normalizedEmail = normalize(email);
    int separator = normalizedEmail.indexOf('@');
    if (separator <= 0) {
      return normalizedEmail;
    }

    String localPart = normalizedEmail.substring(0, separator);
    String[] chunks = localPart.split("[._-]+");
    StringBuilder builder = new StringBuilder();
    for (String chunk : chunks) {
      if (chunk.isBlank()) {
        continue;
      }
      if (!builder.isEmpty()) {
        builder.append(' ');
      }
      builder.append(Character.toUpperCase(chunk.charAt(0)))
        .append(chunk.substring(1));
    }
    return builder.isEmpty() ? localPart : builder.toString();
  }

  private static String resolveFaculty(LecturerProfile lecturerProfile) {
    if (lecturerProfile != null && StringUtils.hasText(lecturerProfile.getFaculty())) {
      return lecturerProfile.getFaculty().trim();
    }
    return null;
  }

  private static String resolveStudyProgram(LecturerProfile lecturerProfile, StaffRegistry staffEntry) {
    if (lecturerProfile != null && StringUtils.hasText(lecturerProfile.getDepartment())) {
      return lecturerProfile.getDepartment().trim();
    }
    if (staffEntry != null && StringUtils.hasText(staffEntry.getStudyProgram())) {
      return staffEntry.getStudyProgram().trim();
    }
    return null;
  }

  private static boolean matchesFaculty(String entryFaculty, String requestedFaculty) {
    if (!StringUtils.hasText(requestedFaculty)) {
      return true;
    }
    return normalize(entryFaculty).equals(normalize(requestedFaculty));
  }

  private static boolean matchesStudyProgram(String entryProgram, String requestedProgram) {
    if (!StringUtils.hasText(requestedProgram)) {
      return true;
    }
    String entryNormalized = normalizeStudyProgram(entryProgram);
    String requestNormalized = normalizeStudyProgram(requestedProgram);
    return entryNormalized.equals(requestNormalized);
  }

  private static String normalizeStudyProgram(String value) {
    String normalized = normalize(value);
    if (normalized.endsWith("systems")) {
      return normalized.substring(0, normalized.length() - 1);
    }
    return normalized;
  }

  private static String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  public record SupervisorDirectoryEntry(
    Long userId,
    String email,
    String name,
    String faculty,
    String studyProgram
  ) {
  }
}
