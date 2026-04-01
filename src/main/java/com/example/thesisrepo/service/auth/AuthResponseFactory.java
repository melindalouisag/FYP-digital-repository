package com.example.thesisrepo.service.auth;

import com.example.thesisrepo.profile.LecturerProfile;
import com.example.thesisrepo.profile.LecturerProfileRepository;
import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.service.UserRoleService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.AuthController;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.CONFLICT;

@Component
@RequiredArgsConstructor
public class AuthResponseFactory {

  private final UserRoleService userRoles;
  private final StudentProfileRepository studentProfiles;
  private final LecturerProfileRepository lecturerProfiles;

  public AuthController.MeResponse toMeResponse(User user, HttpServletRequest request) {
    Role activeRole = requireDisplayRole(user, request);
    boolean roleSelectionRequired = request != null
      && userRoles.isRoleSelectionRequired(user, request);
    java.util.List<String> availableRoles = request != null
      ? userRoles.availableRoleNames(user, request)
      : userRoles.resolveAvailableRoles(user).stream().map(Enum::name).toList();

    if (activeRole == Role.ADMIN) {
      return new AuthController.MeResponse(
        user.getId(),
        user.getEmail(),
        activeRole.name(),
        user.getAuthProvider().name(),
        true,
        user.isEmailVerified(),
        null,
        null,
        null,
        null,
        null,
        null,
        availableRoles,
        roleSelectionRequired
      );
    }

    if (activeRole == Role.STUDENT) {
      StudentProfile profile = studentProfiles.findByUserId(user.getId()).orElse(null);
      String name = profile != null ? normalizeText(profile.getName()) : "";
      String faculty = profile != null ? normalizeText(profile.getFaculty()) : "";
      String program = profile != null ? normalizeText(profile.getProgram()) : "";
      String studentId = profile != null ? normalizeText(profile.getStudentId()) : "";
      boolean complete = !name.isBlank() && !faculty.isBlank() && !program.isBlank() && !studentId.isBlank();
      return new AuthController.MeResponse(
        user.getId(),
        user.getEmail(),
        activeRole.name(),
        user.getAuthProvider().name(),
        complete,
        user.isEmailVerified(),
        emptyToNull(name),
        emptyToNull(name),
        emptyToNull(faculty),
        emptyToNull(program),
        null,
        emptyToNull(studentId),
        availableRoles,
        roleSelectionRequired
      );
    }

    if (activeRole == Role.LECTURER) {
      LecturerProfile profile = lecturerProfiles.findByUserId(user.getId()).orElse(null);
      String name = profile != null ? normalizeText(profile.getName()) : "";
      String faculty = profile != null ? normalizeText(profile.getFaculty()) : "";
      String department = profile != null ? normalizeText(profile.getDepartment()) : "";
      return new AuthController.MeResponse(
        user.getId(),
        user.getEmail(),
        activeRole.name(),
        user.getAuthProvider().name(),
        true,
        user.isEmailVerified(),
        emptyToNull(name),
        emptyToNull(name),
        emptyToNull(faculty),
        null,
        emptyToNull(department),
        null,
        availableRoles,
        roleSelectionRequired
      );
    }

    return new AuthController.MeResponse(
      user.getId(),
      user.getEmail(),
      activeRole != null ? activeRole.name() : user.getRole().name(),
      user.getAuthProvider().name(),
      false,
      user.isEmailVerified(),
      null,
      null,
      null,
      null,
      null,
      null,
      availableRoles,
      roleSelectionRequired
    );
  }

  public Role requireActiveRole(User user, HttpServletRequest request) {
    if (request != null && userRoles.isRoleSelectionRequired(user, request)) {
      throw new ResponseStatusException(CONFLICT, "Please choose a role before continuing.");
    }
    return request != null ? requireDisplayRole(user, request) : user.getRole();
  }

  private Role requireDisplayRole(User user, HttpServletRequest request) {
    if (request == null) {
      return user.getRole();
    }
    Role displayRole = userRoles.resolveDisplayRole(user, request);
    return displayRole != null ? displayRole : user.getRole();
  }

  private static String normalizeText(String value) {
    return value == null ? "" : value.trim();
  }

  private static String emptyToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
