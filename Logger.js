const winston = require('winston');
const fs = require('fs');

const logDir = __dirname + '/logs';


if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const logger = (logFile) => {
    return new(winston.Logger)({
        transports: [
            new(winston.transports.Console)({
                colorize: true
            }),

            new(winston.transports.File)({
                filename: logDir + '/' + logFile + '.log',
                maxsize: 2097152, // 2MB
                maxFiles: 10,
                zippedArchive: true,
                json: false
            })
        ]
    });
}

module.exports = logger;