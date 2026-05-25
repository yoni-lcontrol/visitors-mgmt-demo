import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Visit } from './visit.entity';

@Entity('VisitFiles')
export class VisitFile extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    visitId!: string;

    @ManyToOne(() => Visit, (v) => v.visitFiles, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'visitId' })
    visit!: Visit;

    @Column({ type: 'nvarchar', length: 500 })
    originalName!: string;

    @Column({ type: 'nvarchar', length: 500 })
    storedPath!: string;

    @Column({ type: 'nvarchar', length: 100 })
    mimeType!: string;

    @Column({ type: 'int' })
    size!: number;
}
