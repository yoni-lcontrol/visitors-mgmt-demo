import { DataSource } from 'typeorm';
import { SeedService } from './seed.service';
import { Role } from '../../roles/entities/role.entity';
import { Permission } from '../../permissions/entities/permission.entity';
import { User } from '../../users/entities/user.entity';
import { SmsTemplate } from '../../settings/entities/sms-template.entity';
import { EmailTemplate } from '../../settings/entities/email-template.entity';
import { Setting } from '../../settings/entities/setting.entity';
import { VehicleManufacturer } from '../../settings/entities/vehicle-manufacturer.entity';
import { AdGroupRoleMapping } from '../../ad-group-role-mappings/entities/ad-group-role-mapping.entity';

describe('SeedService', () => {
    function createRepositoryMock() {
        return {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((value) => value),
            save: jest.fn().mockImplementation(async (value) => value),
        };
    }

    it('should seed missing roles even when roles already exist', async () => {
        const permissionRepo = createRepositoryMock();
        permissionRepo.find.mockResolvedValue([
            { key: 'users.read' },
            { key: 'visits.create' },
            { key: 'visits.read' },
            { key: 'visits.update' },
            { key: 'visits.delete' },
            { key: 'parking.request' },
            { key: 'parking.approve' },
            { key: 'access-control.import' },
        ]);

        const roleRepo = createRepositoryMock();
        roleRepo.find.mockResolvedValue([{ name: 'Admin' }]);
        roleRepo.findOne.mockResolvedValue({
            id: 'admin-role',
            name: 'Admin',
            permissions: [{ key: 'users.read' }],
        });

        const userRepo = createRepositoryMock();
        userRepo.findOne.mockResolvedValue({ id: 'admin-user', username: 'admin' });

        const smsTemplateRepo = createRepositoryMock();
        const emailTemplateRepo = createRepositoryMock();
        const settingRepo = createRepositoryMock();
        const vehicleManufacturerRepo = createRepositoryMock();
        const adGroupRoleMappingRepo = createRepositoryMock();

        const repositories = new Map<any, ReturnType<typeof createRepositoryMock>>([
            [Permission, permissionRepo],
            [Role, roleRepo],
            [User, userRepo],
            [SmsTemplate, smsTemplateRepo],
            [EmailTemplate, emailTemplateRepo],
            [Setting, settingRepo],
            [VehicleManufacturer, vehicleManufacturerRepo],
            [AdGroupRoleMapping, adGroupRoleMappingRepo],
        ]);

        const queryRunner = {
            connect: jest.fn(),
            startTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(),
            release: jest.fn(),
            manager: {
                getRepository: jest.fn((entity) => repositories.get(entity)),
            },
        };

        const dataSource = {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
        } as unknown as DataSource;

        const service = new SeedService(dataSource);

        await service.onModuleInit();

        const createdRoleNames = roleRepo.create.mock.calls.map(([value]) => value.name);
        expect(createdRoleNames).toEqual(expect.arrayContaining([
            'Operator',
            'Viewer',
            'עובד מגדל',
            'מנהלים בכירים ומזכירות',
            'מרכז הדרכות',
            'מוקד ביטחון',
            'דלפקים',
            'קב"ט',
        ]));
        expect(createdRoleNames).not.toContain('Admin');

        const createdRoles = roleRepo.save.mock.calls.map(([value]) => value);
        const managersRole = createdRoles.find((role) => role.name === 'מנהלים בכירים ומזכירות');
        const securityDeskRole = createdRoles.find((role) => role.name === 'מוקד ביטחון');
        const kabatRole = createdRoles.find((role) => role.name === 'קב"ט');

        expect(managersRole?.permissions.map((permission: { key: string }) => permission.key)).toEqual(expect.arrayContaining([
            'visits.create',
            'visits.read',
            'visits.update',
            'visits.delete',
            'parking.request',
            'access-control.import',
        ]));
        expect(managersRole?.permissions.map((permission: { key: string }) => permission.key)).not.toContain('parking.approve');
        expect(securityDeskRole?.permissions.map((permission: { key: string }) => permission.key)).toEqual(expect.arrayContaining([
            'visits.create',
            'visits.read',
            'visits.update',
            'visits.delete',
            'parking.request',
            'parking.approve',
            'access-control.import',
        ]));
        expect(kabatRole?.permissions.map((permission: { key: string }) => permission.key)).toEqual(expect.arrayContaining([
            'visits.create',
            'visits.read',
            'visits.update',
            'visits.delete',
            'parking.approve',
            'access-control.import',
        ]));
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should add missing default permissions to existing managers role', async () => {
        const permissionRepo = createRepositoryMock();
        permissionRepo.find.mockResolvedValue([
            { key: 'visits.create' },
            { key: 'visits.read' },
            { key: 'visits.update' },
            { key: 'visits.delete' },
            { key: 'parking.request' },
            { key: 'access-control.import' },
        ]);

        const roleRepo = createRepositoryMock();
        roleRepo.find.mockResolvedValue([
            { name: 'Admin' },
            { name: 'מנהלים בכירים ומזכירות' },
        ]);
        roleRepo.findOne.mockImplementation(async ({ where }: any) => {
            if (where?.name === 'מנהלים בכירים ומזכירות') {
                return {
                    id: 'mgr-role',
                    name: 'מנהלים בכירים ומזכירות',
                    permissions: [{ key: 'visits.read' }],
                };
            }

            if (where?.name === 'Admin') {
                return {
                    id: 'admin-role',
                    name: 'Admin',
                    permissions: [{ key: 'visits.read' }],
                };
            }

            return null;
        });

        const userRepo = createRepositoryMock();
        userRepo.findOne.mockResolvedValue({ id: 'admin-user', username: 'admin' });

        const smsTemplateRepo = createRepositoryMock();
        const emailTemplateRepo = createRepositoryMock();
        const settingRepo = createRepositoryMock();
        const vehicleManufacturerRepo = createRepositoryMock();
        const adGroupRoleMappingRepo = createRepositoryMock();

        const repositories = new Map<any, ReturnType<typeof createRepositoryMock>>([
            [Permission, permissionRepo],
            [Role, roleRepo],
            [User, userRepo],
            [SmsTemplate, smsTemplateRepo],
            [EmailTemplate, emailTemplateRepo],
            [Setting, settingRepo],
            [VehicleManufacturer, vehicleManufacturerRepo],
            [AdGroupRoleMapping, adGroupRoleMappingRepo],
        ]);

        const queryRunner = {
            connect: jest.fn(),
            startTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(),
            release: jest.fn(),
            manager: {
                getRepository: jest.fn((entity) => repositories.get(entity)),
            },
        };

        const dataSource = {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
        } as unknown as DataSource;

        const service = new SeedService(dataSource);
        await service.onModuleInit();

        const updatedManagersCall = roleRepo.save.mock.calls.find(([value]) => value.name === 'מנהלים בכירים ומזכירות');
        expect(updatedManagersCall).toBeDefined();
        const updatedManagersRole = updatedManagersCall?.[0];
        expect(updatedManagersRole.permissions.map((permission: { key: string }) => permission.key)).toEqual(expect.arrayContaining([
            'visits.create',
            'visits.read',
            'visits.update',
            'visits.delete',
            'parking.request',
            'access-control.import',
        ]));
    });

    it('should add missing default permissions to existing security desk role', async () => {
        const permissionRepo = createRepositoryMock();
        permissionRepo.find.mockResolvedValue([
            { key: 'visits.create' },
            { key: 'visits.read' },
            { key: 'visits.update' },
            { key: 'visits.delete' },
            { key: 'parking.request' },
            { key: 'parking.approve' },
            { key: 'access-control.import' },
        ]);

        const roleRepo = createRepositoryMock();
        roleRepo.find.mockResolvedValue([
            { name: 'Admin' },
            { name: 'מוקד ביטחון' },
        ]);
        roleRepo.findOne.mockImplementation(async ({ where }: any) => {
            if (where?.name === 'מוקד ביטחון') {
                return {
                    id: 'security-role',
                    name: 'מוקד ביטחון',
                    permissions: [{ key: 'visits.read' }],
                };
            }

            if (where?.name === 'Admin') {
                return {
                    id: 'admin-role',
                    name: 'Admin',
                    permissions: [{ key: 'visits.read' }],
                };
            }

            return null;
        });

        const userRepo = createRepositoryMock();
        userRepo.findOne.mockResolvedValue({ id: 'admin-user', username: 'admin' });

        const smsTemplateRepo = createRepositoryMock();
        const emailTemplateRepo = createRepositoryMock();
        const settingRepo = createRepositoryMock();
        const vehicleManufacturerRepo = createRepositoryMock();
        const adGroupRoleMappingRepo = createRepositoryMock();

        const repositories = new Map<any, ReturnType<typeof createRepositoryMock>>([
            [Permission, permissionRepo],
            [Role, roleRepo],
            [User, userRepo],
            [SmsTemplate, smsTemplateRepo],
            [EmailTemplate, emailTemplateRepo],
            [Setting, settingRepo],
            [VehicleManufacturer, vehicleManufacturerRepo],
            [AdGroupRoleMapping, adGroupRoleMappingRepo],
        ]);

        const queryRunner = {
            connect: jest.fn(),
            startTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(),
            release: jest.fn(),
            manager: {
                getRepository: jest.fn((entity) => repositories.get(entity)),
            },
        };

        const dataSource = {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
        } as unknown as DataSource;

        const service = new SeedService(dataSource);
        await service.onModuleInit();

        const updatedSecurityDeskCall = roleRepo.save.mock.calls.find(([value]) => value.name === 'מוקד ביטחון');
        expect(updatedSecurityDeskCall).toBeDefined();
        const updatedSecurityDeskRole = updatedSecurityDeskCall?.[0];
        expect(updatedSecurityDeskRole.permissions.map((permission: { key: string }) => permission.key)).toEqual(expect.arrayContaining([
            'visits.create',
            'visits.read',
            'visits.update',
            'visits.delete',
            'parking.request',
            'parking.approve',
            'access-control.import',
        ]));
    });

    it('should upsert AD group-role mappings by groupName', async () => {
        const permissionRepo = createRepositoryMock();

        const roleRepo = createRepositoryMock();
        roleRepo.find
            .mockResolvedValueOnce([
                { name: 'Admin' },
                { name: 'עובד מגדל' },
                { name: 'מנהלים בכירים ומזכירות' },
                { name: 'מרכז הדרכות' },
                { name: 'מוקד ביטחון' },
                { name: 'דלפקים' },
                { name: 'קב"ט' },
            ])
            .mockResolvedValueOnce([
                { id: 'role-users', name: 'עובד מגדל', isActive: true },
                { id: 'role-managers', name: 'מנהלים בכירים ומזכירות', isActive: true },
                { id: 'role-training', name: 'מרכז הדרכות', isActive: true },
                { id: 'role-security-center', name: 'מוקד ביטחון', isActive: true },
                { id: 'role-desk', name: 'דלפקים', isActive: true },
                { id: 'role-kabat', name: 'קב"ט', isActive: true },
            ]);
        roleRepo.findOne.mockResolvedValue({
            id: 'admin-role',
            name: 'Admin',
            permissions: [],
        });

        const userRepo = createRepositoryMock();
        userRepo.findOne.mockResolvedValue({ id: 'admin-user', username: 'admin' });

        const smsTemplateRepo = createRepositoryMock();
        const emailTemplateRepo = createRepositoryMock();
        const settingRepo = createRepositoryMock();
        const vehicleManufacturerRepo = createRepositoryMock();
        const adGroupRoleMappingRepo = createRepositoryMock();
        adGroupRoleMappingRepo.findOne.mockImplementation(async ({ where }: any) => {
            if (where?.groupName === 'Sniper_Kabat') {
                return {
                    id: 10,
                    groupName: 'Sniper_Kabat',
                    adSourceId: null,
                    roleId: 'legacy-role-id',
                };
            }

            return null;
        });

        const repositories = new Map<any, ReturnType<typeof createRepositoryMock>>([
            [Permission, permissionRepo],
            [Role, roleRepo],
            [User, userRepo],
            [SmsTemplate, smsTemplateRepo],
            [EmailTemplate, emailTemplateRepo],
            [Setting, settingRepo],
            [VehicleManufacturer, vehicleManufacturerRepo],
            [AdGroupRoleMapping, adGroupRoleMappingRepo],
        ]);

        const queryRunner = {
            connect: jest.fn(),
            startTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(),
            release: jest.fn(),
            manager: {
                getRepository: jest.fn((entity) => repositories.get(entity)),
            },
        };

        const dataSource = {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
        } as unknown as DataSource;

        const service = new SeedService(dataSource);
        await service.onModuleInit();

        const createdGroupNames = adGroupRoleMappingRepo.create.mock.calls.map(([value]) => value.groupName);
        expect(createdGroupNames).toEqual(expect.arrayContaining([
            'Sniper_useres',
            'Sniper_Mangers',
            'Sniper_merkaz_Hadrachot',
            'Sniper_Moked_bitachon',
            'Sniper_Dalpak_Bitachon',
        ]));
        expect(createdGroupNames).not.toContain('Sniper_Kabat');

        const savedMappings = adGroupRoleMappingRepo.save.mock.calls.map(([value]) => value);
        const updatedKabatMapping = savedMappings.find((mapping) => mapping.groupName === 'Sniper_Kabat');
        expect(updatedKabatMapping).toBeDefined();
        expect(updatedKabatMapping.roleId).toBe('role-kabat');
    });

    it('should skip AD group mappings when target role is missing', async () => {
        const permissionRepo = createRepositoryMock();

        const roleRepo = createRepositoryMock();
        roleRepo.find
            .mockResolvedValueOnce([
                { name: 'Admin' },
                { name: 'עובד מגדל' },
            ])
            .mockResolvedValueOnce([
                { id: 'role-users', name: 'עובד מגדל', isActive: true },
            ]);
        roleRepo.findOne.mockResolvedValue({
            id: 'admin-role',
            name: 'Admin',
            permissions: [],
        });

        const userRepo = createRepositoryMock();
        userRepo.findOne.mockResolvedValue({ id: 'admin-user', username: 'admin' });

        const smsTemplateRepo = createRepositoryMock();
        const emailTemplateRepo = createRepositoryMock();
        const settingRepo = createRepositoryMock();
        const vehicleManufacturerRepo = createRepositoryMock();
        const adGroupRoleMappingRepo = createRepositoryMock();

        const repositories = new Map<any, ReturnType<typeof createRepositoryMock>>([
            [Permission, permissionRepo],
            [Role, roleRepo],
            [User, userRepo],
            [SmsTemplate, smsTemplateRepo],
            [EmailTemplate, emailTemplateRepo],
            [Setting, settingRepo],
            [VehicleManufacturer, vehicleManufacturerRepo],
            [AdGroupRoleMapping, adGroupRoleMappingRepo],
        ]);

        const queryRunner = {
            connect: jest.fn(),
            startTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(),
            release: jest.fn(),
            manager: {
                getRepository: jest.fn((entity) => repositories.get(entity)),
            },
        };

        const dataSource = {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
        } as unknown as DataSource;

        const service = new SeedService(dataSource);
        await service.onModuleInit();

        const createdGroupNames = adGroupRoleMappingRepo.create.mock.calls.map(([value]) => value.groupName);
        expect(createdGroupNames).toEqual(['Sniper_useres']);
        expect(adGroupRoleMappingRepo.save).toHaveBeenCalledTimes(1);
    });
});