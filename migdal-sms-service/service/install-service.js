const path = require('path');
const scriptPath = path.join(__dirname, '..', 'index.js');

let Service = require('node-windows').Service;
let svc = new Service({
    name: `Migdal sms-service`,
    description: `Migdal sms-service`,
    script: scriptPath
});
svc.on('install', function () {
    svc.start();
});
svc.install();

