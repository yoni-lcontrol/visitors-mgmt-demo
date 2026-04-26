import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Visit } from './visit.entity';

@Entity('VisitEscorts')
export class VisitEscort extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    visitId!: string;

    @Column({ type: 'nvarchar', length: 200 })
    firstName!: string;

    @Column({ type: 'nvarchar', length: 200 })
    lastName!: string;

    @Column({ type: 'nvarchar', length: 50 })
    phone!: string;

    @Column({ type: 'nvarchar', length: 320 })
    email!: string;

    @Column({ type: 'nvarchar', length: 200, nullable: true })
    sector!: string | null;

    @ManyToOne(() => Visit, (v) => v.visitEscorts, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'visitId' })
    visit!: Visit;
}
