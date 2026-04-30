import { ClassSerializerInterceptor } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { AcController } from '../entities/ac-controller.entity';
import { Door } from '../entities/door.entity';

describe('AcController entity serialization', () => {
    it('should exclude externalId from serialized output', () => {
        const ctrl = Object.assign(new AcController(), {
            id: 'ctrl-1',
            name: 'Main Controller',
            externalId: 'ext-123',
            type: 1,
            ip: '10.0.0.1',
            port: 3000,
            model: 'AC2000',
            isActive: true,
        });

        const plain = instanceToPlain(ctrl);

        expect(plain.externalId).toBeUndefined();
        expect(plain.name).toBe('Main Controller');
        expect(plain.id).toBe('ctrl-1');
    });

    it('should exclude externalId from nested doors when serializing controller', () => {
        const door = Object.assign(new Door(), {
            id: 'door-1',
            name: 'Front Door',
            externalId: 'ext-door-1',
            controllerId: 'ctrl-1',
            doorsIndex: 0,
            entryType: 0,
        });

        const ctrl = Object.assign(new AcController(), {
            id: 'ctrl-1',
            name: 'Main Controller',
            externalId: 'ext-123',
            doors: [door],
            extensions: [],
        });

        const plain = instanceToPlain(ctrl);

        expect(plain.externalId).toBeUndefined();
        expect(plain.doors[0].externalId).toBeUndefined();
        expect(plain.doors[0].name).toBe('Front Door');
    });
});

describe('AcControllerController metadata', () => {
    it('should have ClassSerializerInterceptor applied', async () => {
        const { AcControllerController } = await import('./ac-controller.controller');
        const interceptors = Reflect.getMetadata('__interceptors__', AcControllerController);
        expect(interceptors).toContain(ClassSerializerInterceptor);
    });
});
