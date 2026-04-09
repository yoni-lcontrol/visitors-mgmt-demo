import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Permission } from '../../permissions/entities/permission.entity';
import { Role } from '../../roles/entities/role.entity';
import { User } from '../../users/entities/user.entity';
import { permissionsSeed } from './data/permissions.seed';
import { rolesSeed } from './data/roles.seed';
import { adminUserSeed } from './data/admin-user.seed';
import { smsTemplatesSeed } from './data/sms-templates.seed';
import { settingsSeed } from './data/settings.seed';
import { hashPassword } from '../../common/utils/hash.util';
import { SmsTemplate } from '../../settings/entities/sms-template.entity';
import { Setting } from '../../settings/entities/setting.entity';

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
            const existingRoleCount = await roleRepo.count();

            if (existingRoleCount === 0) {
                this.logger.log('Seeding roles...');
                const allPerms = await permRepo.find();

                for (const r of rolesSeed) {
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
                this.logger.log(`Seeded ${rolesSeed.length} roles`);
            } else {
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
            }

            // 3. Seed admin user
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
                });
                admin.roles = adminRole ? [adminRole] : [];
                await userRepo.save(admin);
                this.logger.log(
                    `Admin user created: ${adminUserSeed.username} / ${adminUserSeed.password}`,
                );
            }

            // 4. Seed SMS templates (upsert — add missing event+targetGroup templates)
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

            // 5. Seed default settings (upsert — add missing keys)
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
