import dataSource from './src/database/data-source';

async function main() {
    const ds = await dataSource.initialize();
    await ds.query("UPDATE Settings SET value = '3' WHERE [key] = 'retention.auditLogsMonths'");
    const rows = await ds.query("SELECT [key], [value] FROM Settings WHERE [key] LIKE 'retention%'");
    console.log('Updated. Current values:');
    console.log(JSON.stringify(rows, null, 2));
    await ds.destroy();
}

main().catch(console.error);
