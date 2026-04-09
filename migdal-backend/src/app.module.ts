import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
                        : undefined,
                level: process.env.LOG_LEVEL || 'info',
            },
        }),

        // Infrastructure
        ScheduleModule.forRoot(),
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
    ],
})
export class AppModule { }
