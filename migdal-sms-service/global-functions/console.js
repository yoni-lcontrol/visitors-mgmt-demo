const { loggers } = require('winston')
const logger = loggers.get('my-logger')

// white
function normal(msg) {
    logger.normal(msg);
}

// yellow msg
function alert(msg) {
    logger.alert(msg);
}

// red msg
function error(msg) {
    logger.error(msg);
}

// green
function msg(msg) {
    logger.msg(msg);
}

// purple
function specialMsg(msg) {
    logger.specialMsg(msg);
}

// blue
function info(msg) {
    logger.info(msg);
}

module.exports.normal = normal;
module.exports.alert = alert;
module.exports.error = error;
module.exports.specialMsg = specialMsg;
module.exports.info = info;
module.exports.msg = msg;