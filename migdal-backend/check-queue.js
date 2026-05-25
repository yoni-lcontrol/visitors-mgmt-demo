require('dotenv').config({ path: '.env.development' });
const crypto = require('crypto');
const { DataSource } = require('typeorm');
const ds = new DataSource({
  type: 'mssql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433'),
  username: process.env.DB_USERNAME || 'sa',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'migdal_db',
  options: { encrypt: false, trustServerCertificate: true },
});
ds.initialize().then(async (c) => {
  console.log('=== AmadeusSyncQueue ===');
  const rows = await c.query('SELECT TOP 10 id, operation, source, status, personId, errorMessage, retryCount, createdAt FROM AmadeusSyncQueue ORDER BY createdAt DESC');
  console.log(JSON.stringify(rows, null, 2));
  console.log('\n=== Recent ParkingRequests sync status ===');
  const parking = await c.query("SELECT TOP 5 id, status, amadeusSyncStatus, amadeusSyncMessage, updatedAt FROM ParkingRequests ORDER BY updatedAt DESC");
  console.log(JSON.stringify(parking, null, 2));
  await c.destroy();
}).catch(e => { console.error(e.message); process.exit(1); });
