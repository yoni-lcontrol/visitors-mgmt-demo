let serialportgsm;
try {
    serialportgsm = require('serialport-gsm');
} catch (err) {
    // serialport native module may not be available if GSM is disabled
}
const log = require('../global-functions/console');
const axios = require("axios");

var modem;

module.exports = function () {
    if (+process.env.USE_GSM_MODEM) {
        getList();

        modem = serialportgsm.Modem();

        openPort();

        modem.on('open', onOpen);
        modem.on('close', onClose);
        modem.on('error', onError);
        //modem.on('onSendingMessage', result => { status, request, data });
        //modem.on('onNewMessage', messageDetails);
        //modem.on('onNewMessageIndicator', result => { sender, timeSent });
        //modem.on('onNewIncomingCall', result => { number, numberScheme });
        //modem.on('onMemoryFull', result => { status, data });
    }
}

function openPort() {
    let options = {
        baudRate: +process.env.SERIAL_PORT_BAUD_RATE,
        dataBits: +process.env.SERIAL_PORT_DATA_BITS,
        stopBits: +process.env.SERIAL_PORT_STOP_BITS,
        parity: process.env.SERIAL_PORT_PARITY,
        rtscts: false,
        xon: false,
        xoff: false,
        xany: false,
        autoDeleteOnReceive: true,
        enableConcatenation: true,
        incomingCallIndication: true,
        incomingSMSIndication: true,
        pin: '',
        customInitCommand: '',
        //logger: console
    }

    modem.open(process.env.SERIAL_PORT_PATH, options, async (err, data) => {
        if (err) {
            log.error(err.message);
            await sleep(10000);
            openPort();
        }
    })
}

function onOpen(data) {
    log.specialMsg('--Opening port--');
    log.msg(`request: ${data?.request}, status: ${data?.status}, modem: ${data?.data?.modem}, status: ${data?.data?.status}`);
    modem.initializeModem((data) => {
        log.msg(`request: ${data?.request}, status: ${data?.status}, msg: ${data?.data}`);
    })
}

async function onClose(data) {
    if (data) {
        log.alert(`modem: ${data?.modem}, status: ${data?.status}`);
        await sleep(10000);
        openPort();
    }
}

function onError(err) {
    // need to check
    console.log(err);
    log.error(err);
}

async function sendSMSWithGSM(recipient, message) {
    const requestLogURL = `${process.env.REQUEST_LOG_SERVICE_PROTOCOL}://${process.env.REQUEST_LOG_SERVICE_IP}:${process.env.REQUEST_LOG_SERVICE_PORT}/api/request-log`;

    const msg = {
        Data: {
            Message: message,
            Recipients: [{
                Phone: recipient
            }],
            Settings: {
                Sender: "GSM"
            }
        }
    };

    const requestLogMsg = {
        requestTime: new Date(),
        type: "sms service - GSM",
        requestData: JSON.stringify(msg),
        responseData: "",
    };

    return new Promise(async (resolve, reject) => {
        if (!modem || !modem.isOpened) {
            const errMsg = "modem is close";

            try {
                if (+process.env.REQUEST_LOG) {
                    requestLogMsg.responseData = JSON.stringify(errMsg);
                    await axios.post(requestLogURL, requestLogMsg);
                }
            } catch (error) {
                log.error(`REQUEST_LOG - ${error.message}`);
            }

            reject(new Error(errMsg))
            return;
        }

        log.normal(`Sending SMS VIA GSM. Recipient: ${recipient} , Message: ${message}`);

        // IMPORTANT: this callback is ONLY the queue ack - serialport-gsm (the Node.js package); do not resolve here
        // Calling modem.sendSMS(...) queues the job inside serialport-gsm
        // The library’s internal queue worker later talks to the modem and issues AT+CMGS with the PDU. When that finishes, it emits - 'onSendingMessage'
        modem.sendSMS(recipient, message, false, async (data) => {

            if (data?.status == 'success') {
                let responseMsg = '';
                if (data?.data?.recipient)
                    responseMsg = `MSG ID:${data.data?.messageId} | Request: ${data?.request}, status: ${data?.status}, recipient: ${data?.data?.recipient}, message: ${data?.data?.message}`;
                else // Success to push to serialport-gsm queue
                    responseMsg = `MSG ID:${data.data?.messageId} | Request: ${data?.request}, status: ${data?.data?.response}, recipient: ${recipient}, message: ${message}`;

                log.normal(responseMsg);
                resolve(true);
            }
            else {
                log.normal(`Failed send request: ${data?.request}, status: ${data?.status}, recipient: ${recipient}, message: ${message}`);
                reject();
            }

            try {
                // Log sms data to request logs table
                if (+process.env.REQUEST_LOG) {
                    requestLogMsg.responseData = JSON.stringify(responseMsg);
                    await axios.post(requestLogURL, requestLogMsg);
                }
            } catch (error) {
                log.error(`REQUEST_LOG - ${error.message}`);
            }

            resolve(true);
        })
    });
}

function getList() {
    serialportgsm.list((err, result) => {
        log.info("Active Ports:");
        result.forEach((port) => {
            log.msg(port.path);
        });
    })
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.sendSMSWithGSM = sendSMSWithGSM;