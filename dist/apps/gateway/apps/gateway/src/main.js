"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const port = parseInt(process.env.GATEWAY_PORT ?? '3001', 10);
    await app.listen(port);
    console.log(`\n🚀 Gateway running at http://localhost:${port}`);
    console.log(`📊 Bull Board at    http://localhost:${port}/queues`);
    console.log(`📡 Grafana at       http://localhost:3000\n`);
}
bootstrap();
//# sourceMappingURL=main.js.map