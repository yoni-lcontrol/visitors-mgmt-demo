const path = require('path');
const { Service } = require('node-windows');

const appRoot = path.resolve(__dirname, '..');

const svc = new Service({
  name: 'Migdal NestJS API',
  script: path.join(appRoot, 'dist', 'main.js'),
});

svc.on('uninstall', () => {
  console.log('Service uninstalled successfully.');
  console.log('Service exists:', svc.exists);
});

svc.on('alreadyuninstalled', () => {
  console.log('Service is already uninstalled.');
});

svc.on('error', (error) => {
  console.error('Service uninstall error:', error);
});

svc.uninstall();