package com.example.thesisrepo.service;

import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.StaffRegistryRepository;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class UserRoleService {
  public static final String SESSION_AVAILABLE_ROLES = "thesisrepo.availableRoles";
  public static final String SESSION_ACTIVE_ROLE = "thesisrepo.activeRole";
  public static final String SESSION_ROLE_SELECTION_REQUIRED = "thesisrepo.roleSelectionRequired";

  private static final String STUDENT_DOMAIN = "@my.sampoernauniversity.ac.id";
  private static final List<Role> ROLE_ORDER = List.of(Role.STUDENT, Role.LECTURER, Role.ADMIN);

  private final UserRepository users;
  private final StaffRegistryRepository staffRegistry;
  private final StudentProfileRepository studentProfiles;

  public Set<Role> resolveAvailableRoles(User user) {
    LinkedHashSet<Role> roles = new LinkedHashSet<>();
    if (user.getRoles() != null) {
      roles.addAll(user.getRoles());
    }

    String normalizedEmail = normalizeEmail(user.getEmail());
    if (normalizedEmail.endsWith(STUDENT_DOMAIN) || studentProfiles.findByUserId(user.getId()).isPresent()) {
      roles.add(Role.STUDENT);
    }

    staffRegistry.findByEmailIgnoreCase(normalizedEmail)
      .map(entry -> entry.getRole())
      .filter(role -> role == Role.LECTURER || role == Role.ADMIN)
      .ifPresent(roles::add);

    if (roles.isEmpty() && user.getRole() != null) {
      roles.add(user.getRole());
    }

    return sortRoles(roles);
  }

  public void syncAssignedRoles(User user, Set<Role> roles) {
    if (roles.isEmpty()) {
      return;
    }

    boolean changed = false;
    if (user.getRoles() == null) {
      user.setRoles(new LinkedHashSet<>(roles));
      changed = true;
    } else if (!user.getRoles().equals(roles)) {
      user.getRoles().clear();
      user.getRoles().addAll(roles);
      changed = true;
    }

    if (user.getRole() == null || !roles.contains(user.getRole())) {
      user.setRole(roles.iterator().next());
      changed = true;
    }

    if (changed) {
      users.save(user);
    }
  }

  public void initializeSession(HttpServletRequest request, User user) {
    Set<Role> roles = resolveAvailableRoles(user);
    if (roles.isEmpty()) {
      throw new IllegalStateException("No available roles configured for user " + user.getEmail());
    }
    syncAssignedRoles(user, roles);

    HttpSession session = request.getSession(true);
    session.setAttribute(SESSION_AVAILABLE_ROLES, toRoleNames(roles));
    if (roles.size() <= 1) {
      Role activeRole = roles.iterator().next();
      session.setAttribute(SESSION_ACTIVE_ROLE, activeRole.name());
      session.setAttribute(SESSION_ROLE_SELECTION_REQUIRED, false);
      if (user.getRole() != activeRole) {
        user.setRole(activeRole);
        users.save(user);
      }
      return;
    }

    session.removeAttribute(SESSION_ACTIVE_ROLE);
    session.setAttribute(SESSION_ROLE_SELECTION_REQUIRED, true);
  }

  public Role selectActiveRole(HttpServletRequest request, User user, Role role) {
    Set<Role> roles = resolveAvailableRoles(user);
    if (!roles.contains(role)) {
      throw new IllegalArgumentException("Requested role is not available for this account.");
    }

    syncAssignedRoles(user, roles);
    HttpSession session = request.getSession(true);
    session.setAttribute(SESSION_AVAILABLE_ROLES, toRoleNames(roles));
    session.setAttribute(SESSION_ACTIVE_ROLE, role.name());
    session.setAttribute(SESSION_ROLE_SELECTION_REQUIRED, false);

    if (user.getRole() != role) {
      user.setRole(role);
      users.save(user);
    }

    return role;
  }

  public Role resolveDisplayRole(User user, HttpServletRequest request) {
    Role activeRole = getActiveRole(request);
    if (activeRole != null) {
      return activeRole;
    }

    Set<Role> roles = resolveAvailableRoles(user);
    if (user.getRole() != null && roles.contains(user.getRole())) {
      return user.getRole();
    }
    return roles.isEmpty() ? user.getRole() : roles.iterator().next();
  }

  public boolean isRoleSelectionRequired(User user, HttpServletRequest request) {
    HttpSession session = request.getSession(false);
    if (session != null && session.getAttribute(SESSION_ROLE_SELECTION_REQUIRED) instanceof Boolean selectionRequired) {
      return selectionRequired;
    }
    return resolveAvailableRoles(user).size() > 1 && getActiveRole(request) == null;
  }

  public Role getActiveRole(HttpServletRequest request) {
    HttpSession session = request.getSession(false);
    if (session == null) {
      return null;
    }
    Object value = session.getAttribute(SESSION_ACTIVE_ROLE);
    if (!(value instanceof String roleName) || roleName.isBlank()) {
      return null;
    }
    try {
      return Role.valueOf(roleName);
    } catch (IllegalArgumentException ignored) {
      return null;
    }
  }

  public List<String> availableRoleNames(User user, HttpServletRequest request) {
    HttpSession session = request.getSession(false);
    if (session != null && session.getAttribute(SESSION_AVAILABLE_ROLES) instanceof Collection<?> values) {
      return values.stream()
        .filter(String.class::isInstance)
        .map(String.class::cast)
        .toList();
    }
    return toRoleNames(resolveAvailableRoles(user));
  }

  public Authentication adaptAuthentication(Authentication authentication, HttpServletRequest request) {
    if (authentication == null || !authentication.isAuthenticated()) {
      return authentication;
    }

    HttpSession session = request.getSession(false);
    if (session == null) {
      return authentication;
    }

    boolean selectionRequired = Boolean.TRUE.equals(session.getAttribute(SESSION_ROLE_SELECTION_REQUIRED));
    Role activeRole = getActiveRole(request);
    List<SimpleGrantedAuthority> authorities;
    if (selectionRequired && activeRole == null) {
      authorities = List.of(new SimpleGrantedAuthority("ROLE_ROLE_SELECTION_REQUIRED"));
    } else if (activeRole != null) {
      authorities = List.of(new SimpleGrantedAuthority("ROLE_" + activeRole.name()));
    } else {
      return authentication;
    }

    if (hasSameAuthorities(authentication.getAuthorities(), authorities)) {
      return authentication;
    }

    UsernamePasswordAuthenticationToken adapted = new UsernamePasswordAuthenticationToken(
      authentication.getPrincipal(),
      authentication.getCredentials(),
      authorities
    );
    adapted.setDetails(authentication.getDetails());
    return adapted;
  }

  private static boolean hasSameAuthorities(Collection<?> currentAuthorities, Collection<?> nextAuthorities) {
    return currentAuthorities.size() == nextAuthorities.size() && currentAuthorities.containsAll(nextAuthorities);
  }

  private static Set<Role> sortRoles(Set<Role> roles) {
    return roles.stream()
      .sorted(Comparator.comparingInt(role -> ROLE_ORDER.indexOf(role)))
      .collect(LinkedHashSet::new, LinkedHashSet::add, LinkedHashSet::addAll);
  }

  private static List<String> toRoleNames(Set<Role> roles) {
    return roles.stream().map(Enum::name).toList();
  }

  private static String normalizeEmail(String email) {
    return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
  }
}
