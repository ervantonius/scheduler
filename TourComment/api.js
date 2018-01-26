const basicAuth = require('basic-auth');
const express = require('express');
const morgan = require('morgan');
const moment = require('moment');

const app = express();
const config = require('./../config.json');
const logger = require('./../Logger.js')('api_tourcomment');
const kemaren = moment().add(-1, 'days').format('YYYY-MM-DD');

/***************** Routing & Auth ****************/
var auth = (req, res, next) => {
	var user = basicAuth(req);
	if (!user || !user.name || !user.pass) {
		res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
		res.sendStatus(401);
		return;	
	}
	if (user.name === config.mailer.email && user.pass === config.mailer.password) {
		next();
	} else {
		res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
		res.sendStatus(401);
		return;
	}
}

app.use(morgan("combined", { stream: { write: (message) => logger.info(message) }})); // Log for Hit API
app.get('/:date?', auth, (req, res) => {
	var validate_date = moment(req.params.date, 'YYYY-MM-DD', true).isValid();
    if (req.params.date && validate_date) {
    	var mulai = async () => {
    		return await require('./Core.js')(req.params.date);
    	}
    	mulai().then((logs) => {
	    	res.status(200).json({
	    		status: 200,
	    		message: 'End Date `'+req.params.date+'` has been checked',
	    		logs: logs,
	    		info: 'Check logs on server for details',
	    		note: 'Run node api.js on server to actived again'
	    	});
	    	process.exit();
    	});
    }
    else if (req.params.date === undefined) {
    	var mulai = async () => {
    		return await require('./Core.js')(kemaren);
    	}
    	mulai().then((logs) => {
	    	res.status(200).json({
	    		status: 200,
	    		message: 'End Date `'+kemaren+'` has been checked',
	    		logs: logs,
	    		info: 'Check logs on server for details',
	    		note: 'Run node api.js on server to actived again'
	    	});
	    	process.exit();
    	});
    }
    else {
    	res.status(404).json({
    		status: 404,
    		message: 'Wrong Date Format! Require YYYY-MM-DD'
    	});
    }
});

app.listen(3030); // port for API
/************************************************/