import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { Permission } from '../../permissions/entities/permission.entity';
import { Role } from '../../roles/entities/role.entity';
import { User } from '../../users/entities/user.entity';
import { AdGroupRoleMapping } from '../../ad-group-role-mappings/entities/ad-group-role-mapping.entity';
import { permissionsSeed } from './data/permissions.seed';
import { rolesSeed } from './data/roles.seed';
import { adGroupRoleMappingsSeed } from './data/ad-group-role-mappings.seed';
import { adminUserSeed } from './data/admin-user.seed';
import { smsTemplatesSeed } from './data/sms-templates.seed';
import { emailTemplatesSeed } from './data/email-templates.seed';
import { settingsSeed } from './data/settings.seed';
import { vehicleManufacturersSeed } from './data/vehicle-manufacturers.seed';
import { vehicleModelsSeed } from './data/vehicle-models.seed';
import { hashPassword } from '../../common/utils/hash.util';
import { SmsTemplate } from '../../settings/entities/sms-template.entity';
import { EmailTemplate } from '../../settings/entities/email-template.entity';
import { Setting } from '../../settings/entities/setting.entity';
import { VehicleManufacturer } from '../../settings/entities/vehicle-manufacturer.entity';
import { VehicleModel } from '../../settings/entities/vehicle-model.entity';

@Injectable()
export class SeedService implements OnModuleInit {
    private readonly logger = new Logger(SeedService.name);

    constructor(private readonly dataSource: DataSource) { }

    async onModuleInit(): Promise<void> {
        await this.seed();
    }

    private async seed(): Promise<void> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // 1. Seed permissions (upsert — add any new permissions from PermissionKey enum)
            const permRepo = queryRunner.manager.getRepository(Permission);
            const existingPerms = await permRepo.find();
            const existingKeys = new Set(existingPerms.map((p) => p.key));

            const newPerms = permissionsSeed.filter((p) => !existingKeys.has(p.key));
            if (newPerms.length > 0) {
                this.logger.log(`Seeding ${newPerms.length} new permission(s)...`);
                for (const p of newPerms) {
                    const perm = permRepo.create({
                        key: p.key,
                        name: p.name,
                        description: p.description,
                        module: p.module,
                        action: p.action,
                    });
                    await permRepo.save(perm);
                }
                this.logger.log(`Seeded ${newPerms.length} new permission(s)`);
            }

            // 2. Seed roles
            const roleRepo = queryRunner.manager.getRepository(Role);
            const existingRoles = await roleRepo.find();
            const existingRoleNames = new Set(existingRoles.map((role) => role.name));
            const missingRoles = rolesSeed.filter((role) => !existingRoleNames.has(role.name));
            const allPerms = await permRepo.find();

            if (missingRoles.length > 0) {
                this.logger.log(`Seeding ${missingRoles.length} missing role(s)...`);

                for (const r of missingRoles) {
                    const role = roleRepo.create({
                        name: r.name,
                        description: r.description,
                        isSystem: r.isSystem,
                    });
                    role.permissions = allPerms.filter((p) =>
                        r.permissions.includes(p.key as any),
                    );
                    await roleRepo.save(role);
                }
                this.logger.log(`Seeded ${missingRoles.length} role(s)`);
            }

            // Ensure existing seeded roles include required default permissions (additive only)
            for (const seededRole of rolesSeed) {
                if (!existingRoleNames.has(seededRole.name)) {
                    continue;
                }

                const role = await roleRepo.findOne({
                    where: { name: seededRole.name },
                    relations: ['permissions'],
                });

                if (!role) {
                    continue;
                }

                const existingKeys = new Set((role.permissions ?? []).map((permission) => permission.key));
                const seedKeys = new Set<string>(seededRole.permissions);
                const missingKeys = seededRole.permissions.filter((permissionKey) => !existingKeys.has(permissionKey));
                const extraKeys = [...existingKeys].filter((key) => !seedKeys.has(key));

                if (missingKeys.length === 0 && extraKeys.length === 0) {
                    continue;
                }

                const missingPermissions = allPerms.filter((permission) => missingKeys.includes(permission.key as any));
                const updatedPermissions = (role.permissions ?? []).filter((permission) => !extraKeys.includes(permission.key));
                role.permissions = [...updatedPermissions, ...missingPermissions];
                await roleRepo.save(role);

                if (missingKeys.length > 0) {
                    this.logger.log(`Updated role ${role.name}: added ${missingPermissions.length} permission(s)`);
                }
                if (extraKeys.length > 0) {
                    this.logger.log(`Updated role ${role.name}: removed ${extraKeys.length} permission(s) [${extraKeys.join(', ')}]`);
                }
            }

