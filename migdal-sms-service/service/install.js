const exec = require('child_process').exec;
const path = require('path');
const scriptPath = path.resolve('index.js');
const isWin = process.platform === "win32";
const serviceName = "sms-service";

console.log(`install ${serviceName}....`);

// install for win platform
if (isWin) {

    console.log(`win platform`);
    console.log(`install node-windows....`);

    exec(`npm install node-windows@0.1.14`, function (error, stdout, stderr) {
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }

        let Service = require('node-windows').Service;
        let svc = new Service({
            name: `!Shob_${serviceName}`,
            description: serviceName,
            script: scriptPath
        });
        svc.on('install', function () {
            svc.start();
        });
        svc.install();
    })
}// install for linux platform
else {
     console.log(`linux platform need to install manual`);

    // console.log(`install PM2....`);

    // exec(`npm uninstall node-windows`, function (error, stdout, stderr) {
    //     if (error) {
    //         console.log(`error: ${error.message}`);
    //         return;
    //     }

    //     exec("npm install pm2 -g", function (error, stdout, stderr) {
    //         if (error) {
    //             console.log(`error: ${error.message}`);
    //             return;
    //         }

    //         console.log(`Installation PM2 successful`);

    //         exec(`pm2 pid ${serviceName}`, function (error, stdout, stderr) {
    //             if (error) {
    //                 console.log(`error: ${error.message}`);
    //                 return;
    //             }
    //             if (!stdout.trim()) {

    //                 exec(`pm2 start ${scriptPath} --name ${serviceName}`, function (error, stdout, stderr) {
    //                     if (error) {
    //                         console.log(`error: ${error.message}`);
    //                         return;
    //                     }

    //                     console.log(`Add ${serviceName} to list successful`);
    //                     console.log(`Save list`);

    //                     exec("pm2 startup", function (error, stdout, stderr) {
    //                         if (error) {
    //                             console.log(`error: ${error.message}`);
    //                             return;
    //                         }
    //                         console.log(`pm2 startup successful`);

    //                         exec("pm2 save", function (error, stdout, stderr) {
    //                             if (error) {
    //                                 console.log(`error: ${error.message}`);
    //                                 return;
    //                             }

    //                             exec("pm2 list", function (error, stdout, stderr) {
    //                                 if (error) {
    //                                     console.log(`error: ${error.message}`);
    //                                     return;
    //                                 }
    //                                 console.log(`Save list successful`);
    //                                 console.log(stdout);
    //                             });
    //                         });
    //                     });
    //                 })
    //             } else {
    //                 exec("pm2 list", function (error, stdout, stderr) {
    //                     if (error) {
    //                         console.log(`error: ${error.message}`);
    //                         return;
    //                     }
    //                     console.log(`Save list successful`);
    //                     console.log(stdout);
    //                 });
    //             }

    //         })
    //     })

    // })
}