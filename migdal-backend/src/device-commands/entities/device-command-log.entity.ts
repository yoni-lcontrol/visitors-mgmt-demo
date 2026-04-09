import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Workstation } from '../../workstations/entities/workstation.entity';
import { DeviceAgent } from '../../agents/entities/device-agent.entity';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';
import { DeviceCommandStatus } from '../enums/device-command-status.enum';

@Entity('DeviceCommandLogs')
@Index('IX_DeviceCommandLogs_CorrelationId', ['correlationId'])
@Index('IX_DeviceCommandLogs_RequestedBy', ['requestedByUserId'])
@Index('IX_DeviceCommandLogs_Status', ['status'])
export class DeviceCommandLog extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    requestedByUserId!: string;

    @Column({ type: 'uniqueidentifier' })
    workstationId!: string;

    @Column({ type: 'nvarchar', length: 50 })
    providerType!: IntegrationProvider;

    @Column({ type: 'nvarchar', length: 100 })
    commandType!: string;

    @Column({ type: 'uniqueidentifier', nullable: true })
    targetAgentId!: string | null;

    @Column({ type: 'nvarchar', length: 255 })
    correlationId!: string;

    @Column({ type: 'nvarchar', length: 50, default: `'${DeviceCommandStatus.Pending}'` })
    status!: DeviceCommandStatus;

    @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
    requestPayloadJson!: string | null;

    @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
    responsePayloadJson!: string | null;

    @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
    errorMessage!: string | null;

    @Column({ type: 'datetime2', nullable: true })
    completedAt!: Date | null;

    @ManyToOne(() => Workstation)
    @JoinColumn({ name: 'workstationId' })
    workstation!: Workstation;

    @ManyToOne(() => DeviceAgent, { nullable: true })
    @JoinColumn({ name: 'targetAgentId' })
    targetAgent!: DeviceAgent | null;
}
