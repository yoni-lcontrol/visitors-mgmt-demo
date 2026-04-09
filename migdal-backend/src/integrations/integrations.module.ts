import { Module } from '@nestjs/common';
import { IntegrationsCommonModule } from './common/integrations-common.module';
import { AccessControlIntegrationModule } from './access-control/access-control-integration.module';
import { ScannerIntegrationModule } from './scanner/scanner-integration.module';
import { PrinterIntegrationModule } from './printer/printer-integration.module';

@Module({
    imports: [
        IntegrationsCommonModule,
        AccessControlIntegrationModule,
        ScannerIntegrationModule,
        PrinterIntegrationModule,
    ],
    exports: [
        IntegrationsCommonModule,
    ],
})
export class IntegrationsModule { }
