# Database Design

## Overview

Microsoft SQL Server database with TypeORM as the ORM layer. All tables follow consistent conventions for auditability and soft-delete support.

## Common Column Conventions

Every table includes these audit columns:

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uniqueidentifier` (UUID) | Primary key, auto-generated |
| `createdAt` | `datetime2` | Record creation timestamp |
| `updatedAt` | `datetime2` | Last update timestamp |
| `createdBy` | `uniqueidentifier` | FK to Users (nullable for system-created) |
| `updatedBy` | `uniqueidentifier` | FK to Users (nullable) |
| `isActive` | `bit` | Soft delete flag (default: 1) |

## Entity Relationship Diagram

```
Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š     Users        Ã¢â€â€š
Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š
Ã¢â€â€š id (PK)          Ã¢â€â€š
Ã¢â€â€š email (unique)   Ã¢â€â€š
Ã¢â€â€š passwordHash     Ã¢â€â€š
Ã¢â€â€š firstName        Ã¢â€â€š
Ã¢â€â€š lastName         Ã¢â€â€š
Ã¢â€â€š isActive         Ã¢â€â€š
Ã¢â€â€š lastLoginAt      Ã¢â€â€š
Ã¢â€â€š createdAt        Ã¢â€â€š
Ã¢â€â€š updatedAt        Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
        Ã¢â€â€š 1
        Ã¢â€â€š
        Ã¢â€â€š M
Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â´Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â       Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š   UserRoles      Ã¢â€â€š       Ã¢â€â€š     Roles        Ã¢â€â€š
Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š       Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š
Ã¢â€â€š userId (FK)      Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š id (PK)          Ã¢â€â€š
Ã¢â€â€š roleId (FK)      Ã¢â€â€š   M:1 Ã¢â€â€š name (unique)    Ã¢â€â€š
Ã¢â€â€š assignedAt       Ã¢â€â€š       Ã¢â€â€š description      Ã¢â€â€š
Ã¢â€â€š assignedBy (FK)  Ã¢â€â€š       Ã¢â€â€š isActive         Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ       Ã¢â€â€š isSystem         Ã¢â€â€š
                           Ã¢â€â€š createdAt        Ã¢â€â€š
                           Ã¢â€â€š updatedAt        Ã¢â€â€š
                           Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
                                   Ã¢â€â€š 1
                                   Ã¢â€â€š
                                   Ã¢â€â€š M
                           Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â´Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â       Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
                           Ã¢â€â€š RolePermissions  Ã¢â€â€š       Ã¢â€â€š  Permissions     Ã¢â€â€š
                           Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š       Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š
                           Ã¢â€â€š roleId (FK)      Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š id (PK)          Ã¢â€â€š
                           Ã¢â€â€š permissionId(FK) Ã¢â€â€š   M:1 Ã¢â€â€š key (unique)     Ã¢â€â€š
                           Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ       Ã¢â€â€š name             Ã¢â€â€š
                                                      Ã¢â€â€š description      Ã¢â€â€š
                                                      Ã¢â€â€š module           Ã¢â€â€š
                                                      Ã¢â€â€š action           Ã¢â€â€š
                                                      Ã¢â€â€š isActive         Ã¢â€â€š
                                                      Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ

Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â       Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â       Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š AcControllers    Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬1:MÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š     Doors        Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬1:MÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š    DoorIOs       Ã¢â€â€š
Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š       Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š       Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š
Ã¢â€â€š id (PK)          Ã¢â€â€š       Ã¢â€â€š id (PK)          Ã¢â€â€š       Ã¢â€â€š id (PK)          Ã¢â€â€š
Ã¢â€â€š name             Ã¢â€â€š       Ã¢â€â€š controllerId(FK) Ã¢â€â€š       Ã¢â€â€š doorId (FK)      Ã¢â€â€š
Ã¢â€â€š ipAddress        Ã¢â€â€š       Ã¢â€â€š name             Ã¢â€â€š       Ã¢â€â€š name             Ã¢â€â€š
Ã¢â€â€š model            Ã¢â€â€š       Ã¢â€â€š doorNumber       Ã¢â€â€š       Ã¢â€â€š ioNumber         Ã¢â€â€š
Ã¢â€â€š serialNumber     Ã¢â€â€š       Ã¢â€â€š status           Ã¢â€â€š       Ã¢â€â€š ioType           Ã¢â€â€š
Ã¢â€â€š status           Ã¢â€â€š       Ã¢â€â€š isActive         Ã¢â€â€š       Ã¢â€â€š status           Ã¢â€â€š
Ã¢â€â€š location         Ã¢â€â€š       Ã¢â€â€š createdAt        Ã¢â€â€š       Ã¢â€â€š isActive         Ã¢â€â€š
Ã¢â€â€š firmware         Ã¢â€â€š       Ã¢â€â€š updatedAt        Ã¢â€â€š       Ã¢â€â€š createdAt        Ã¢â€â€š
Ã¢â€â€š isActive         Ã¢â€â€š       Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ       Ã¢â€â€š updatedAt        Ã¢â€â€š
Ã¢â€â€š lastSyncAt       Ã¢â€â€š                                  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
Ã¢â€â€š createdAt        Ã¢â€â€š
Ã¢â€â€š updatedAt        Ã¢â€â€š       Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â       Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€ËœÃ¢â€â‚¬Ã¢â€â‚¬1:MÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š  Extensions      Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬1:MÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š ExtensionIOs     Ã¢â€â€š
                           Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š       Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š
                           Ã¢â€â€š id (PK)          Ã¢â€â€š       Ã¢â€â€š id (PK)          Ã¢â€â€š
                           Ã¢â€â€š controllerId(FK) Ã¢â€â€š       Ã¢â€â€š extensionId(FK)  Ã¢â€â€š
                           Ã¢â€â€š name             Ã¢â€â€š       Ã¢â€â€š name             Ã¢â€â€š
                           Ã¢â€â€š extensionNumber  Ã¢â€â€š       Ã¢â€â€š ioNumber         Ã¢â€â€š
                           Ã¢â€â€š model            Ã¢â€â€š       Ã¢â€â€š ioType           Ã¢â€â€š
                           Ã¢â€â€š status           Ã¢â€â€š       Ã¢â€â€š status           Ã¢â€â€š
                           Ã¢â€â€š isActive         Ã¢â€â€š       Ã¢â€â€š isActive         Ã¢â€â€š
                           Ã¢â€â€š createdAt        Ã¢â€â€š       Ã¢â€â€š createdAt        Ã¢â€â€š
                           Ã¢â€â€š updatedAt        Ã¢â€â€š       Ã¢â€â€š updatedAt        Ã¢â€â€š
                           Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ       Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ

Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â       Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â       Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š   Visitors       Ã¢â€â€š       Ã¢â€â€š    Settings      Ã¢â€â€š       Ã¢â€â€š   AuditLogs      Ã¢â€â€š
Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š       Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š       Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â€š
Ã¢â€â€š id (PK)          Ã¢â€â€š       Ã¢â€â€š id (PK)          Ã¢â€â€š       Ã¢â€â€š id (PK)          Ã¢â€â€š
Ã¢â€â€š firstName        Ã¢â€â€š       Ã¢â€â€š key (unique)     Ã¢â€â€š       Ã¢â€â€š userId (FK)      Ã¢â€â€š
Ã¢â€â€š lastName         Ã¢â€â€š       Ã¢â€â€š value            Ã¢â€â€š       Ã¢â€â€š action           Ã¢â€â€š
Ã¢â€â€š email            Ã¢â€â€š       Ã¢â€â€š type             Ã¢â€â€š       Ã¢â€â€š entity           Ã¢â€â€š
Ã¢â€â€š phone            Ã¢â€â€š       Ã¢â€â€š group            Ã¢â€â€š       Ã¢â€â€š entityId         Ã¢â€â€š
Ã¢â€â€š personId         Ã¢â€â€š       Ã¢â€â€š description      Ã¢â€â€š       Ã¢â€â€š newValue (json)  Ã¢â€â€š
Ã¢â€â€š carNumber        Ã¢â€â€š       Ã¢â€â€š isPublic         Ã¢â€â€š       Ã¢â€â€š ipAddress        Ã¢â€â€š
Ã¢â€â€š vehicleType      Ã¢â€â€š       Ã¢â€â€š createdAt        Ã¢â€â€š       Ã¢â€â€š userAgent        Ã¢â€â€š
Ã¢â€â€š isActive         Ã¢â€â€š       Ã¢â€â€š updatedAt        Ã¢â€â€š       Ã¢â€â€š createdAt        Ã¢â€â€š
Ã¢â€â€š createdAt        Ã¢â€â€š       Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ       Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
Ã¢â€â€š updatedAt        Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ       Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â 
                           Ã¢â€â€š RefreshTokens    Ã¢â€â€š
                           Ã¢â€â€šÃ¢â€â‚¬Ã¢â€â‚¬Ã¢Ã¢â€â€š
                           Ã¢â€â€š id (PK)          Ã¢â€â€š
                           Ã¢â€â€š userId (FK)      Ã¢â€â€š
                           Ã¢â€â€š tokenHash        Ã¢â€â€š
                           Ã¢â€â€š expiresAt        Ã¢â€â€š
                           Ã¢â€â€š isRevoked        Ã¢â€â€š
                           Ã¢â€â€š userAgent        Ã¢â€â€š
                           Ã¢â€â€š ipAddress        Ã¢â€â€š
                           Ã¢â€â€š createdAt        Ã¢â€â€š
                           Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