            // Always ensure the Admin role has ALL permissions
            const adminRole = await roleRepo.findOne({
                where: { name: 'Admin' },
                relations: ['permissions'],
            });
            if (adminRole) {
                const allPerms = await permRepo.find();
                if (adminRole.permissions.length !== allPerms.length) {
                    adminRole.permissions = allPerms;
                    await roleRepo.save(adminRole);
                    this.logger.log(`Updated Admin role: ${adminRole.permissions.length} → ${allPerms.length} permissions`);
                }
            }

            // 3. Seed AD group-role mappings (upsert by groupName in global scope)
            const adGroupRoleMappingRepo = queryRunner.manager.getRepository(AdGroupRoleMapping);
            const mappingTargetRoleNames = Array.from(
                new Set(adGroupRoleMappingsSeed.map((mapping) => mapping.roleName)),
            );
            const mappingTargetRoles = await roleRepo.find({
                where: mappingTargetRoleNames.map((name) => ({ name, isActive: true })),
            });
            const roleByName = new Map(mappingTargetRoles.map((role) => [role.name, role]));

            let mappingsCreated = 0;
            let mappingsUpdated = 0;
            let mappingsSkippedMissingRole = 0;

            for (const mappingSeed of adGroupRoleMappingsSeed) {
                const role = roleByName.get(mappingSeed.roleName);
                if (!role) {
                    mappingsSkippedMissingRole += 1;
                    this.logger.warn(
                        `Skipping AD group mapping for ${mappingSeed.groupName}: role \"${mappingSeed.roleName}\" was not found or inactive`,
                    );
                    continue;
                }

                const existingMapping = await adGroupRoleMappingRepo.findOne({
                    where: {
                        adSourceId: IsNull(),
                        groupName: mappingSeed.groupName,
                    },
                });

                if (!existingMapping) {
                    const createdMapping = adGroupRoleMappingRepo.create({
                        groupName: mappingSeed.groupName,
                        adSourceId: null,
                        roleId: role.id,
                        groupExternalId: null,
                        createdBy: null,
                        updatedBy: null,
                    });
                    await adGroupRoleMappingRepo.save(createdMapping);
                    mappingsCreated += 1;
                    continue;
                }

                if (existingMapping.roleId !== role.id) {
                    existingMapping.roleId = role.id;
                    existingMapping.updatedBy = null;
                    await adGroupRoleMappingRepo.save(existingMapping);
                    mappingsUpdated += 1;
                }
            }

            this.logger.log(
                `AD group-role mapping seed complete: created=${mappingsCreated}, updated=${mappingsUpdated}, skippedMissingRole=${mappingsSkippedMissingRole}`,
            );

            // 4. Seed admin user
            const userRepo = queryRunner.manager.getRepository(User);
            const adminExists = await userRepo.findOne({
                where: { username: adminUserSeed.username },
            });

            if (!adminExists) {
                this.logger.log('Seeding admin user...');
                const adminRole = await roleRepo.findOne({
                    where: { name: adminUserSeed.roleName },
                });

                const passwordHash = await hashPassword(adminUserSeed.password);
                const admin = userRepo.create({
                    username: adminUserSeed.username,
                    passwordHash,
                    firstName: adminUserSeed.firstName,
                    lastName: adminUserSeed.lastName,
                    phone: '0502221634',
                    email: 'sarit.b@lcontrol.com'
                });
                admin.roleId = adminRole?.id ?? null;
                await userRepo.save(admin);
                this.logger.log(
                    `Admin user created: ${adminUserSeed.username} / ${adminUserSeed.password}`,
                );
            }

            // 5. Seed SMS templates (upsert — add missing event+targetGroup templates)
            const smsRepo = queryRunner.manager.getRepository(SmsTemplate);
            const existingSmsTemplates = await smsRepo.find();
            const existingSmsKeys = new Set(existingSmsTemplates.map((t) => `${t.event}::${t.targetGroup}`));

