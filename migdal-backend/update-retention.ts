import dataSource from './src/database/data-source';

async function main() {
    const ds = await dataSource.initialize();
    await ds.query("UPDATE Settings SET value = '3' WHERE [key] IN ('retention.auditLogsMonths', 'retention.visitsMonths')");
    console.log('Updated retention defaults to 3 months');
    await ds.destroy();
}

main().catch(console.error);