```

## Indexes

| Table | Index | Columns | Type |
|-------|-------|---------|------|
| Users | IX_Users_Email | email | Unique |
| Users | IX_Users_IsActive | isActive | Non-unique |
| Roles | IX_Roles_Name | name | Unique |
| Permissions | IX_Permissions_Key | key | Unique |
| Permissions | IX_Permissions_Module | module | Non-unique |
| UserRoles | PK_UserRoles | userId, roleId | Composite PK |
| RolePermissions | PK_RolePermissions | roleId, permissionId | Composite PK |
| AcControllers | IX_AcControllers_SerialNumber | serialNumber | Unique |
| Doors | IX_Doors_Controller | controllerId | Non-unique |
| Extensions | IX_Extensions_Controller | controllerId | Non-unique |
| DoorIOs | IX_DoorIOs_Door | doorId | Non-unique |
| ExtensionIOs | IX_ExtensionIOs_Extension | extensionId | Non-unique |
| Visitors | IX_Visitors_PersonId | personId | Non-unique |
| Settings | IX_Settings_Key | key | Unique |
| Settings | IX_Settings_Group | group | Non-unique |
| AuditLogs | IX_AuditLogs_UserId | userId | Non-unique |
| AuditLogs | IX_AuditLogs_Entity | entity, entityId | Non-unique |
| AuditLogs | IX_AuditLogs_CreatedAt | createdAt | Non-unique |
| RefreshTokens | IX_RefreshTokens_UserId | userId | Non-unique |
| RefreshTokens | IX_RefreshTokens_TokenHash | tokenHash | Unique |
| Workstations | IX_Workstations_MachineId | machineId | Unique |
| Workstations | IX_Workstations_Code | code | Unique |
| Workstations | FK_Workstations_CardTemplates | defaultCardTemplateId | FK (nullable) |
| WorkstationUsers | IX_WorkstationUsers_Workstation_User | workstationId, userId | Unique composite |
| WorkstationRoles | IX_WorkstationRoles_Workstation_Role | workstationId, roleId | Unique composite |
| WorkstationEnrollmentTokens | IX_WorkstationEnrollmentTokens_TokenHash | tokenHash | Unique |
| DeviceAgents | IX_DeviceAgents_ClientId | clientId | Unique |
| DeviceCommandLogs | IX_DeviceCommandLogs_CorrelationId | correlationId | Unique |
| DeviceCommandLogs | IX_DeviceCommandLogs_Workstation_Status | workstationId, providerType, status | Composite |
| DeviceCommandLogs | IX_DeviceCommandLogs_Status_CreatedAt | status, createdAt | Composite |
| Blacklist | IX_Blacklist_BlacklistType | blacklistType | Non-unique |
| Blacklist | IX_Blacklist_IdNumber | idNumber | Non-unique |
| Blacklist | IX_Blacklist_CarNumber | carNumber | Non-unique |
| BlacklistNotifyUsers | PK_BlacklistNotifyUsers | blacklistId, userId | Composite PK |
| Sites | IX_Sites_Code | code | Unique |
| UserSites | PK_UserSites | userId, siteId | Composite PK |

## Sites Tables

### Sites

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uniqueidentifier` | Primary key (BaseEntity) |
| `name` | `nvarchar(200)` | Site display name |
| `code` | `nvarchar(50)` | Unique short code (e.g., TLV, JLM) |
| `address` | `nvarchar(500)` | Physical address (nullable) |
| `timezone` | `nvarchar(100)` | Timezone identifier (nullable) |
| `contactPhone` | `nvarchar(50)` | Contact phone (nullable) |
| `contactEmail` | `nvarchar(200)` | Contact email (nullable) |
| `isActive` | `bit` | Soft delete flag |
| `createdAt` | `datetime2` | Created timestamp |
| `updatedAt` | `datetime2` | Updated timestamp |

