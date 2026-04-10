package com.example.thesisrepo.service.registration;

import com.example.thesisrepo.profile.LecturerProfileRepository;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.service.SupervisorDirectoryService;
import com.example.thesisrepo.service.UserRoleService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.StaffRegistryRepository;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistrationSupportServiceTest {

  @Mock
  private PublicationCaseRepository cases;

  @Mock
  private CaseSupervisorRepository caseSupervisors;

  @Mock
  private StudentProfileRepository studentProfiles;

  @Mock
  private LecturerProfileRepository lecturerProfiles;

  @Mock
  private UserRepository users;

  @Mock
  private StaffRegistryRepository staffRegistry;

  @Mock
  private PasswordEncoder passwordEncoder;

  @Mock
  private UserRoleService userRoles;

  @Mock
  private SupervisorDirectoryService supervisorDirectoryService;

  @InjectMocks
  private RegistrationSupportService registrationSupportService;

  @Test
  void validateSupervisorForStudentAcceptsDualRoleLecturerCapability() {
    User supervisor = User.builder()
      .id(10L)
      .email("melinda.gunawan@my.sampoernauniversity.ac.id")
      .role(Role.ADMIN)
      .roles(new LinkedHashSet<>(Set.of(Role.ADMIN, Role.LECTURER)))
      .passwordHash("hash")
      .build();

    SupervisorDirectoryService.SupervisorDirectoryEntry entry =
      new SupervisorDirectoryService.SupervisorDirectoryEntry(
        10L,
        supervisor.getEmail(),
        "Melinda Gunawan",
        null,
        "Information Systems"
      );

    when(userRoles.isLecturerCapable(supervisor)).thenReturn(true);
    when(supervisorDirectoryService.findActiveByEmail(supervisor.getEmail())).thenReturn(entry);
    when(supervisorDirectoryService.isEligibleForStudent(entry, null, "Information Systems")).thenReturn(true);

    assertThatCode(() -> registrationSupportService.validateSupervisorForStudent(supervisor, "Information Systems"))
      .doesNotThrowAnyException();
  }

  @Test
  void resolveRequestedSupervisorReusesExistingLecturerCapableUser() {
    User existingUser = User.builder()
      .id(10L)
      .email("melinda.gunawan@my.sampoernauniversity.ac.id")
      .role(Role.ADMIN)
      .roles(new LinkedHashSet<>(Set.of(Role.ADMIN, Role.LECTURER)))
      .passwordHash("hash")
      .build();

    when(users.findByEmailIgnoreCase(existingUser.getEmail())).thenReturn(Optional.of(existingUser));
    when(userRoles.isLecturerCapable(existingUser)).thenReturn(true);
    when(userRoles.resolveAvailableRoles(existingUser)).thenReturn(new LinkedHashSet<>(Set.of(Role.ADMIN, Role.LECTURER)));
    when(staffRegistry.findByEmailIgnoreCase(existingUser.getEmail())).thenReturn(Optional.empty());

    User resolved = registrationSupportService.resolveRequestedSupervisor(existingUser.getEmail(), null, null, null);

    assertThat(resolved).isSameAs(existingUser);
    verify(users, never()).save(any());
    verify(lecturerProfiles, never()).save(any());
  }
}
