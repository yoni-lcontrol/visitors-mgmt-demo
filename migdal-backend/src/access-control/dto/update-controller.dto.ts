import { PartialType } from '@nestjs/swagger';
import { CreateControllerDto } from './create-controller.dto';

export class UpdateControllerDto extends PartialType(CreateControllerDto) { }
