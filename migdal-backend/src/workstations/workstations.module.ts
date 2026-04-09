import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workstation } from './entities/workstation.entity';
import { UserWorkstationSession } from './entities/user-workstation-session.entity';
import { WorkstationUser } from './entities/workstation-user.entity';
import { WorkstationRole } from './entities/workstation-role.entity';
import { WorkstationEnrollmentToken } from './entities/workstation-enrollment-token.entity';
import { DeviceAgent } from '../agents/entities/device-agent.entity';
import { Role } from '../roles/entities/role.entity';
import { WorkstationSessionService } from './services/workstation-session.service';
import { WorkstationsService } from './services/workstations.service';
import { WorkstationsController } from './workstations.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Workstation,
            UserWorkstationSession,
            WorkstationUser,
            WorkstationRole,
            WorkstationEnrollmentToken,
            DeviceAgent,
            Role,
        ]),
    ],
    controllers: [WorkstationsController],
    providers: [WorkstationSessionService, WorkstationsService],
    exports: [WorkstationSessionService, WorkstationsService, TypeOrmModule],
})
export class WorkstationsModule { }
