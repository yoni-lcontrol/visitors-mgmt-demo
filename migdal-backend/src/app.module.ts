import { Module, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AccessControlModule } from './access-control/access-control.module';
import { VisitorsModule } from './visitors/visitors.module';
import { SettingsModule } from './settings/settings.module';
import { AuditModule } from './audit/audit.module';
import { WebsocketModule } from './websocket/websocket.module';
import { ScheduledTasksModule } from './scheduled-tasks/scheduled-tasks.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { WorkstationsModule } from './workstations/workstations.module';
import { AgentsModule } from './agents/agents.module';
import { DeviceCommandsModule } from './device-commands/device-commands.module';
import { PrintingModule } from './printing/printing.module';
import { ScanningModule } from './scanning/scanning.module';
import { HealthModule } from './health/health.module';
import { BuildingsModule } from './buildings/buildings.module';
import { AmadeusModule } from './amadeus/amadeus.module';
import { SectorsModule } from './sectors/sectors.module';
import { AdGroupRoleMappingsModule } from './ad-group-role-mappings/ad-group-role-mappings.module';

function bullModuleIfRedis(): DynamicModule[] {
    if (!process.env.REDIS_HOST) return [];
    return [
        BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                connection: {
                    host: config.get<string>('REDIS_HOST', 'localhost'),
                    port: config.get<number>('REDIS_PORT', 6379),
                    password: config.get<string>('REDIS_PASSWORD') || undefined,
                    maxRetriesPerRequest: 1,
                    connectTimeout: 3000,
                    enableOfflineQueue: false,
                    lazyConnect: true,
                    retryStrategy: (times: number) => {
                        if (times > 3) return null;
                        return Math.min(times * 500, 3000);
                    },
                },
            }),
        }),
    ];
}

@Module({
    imports: [
        // Global configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
        }),

        // Structured logging
        LoggerModule.forRoot({
            pinoHttp: {
                transport:
                    process.env.NODE_ENV !== 'production'
                        ? { target: 'pino-pretty', options: { colorize: true } }
                        : {
                            targets: [
                                { target: 'pino/file', options: { destination: 1 } },
                                ...(process.env.SIEM_SYSLOG_HOST
                                    ? [{
                                        target: 'pino-syslog',
                                        options: {
                                            destination: process.env.SIEM_SYSLOG_HOST,
                                            port: parseInt(process.env.SIEM_SYSLOG_PORT ?? '514', 10),
                                            protocol: process.env.SIEM_SYSLOG_PROTOCOL ?? 'tcp',
                                            appname: process.env.SIEM_SYSLOG_TOKEN ?? 'migdal-backend',
                                            facility: 16,
                                            newline: true,
                                        },
                                    }]
                                    : []),
                            ],
                        },
                level: process.env.LOG_LEVEL || 'info',
            },
        }),

        // Infrastructure
        ScheduleModule.forRoot(),
        ...bullModuleIfRedis(),
        DatabaseModule,
        CommonModule,
        WebsocketModule,
        HealthModule,

        // Feature modules
        AuthModule,
        UsersModule,
        RolesModule,
        PermissionsModule,
        AccessControlModule,
        VisitorsModule,
        SettingsModule,
        AuditModule,
        ScheduledTasksModule,
        IntegrationsModule,

        // Device/agent modules
        WorkstationsModule,
        AgentsModule,
        DeviceCommandsModule,
        PrintingModule,
        ScanningModule,
        BuildingsModule,
        AmadeusModule,
        SectorsModule,
        AdGroupRoleMappingsModule,
    ],
})
export class AppModule { }
