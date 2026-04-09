import { Module } from '@nestjs/common';
import { ScanningService } from './services/scanning.service';
import { DeviceCommandsModule } from '../device-commands/device-commands.module';

@Module({
    imports: [DeviceCommandsModule],
    providers: [ScanningService],
    exports: [ScanningService],
})
export class ScanningModule { }
