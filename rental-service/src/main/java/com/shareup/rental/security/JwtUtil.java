package com.shareup.rental.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;
import java.util.function.Function;

@Component
public class JwtUtil {

    private static final Logger log = LoggerFactory.getLogger(JwtUtil.class);

    private final Key signingKey;

    public JwtUtil(@Value("${jwt.secret}") String secret) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes());
    }

    // Role carried by the tokens this service signs for its own calls
    public static final String SERVICE_ROLE = "SERVICE";

    private static final long SERVICE_TOKEN_TTL_MS = 5 * 60 * 1000;

    /**
     * Short-lived token for calls to auth-service and item-service.
     * It is signed with the shared secret, so only a ShareUp service can produce one.
     */
    public String generateServiceToken() {
        Date now = new Date();
        return Jwts.builder()
                .setSubject("rental-service")
                .claim("role", SERVICE_ROLE)
                .setIssuedAt(now)
                .setExpiration(new Date(now.getTime() + SERVICE_TOKEN_TTL_MS))
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            extractAllClaims(token);
            return true;
        } catch (Exception e) {
            log.warn("JWT validation failed: {}", e.getMessage());
            return false;
        }
    }

    public Long extractUserId(String token) {
        Object userId = extractAllClaims(token).get("userId");
        return userId != null ? Long.valueOf(userId.toString()) : null;
    }

    public String extractRole(String token) {
        return extractClaim(token, claims -> claims.get("role", String.class));
    }
 
    public String extractPhone(String token) {
        return extractClaim(token, claims -> claims.get("phone", String.class));
    }
 
    public String extractEmail(String token) {
        return extractClaim(token, claims -> claims.get("email", String.class));
    }

    private <T> T extractClaim(String token, Function<Claims, T> resolver) {
        return resolver.apply(extractAllClaims(token));
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(signingKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
