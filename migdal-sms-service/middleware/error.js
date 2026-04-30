const { loggers } = require('winston')
const logger = loggers.get('my-logger')

module.exports = function (err, req, res, next) {

    // types of writing a log:
    // error
    // warn
    // info
    // verbose 
    // debug
    // silly

    logger.error(err);
    res.status(500).send(err.message);
}