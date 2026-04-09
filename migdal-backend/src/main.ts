import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
        rawBody: true,
    });

    // Structured logging
    app.useLogger(app.get(Logger));

    const configService = app.get(ConfigService);

    // Global prefix
    app.setGlobalPrefix('api');

    // CORS
    app.enableCors({
        origin: configService.get<string>('FRONTEND_URL', 'http://localhost:4200'),
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
