import dataSource from './src/database/data-source';

async function main() {
    await dataSource.initialize();
    const result = await dataSource.query(
        "UPDATE AmadeusSyncQueue SET status = 'failed' WHERE status IN ('pending', 'in_progress')"
    );
    console.log('Updated pending/in_progress items:', result);
    await dataSource.destroy();
}

main().catch(console.error);
