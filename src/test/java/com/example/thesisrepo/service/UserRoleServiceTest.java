package com.example.thesisrepo.service;

import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.StaffRegistryRepository;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserRoleServiceTest {

  @Mock
  private UserRepository users;

  @Mock
  private StaffRegistryRepository staffRegistry;

  @Mock
  private StudentProfileRepository studentProfiles;

  @InjectMocks
  private UserRoleService userRoleService;

  @Test
  void isLecturerCapableUsesAssignedRolesEvenWhenActiveRoleIsAdmin() {
    User user = User.builder()
      .id(1L)
      .email("melinda.gunawan@my.sampoernauniversity.ac.id")
      .role(Role.ADMIN)
      .roles(new LinkedHashSet<>(Set.of(Role.ADMIN, Role.LECTURER)))
      .passwordHash("hash")
      .build();

    assertThat(userRoleService.isLecturerCapable(user)).isTrue();
  }

  @Test
  void resolveAvailableRolesKeepsCurrentActiveRoleAsCompatibilityFallback() {
    User user = User.builder()
      .id(2L)
      .email("melinda.gunawan@sampoernauniversity.ac.id")
      .role(Role.LECTURER)
      .roles(new LinkedHashSet<>(Set.of(Role.ADMIN)))
      .passwordHash("hash")
      .build();

    when(studentProfiles.findByUserId(2L)).thenReturn(Optional.empty());
    when(staffRegistry.findByEmailIgnoreCase("melinda.gunawan@sampoernauniversity.ac.id")).thenReturn(Optional.empty());

    assertThat(userRoleService.resolveAvailableRoles(user))
      .contains(Role.ADMIN, Role.LECTURER);
  }
}
