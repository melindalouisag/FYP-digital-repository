package com.example.thesisrepo.config;

import com.example.thesisrepo.service.UserRoleService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class SessionActiveRoleFilter extends OncePerRequestFilter {

  private final UserRoleService userRoles;

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
    throws ServletException, IOException {

    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    Authentication adapted = userRoles.adaptAuthentication(authentication, request);
    if (adapted != authentication) {
      SecurityContextHolder.getContext().setAuthentication(adapted);
    }

    filterChain.doFilter(request, response);
  }
}
