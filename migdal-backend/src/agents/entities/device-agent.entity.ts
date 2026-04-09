import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Workstation } from '../../workstations/entities/workstation.entity';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';

@Entity('DeviceAgents')
@Index('IX_DeviceAgents_Workstation_Provider', ['workstationId', 'providerType'])
export class DeviceAgent extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    workstationId!: string;

    @Column({ type: 'nvarchar', length: 50 })
    providerType!: IntegrationProvider;

    @Index('IX_DeviceAgents_ClientId', { unique: true })
    @Column({ type: 'nvarchar', length: 255 })
    clientId!: string;

    @Column({ type: 'nvarchar', length: 512, nullable: true })
    clientSecret!: string | null;

    @Column({ type: 'nvarchar', length: 100, nullable: true })
    secretVersion!: string | null;

    @Column({ type: 'nvarchar', length: 100, nullable: true })
    version!: string | null;

    @Column({ type: 'bit', default: true })
    isEnabled!: boolean;

    // ── Live connection state ──

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    socketId!: string | null;

    @Column({ type: 'bit', default: false })
    isConnected!: boolean;

    @Column({ type: 'bit', nullable: true })
    deviceConnected!: boolean | null;

    @Column({ type: 'datetime2', nullable: true })
    connectedAt!: Date | null;

    @Column({ type: 'datetime2', nullable: true })
    lastSeenAt!: Date | null;

    @Column({ type: 'datetime2', nullable: true })
    disconnectedAt!: Date | null;

    @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
    capabilitiesJson!: string | null;

    @ManyToOne(() => Workstation)
    @JoinColumn({ name: 'workstationId' })
    workstation!: Workstation;
}
