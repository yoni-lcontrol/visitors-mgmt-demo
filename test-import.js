const http = require('http');

const BASE = 'http://localhost:3001/api';
let TOKEN = '';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (TOKEN) options.headers['Authorization'] = `Bearer ${TOKEN}`;
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function log(label, result) {
  const icon = result.status >= 200 && result.status < 300 ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${label} -> ${result.status}`);
  if (result.body) console.log('  Response:', JSON.stringify(result.body, null, 2).slice(0, 500));
}

async function run() {
  // Login
  const login = await request('POST', '/auth/login', { username: 'admin', password: 'Admin@123456' });
  if (login.status !== 200) { console.log('Login failed:', login.body); process.exit(1); }
  TOKEN = login.body.accessToken || login.body.data?.accessToken;
  console.log('[PASS] Login OK\n');

  // Test 1: Trigger import (should return 202 since remote server is not running)
  console.log('=== TEST 1: Trigger import (POST /access-control/controllers/import) ===');
  const triggerRes = await request('POST', '/access-control/controllers/import', {});
  // Expected: 502 Bad Gateway because remote server isn't running,
  // but the endpoint itself is reachable and returns proper error
  log('POST /controllers/import (trigger)', triggerRes);

  // Test 2: Callback endpoint (should be PUBLIC - no auth required)
  console.log('\n=== TEST 2: Callback endpoint (POST /access-control/import/callback) - NO AUTH ===');
  TOKEN = ''; // clear auth token
  const callbackRes = await request('POST', '/access-control/import/callback', {
    controllers: [
      {
        name: 'Imported Controller 1',
        type: 1,
        ip: '10.0.0.1',
        port: 5000,
        model: 'RemoteModel',
        externalId: 'REMOTE-001',
        doors: [
          {
            name: 'Imported Door 1',
            doorsIndex: 0,
            entryType: 1,
            externalId: 'RDOOR-001',
            doorIos: [
              { name: 'Door IO 1', type: 1, ioIndex: 0, ioState: 0, externalId: 'RDIO-001' }
            ]
          }
        ],
        extensions: [
          {
            name: 'Imported Extension 1',
            type: 2,
            extensionIndex: 0,
            externalId: 'REXT-001',
            extensionIos: [
              { name: 'Ext IO 1', type: 1, ioIndex: 0, ioState: 0, externalId: 'REIO-001' }
            ]
          }
        ]
      }
    ]
  });
  log('POST /import/callback (public, no auth)', callbackRes);

  // Test 3: Verify the imported data exists
  console.log('\n=== TEST 3: Verify imported data ===');
  // Re-login to read data
  const login2 = await request('POST', '/auth/login', { username: 'admin', password: 'Admin@123456' });
  TOKEN = login2.body.accessToken || login2.body.data?.accessToken;

  const listRes = await request('GET', '/access-control/controllers?page=1&limit=50&search=Imported Controller');
  log('GET /controllers (search for imported)', listRes);
  const items = listRes.body?.data?.items || listRes.body?.items || [];
  const imported = items.find(c => c.name === 'Imported Controller 1');
  if (imported) {
    console.log('  Found imported controller:', imported.id);

    // Check doors
    const doorsRes = await request('GET', `/access-control/doors/by-controller/${imported.id}`);
    log(`GET /doors/by-controller/${imported.id}`, doorsRes);
    const doors = doorsRes.body?.data || doorsRes.body || [];
    console.log(`  Doors count: ${doors.length}`);

    if (doors.length > 0) {
      const iosRes = await request('GET', `/access-control/door-ios/by-door/${doors[0].id}`);
      log(`GET /door-ios/by-door/${doors[0].id}`, iosRes);
      const ios = iosRes.body?.data || iosRes.body || [];
      console.log(`  Door IOs count: ${ios.length}`);
    }

    // Check extensions
    const extsRes = await request('GET', `/access-control/extensions/by-controller/${imported.id}`);
    log(`GET /extensions/by-controller/${imported.id}`, extsRes);
    const exts = extsRes.body?.data || extsRes.body || [];
    console.log(`  Extensions count: ${exts.length}`);

    if (exts.length > 0) {
      const eiosRes = await request('GET', `/access-control/extension-ios/by-extension/${exts[0].id}`);
      log(`GET /extension-ios/by-extension/${exts[0].id}`, eiosRes);
      const eios = eiosRes.body?.data || eiosRes.body || [];
      console.log(`  Extension IOs count: ${eios.length}`);
    }

    // Cleanup
    console.log('\n=== CLEANUP ===');
    // Delete the imported data
    if (doors.length > 0) {
      const diosRes = await request('GET', `/access-control/door-ios/by-door/${doors[0].id}`);
      const dios = diosRes.body?.data || diosRes.body || [];
      for (const dio of dios) {
        const d = await request('DELETE', `/access-control/door-ios/${dio.id}`);
        log(`DELETE door-io ${dio.id}`, d);
      }
      const dd = await request('DELETE', `/access-control/doors/${doors[0].id}`);
      log(`DELETE door ${doors[0].id}`, dd);
    }
    if (exts.length > 0) {
      const eiosRes2 = await request('GET', `/access-control/extension-ios/by-extension/${exts[0].id}`);
      const eios2 = eiosRes2.body?.data || eiosRes2.body || [];
      for (const eio of eios2) {
        const d = await request('DELETE', `/access-control/extension-ios/${eio.id}`);
        log(`DELETE ext-io ${eio.id}`, d);
      }
      const de = await request('DELETE', `/access-control/extensions/${exts[0].id}`);
      log(`DELETE extension ${exts[0].id}`, de);
    }
    const dc = await request('DELETE', `/access-control/controllers/${imported.id}`);
    log(`DELETE controller ${imported.id}`, dc);
  } else {
    console.log('  [FAIL] Imported controller not found!');
  }

  console.log('\n=== DONE ===');
}

run().catch((err) => { console.error('Error:', err.message); process.exit(1); });
