const express = require('express');
const log = require('../global-functions/console');
const {
    newSms
} = require('../handlers/send-sms');

const router = express.Router();

router.post('/send-sms', async (req, res) => {
    try {
        const data = req.body;
        await newSms(data);
        res.send(true);
    } catch (ex) {
        log.error(`API send SMS - ${ex.message}`);
        res.status(500).send(ex.message);
    }
});

module.exports = router;