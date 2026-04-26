import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdGroupRoleMapping } from './entities/ad-group-role-mapping.entity';
import { Role } from '../roles/entities/role.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { AdGroupRoleMappingsController } from './ad-group-role-mappings.controller';
import { AdGroupRoleMappingsService } from './ad-group-role-mappings.service';

@Module({
    imports: [TypeOrmModule.forFeature([AdGroupRoleMapping, Role, AdConfiguration])],
    controllers: [AdGroupRoleMappingsController],
    providers: [AdGroupRoleMappingsService],
    exports: [AdGroupRoleMappingsService],
})
export class AdGroupRoleMappingsModule { }
