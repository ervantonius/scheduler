require('./../Global.js');
const logger = require('./../Logger.js')('birthday');
const tahun_sekarang = moment().format('YYYY');

db.query("SELECT `template_type`, `trans_type`, `product_id`, `description`, `value_type`, `value`, `min_transaction`, `min_pax`, `max_discount`, `reuse`, `maxlimit`, `expired_days`, `created_by`, `modified_by` FROM `t_mst_coupon_template` WHERE `template_type` = 'BIRTHDAY_USER'", async (err, result) => {
	if (err) {
		logger.error('Query Select `t_mst_coupon_template` error: ', err);
	}
	else if (result.length === 0) {
		logger.warn("No data from `t_mst_coupon_template` where template_type = 'BIRTHDAY_USER'");
	}
	else {
		await start(result[0])
	}
	db.end();
});

var start = (coupon_template) => {
	return new Promise((resolve) => {
		var query_birthday = db.query("SELECT `u`.`id_user`, `u`.`email`, `u`.`first_name`, `u`.`last_name`, `u`.`birthday`, `u`.`salutation`, `cb`.`has_birthday` FROM `t_mst_users` AS `u` LEFT JOIN `t_mst_coupon_birthday` AS `cb` ON `u`.`id_user` = `cb`.`user_id` AND `cb`.`has_birthday` = '"+tahun_sekarang+"' WHERE `u`.`verified` = 0 AND `u`.`birthday` LIKE '%"+moment().format('-MM-DD')+"'", async (err, result) => {
			if (err) {
				logger.error('Query Select `t_mst_users` for birthday greetings error: ', err);
				resolve(false);
			}
			else if (result.length === 0) {
				logger.warn('No data from `t_mst_users` for birthday greetings');
				resolve(false);
			}
			else {
				for (var i = 0; i < result.length; i++) {
					if (result[i].has_birthday == null) {
						await send_mail_birthday(result[i]);
					}
					else {
						logger.warn(result[i].email+' has been sended this year for birthday greetings');
					}
				}
			}
		});
		logger.info(query_birthday.sql);


		var query_30 = db.query("SELECT `u`.`id_user`, `u`.`email`, `u`.`first_name`, `u`.`last_name`, `u`.`birthday`, `u`.`salutation`, `cb`.`has_birthday` FROM `t_mst_users` AS `u` LEFT JOIN `t_mst_coupon_birthday` AS `cb` ON `u`.`id_user` = `cb`.`user_id` AND `cb`.`has_birthday` = '"+tahun_sekarang+"' WHERE `u`.`verified` = 0 AND `u`.`birthday` LIKE '%"+moment().add('30', 'days').format('-MM-DD')+"'", async (err, result) => {
			if (err) {
				logger.error('Query Select `t_mst_users` for H-30 birthday voucher error: ', err);
				resolve(false);
			}
			else if (result.length === 0) {
				logger.warn('No data from `t_mst_users` for H-30 birthday voucher');
				resolve(false);
			}
			else {
				for (var i = 0; i < result.length; i++) {
					if (result[i].has_birthday == null) {
						await insert_sendmail(Object.assign(result[i], coupon_template));
					}
					else {
						logger.warn(result[i].email+' has been sended this year for H-30 birthday voucher');
					}
				}
				resolve(true);
			}
		});
		logger.info(query_30.sql);
	});
}

var insert_sendmail = (data) => {
	return new Promise((resolve) => {
		var generate_voucher = generate_code_voucher();
		var check_voucher = (code_voucher) => {
			db.query("SELECT * FROM `t_mst_coupon` WHERE code = '"+code_voucher+"' AND status = 'active'", (err, result) => { 
				if (err) {
					logger.error('Error Check Code Voucher: ', err);
					resolve(false);
				}
				else if (result.length === 0) {
					insert_data(code_voucher);
				}
				else {
					return check_voucher(generate_code_voucher()); 
				}
			});
		}
		check_voucher(generate_voucher);

		var insert_data = (code_voucher) => {
			var sql = "INSERT INTO `t_mst_coupon` (code, trans_type, product_id, value_type, value, min_transaction, min_pax, max_discount, reuse, maxlimit, email, actived_date, expired_date, description, created_date) VALUES ('"+code_voucher+"', '"+data.trans_type+"', "+data.product_id+", '"+data.value_type+"', '"+data.value+"', '"+data.min_transaction+"', '"+data.min_pax+"', '"+data.max_discount+"', '"+data.reuse+"', '"+data.maxlimit+"', '"+data.email+"', '"+sekarang+"', "+((data.expired_days) ? "'"+moment().add(data.expired_days, 'days').format('YYYY-MM-DD HH:mm:ss')+"'" : null)+", '"+data.description+"', '"+sekarang+"')";
			db.query(sql, (err, result) => {
				if (err) {
					logger.error('Query Insert `t_mst_coupon` error: ', err);
					resolve(false);
				}
				else {
					logger.info(sql);
					db.query("INSERT INTO `t_mst_coupon_birthday` (`coupon_code`, `user_id`, `has_birthday`) VALUES ('"+code_voucher+"', "+data.id_user+", '"+tahun_sekarang+"')", (err) => {
						if (err) {
							logger.error('Query Insert `t_mst_coupon_birthday` error: ', err);
							resolve(false);
						}
						else {
							logger.info("INSERT INTO `t_mst_coupon_birthday` (`coupon_code`, `user_id`, `has_birthday`) VALUES ('"+code_voucher+"', "+data.id_user+", '"+tahun_sekarang+"')");
							send_mail(data, code_voucher);
						}
					});
				}
			});
		}

		var send_mail = (data, voucher) => {
			data.value = number_format(data.value, '.'); // rupiah format number
			ejs.renderFile(__dirname+'/../templates/birthday_voucher.ejs', {data: data, code_voucher: voucher}, (err, html) => {
				if (err) {
					logger.error('Error renderFile: ', err);
					resolve(false);
				}
				else {
					var mailOptions = {
						from: '"Momotrip.co.id" <'+config.mailer.email+'>',
						to: data.email,
						subject: 'Voucher H-30 menjelang hari ulang tahunmu dari Momotrip.co.id',
						html: html
					};

					sender.sendMail(mailOptions, (err, info) => {
						if (err) {
							logger.error('Error Sender Mail: ', err);
							resolve(false);
						}
						else {
							logger.info('Email Response: ', info);
							resolve(true);
						}
					});
				}
			});
		}
	});
}

var send_mail_birthday = (data) => {
	return new Promise((resolve) => {
		data.umur = moment().diff(data.birthday, 'years');
		ejs.renderFile(__dirname+'/../templates/birthday.ejs', {data: data}, (err, html) => {
			if (err) {
				logger.error('Error renderFile: ', err);
				resolve([false]);
			}
			else {
				var mailOptions = {
					from: '"Momotrip.co.id" <'+config.mailer.email+'>',
					to: data.email,
					subject: 'Selamat Ulang Tahun dari Momotrip.co.id',
					html: html
				};

				sender.sendMail(mailOptions, (err, info) => {
					if (err) {
						logger.error('Error Sender Mail: ', err);
						resolve([false]);
					}
					else {
						logger.info('Email Response: ', info);
						resolve([true]);
					}
				});
			}
		});
	});
}