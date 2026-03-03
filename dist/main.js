"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const path_1 = require("path");
const fs_1 = require("fs");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ["error", "warn", "log"],
    });
    app.use((req, res, next) => {
        const start = Date.now();
        const { method, originalUrl } = req;
        res.on("finish", () => {
            const duration = Date.now() - start;
            const status = res.statusCode;
            const color = status >= 500 ? "\x1b[31m" : status >= 400 ? "\x1b[33m" : "\x1b[32m";
            console.log(`${color}${method}\x1b[0m ${originalUrl} \x1b[2m${status} ${duration}ms\x1b[0m`);
        });
        next();
    });
    app.enableCors();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
    }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    const uploadsDir = (0, path_1.join)(__dirname, "..", "uploads");
    if (!(0, fs_1.existsSync)(uploadsDir)) {
        (0, fs_1.mkdirSync)(uploadsDir);
    }
    app.useStaticAssets(uploadsDir, { prefix: "/uploads" });
    const clientDir = (0, path_1.join)(__dirname, "..", "client", "dist");
    if ((0, fs_1.existsSync)(clientDir)) {
        app.useStaticAssets(clientDir);
    }
    const httpAdapter = app.getHttpAdapter();
    httpAdapter.get("/", (req, res) => {
        const indexPath = (0, path_1.join)(clientDir, "index.html");
        if ((0, fs_1.existsSync)(clientDir) && (0, fs_1.existsSync)(indexPath)) {
            res.sendFile(indexPath);
        }
        else {
            res.json({ message: "Chat API is running." });
        }
    });
    const expressApp = httpAdapter.getInstance();
    expressApp.use((req, res, next) => {
        const indexPath = (0, path_1.join)(clientDir, "index.html");
        if (req.method === "GET" &&
            !req.url.startsWith("/api") &&
            !req.url.startsWith("/uploads") &&
            !req.url.startsWith("/socket.io") &&
            (0, fs_1.existsSync)(indexPath)) {
            res.sendFile(indexPath);
        }
        else {
            next();
        }
    });
    const configService = app.get(config_1.ConfigService);
    const port = configService.get("PORT") || 3000;
    await app.listen(port);
    console.log(`Server running on port ${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map