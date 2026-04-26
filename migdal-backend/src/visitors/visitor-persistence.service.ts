import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Visitor } from './entities/visitor.entity';

export interface VisitorSnapshotInput {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone: string;
    personId: string;
    carNumber?: string | null;
    vehicleType?: string | null;
}

export interface VisitorUpsertResult {
    visitor: Visitor;
    action: 'created' | 'updated';
}

@Injectable()
export class VisitorPersistenceService {
    constructor(
        @InjectRepository(Visitor)
        private readonly visitorRepo: Repository<Visitor>,
    ) { }

    normalizePersonId(personId: string): string {
        return personId.trim();
    }

    async findByPersonId(personId: string, manager?: EntityManager): Promise<Visitor | null> {
        const normalizedPersonId = this.normalizePersonId(personId);
        if (!normalizedPersonId) {
            return null;
        }

        return this.getRepository(manager).findOne({
            where: { personId: normalizedPersonId },
        });
    }

    async upsertByPersonId(
        input: VisitorSnapshotInput,
        currentUserId?: string,
        manager?: EntityManager,
    ): Promise<VisitorUpsertResult> {
        const repo = this.getRepository(manager);
        const snapshot = this.normalizeSnapshot(input);
        const existing = await repo.findOne({
            where: { personId: snapshot.personId },
        });

        if (existing) {
            Object.assign(existing, snapshot, {
                isActive: true,
                updatedBy: currentUserId ?? null,
            });

            return {
                visitor: await repo.save(existing),
                action: 'updated',
            };
        }

        const created = repo.create({
            ...snapshot,
            isActive: true,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });

        return {
            visitor: await repo.save(created),
            action: 'created',
        };
    }

    private getRepository(manager?: EntityManager): Repository<Visitor> {
        return manager ? manager.getRepository(Visitor) : this.visitorRepo;
    }

    private normalizeSnapshot(input: VisitorSnapshotInput): VisitorSnapshotInput {
        return {
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            email: this.toNullable(input.email),
            phone: input.phone.trim(),
            personId: this.normalizePersonId(input.personId),
            carNumber: this.toNullable(input.carNumber),
            vehicleType: this.toNullable(input.vehicleType),
        };
    }

    private toNullable(value?: string | null): string | null {
        if (value === undefined || value === null) {
            return null;
        }

        const trimmed = value.trim();
        return trimmed ? trimmed : null;
    }
}