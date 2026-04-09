import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalEventLog } from './entities/external-event-log.entity';
import { IntegrationAuthService } from './services/integration-auth.service';
import { IntegrationHmacGuard } from './guards/integration-hmac.guard';
import { InboundEventLogService } from './services/inbound-event-log.service';

@Module({
    imports: [TypeOrmModule.forFeature([ExternalEventLog])],
    providers: [IntegrationAuthService, IntegrationHmacGuard, InboundEventLogService],
    exports: [IntegrationAuthService, IntegrationHmacGuard, InboundEventLogService],
})
export class IntegrationsCommonModule { }
