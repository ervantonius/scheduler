global.ejs = require('ejs');
global.moment = require('moment');
global.mysql = require('mysql');
global.nodemailer = require('nodemailer');
global.sekarang = moment().format('YYYY-MM-DD HH:mm:ss');
global.kemaren = moment().add(-1, 'days').format('YYYY-MM-DD');
global.config = require('./config.json');


/****************** Config DB & Mail *******************/
global.db = mysql.createConnection({
	host: config.db.host,
	port: config.db.port,
	user: config.db.user,
	password: config.db.password,
	database: config.db.name
});

global.sender = nodemailer.createTransport({
	service: config.mailer.service,
    auth: {
        user: (config.mailer.sendgrid_user) ? config.mailer.sendgrid_user : config.mailer.email,
        pass: config.mailer.password
    }
});
/*******************************************************/


/******************* Unique Function *******************/
global.generate_code_voucher = () => { 
	var char = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; 
	var code_voucher = '';

	for (var i = 0; i < 8; i++) { 
		code_voucher += char.charAt(Math.floor(Math.random() * char.length)); 
	}

	return code_voucher;
}

global.number_format = (number, format) => {
	return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, format);
}
/******************************************************/