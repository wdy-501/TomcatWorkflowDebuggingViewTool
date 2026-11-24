package com.example.shop.config;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.example.shop.controller.OrderController;

/** DispatcherServlet context: Spring MVC controllers + the static SSM demo page. */
@Configuration
@EnableWebMvc
@ComponentScan(basePackageClasses = OrderController.class)
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/", "/index.html").addResourceLocations("/");
    }
}