### UserSites (Junction)

| Column | Type | Description |
|--------|------|-------------|
| `userId` | `uniqueidentifier` | FK → Users (composite PK) |
| `siteId` | `uniqueidentifier` | FK → Sites (composite PK) |
| `isPrimary` | `bit` | Whether this is the user's primary site |
| `assignedAt` | `datetime2` | Assignment timestamp |
| `assignedBy` | `uniqueidentifier` | FK → Users (nullable, who assigned) |

### Multi-Site Column (siteId)

The following tables include a `siteId` column (FK → Sites) to associate records with a specific site:

- Visits
- AcControllers
- Workstations
- Buildings
- BlacklistEntries
- AuditLogs

## Seed Data

The following data is seeded on first deployment:

### Permissions (26 total, by module)

```
users.create, users.read, users.update, users.delete
roles.create, roles.read, roles.update, roles.delete
access-control.create, access-control.read, access-control.update, access-control.delete, access-control.import, access-control.sync
visits.create, visits.read, visits.update, visits.delete, visits.print-card
devices.read, devices.manage
scanner.execute
settings.read, settings.update
audit.read, audit.export
```

### Default Roles

| Role | Permissions | isSystem |
|------|-------------|----------|
| Admin | All permissions | true |
| Operator | Most read/write except settings and user management | true |
| Viewer | All .read permissions only | true |

