package com.shareup.rental.config;

import com.shareup.rental.security.JwtUtil;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
public class RestConfig {

    @Bean
    public RestTemplate restTemplate(JwtUtil jwtUtil) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();

        // ✅ If auth-service or item-service is slow/down,
        //    fail fast instead of hanging the entire request
        factory.setConnectTimeout(3000);  // 3 seconds to establish connection
        factory.setReadTimeout(5000);     // 5 seconds to read response

        RestTemplate restTemplate = new RestTemplate(factory);

        // auth-service and item-service only answer internal calls that carry a service token
        restTemplate.getInterceptors().add((request, body, execution) -> {
            request.getHeaders().setBearerAuth(jwtUtil.generateServiceToken());
            return execution.execute(request, body);
        });

        return restTemplate;
    }
}