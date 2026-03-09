FROM node:20-alpine AS frontend-builder

WORKDIR /app/admin-ui
COPY admin-ui/package.json admin-ui/package-lock.json ./
RUN npm ci

COPY admin-ui/ ./
RUN npm run build

FROM maven:3.9.9-eclipse-temurin-21 AS backend-builder

WORKDIR /app
COPY pom.xml mvnw ./
COPY .mvn .mvn
COPY src ./src

# Replace any stale committed SPA build with the latest Vite output.
COPY --from=frontend-builder /app/admin-ui/dist ./admin-ui/dist
RUN rm -rf src/main/resources/static/* \
  && cp -R admin-ui/dist/. src/main/resources/static/ \
  && mvn -B -DskipTests clean package

FROM eclipse-temurin:21-jre

WORKDIR /app
COPY --from=backend-builder /app/target/*.jar app.jar

ENTRYPOINT ["java","-jar","app.jar"]
