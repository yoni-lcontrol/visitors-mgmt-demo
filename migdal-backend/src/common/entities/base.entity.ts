import {
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Column,
} from 'typeorm';

export abstract class BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @CreateDateColumn({ type: 'datetime2' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'datetime2' })
    updatedAt!: Date;

    @Column({ type: 'uniqueidentifier', nullable: true })
    createdBy!: string | null;

    @Column({ type: 'uniqueidentifier', nullable: true })
    updatedBy!: string | null;

    @Column({ type: 'bit', default: true })
    isActive!: boolean;
}
