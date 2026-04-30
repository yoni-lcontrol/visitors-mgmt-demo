const sms = require('../routes/sms');

// for error handling
const error = require('../middleware/error');

module.exports = function (app) {
    app.use('/sms', sms);
    
    app.use(error);
};