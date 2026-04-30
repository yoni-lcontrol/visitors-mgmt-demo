const path = require('path');
const scriptPath = path.join(__dirname, '..', 'index.js');

let Service = require('node-windows').Service;
let svc = new Service({
  name: 'Migdal sms-service',
  description: 'Migdal sms-service',
  script: scriptPath
});
// Listen for the 'uninstall' event so we know when it is done.
svc.on('uninstall', function () {
  console.log('Uninstall complete.');
  console.log('The service exists: ', svc.exists);
});
// Uninstall the service.
svc.uninstall();
