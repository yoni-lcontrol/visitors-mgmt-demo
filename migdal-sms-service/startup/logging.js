const {
    loggers,
    format,
    transports,
    addColors
} = require('winston');
const {
    combine
} = format;
const convertDateFormat = require('../global-functions/date');

// for handaling erros in the route handler
// we don't need to write a middleware function to handler the errors
// example for an error: the database stoped working
require('express-async-errors');

// for debug add on launch:
// "outputCapture": "std"

const myFormat = (info) => {
    let color = "\x1b[37m";
    switch (info[Symbol.for('level')]) {
        // red
        case "error":
            color = "\x1b[31m";
            break;
        // yellow
        case "alert":
            color = "\x1b[33m";
            break;
        // blue
        case "info":
            color = "\x1b[34m";
            break;
        // magenta
        case "specialMsg":
            color = "\x1b[35m";
            break;
        // green
        case "msg":
            color = "\x1b[32m";
            break;
        // white
        case "normal":
            color = "\x1b[37m";
            break;
    }

    let date = convertDateFormat(new Date(), 'Date', 'dd/MM/yyyy HH:mm:ss');
    return `${color} ${date} - ${info.message} \x1b[0m`;
}

const myCustomLevels = {
    levels: {
        error: 0,
        alert: 1,
        info: 2,
        specialMsg: 3,
        msg: 4,
        normal: 5
    },
    colors: {
        error: 'red',
        alert: 'yellow',
        info: 'blue',
        specialMsg: 'magenta',
        msg: 'green',
        normal: 'white'
    }
};

addColors(myCustomLevels.colors);

module.exports = function () {

    const transportsList = [
        new transports.File({
            filename: 'logs/unhandledRejection.log',
            level: 'error',
            maxsize: 10000000,
            maxFiles: 10
        })
    ];

    if (process.env.NODE_ENV == 'development') {
        transportsList.push(new transports.File({
            filename: 'logs/logfile.log',
            level: 'normal',
            maxsize: 10000000,
            maxFiles: 10
        }));

        transportsList.push(new transports.Console({
            level: 'normal',
            format: combine(
                format.timestamp(),
                format.colorize(),
                format.printf(myFormat)
            )
        }));
    }

    loggers.add('my-logger', {
        exitOnError: false,
        levels: myCustomLevels.levels,
        format: combine(
            format.timestamp(),
            format.json(),
        ),
        transports: transportsList,
    })

    const logger = loggers.get('my-logger')

    // handle unhandled rejection
    // works with asynchronized code 
    // for example call to a database or call to a remote http service
    process.on('unhandledRejection', (ex) => {
        logger.error(`WE GOT ERROR REJECTION`);
        logger.error(`${ex.message} - ${ex}`);
    });
}