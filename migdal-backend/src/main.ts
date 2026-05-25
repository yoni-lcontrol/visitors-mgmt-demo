import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

class LargePayloadIoAdapter extends IoAdapter {
    createIOServer(port: number, options?: any) {
        return super.createIOServer(port, {
            ...options,
            maxHttpBufferSize: 10e6, // 10MB for base64 scan images
        });
    }
}

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
        rawBody: true,
    });

    // Structured logging
    app.useLogger(app.get(Logger));

    // WebSocket adapter with increased buffer size for scan images
    app.useWebSocketAdapter(new LargePayloadIoAdapter(app));

    const configService = app.get(ConfigService);

    // Global prefix
    app.setGlobalPrefix('api');

    // CORS
    const corsOrigins = [
        configService.get<string>('FRONTEND_URL', 'http://localhost:4200'),
        configService.get<string>('KIOSK_URL', 'http://localhost:4201'),
        'http://10.0.0.147:8080',
        'http://10.0.0.147:4201',
    ].filter(Boolean);
    app.enableCors({
        origin: (origin, callback) => {
            // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
            if (!origin) return callback(null, true);
            // Allow any localhost port (dev) or any local network IP
            if (origin.match(/^https?:\/\/(localhost|10\.\d+\.\d+\.\d+)(:\d+)?$/) || corsOrigins.includes(origin)) {
                return callback(null, true);
            }
            callback(null, false);
        },
        credentials: true,
    });

    // Cookie parser (for refresh tokens)
    app.use(cookieParser());

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // Swagger
    const swaggerConfig = new DocumentBuilder()
        .setTitle('Migdal API')
        .setDescription('Migdal Management Platform API Documentation')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);

    const port = configService.get<number>('APP_PORT', 3000);
    await app.listen(port);

    console.log(`🚀 Application running on: http://localhost:${port}/api`);
    console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
