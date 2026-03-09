package com.example.thesisrepo;

import com.example.thesisrepo.config.PostgresPreflightCheck;
import com.example.thesisrepo.config.RailwayDatasourceInitializer;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableAsync
@EnableScheduling
public class ThesisRepoApplication {
  public static void main(String[] args) {
    SpringApplication app = new SpringApplication(ThesisRepoApplication.class);
    app.addInitializers(new RailwayDatasourceInitializer());
    app.addInitializers(new PostgresPreflightCheck());
    app.run(args);
  }
}
