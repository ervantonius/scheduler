require('./../../Global.js');
const crypto = require('crypto');
const logger = require('./../../Logger.js')('tour_comment');
const secret_key = 'Momotrip2017!';


/******************* Generate Code ********************/
var generate_code_token = (code) => {
	return crypto.createHmac('sha1', secret_key)
				 .update(code)
				 .digest('hex');
}
/******************************************************/


/************* Start for Send Mail ***************/
var start = (end_date) => {
	return new Promise((resolve) => {
		var logs_arr = [];
		var query = db.query("SELECT keyid, keydata, keydesc, keytype FROM `t_mst_configuration` WHERE keyid = 'tr_com_template'", async (err, result) => {
			if (err) {
				logger.error('Query Select `t_mst_configuration` Error: ', err);
				logs_arr.push('['+sekarang+'] --- Query Select `t_mst_configuration` Error: ', err);
				resolve(logs_arr);
			}
			else {
				if (result.length > 0) {
					logs_arr.push("["+sekarang+"] --- SELECT keyid, keydata, keydesc, keytype FROM `t_mst_configuration` WHERE keyid = 'tr_com_template'");
					await tours(result[0]);
				}
				else {
					logger.warn("No data from `t_mst_configuration` where keyid = 'tr_com_template'");
					logs_arr.push("["+sekarang+"] --- No data from `t_mst_configuration` where keyid = 'tr_com_template'");
					resolve(logs_arr);
				}
			}
			db.end();
		});
		logger.info(query.sql);

		var tours = (configuration) => {
			return new Promise((resolve_tours) => {
				var query = db.query("SELECT id FROM `tours` WHERE end_date = '"+end_date+"' AND status IN ('confirm', 'close')", async (err, result) => {
					if (err) {
						logger.error('Query Select `tours` Error: ', err);
						logs_arr.push('['+sekarang+'] --- Query Select `tours` Error: ', err);
						resolve(logs_arr);
						resolve_tours(false);
					}
					else {
						if (result.length > 0) {
							var tour_id = [];
							for (var i = 0; i < result.length; i++) {
								tour_id.push(result[i].id);
							}
							logs_arr.push("["+sekarang+"] --- SELECT * FROM `tours` WHERE end_date = '"+end_date+"' AND status IN ('confirm', 'close')");
							await trx_booking(tour_id.toString(), configuration);
							resolve_tours(true);
						}
						else {
							logger.warn('No data from `tours` on '+end_date);
							logs_arr.push('['+sekarang+'] --- No data from `tours` on '+end_date);
							resolve(logs_arr);
							resolve_tours(false);
						}
					}
				});
				logger.info(query.sql);
			});
		}
		
		var trx_booking = (tour_id, configuration) => {
			return new Promise((resolve_booking) => {
				var query = db.query("SELECT id FROM `trx_booking` WHERE (dp_booking_code LIKE '%-1' OR dp_booking_code = '') AND status = 'success' AND transaction_id IN ("+tour_id+")", async (err, result) => {
					if (err) {
						logger.error('Query Select `trx_booking` Error: ', err);
						logs_arr.push('['+sekarang+'] --- Query Select `trx_booking` Error: ', err);
						resolve(logs_arr);
						resolve_booking(false);
					}
					else {
						if (result.length > 0) {
							var booking_id = [];
							for (var i = 0; i < result.length; i++) {
								booking_id.push(result[i].id);
							}
							logs_arr.push("["+sekarang+"] --- SELECT * FROM `trx_booking` WHERE (dp_booking_code LIKE '%-1' OR dp_booking_code = '') AND status = 'success' AND transaction_id IN ("+tour_id+")");
							await trx_booking_contact(booking_id.toString(), configuration);
							resolve_booking(true);
						}
						else {
							logger.warn('No data from `trx_booking` on '+end_date);
							logs_arr.push('['+sekarang+'] --- No data from `trx_booking` on '+end_date);
							resolve(logs_arr);
							resolve_booking(false);
						}
					}
				});
				logger.info(query.sql);
			});
		}

		var trx_booking_contact = (booking_id, configuration) => {
			return new Promise((resolve_booking_contact) => {
				var query = db.query("SELECT bc.*, t.id AS tour_id, t.title as judul_trip, t.guide_tour_program_id FROM `trx_booking_contact` AS bc JOIN `trx_booking` AS b ON bc.booking_id = b.id JOIN `tours` AS t ON b.transaction_id = t.id WHERE bc.booking_id IN ("+booking_id+") AND bc.email != '' GROUP BY bc.email, tour_id", (err, result) => {
					if (err) {
						logger.error('Query Select `trx_booking_contact` Error: ', err);
						logs_arr.push('['+sekarang+'] --- Query Select `trx_booking_contact` Error: ', err);
						resolve(logs_arr);
						resolve_booking_contact(false);
					}
					else {
						if (result.length > 0) {
							logs_arr.push("["+sekarang+"] --- SELECT bc.*, t.id AS tour_id, t.title as judul_trip, t.guide_tour_program_id FROM `trx_booking_contact` AS bc JOIN `trx_booking` AS b ON bc.booking_id = b.id JOIN `tours` AS t ON b.transaction_id = t.id WHERE bc.booking_id IN ("+booking_id+") AND bc.email != '' GROUP BY bc.email, tour_id");

							var insert_sendmail = async () => {
								var count = result.length;
								for (var i = 0; i < result.length; i++) {
									var token = generate_code_token(result[i].email+result[i].booking_id);
									var [bool, logs_arr] = await insert_data(result[i], token);
									if (bool === true) {
										var [logs_arr] = await send_mail(Object.assign(result[i], configuration), token);
									}
									count--;
									if (count === 0) {
										resolve(logs_arr);
										resolve_booking_contact(true);
									}
								}
							}
							insert_sendmail();
						}
						else {
							logger.warn('No data from `trx_booking_contact` on '+end_date);
							logs_arr.push('['+sekarang+'] --- No data from `trx_booking_contact` on '+end_date);
							resolve(logs_arr);
							resolve_booking_contact(false);
						}
					}
				});
				logger.info(query.sql);
			});
		}

		var insert_data = (data, token) => {
			return new Promise((resolve_insert) => {
				var sql = "INSERT INTO `tour_comment_notifications` (`code`, `email`, `user_id`, `trx_booking_id`, `guide_tour_program_id`, `tour_id`, `created_by`) VALUES (?, ?, ?, ?, ?, ?, ?)";
				db.query(sql, [token, data.email, data.user_id, data.booking_id, data.guide_tour_program_id, data.tour_id, 'momo-scheduler'], (err) => {
					if (err) {
						logger.error('Query Insert error: ', err);
						logs_arr.push('['+sekarang+'] --- Query Insert error: ', err);
						resolve_insert([false, logs_arr]);
					}
					else {
						logger.info(sql);
						logger.info('Insert data berhasil');
						logs_arr.push("["+sekarang+"] --- "+sql);
						resolve_insert([true, logs_arr]);
					}
				});
			});
		}

		var send_mail = (data, token) => {
			return new Promise((resolve_send) => {
				ejs.renderFile(__dirname+'/../../templates/'+data.keydata+'.ejs', {data: data, token: token, config_url: config.config_url}, (err, html) => {
					if (err) {
						logger.error('Error renderFile: ', err);
						logs_arr.push('['+sekarang+'] --- Error renderFile: ', err);
						resolve_send([logs_arr]);
					}
					else {
						var mailOptions = {
							from: '"Momotrip.co.id" <'+config.mailer.email+'>',
							to: data.email,
							subject: 'Berikan ulasanmu untuk trip '+data.judul_trip,
							html: html
						};

						sender.sendMail(mailOptions, (err, info) => {
							if (err) {
								logger.error('Error Sender Mail: ', err);
								logs_arr.push('['+sekarang+'] --- Error Sender Mail: ', err);
								resolve_send([logs_arr]);
							}
							else {
								logger.info('Email Response: ', info);
								logs_arr.push('['+sekarang+'] --- Email Response: ', info);
								resolve_send([logs_arr]);								
							}
						});
					}
				});
			});
		}
	});
}

module.exports = start;
/*************************************************/