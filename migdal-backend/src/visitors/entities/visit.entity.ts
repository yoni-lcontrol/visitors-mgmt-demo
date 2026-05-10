import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { VisitVisitor } from './visit-visitor.entity';
import { VisitEscort } from './visit-escort.entity';
import { Building } from '../../buildings/entities/building.entity';
import { User } from '../../users/entities/user.entity';
import { Sector } from '../../sectors/entities/sector.entity';

@Entity('Visits')
export class Visit extends BaseEntity {
    @Column({ type: 'nvarchar', length: 100, nullable: true })
    siteId!: string | null;

    @Column({ type: 'uniqueidentifier', nullable: true })
    sectorId!: string | null;

    @ManyToOne(() => Sector, { nullable: true, onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'sectorId' })
    sector!: Sector | null;

    @Column({ type: 'uniqueidentifier', nullable: true })
    buildingId!: string | null;

    @ManyToOne(() => Building, { onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'buildingId' })
    building!: Building;

    @Column({ type: 'int', nullable: true })
    floor!: number | null;

    @Column({ type: 'nvarchar', length: 300 })
    title!: string;

    @Column({ type: 'nvarchar', length: 2000, nullable: true })
    purposeOfVisit!: string | null;

    @Column({ type: 'datetime2' })
    plannedStartTimeUtc!: Date;

    @Column({ type: 'datetime2', nullable: true })
    plannedEndTimeUtc!: Date | null;

    @Column({ type: 'uniqueidentifier', nullable: true })
    createdByUserId!: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'createdByUserId' })
    createdByUser!: User | null;

    // Visit Requester
    @Column({ type: 'uniqueidentifier', nullable: true })
    visitRequesterUserId!: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'visitRequesterUserId' })
    visitRequesterUser!: User | null;

    @Column({ type: 'nvarchar', length: 200, nullable: true })
    visitRequesterFirstName!: string | null;

    @Column({ type: 'nvarchar', length: 200, nullable: true })
    visitRequesterLastName!: string | null;

    @Column({ type: 'nvarchar', length: 50, nullable: true })
    visitRequesterPhone!: string | null;

    @Column({ type: 'nvarchar', length: 320, nullable: true })
    visitRequesterEmail!: string | null;

    @OneToMany(() => VisitVisitor, (vv) => vv.visit)
    visitVisitors!: VisitVisitor[];

    @OneToMany(() => VisitEscort, (ve) => ve.visit)
    visitEscorts!: VisitEscort[];
}
