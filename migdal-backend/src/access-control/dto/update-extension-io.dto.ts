import { PartialType } from '@nestjs/swagger';
import { CreateExtensionIoDto } from './create-extension-io.dto';

export class UpdateExtensionIoDto extends PartialType(CreateExtensionIoDto) { }
