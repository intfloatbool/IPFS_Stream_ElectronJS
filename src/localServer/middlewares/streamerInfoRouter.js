const express = require('express');
const router = express.Router();
const fs = require('fs');
const appConfig = require('../../../appFilesConfig');
const STATUS = require('../data/apiData').STATUS;

const STREAM_INFO_PATH = appConfig.files.USER_STREAM_INFO_JSON_PATH;
const RESULT_RESPONSE = {
    status: STATUS.UNDEFINED,
    body: STATUS.UNDEFINED
};

router.post('/', async (req, res) => {
    const streamInfo = req.body;
    try {
        RESULT_RESPONSE.status = await checkStreamInfo(streamInfo);
        RESULT_RESPONSE.body = streamInfo;
    } catch(err) {
        RESULT_RESPONSE.status = STATUS.FAILED;
        RESULT_RESPONSE.body = err.message;
    }

    res.json(RESULT_RESPONSE);
});

router.get('/', async (req,res) => {
    try {
        const streamInfo = await new Promise((resolve, rejected) => {
            try {
                const data = fs.readFileSync(STREAM_INFO_PATH, 'utf8');
                const parsed = JSON.parse(data);
                resolve(parsed);
            } catch(err) {
                rejected(err);
            }
        });
        RESULT_RESPONSE.status = STATUS.SUCCESS;
        RESULT_RESPONSE.body = streamInfo;
    } catch(err) {
        RESULT_RESPONSE.status = STATUS.FAILED;
        RESULT_RESPONSE.body = err.message;
    }

    res.json(RESULT_RESPONSE);
});

router.put('/', (req,res) => {

});

router.delete('/', (req,res) => {

});

function checkStreamInfo(streamInfo) {
    return new Promise((resolve, rejected) => {
        try {
            const streamKeys = Object.keys(streamInfo);
            const necessaryKeys = ['streamName', 'avaBase64'];
            let undefinedKeys;
            for(let i = 0; i < necessaryKeys.length; i++) {
                const key = necessaryKeys[i];
                if(!streamKeys.includes(key) || streamKeys[key] === '') {
                    if(!undefinedKeys)
                        undefinedKeys = 'UNDEFINED KEYS: ';
                    undefinedKeys += `${key} ,`;
                }
            }

            if(undefinedKeys) {
                throw new Error(undefinedKeys);
            }

            fs.writeFileSync(STREAM_INFO_PATH, JSON.stringify(streamInfo));
            resolve(STATUS.SUCCESS);
        } catch(err) {
            rejected(err);
        }
    });
}


module.exports = router;