### Default Admin User

```
Email:    admin@migdal.local
Password: Admin@123456 (bcrypt hashed)
Roles:    [Admin]
```

### Default SMS Templates (9 events × 4 target groups = 36 templates)

Each notification event has a separate SMS template per target group (`system_users`, `visitors`, `escorts`, `visit_requester`). The `SmsTemplates` table uses a composite unique constraint on `(event, targetGroup)`.

| Event | Template (Hebrew) |
|-------|-------------------|
| `visitor_arrived` | Welcome + site + host + check-in code |
| `visit_created` | Visit scheduled + date + host + purpose |
| `visit_updated` | Visit updated + new date + host |
| `visit_deleted` | Visit cancelled + date |
| `visitor_blacklisted` | Visitor blocked from entry |
| `check_in_code_sent` | Check-in code + site + host |
| `parking_request_decision` | Parking decision + status + note |
| `visitor_checked_out` | Visitor checked out + site |
| `visitor_overstay` | Visitor overstay alert + site + end time |

### Default Settings (7 keys)

| Key | Value | Type | Group | Public |
|-----|-------|------|-------|--------|
| `app.name` | Migdal Platform | string | general | Yes |
| `app.timezone` | Asia/Jerusalem | string | general | Yes |
| `auth.sessionTimeout` | 900 | number | auth | No |
| `auth.maxRefreshDays` | 7 | number | auth | No |
| `visitors.requireApproval` | true | boolean | visitors | Yes |
| `visitors.badgePrefix` | VIS- | string | visitors | No |
| `retention.deviceCommandLogsMonths` | 3 | number | retention | No |

