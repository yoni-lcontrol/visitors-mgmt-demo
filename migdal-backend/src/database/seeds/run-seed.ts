import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';

async function bootstrap(): Promise<void> {
    const logger = new Logger('SeedRunner');
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['log', 'warn', 'error'],
    });

    await app.close();
    logger.log('Seed completed successfully');
}

bootstrap().catch((error: unknown) => {
    console.error('Seed failed', error);
    process.exit(1);
});
