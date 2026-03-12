package com.example.thesisrepo.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
  Optional<User> findByEmail(String email);
  Optional<User> findByEmailIgnoreCase(String email);
  boolean existsByEmail(String email);

  @Query("""
    select distinct u from User u
    left join u.roles assignedRole
    where u.role = :role or assignedRole = :role
    """)
  List<User> findByRole(@Param("role") Role role);
}
