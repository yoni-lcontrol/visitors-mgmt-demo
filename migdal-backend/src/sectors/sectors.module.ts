import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sector } from './entities/sector.entity';
import { SectorsService } from './sectors.service';

@Module({
    imports: [TypeOrmModule.forFeature([Sector])],
    providers: [SectorsService],
    exports: [SectorsService, TypeOrmModule],
})
export class SectorsModule { }
