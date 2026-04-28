const path = require('path');
const { Service } = require('node-windows');

const appRoot = path.resolve(__dirname, '..');

const svc = new Service({
  name: 'Migdal NestJS API',
  description: 'Runs the NestJS backend as a Windows Service.',
  script: path.join(appRoot, 'dist', 'main.js'),
  workingDirectory: appRoot
});

svc.on('install', () => {
  console.log('Service installed successfully.');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('Service is already installed.');
});

svc.on('start', () => {
  console.log('Service started.');
});

svc.on('error', (error) => {
  console.error('Service error:', error);
});

svc.install();