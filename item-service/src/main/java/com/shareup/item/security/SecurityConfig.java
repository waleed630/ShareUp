package com.shareup.item.security;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        return http
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .sessionManagement(sess -> sess.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Missing or expired token -> 401, so the frontend can send the user back to login
            // Logged in but wrong role -> a plain 403 (never 401, which the frontend treats as logged out)
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                .accessDeniedHandler((request, response, denied) -> response.setStatus(HttpStatus.FORBIDDEN.value()))
            )

            .authorizeHttpRequests(auth -> auth

                // CORS preflight
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // ---------- OWNER ONLY ----------
                .requestMatchers(HttpMethod.GET, "/api/items/owner").hasRole("OWNER")
                .requestMatchers(HttpMethod.POST, "/api/items").hasRole("OWNER")
                .requestMatchers(HttpMethod.POST, "/api/items/*/image").hasRole("OWNER")
                .requestMatchers(HttpMethod.DELETE, "/api/items/*").hasRole("OWNER")

                // ---------- INTERNAL (rental-service only) ----------
                .requestMatchers(HttpMethod.PUT, "/api/items/*/rented").hasRole(JwtAuthFilter.SERVICE_ROLE)
                .requestMatchers(HttpMethod.PUT, "/api/items/*/available").hasRole(JwtAuthFilter.SERVICE_ROLE)
                .requestMatchers(HttpMethod.PUT, "/api/items/*/status").hasRole(JwtAuthFilter.SERVICE_ROLE)

                // ---------- PUBLIC ----------
                .requestMatchers(HttpMethod.GET, "/api/items/**").permitAll()

                // ---------- EVERYTHING ELSE ----------
                .anyRequest().authenticated()
            )

            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOrigins(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return source;
    }
}
