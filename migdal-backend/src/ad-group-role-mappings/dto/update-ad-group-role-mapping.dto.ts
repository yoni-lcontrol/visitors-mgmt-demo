import { PartialType } from '@nestjs/swagger';
import { CreateAdGroupRoleMappingDto } from './create-ad-group-role-mapping.dto';

export class UpdateAdGroupRoleMappingDto extends PartialType(CreateAdGroupRoleMappingDto) { }
