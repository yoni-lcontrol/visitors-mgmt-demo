/**
 * Shared mock factories for backend unit tests.
 * Provides reusable mock objects for repositories, services, and gateways.
 */

/** Create a mock TypeORM repository with all standard methods. */
export function createMockRepository() {
    return {
        find: jest.fn(),
        findOne: jest.fn(),
        findBy: jest.fn(),
        create: jest.fn((data: any) => ({ ...data })),
        save: jest.fn((entity: any) => Promise.resolve({ id: 'mock-id', ...entity })),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: jest.fn(),
        count: jest.fn(),
    };
}

/** Create a chainable mock query builder. */
export function createMockQueryBuilder(result: any[] = [], count = 0) {
    const qb: any = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(result),
        getOne: jest.fn().mockResolvedValue(result[0] ?? null),
        getCount: jest.fn().mockResolvedValue(count),
        getExists: jest.fn().mockResolvedValue(result.length > 0),
        getRawMany: jest.fn().mockResolvedValue(result),
        getRawOne: jest.fn().mockResolvedValue(result[0] ?? null),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
    };
    return qb;
}

/** Create a mock WebsocketGateway. */
export function createMockWsGateway() {
    return {
        broadcastToAll: jest.fn(),
        broadcastToRoom: jest.fn(),
    };
}

/** Create a mock BlacklistService. */
export function createMockBlacklistService() {
    return {
        checkBlacklistStatus: jest.fn().mockResolvedValue({ isBlacklisted: false }),
        checkBlacklistStatusBatch: jest.fn().mockResolvedValue(new Map()),
        checkVehicleBlacklistStatus: jest.fn().mockResolvedValue({ isBlacklisted: false }),
        checkVehicleBlacklistStatusBatch: jest.fn().mockResolvedValue(new Map()),
        findActiveByIdNumber: jest.fn().mockResolvedValue([]),
        findActiveByCarNumber: jest.fn().mockResolvedValue([]),
        findActiveByName: jest.fn().mockResolvedValue([]),
        notifyBlacklistArrival: jest.fn(),
    };
}

/** Create a mock DataSource with query runner. */
export function createMockDataSource() {
    const qrManager = {
        create: jest.fn((Entity: any, data: any) => ({ ...data })),
        save: jest.fn((entity: any) => Promise.resolve({ id: 'mock-id', ...entity })),
        findOne: jest.fn(),
        createQueryBuilder: jest.fn(),
    };

    const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: qrManager,
    };

    return {
        createQueryRunner: jest.fn().mockReturnValue(queryRunner),
        _queryRunner: queryRunner,
        _qrManager: qrManager,
    };
}

/** Create a mock AuditService. */
export function createMockAuditService() {
    return {
        log: jest.fn().mockResolvedValue(undefined),
    };
}



/** Create a mock PrintingService. */
export function createMockPrintingService() {
    return {
        requestPrintCard: jest.fn(),
    };
}

/** Create a mock ScanningService. */
export function createMockScanningService() {
    return {
        requestScannerAction: jest.fn(),
    };
}


