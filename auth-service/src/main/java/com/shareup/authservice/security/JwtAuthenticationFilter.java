package com.shareup.authservice.security;

import com.shareup.authservice.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    // Role carried by tokens that rental-service signs for its own calls
    public static final String SERVICE_ROLE = "SERVICE";

    private final JwtUtil jwtUtil;
    private final CustomUserDetailsService userDetailsService;

    public JwtAuthenticationFilter(JwtUtil jwtUtil, CustomUserDetailsService userDetailsService) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {

            String token = header.substring(7);

            if (jwtUtil.validateToken(token)) {
                UsernamePasswordAuthenticationToken authentication = authenticate(token);

                if (authentication != null) {
                    authentication.setDetails(
                            new WebAuthenticationDetailsSource().buildDetails(request)
                    );
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private UsernamePasswordAuthenticationToken authenticate(String token) {

        // Service tokens belong to another ShareUp service, not to a row in the users table
        if (SERVICE_ROLE.equals(jwtUtil.extractRole(token))) {
            return new UsernamePasswordAuthenticationToken(
                    "service",
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + SERVICE_ROLE))
            );
        }

        try {
            UserDetails userDetails = userDetailsService.loadUserByUsername(jwtUtil.extractEmail(token));
            return new UsernamePasswordAuthenticationToken(
                    userDetails,
                    null,
                    userDetails.getAuthorities()
            );
        } catch (UsernameNotFoundException e) {
            // the account was removed after the token was issued
            return null;
        }
    }
}
