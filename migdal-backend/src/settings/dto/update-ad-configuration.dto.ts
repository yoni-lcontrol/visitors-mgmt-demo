import { PartialType } from '@nestjs/swagger';
import { CreateAdConfigurationDto } from './create-ad-configuration.dto';

export class UpdateAdConfigurationDto extends PartialType(CreateAdConfigurationDto) { }
