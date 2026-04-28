const log = require('../global-functions/console');
const axios = require("axios");

const token = process.env.SHAMIR_TOKEN;
const sender = process.env.SHAMIR_SENDER;

function sendSMSWithShamir(recipient, message) {
    return new Promise((resolve, reject) => {
        const config = {
            headers: {
                Authorization: `Basic ${token}`,
            }
        }

        const msg = {
            Data: {
                Message: message,
                Recipients: [{
                    Phone: recipient
                }],
                Settings: {
                    Sender: sender
                }
            }
        };

        const requestLogMsg = {
            requestTime: new Date(),
            type: "sms service - shamir",
            requestData: JSON.stringify(msg),
            responseData: "",
        };
        const requestLogURL = `${process.env.REQUEST_LOG_SERVICE_PROTOCOL}://${process.env.REQUEST_LOG_SERVICE_IP}:${process.env.REQUEST_LOG_SERVICE_PORT}/api/request-log`;

        axios.post('https://capi.inforu.co.il/api/v2/SMS/SendSms', msg, config).then(async (response) => {
            log.normal(`request: ${response.data?.RequestId}, status: ${response.data?.StatusDescription}, recipient: ${recipient}, message: ${message}`);

            try {
                requestLogMsg.responseData = JSON.stringify(response);
                if (+process.env.REQUEST_LOG)
                    await axios.post(requestLogURL, requestLogMsg);
            } catch (error) {
                log.error(`REQUEST_LOG - ${error.message}`);
            }

            resolve(true);
        })
            .catch(async (error) => {
                log.error(error.message);

                try {
                    requestLogMsg.responseData = JSON.stringify(error.message);
                    if (+process.env.REQUEST_LOG)
                        await axios.post(requestLogURL, requestLogMsg);
                } catch (error) {
                    log.error(`REQUEST_LOG - ${error.message}`);
                }

                reject(new Error(error.message));
            })
    });
}

module.exports.sendSMSWithShamir = sendSMSWithShamir;