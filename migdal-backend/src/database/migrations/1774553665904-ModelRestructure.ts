import { MigrationInterface, QueryRunner } from "typeorm";

export class ModelRestructure1774553665904 implements MigrationInterface {
    name = 'ModelRestructure1774553665904'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "DoorIOs" DROP COLUMN "ioNumber"`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" DROP COLUMN "ioType"`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" DROP CONSTRAINT "DF_502a4f2eb91aa9595fae40c6eaf"`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "Doors" DROP COLUMN "doorNumber"`);
        await queryRunner.query(`ALTER TABLE "Doors" DROP CONSTRAINT "DF_f9549b4309d6d80f285b2d7298b"`);
        await queryRunner.query(`ALTER TABLE "Doors" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" DROP COLUMN "ipAddress"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" DROP CONSTRAINT "UQ_69ba0da7725dedc478f570022f0"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" DROP COLUMN "serialNumber"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" DROP CONSTRAINT "DF_75236c78ca4296a617648dbcc9c"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" DROP COLUMN "location"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" DROP COLUMN "firmware"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" DROP COLUMN "lastSyncAt"`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" DROP COLUMN "ioNumber"`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" DROP COLUMN "ioType"`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" DROP CONSTRAINT "DF_3b75cf7e1c534cc3d824703e0ef"`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "Extensions" DROP COLUMN "extensionNumber"`);
        await queryRunner.query(`ALTER TABLE "Extensions" DROP COLUMN "model"`);
        await queryRunner.query(`ALTER TABLE "Extensions" DROP CONSTRAINT "DF_ab006aab18886a1b00d85652ec5"`);
        await queryRunner.query(`ALTER TABLE "Extensions" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" ADD "type" int NOT NULL CONSTRAINT "DF_dee62f5f56d8d62e1f9be6502e9" DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" ADD "ioIndex" int NOT NULL CONSTRAINT "DF_a093f59f78f419921519db02ea0" DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" ADD "ioState" int NOT NULL CONSTRAINT "DF_3acf7429a0cb338a26d1f5f8e96" DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" ADD "externalId" nvarchar(200)`);
        await queryRunner.query(`ALTER TABLE "Doors" ADD "doorsIndex" int NOT NULL CONSTRAINT "DF_30321fa8ea545a03e5909ba5d37" DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "Doors" ADD "entryType" int NOT NULL CONSTRAINT "DF_648955bd580b007131c6870a901" DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "Doors" ADD "externalId" nvarchar(200)`);
        await queryRunner.query(`ALTER TABLE "Doors" ADD "stationId" uniqueidentifier`);
        await queryRunner.query(`ALTER TABLE "AcControllers" ADD "type" int NOT NULL CONSTRAINT "DF_9cdf29237d76dc0065a51e4f8e1" DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "AcControllers" ADD "ip" nvarchar(45)`);
        await queryRunner.query(`ALTER TABLE "AcControllers" ADD "port" int NOT NULL CONSTRAINT "DF_1105ecfa1e69f643ce81a45adf7" DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "AcControllers" ADD "externalId" nvarchar(200)`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" ADD "type" int NOT NULL CONSTRAINT "DF_22ac3a15f1374c58d267609958f" DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" ADD "ioIndex" int NOT NULL CONSTRAINT "DF_bc93401073dfeda9b89cc3061ca" DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" ADD "ioState" int NOT NULL CONSTRAINT "DF_f1836d5be7ead1229ea6ecb4fae" DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" ADD "externalId" nvarchar(200)`);
        await queryRunner.query(`ALTER TABLE "Extensions" ADD "type" int NOT NULL CONSTRAINT "DF_fc876ebc3050f89b672f3a75ad0" DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "Extensions" ADD "extensionIndex" int NOT NULL CONSTRAINT "DF_9adf46a5670920de2ad8a801180" DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "Extensions" ADD "externalId" nvarchar(200)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Extensions" DROP COLUMN "externalId"`);
        await queryRunner.query(`ALTER TABLE "Extensions" DROP CONSTRAINT "DF_9adf46a5670920de2ad8a801180"`);
        await queryRunner.query(`ALTER TABLE "Extensions" DROP COLUMN "extensionIndex"`);
        await queryRunner.query(`ALTER TABLE "Extensions" DROP CONSTRAINT "DF_fc876ebc3050f89b672f3a75ad0"`);
        await queryRunner.query(`ALTER TABLE "Extensions" DROP COLUMN "type"`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" DROP COLUMN "externalId"`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" DROP CONSTRAINT "DF_f1836d5be7ead1229ea6ecb4fae"`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" DROP COLUMN "ioState"`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" DROP CONSTRAINT "DF_bc93401073dfeda9b89cc3061ca"`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" DROP COLUMN "ioIndex"`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" DROP CONSTRAINT "DF_22ac3a15f1374c58d267609958f"`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" DROP COLUMN "type"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" DROP COLUMN "externalId"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" DROP CONSTRAINT "DF_1105ecfa1e69f643ce81a45adf7"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" DROP COLUMN "port"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" DROP COLUMN "ip"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" DROP CONSTRAINT "DF_9cdf29237d76dc0065a51e4f8e1"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" DROP COLUMN "type"`);
        await queryRunner.query(`ALTER TABLE "Doors" DROP COLUMN "stationId"`);
        await queryRunner.query(`ALTER TABLE "Doors" DROP COLUMN "externalId"`);
        await queryRunner.query(`ALTER TABLE "Doors" DROP CONSTRAINT "DF_648955bd580b007131c6870a901"`);
        await queryRunner.query(`ALTER TABLE "Doors" DROP COLUMN "entryType"`);
        await queryRunner.query(`ALTER TABLE "Doors" DROP CONSTRAINT "DF_30321fa8ea545a03e5909ba5d37"`);
        await queryRunner.query(`ALTER TABLE "Doors" DROP COLUMN "doorsIndex"`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" DROP COLUMN "externalId"`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" DROP CONSTRAINT "DF_3acf7429a0cb338a26d1f5f8e96"`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" DROP COLUMN "ioState"`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" DROP CONSTRAINT "DF_a093f59f78f419921519db02ea0"`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" DROP COLUMN "ioIndex"`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" DROP CONSTRAINT "DF_dee62f5f56d8d62e1f9be6502e9"`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" DROP COLUMN "type"`);
        await queryRunner.query(`ALTER TABLE "Extensions" ADD "status" nvarchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "Extensions" ADD CONSTRAINT "DF_ab006aab18886a1b00d85652ec5" DEFAULT 'unknown' FOR "status"`);
        await queryRunner.query(`ALTER TABLE "Extensions" ADD "model" nvarchar(100)`);
        await queryRunner.query(`ALTER TABLE "Extensions" ADD "extensionNumber" int NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" ADD "status" nvarchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" ADD CONSTRAINT "DF_3b75cf7e1c534cc3d824703e0ef" DEFAULT 'unknown' FOR "status"`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" ADD "ioType" nvarchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ExtensionIOs" ADD "ioNumber" int NOT NULL`);
        await queryRunner.query(`ALTER TABLE "AcControllers" ADD "lastSyncAt" datetime2`);
        await queryRunner.query(`ALTER TABLE "AcControllers" ADD "firmware" nvarchar(50)`);
        await queryRunner.query(`ALTER TABLE "AcControllers" ADD "location" nvarchar(200)`);
        await queryRunner.query(`ALTER TABLE "AcControllers" ADD "status" nvarchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "AcControllers" ADD CONSTRAINT "DF_75236c78ca4296a617648dbcc9c" DEFAULT 'offline' FOR "status"`);
        await queryRunner.query(`ALTER TABLE "AcControllers" ADD "serialNumber" nvarchar(100)`);
        await queryRunner.query(`ALTER TABLE "AcControllers" ADD CONSTRAINT "UQ_69ba0da7725dedc478f570022f0" UNIQUE ("serialNumber")`);
        await queryRunner.query(`ALTER TABLE "AcControllers" ADD "ipAddress" nvarchar(45)`);
        await queryRunner.query(`ALTER TABLE "Doors" ADD "status" nvarchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "Doors" ADD CONSTRAINT "DF_f9549b4309d6d80f285b2d7298b" DEFAULT 'unknown' FOR "status"`);
        await queryRunner.query(`ALTER TABLE "Doors" ADD "doorNumber" int NOT NULL`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" ADD "status" nvarchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" ADD CONSTRAINT "DF_502a4f2eb91aa9595fae40c6eaf" DEFAULT 'unknown' FOR "status"`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" ADD "ioType" nvarchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "DoorIOs" ADD "ioNumber" int NOT NULL`);
    }

}