            const newTemplates = smsTemplatesSeed.filter((t) => !existingSmsKeys.has(`${t.event}::${t.targetGroup}`));
            if (newTemplates.length > 0) {
                this.logger.log(`Seeding ${newTemplates.length} SMS template(s)...`);
                for (const t of newTemplates) {
                    const tpl = smsRepo.create({
                        event: t.event,
                        targetGroup: t.targetGroup,
                        template: t.template,
                    });
                    await smsRepo.save(tpl);
                }
                this.logger.log(`Seeded ${newTemplates.length} SMS template(s)`);
            }

            // 6. Seed email templates (upsert — add missing event+targetGroup templates)
            const emailRepo = queryRunner.manager.getRepository(EmailTemplate);
            const existingEmailTemplates = await emailRepo.find();
            const existingEmailKeys = new Set(existingEmailTemplates.map((t) => `${t.event}::${t.targetGroup}`));

            const newEmailTemplates = emailTemplatesSeed.filter((t) => !existingEmailKeys.has(`${t.event}::${t.targetGroup}`));
            if (newEmailTemplates.length > 0) {
                this.logger.log(`Seeding ${newEmailTemplates.length} email template(s)...`);
                for (const t of newEmailTemplates) {
                    const tpl = emailRepo.create({
                        event: t.event,
                        targetGroup: t.targetGroup,
                        subject: t.subject,
                        bodyHtml: t.bodyHtml,
                    });
                    await emailRepo.save(tpl);
                }
                this.logger.log(`Seeded ${newEmailTemplates.length} email template(s)`);
            }

            // 7. Seed default settings (upsert — add missing keys)
            const settingRepo = queryRunner.manager.getRepository(Setting);
            const existingSettings = await settingRepo.find();
            const existingSettingKeys = new Set(existingSettings.map((s) => s.key));

            const newSettings = settingsSeed.filter((s) => !existingSettingKeys.has(s.key));
            if (newSettings.length > 0) {
                this.logger.log(`Seeding ${newSettings.length} setting(s)...`);
                for (const s of newSettings) {
                    const setting = settingRepo.create(s);
                    await settingRepo.save(setting);
                }
                this.logger.log(`Seeded ${newSettings.length} setting(s)`);
            }

            // 8. Seed vehicle manufacturers (upsert by unique name)
            const vehicleManufacturerRepo = queryRunner.manager.getRepository(VehicleManufacturer);
            const existingManufacturers = await vehicleManufacturerRepo.find();
            const existingManufacturerNames = new Set(existingManufacturers.map((m) => m.name));
            const newManufacturers = vehicleManufacturersSeed.filter((name) => !existingManufacturerNames.has(name));

            if (newManufacturers.length > 0) {
                this.logger.log(`Seeding ${newManufacturers.length} vehicle manufacturer(s)...`);
                for (const name of newManufacturers) {
                    const manufacturer = vehicleManufacturerRepo.create({ name });
                    await vehicleManufacturerRepo.save(manufacturer);
                }
                this.logger.log(`Seeded ${newManufacturers.length} vehicle manufacturer(s)`);
            }

            // 9. Seed vehicle models (upsert by unique manufacturer+model)
            const vehicleModelRepo = queryRunner.manager.getRepository(VehicleModel);
            const existingModels = await vehicleModelRepo.find();
            const existingModelKeys = new Set(existingModels.map((m) => `${m.manufacturer}|${m.model}`));
            const newModels = vehicleModelsSeed.filter((m) => !existingModelKeys.has(`${m.manufacturer}|${m.model}`));
            if (newModels.length > 0) {
                this.logger.log(`Seeding ${newModels.length} vehicle model(s)...`);
                for (const m of newModels) {
                    const vehicleModel = vehicleModelRepo.create(m);
                    await vehicleModelRepo.save(vehicleModel);
                }
                this.logger.log(`Seeded ${newModels.length} vehicle model(s)`);
            }

            await queryRunner.commitTransaction();
            this.logger.log('Database seed complete');
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error('Seed failed, rolled back', error);
        } finally {
            await queryRunner.release();
        }
    }
}
