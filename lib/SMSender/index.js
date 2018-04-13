const https = require('https');
const mysql = require('mysql');
const config = require('./../../config.json');
const logger = require('./../../Logger.js')('sms');

/****************** Config DB & Mail *******************/
const db = mysql.createConnection({
	host: config.db.host,
	port: config.db.port,
	user: config.db.user,
	password: config.db.password,
	database: config.db.name
});
/*******************************************************/

/***************** Unique Function *****************/
var check_provider = (mnc) => {
	switch(mnc) {
		case '51000' :
			return 'PSN';
			break;
		case '51001' :
			return 'Indosat Ooredoo';
			break;
		case '51003' :
			return 'StarOne';
			break;
		case '51007' :
			return 'TelkomFlexi';
			break;
		case '51008' :
			return 'AXIS';
			break;
		case '51009' :
			return 'Smartfren';
			break;
		case '51010' :
			return 'Telkomsel';
			break;
		case '51011' :
			return 'XL';
			break;
		case '51020' :
			return 'TELKOMMobile';
			break;
		case '51021' :
			return 'IM3';
			break;
		case '51027' :
			return 'Net1';
			break;
		case '51028' :
			return 'Fren/Hepi';
			break;
		case '51088' :
			return 'BOLT! Super 4G';
			break;
		case '51089' :
			return '3';
			break;
		case '51099' :
			return 'Esia';
			break;
		default :
			return 'unknown';
			break;
	}
}
/**************************************************/



/***************** Start *****************/
var sql = "SELECT phone FROM customer_phone_number WHERE phone IS NOT NULL AND phone <> ''";
db.query(sql, async (err, result, fields) => {
	if (err) {
		logger.error('Query Select phone Error: ', err);
	}
	else {
		if (result.length > 0) {
			for (var i = 0; i < result.length; i++) {
				var number = result[i].phone.replace(/[^\w]/g, '').replace(/[\_]/g, '').replace(/[A-Za-z]/g, ''); // hapus semua simbol, spasi dan huruf dimanapun berada
				if (number.search('8') === 0) { // cari yg depannya 8
					if (number.length >= 9 && number.length <= 12) {
						update_after_validate(number.replace('8', '628'), result[i].phone);
					}
				}
				else if (number.search('08') === 0) { // cari yg depannya 08
					if (number.length >= 10 && number.length <= 13) {
						update_after_validate(number.replace('08', '628'), result[i].phone);
					}
				}
				else if (number.search('62') === 0) { // cari yg depannya 62
					if (number.length >= 11 && number.length <= 14) {
						update_after_validate(number, result[i].phone);
					}
				}
			}
			await start();
		}
		else {
			logger.warn('Data phone not found');
		}
	}
	db.end();
});

var update_after_validate = (phone_international, real_phone) => {
	var sql = "UPDATE customer_phone_number SET phone_international = ?, status = 'valid' WHERE phone = ?";
	db.query(sql, [phone_international, real_phone], (err, result, fields) => {
		if (err) {
			logger.error('Query Update Validate Error: ', err);
		}
		else {
			logger.info('Validate '+real_phone+' to '+phone_international+' = valid')
		}
	});
}

var start = () => {
	return new Promise((resolve) => {
		var sql = "SELECT keydesc FROM t_mst_configuration WHERE keyid = 'sms'";
		db.query(sql, (err, result, fields) => {
			if (err) {
				resolve(false);
				logger.error('Query Select `t_mst_configuration` Error: ', err);
			}
			else {
				if (result.length > 0) {
					if (result[0].keydesc.length <= 160) {
						sms(result[0].keydesc);
					}
					else {
						resolve(false);
						logger.warn('Pesan SMS melebihi 160 karakter, silakan edit pesan terlebih dahulu');
					}
				}
				else {
					resolve(false);
					logger.warn('Data `t_mst_configuration` not found');
				}
			}
		});

		var sms = (pesan) => {
			var sql = "SELECT DISTINCT phone_international FROM customer_phone_number WHERE phone_international IS NOT NULL AND phone_international <> '' AND status = 'valid'";
			db.query(sql, (err, result, fields) => {
				if (err) {
					resolve(false);
					logger.error('Query Select phone_international Error: ', err);
				}
				else {
					if (result.length > 0) {
						var success = async () => {
							for (var i = 0; i < result.length; i++) {
								var [success, response] = await send(result[i].phone_international, pesan);
								update_after_send(result[i].phone_international, (success) ? 'valid' : 'invalid', (success) ? response.network : 'Error Code: '+response.status, (success) ? check_provider(response.network) : '');
							}
							resolve(true);
						}
						success();
					}
					else {
						resolve(false);
						logger.warn('Data phone_international not found');
					}
				}
			});
		}
	});
}

var send = (phone, pesan) => {
	return new Promise((resolve) => {
		var data = JSON.stringify({
			api_key: config.api_key,
			api_secret: config.api_secret,
			to: phone,
			from: 'MOMOTRIP',
			text: pesan
		});

		var options = {
			host: 'rest.nexmo.com',
			path: '/sms/json',
			port: 443,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(data)
			}
		};

		var req = https.request(options);

		req.write(data);
		req.end();

		var responseData = '';
		req.on('response', function(res){
			res.on('data', function(chunk){
				responseData += chunk;
			});

			res.on('end', function(){
				var decoded_response = JSON.parse(responseData);

				if (decoded_response.messages[0].status == 0) {
					logger.info('Response Nexmo : ', decoded_response.messages[0]); // cek response after send
					resolve([true, decoded_response.messages[0]]);
				}
				else {
					logger.info('Response Nexmo : ', decoded_response.messages[0]); // cek response after send
					resolve([false, decoded_response.messages[0]]);
				}
			});
	
		});
	});
}

var update_after_send = (phone_international, status, network_code, provider) => {
	return new Promise((resolve) => {
		var sql = "UPDATE customer_phone_number SET status = ?, network_code = ?, provider = ? WHERE phone_international = ?";
		db.query(sql, [status, network_code, provider, phone_international], (err, result, fields) => {
			if (err) {
				logger.error('Query Update Send Error: ', err);
				resolve(false);
			}
			else {
				if (status === 'invalid') {
					logger.warn('Gagal mengirim SMS ke '+phone_international+' -- '+network_code);
					resolve(false);
				}
				else {
					logger.info('Berhasil mengirim SMS ke '+phone_international);
					resolve(true);
				}
			}
		});
	});
}
/*************************************************/