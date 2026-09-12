package com.inkshelf;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
/** 墨架 Java 服务启动入口。 */
public class InkShelfApplication {
    public static void main(String[] args) {
        SpringApplication.run(InkShelfApplication.class, args);
    }
}
