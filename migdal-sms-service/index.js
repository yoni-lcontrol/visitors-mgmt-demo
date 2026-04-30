const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const express = require('express');
const compression = require('compression');
require('dotenv').config({
    path: path.join(__dirname, '/.env'),
});

require('./startup/logging')();
require('./handlers/sms-gsm')();

const log = require('./global-functions/console');
const app = express();

// allow access from other services
app.use(cors());
app.use((req, res, next) => {
    res.append('Access-Control-Allow-Headers', 'Content-Type');
    next();
})

// support parsing of application/json type post data
app.use(express.json({
    limit: '50mb'
}));

// support parsing of application/x-www-form-urlencoded post data
app.use(express.urlencoded({
    limit: '50mb',
    extended: true
}));

// decrease the size of the response body and hence increase the speed of a web app
app.use(compression());

// HTTP request logger
if (process.env.NODE_ENV == 'development')
    app.use(morgan('dev'));

// set the restful API routes
require('./startup/routes')(app);

app.listen(process.env.SERVER_PORT, () => {
    log.info(`Listening on port ${process.env.SERVER_PORT}`);
});

function setTerminalTitle(title) {
    process.stdout.write(
        String.fromCharCode(27) + "]0;" + title + String.fromCharCode(7)
    );
}

setTerminalTitle('SMS Service');