All seed data is managed by `SeedService` on startup (upsert — only inserts missing rows, never overwrites existing).

## SQL Files

| File | Purpose |
|------|---------|
| `src/database/schema.sql` | Full DDL Ã¢â‚¬â€ creates all 14 tables, PKs, FKs, indexes |
| `src/database/seed.sql` | Seed data Ã¢â‚¬â€ permissions, roles, role-permission mappings, admin user, default settings, SMS templates |

> **Note:** These SQL files are the source-of-truth reference. In practice, TypeORM generates migrations from the entity classes. Use these scripts for manual bootstrapping or DBA review.

## Migration Strategy

- TypeORM migrations via CLI: `typeorm migration:generate` and `typeorm migration:run`
- Migrations are version-controlled
- Seed data runs automatically on app startup via `SeedService` (`OnModuleInit`)
- Destructive migrations require manual approval (not auto-generated)

## Table Summary

| # | Table | Rows (est.) | FK Dependencies |
|---|-------|-------------|-----------------|
| 1 | Users | Ã¢â‚¬â€ | Ã¢â‚¬â€ |
| 2 | Roles | 3 seed | Ã¢â‚¬â€ |
| 3 | Permissions | 22 seed | Ã¢â‚¬â€ |
| 4 | UserRoles | Ã¢â‚¬â€ | Users, Roles |
| 5 | RolePermissions | Ã¢â‚¬â€ | Roles, Permissions |
| 6 | RefreshTokens | Ã¢â‚¬â€ | Users |
| 7 | AcControllers | Ã¢â‚¬â€ | Ã¢â‚¬â€ |
| 8 | Doors | Ã¢â‚¬â€ | AcControllers |
| 9 | Extensions | Ã¢â‚¬â€ | AcControllers |
| 10 | DoorIOs | Ã¢â‚¬â€ | Doors |
| 11 | ExtensionIOs | Ã¢â‚¬â€ | Extensions |
| 12 | Visitors | Ã¢â‚¬â€ | Ã¢â‚¬â€ |
| 13 | Settings | 7 seed | Ã¢â‚¬â€ |
| 14 | AuditLogs | â€" | Users (nullable) |
| 15 | Blacklist | â€" | Users (createdBy, nullable) |
| 16 | BlacklistNotifyUsers | â€" | Blacklist, Users |
| 17 | SmsTemplates | 9 seed | â€" |
| 18 | ParkingRequests | â€" | VisitVisitors (CASCADE), Users (nullable) |
### FK Cascade Rules

| FK | ON DELETE |
|----|-----------|
| UserRoles Ã¢â€ â€™ Users | CASCADE |
| UserRoles Ã¢â€ â€™ Roles | CASCADE |
| RolePermissions Ã¢â€ â€™ Roles | CASCADE |
| RolePermissions Ã¢â€ â€™ Permissions | CASCADE |
| RefreshTokens Ã¢â€ â€™ Users | CASCADE |
| Doors Ã¢â€ â€™ AcControllers | CASCADE |
| Extensions Ã¢â€ â€™ AcControllers | CASCADE |
| DoorIOs Ã¢â€ â€™ Doors | CASCADE |
| ExtensionIOs Ã¢â€ â€™ Extensions | CASCADE |
| AuditLogs Ã¢â€ â€™ Users | SET NULL || DeviceAgents Ã¢â€ â€™ Workstations | CASCADE |
| UserWorkstationSessions Ã¢â€ â€™ Workstations | CASCADE |
| Workstations  Ã¢â€ â€™ CardTemplates (default) | SET NULL |
| DeviceCommandLogs → Workstations | NO ACTION |
| BlacklistNotifyUsers → Blacklist | CASCADE |
| BlacklistNotifyUsers → Users | CASCADE |