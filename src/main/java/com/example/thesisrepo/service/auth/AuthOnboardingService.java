package com.example.thesisrepo.service.auth;

import com.example.thesisrepo.master.Faculty;
import com.example.thesisrepo.master.Program;
import com.example.thesisrepo.master.repo.FacultyRepository;
import com.example.thesisrepo.master.repo.ProgramRepository;
import com.example.thesisrepo.profile.LecturerProfile;
import com.example.thesisrepo.profile.LecturerProfileRepository;
import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;

@Service
@RequiredArgsConstructor
public class AuthOnboardingService {

  private final StudentProfileRepository studentProfiles;
  private final LecturerProfileRepository lecturerProfiles;
  private final FacultyRepository faculties;
  private final ProgramRepository programs;

  public void completeOnboarding(
    User user,
    Role activeRole,
    String name,
    String facultyName,
    String studyProgram,
    String program,
    String studentId,
    String department
  ) {
    String normalizedName = normalizeText(name);
    String normalizedFaculty = normalizeText(facultyName);
    if (normalizedName.isBlank() || normalizedFaculty.isBlank()) {
      throw new ResponseStatusException(BAD_REQUEST, "Name and faculty are required.");
    }

    Faculty faculty = faculties.findByActiveTrueAndNameIgnoreCase(normalizedFaculty)
      .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Invalid faculty/program"));

    if (activeRole == Role.STUDENT) {
      completeStudentOnboarding(user, normalizedName, faculty, studyProgram, program, department, studentId);
      return;
    }
    if (activeRole == Role.LECTURER) {
      completeLecturerOnboarding(user, normalizedName, faculty, studyProgram, program, department);
      return;
    }

    throw new ResponseStatusException(BAD_REQUEST, "Onboarding is not required for this role.");
  }

  private void completeStudentOnboarding(
    User user,
    String name,
    Faculty faculty,
    String studyProgram,
    String program,
    String department,
    String studentId
  ) {
    String programName = firstNonBlank(studyProgram, program, department);
    String normalizedStudentId = normalizeText(studentId);
    if (programName.isBlank() || normalizedStudentId.isBlank()) {
      throw new ResponseStatusException(BAD_REQUEST, "Program and student ID are required for students.");
    }

    Program activeProgram = programs.findByActiveTrueAndFaculty_IdAndNameIgnoreCase(faculty.getId(), programName)
      .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Invalid faculty/program"));

    studentProfiles.findByStudentId(normalizedStudentId)
      .filter(existing -> !existing.getUserId().equals(user.getId()))
      .ifPresent(existing -> {
        throw new ResponseStatusException(CONFLICT, "Student ID is already used by another account.");
      });

    StudentProfile profile = studentProfiles.findByUserId(user.getId())
      .orElseGet(() -> StudentProfile.builder().user(user).build());
    profile.setName(name);
    profile.setFaculty(faculty.getName());
    profile.setProgram(activeProgram.getName());
    profile.setStudentId(normalizedStudentId);
    studentProfiles.save(profile);
  }

  private void completeLecturerOnboarding(
    User user,
    String name,
    Faculty faculty,
    String studyProgram,
    String program,
    String department
  ) {
    String departmentName = firstNonBlank(studyProgram, department, program);
    if (departmentName.isBlank()) {
      throw new ResponseStatusException(BAD_REQUEST, "Study program is required for lecturers.");
    }

    Program activeDepartment = programs.findByActiveTrueAndFaculty_IdAndNameIgnoreCase(faculty.getId(), departmentName)
      .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Invalid faculty/program"));

    LecturerProfile profile = lecturerProfiles.findByUserId(user.getId())
      .orElseGet(() -> LecturerProfile.builder().user(user).build());
    profile.setName(name);
    profile.setFaculty(faculty.getName());
    profile.setDepartment(activeDepartment.getName());
    lecturerProfiles.save(profile);
  }

  private static String normalizeText(String value) {
    return value == null ? "" : value.trim();
  }

  private static String firstNonBlank(String first, String second) {
    if (first != null && !first.trim().isEmpty()) {
      return first.trim();
    }
    return second == null ? "" : second.trim();
  }

  private static String firstNonBlank(String first, String second, String third) {
    String value = firstNonBlank(first, second);
    if (!value.isBlank()) {
      return value;
    }
    return third == null ? "" : third.trim();
  }
}
