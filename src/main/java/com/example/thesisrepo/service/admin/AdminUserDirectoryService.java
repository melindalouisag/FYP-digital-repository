package com.example.thesisrepo.service.admin;

import com.example.thesisrepo.profile.LecturerProfile;
import com.example.thesisrepo.profile.LecturerProfileRepository;
import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.web.dto.AdminUserDirectoryItemDto;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminUserDirectoryService {

  private final StudentProfileRepository studentProfiles;
  private final LecturerProfileRepository lecturerProfiles;

  public List<AdminUserDirectoryItemDto> students(String q, String faculty, String studyProgram) {
    return studentProfiles.findAll(Sort.by(Sort.Order.asc("name"), Sort.Order.asc("userId"))).stream()
      .map(profile -> new AdminUserDirectoryItemDto(
        profile.getUserId(),
        fallbackName(profile.getName(), profile.getUser() != null ? profile.getUser().getEmail() : null),
        profile.getUser() != null ? profile.getUser().getEmail() : null,
        profile.getFaculty(),
        profile.getProgram(),
        Role.STUDENT.name()
      ))
      .filter(item -> matches(item, q, faculty, studyProgram))
      .toList();
  }

  public List<AdminUserDirectoryItemDto> lecturers(String q, String faculty, String studyProgram) {
    return lecturerProfiles.findAll(Sort.by(Sort.Order.asc("name"), Sort.Order.asc("userId"))).stream()
      .map(profile -> new AdminUserDirectoryItemDto(
        profile.getUserId(),
        fallbackName(profile.getName(), profile.getUser() != null ? profile.getUser().getEmail() : null),
        profile.getUser() != null ? profile.getUser().getEmail() : null,
        profile.getFaculty(),
        profile.getDepartment(),
        Role.LECTURER.name()
      ))
      .filter(item -> matches(item, q, faculty, studyProgram))
      .toList();
  }

  private boolean matches(AdminUserDirectoryItemDto item, String q, String faculty, String studyProgram) {
    return matchesQuery(item, q)
      && matchesField(item.faculty(), faculty)
      && matchesField(item.studyProgram(), studyProgram);
  }

  private boolean matchesQuery(AdminUserDirectoryItemDto item, String q) {
    if (!hasText(q)) {
      return true;
    }
    String normalized = normalize(q);
    return normalize(item.fullName()).contains(normalized)
      || normalize(item.email()).contains(normalized);
  }

  private boolean matchesField(String value, String filter) {
    if (!hasText(filter)) {
      return true;
    }
    return normalize(value).contains(normalize(filter));
  }

  private String fallbackName(String name, String email) {
    return hasText(name) ? name.trim() : (email == null ? "Unknown user" : email);
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase();
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
