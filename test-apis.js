const http = require('http');

const BASE = 'http://localhost:3001/api';
let TOKEN = '';
let controllerId = '';
let doorId = '';
let doorIoId = '';
let extensionId = '';
let extensionIoId = '';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
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
  if (icon === 'FAIL') {
    console.log('  Response:', JSON.stringify(result.body, null, 2).slice(0, 500));
  }
}

async function run() {
  // 1. Login
  console.log('\n=== AUTH ===');
  const login = await request('POST', '/auth/login', { username: 'admin', password: 'Admin@123456' });
  log('POST /auth/login', login);
  if (login.status !== 201 && login.status !== 200) {
    console.log('Cannot proceed without auth token. Response:', JSON.stringify(login.body));
    process.exit(1);
  }
  TOKEN = login.body.accessToken || login.body.data?.accessToken;
  console.log('  Token obtained:', TOKEN ? 'YES' : 'NO');

  // 2. Controllers CRUD
  console.log('\n=== CONTROLLERS ===');

  // CREATE
  const createCtrl = await request('POST', '/access-control/controllers', {
    name: 'Test Controller API',
    type: 1,
    model: 'TestModel',
    ip: '192.168.1.100',
    port: 8080,
    externalId: 'EXT-001',
  });
  log('POST /access-control/controllers (create)', createCtrl);
  controllerId = createCtrl.body?.data?.id || createCtrl.body?.id || '';
  console.log('  Controller ID:', controllerId);

  // LIST
  const listCtrl = await request('GET', '/access-control/controllers?page=1&limit=10');
  log('GET /access-control/controllers (list)', listCtrl);
  const items = listCtrl.body?.data?.items || listCtrl.body?.items || [];
  console.log('  Total items:', listCtrl.body?.data?.total || listCtrl.body?.total || items.length);

  // GET ONE
  if (controllerId) {
    const getCtrl = await request('GET', `/access-control/controllers/${controllerId}`);
    log(`GET /access-control/controllers/${controllerId} (findOne)`, getCtrl);
    const c = getCtrl.body?.data || getCtrl.body;
    if (c) console.log('  Fields: name=%s type=%s model=%s ip=%s port=%s externalId=%s', c.name, c.type, c.model, c.ip, c.port, c.externalId);
  }

  // UPDATE
  if (controllerId) {
    const updateCtrl = await request('PATCH', `/access-control/controllers/${controllerId}`, {
      name: 'Updated Controller',
      port: 9090,
    });
    log(`PATCH /access-control/controllers/${controllerId} (update)`, updateCtrl);
  }

  // EXPORT
  const exportCtrl = await request('GET', '/access-control/controllers/export?sortBy=name&sortOrder=ASC&filters={}');
  log('GET /access-control/controllers/export', exportCtrl);

  // 3. Doors CRUD
  console.log('\n=== DOORS ===');

  // CREATE
  if (controllerId) {
    const createDoor = await request('POST', '/access-control/doors', {
      controllerId,
      name: 'Test Door',
      doorsIndex: 1,
      entryType: 1,
      externalId: 'DOOR-EXT-001',
    });
    log('POST /access-control/doors (create)', createDoor);
    doorId = createDoor.body?.data?.id || createDoor.body?.id || '';
    console.log('  Door ID:', doorId);
  }

  // LIST
  const listDoors = await request('GET', '/access-control/doors?page=1&limit=10');
  log('GET /access-control/doors (list)', listDoors);

  // BY CONTROLLER
  if (controllerId) {
    const byCtrl = await request('GET', `/access-control/doors/by-controller/${controllerId}`);
    log(`GET /access-control/doors/by-controller/${controllerId}`, byCtrl);
  }

  // GET ONE
  if (doorId) {
    const getDoor = await request('GET', `/access-control/doors/${doorId}`);
    log(`GET /access-control/doors/${doorId} (findOne)`, getDoor);
    const d = getDoor.body?.data || getDoor.body;
    if (d) console.log('  Fields: name=%s doorsIndex=%s entryType=%s externalId=%s stationId=%s', d.name, d.doorsIndex, d.entryType, d.externalId, d.stationId);
  }

  // UPDATE
  if (doorId) {
    const updateDoor = await request('PATCH', `/access-control/doors/${doorId}`, {
      name: 'Updated Door',
      entryType: 2,
    });
    log(`PATCH /access-control/doors/${doorId} (update)`, updateDoor);
  }

  // EXPORT
  const exportDoors = await request('GET', '/access-control/doors/export?sortBy=name&sortOrder=ASC&filters={}');
  log('GET /access-control/doors/export', exportDoors);

  // 4. Door IOs CRUD
  console.log('\n=== DOOR IOs ===');

  // CREATE
  if (doorId) {
    const createDoorIo = await request('POST', '/access-control/door-ios', {
      doorId,
      name: 'Test Door IO',
      type: 1,
      ioIndex: 0,
      ioState: 1,
      externalId: 'DIO-001',
    });
    log('POST /access-control/door-ios (create)', createDoorIo);
    doorIoId = createDoorIo.body?.data?.id || createDoorIo.body?.id || '';
    console.log('  Door IO ID:', doorIoId);
  }

  // BY DOOR
  if (doorId) {
    const byDoor = await request('GET', `/access-control/door-ios/by-door/${doorId}`);
    log(`GET /access-control/door-ios/by-door/${doorId}`, byDoor);
  }

  // GET ONE
  if (doorIoId) {
    const getDoorIo = await request('GET', `/access-control/door-ios/${doorIoId}`);
    log(`GET /access-control/door-ios/${doorIoId} (findOne)`, getDoorIo);
    const dio = getDoorIo.body?.data || getDoorIo.body;
    if (dio) console.log('  Fields: name=%s type=%s ioIndex=%s ioState=%s externalId=%s', dio.name, dio.type, dio.ioIndex, dio.ioState, dio.externalId);
  }

  // UPDATE
  if (doorIoId) {
    const updateDoorIo = await request('PATCH', `/access-control/door-ios/${doorIoId}`, {
      name: 'Updated Door IO',
      ioState: 2,
    });
    log(`PATCH /access-control/door-ios/${doorIoId} (update)`, updateDoorIo);
  }

  // 5. Extensions CRUD
  console.log('\n=== EXTENSIONS ===');

  // CREATE
  if (controllerId) {
    const createExt = await request('POST', '/access-control/extensions', {
      controllerId,
      name: 'Test Extension',
      type: 2,
      extensionIndex: 1,
      externalId: 'EXT-IO-001',
    });
    log('POST /access-control/extensions (create)', createExt);
    extensionId = createExt.body?.data?.id || createExt.body?.id || '';
    console.log('  Extension ID:', extensionId);
  }

  // LIST
  const listExts = await request('GET', '/access-control/extensions?page=1&limit=10');
  log('GET /access-control/extensions (list)', listExts);

  // BY CONTROLLER
  if (controllerId) {
    const byCtrl = await request('GET', `/access-control/extensions/by-controller/${controllerId}`);
    log(`GET /access-control/extensions/by-controller/${controllerId}`, byCtrl);
  }

  // GET ONE
  if (extensionId) {
    const getExt = await request('GET', `/access-control/extensions/${extensionId}`);
    log(`GET /access-control/extensions/${extensionId} (findOne)`, getExt);
    const e = getExt.body?.data || getExt.body;
    if (e) console.log('  Fields: name=%s type=%s extensionIndex=%s externalId=%s', e.name, e.type, e.extensionIndex, e.externalId);
  }

  // UPDATE
  if (extensionId) {
    const updateExt = await request('PATCH', `/access-control/extensions/${extensionId}`, {
      name: 'Updated Extension',
      type: 3,
    });
    log(`PATCH /access-control/extensions/${extensionId} (update)`, updateExt);
  }

  // EXPORT
  const exportExts = await request('GET', '/access-control/extensions/export?sortBy=name&sortOrder=ASC&filters={}');
  log('GET /access-control/extensions/export', exportExts);

  // 6. Extension IOs CRUD
  console.log('\n=== EXTENSION IOs ===');

  // CREATE
  if (extensionId) {
    const createExtIo = await request('POST', '/access-control/extension-ios', {
      extensionId,
      name: 'Test Extension IO',
      type: 1,
      ioIndex: 0,
      ioState: 1,
      externalId: 'EIO-001',
    });
    log('POST /access-control/extension-ios (create)', createExtIo);
    extensionIoId = createExtIo.body?.data?.id || createExtIo.body?.id || '';
    console.log('  Extension IO ID:', extensionIoId);
  }

  // BY EXTENSION
  if (extensionId) {
    const byExt = await request('GET', `/access-control/extension-ios/by-extension/${extensionId}`);
    log(`GET /access-control/extension-ios/by-extension/${extensionId}`, byExt);
  }

  // GET ONE
  if (extensionIoId) {
    const getExtIo = await request('GET', `/access-control/extension-ios/${extensionIoId}`);
    log(`GET /access-control/extension-ios/${extensionIoId} (findOne)`, getExtIo);
    const eio = getExtIo.body?.data || getExtIo.body;
    if (eio) console.log('  Fields: name=%s type=%s ioIndex=%s ioState=%s externalId=%s', eio.name, eio.type, eio.ioIndex, eio.ioState, eio.externalId);
  }

  // UPDATE
  if (extensionIoId) {
    const updateExtIo = await request('PATCH', `/access-control/extension-ios/${extensionIoId}`, {
      name: 'Updated Extension IO',
      ioState: 2,
    });
    log(`PATCH /access-control/extension-ios/${extensionIoId} (update)`, updateExtIo);
  }

  // 7. CLEANUP - Delete in reverse order
  console.log('\n=== CLEANUP (DELETE) ===');

  if (extensionIoId) {
    const del = await request('DELETE', `/access-control/extension-ios/${extensionIoId}`);
    log(`DELETE /access-control/extension-ios/${extensionIoId}`, del);
  }
  if (doorIoId) {
    const del = await request('DELETE', `/access-control/door-ios/${doorIoId}`);
    log(`DELETE /access-control/door-ios/${doorIoId}`, del);
  }
  if (extensionId) {
    const del = await request('DELETE', `/access-control/extensions/${extensionId}`);
    log(`DELETE /access-control/extensions/${extensionId}`, del);
  }
  if (doorId) {
    const del = await request('DELETE', `/access-control/doors/${doorId}`);
    log(`DELETE /access-control/doors/${doorId}`, del);
  }
  if (controllerId) {
    const del = await request('DELETE', `/access-control/controllers/${controllerId}`);
    log(`DELETE /access-control/controllers/${controllerId}`, del);
  }

  console.log('\n=== DONE ===');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
