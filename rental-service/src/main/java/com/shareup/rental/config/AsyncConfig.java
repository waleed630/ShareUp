package com.shareup.rental.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

// Lets EmailService send mail in the background
@Configuration
@EnableAsync
public class AsyncConfig {
}
