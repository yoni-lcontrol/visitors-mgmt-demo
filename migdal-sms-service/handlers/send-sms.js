const log = require('../global-functions/console');
const {
    sendSMSWithGSM
} = require('./sms-gsm');
const {
    sendSMSWithShamir
} = require('./sms-shamir');
const {
    sendSmsWithSNS
} = require('./sms-sns');

const smsQueue = [];

async function newSms(data) {
    const phonesNumber = data.to.split(',');

    for (let phoneNumber of phonesNumber) {
        const fixPhoneNumber = fixNumber(phoneNumber);

        if (fixPhoneNumber) {
            if (+process.env.USE_GSM_MODEM) {
                addQueue(fixPhoneNumber, data.text);
            }

            if (+process.env.USE_SHAMIR_SYS)
                await sendSMSWithShamir(fixPhoneNumber, data.text);

            if (+process.env.USE_SNS_SYS)
                await sendSmsWithSNS({ phoneTo: fixPhoneNumber, text: data.text });
        }
    }
}

function fixNumber(number) {
    const validChars = /^\+?(972\-?)?0?(([23489]{1}\-?\d{7})|[5]{1}\d{1}\-?\d{7})$/.test(number);

    if (!validChars) {
        log.error(`invalid number ${number}`);
        return '';
    }

    number = number.replace(/-/g, ''); // remove all '-' char
    number = number.indexOf('0') == 0 ? number.replace(/0/, '+972') : number; // sets +972 as prefix
    number = number.indexOf('0') == 4 ? number.replace(/0/, '') : number;

    if (number.length != 13) {
        log.error(`invalid number ${number}`);
        return '';
    }

    return number;
}

function addQueue(phoneNumber, message) {
    smsQueue.push({
        phoneNumber,
        message
    });
    startWorker();
}

let running = false;

function startWorker() {
    if (running)
        return;

    running = true;

    (async () => {
        while (smsQueue.length > 0) {
            const job = smsQueue.shift();
            try {
                await sendSMSWithGSM(job.phoneNumber, job.message);
                await sleep(5000);
            } catch (e) {
                log.error(`failed to send to ${job.phoneNumber}: ${e.message}`);
                await sleep(5000);
            }
        }
        running = false;
    })().catch(e => {
        running = false;
        log.error(`worker crashed: ${e.message}`);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


module.exports.newSms = newSms;