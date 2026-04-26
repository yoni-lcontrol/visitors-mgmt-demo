import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Building } from './entities/building.entity';
import { AccessLevel } from '../access-control/entities/access-level.entity';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Building, AccessLevel]),
    ],
    controllers: [BuildingsController],
    providers: [BuildingsService],
    exports: [BuildingsService],
})
export class BuildingsModule { }
