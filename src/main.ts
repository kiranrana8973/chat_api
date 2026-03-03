import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn", "log"],
  });

  // Request logger middleware
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    const { method, originalUrl } = req;
    res.on("finish", () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const color =
        status >= 500 ? "\x1b[31m" : status >= 400 ? "\x1b[33m" : "\x1b[32m";
      console.log(
        `${color}${method}\x1b[0m ${originalUrl} \x1b[2m${status} ${duration}ms\x1b[0m`,
      );
    });
    next();
  });

  // CORS
  app.enableCors();

  // Global prefix for all controllers
  app.setGlobalPrefix("api");

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Global exception filter for { error: string } format
  app.useGlobalFilters(new HttpExceptionFilter());

  // Ensure uploads directory exists
  const uploadsDir = join(__dirname, "..", "uploads");
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir);
  }

  // Serve static uploads
  app.useStaticAssets(uploadsDir, { prefix: "/uploads" });

  // Serve React client build (if exists)
  const clientDir = join(__dirname, "..", "client", "dist");
  if (existsSync(clientDir)) {
    app.useStaticAssets(clientDir);
  }

  // Root health check (outside /api prefix)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get("/", (req, res: any) => {
    // If React build exists, serve index.html; otherwise health check JSON
    const indexPath = join(clientDir, "index.html");
    if (existsSync(clientDir) && existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.json({ message: "Chat API is running." });
    }
  });

  // SPA catch-all: serve index.html for non-API routes
  const expressApp = httpAdapter.getInstance();
  expressApp.use((req: any, res: any, next: any) => {
    const indexPath = join(clientDir, "index.html");
    if (
      req.method === "GET" &&
      !req.url.startsWith("/api") &&
      !req.url.startsWith("/uploads") &&
      !req.url.startsWith("/socket.io") &&
      existsSync(indexPath)
    ) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT") || 3000;
  await app.listen(port);
  console.log(`Server running on port ${port}`);
}
bootstrap();
