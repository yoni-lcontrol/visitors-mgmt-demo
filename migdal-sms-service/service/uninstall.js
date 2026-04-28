const exec = require('child_process').exec;
const path = require('path');
const scriptPath = path.resolve('index.js');
const isWin = process.platform === "win32";
const serviceName = "sms-service";

console.log(`Delete ${serviceName}....`);

// uninstall for win platform
if (isWin) {

  console.log(`win platform`);

  let Service = require('node-windows').Service;
  let svc = new Service({
    name: `!Shob_${serviceName}`,
    description: serviceName,
    script: scriptPath
  });
  // Listen for the 'uninstall' event so we know when it is done.
  svc.on('uninstall', function () {
    console.log('Uninstall complete.');
    console.log('The service exists: ', svc.exists);
  });
  // Uninstall the service.
  svc.uninstall();

}// uninstall for linux platform
else {
  console.log(`linux platform need to uninstall manual`);

  // exec(`pm2 delete ${serviceName}`, function (error, stdout, stderr) {
  //   if (error) {
  //     console.log(`error: ${error.message}`);
  //     return;
  //   }

  //   console.log(`Delete ${serviceName} successful`);
  //   console.log(`Save list`);
  //   exec("pm2 list", function (error, stdout, stderr) {
  //     if (error) {
  //       console.log(`error: ${error.message}`);
  //       return;
  //     }
  //     console.log(`Save list successful`);
  //     console.log(stdout);
  //   });

  // });
}
