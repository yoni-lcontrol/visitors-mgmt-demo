import { ClassSerializerInterceptor } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { Door } from '../entities/door.entity';

describe('Door entity serialization', () => {
    it('should exclude externalId from serialized output', () => {
        const door = Object.assign(new Door(), {
            id: 'door-1',
            name: 'Front Door',
            externalId: 'ext-door-1',
            controllerId: 'ctrl-1',
            doorsIndex: 0,
            entryType: 1,
            isActive: true,
        });

        const plain = instanceToPlain(door);

        expect(plain.externalId).toBeUndefined();
        expect(plain.name).toBe('Front Door');
        expect(plain.id).toBe('door-1');
        expect(plain.controllerId).toBe('ctrl-1');
    });
});

describe('DoorController metadata', () => {
    it('should have ClassSerializerInterceptor applied', async () => {
        const { DoorController } = await import('./door.controller');
        const interceptors = Reflect.getMetadata('__interceptors__', DoorController);
        expect(interceptors).toContain(ClassSerializerInterceptor);
    });
});
