require('./../../Global.js');
const sendgrid = require('sendgrid')(config.api_sendgrid);
const logger = require('./../../Logger.js')('birthday');
const tahun_sekarang = moment().format('YYYY');

db.query("SELECT `template_type`, `trans_type`, `product_id`, `description`, `value_type`, `value`, `min_transaction`, `min_pax`, `max_discount`, `reuse`, `maxlimit`, `expired_days`, `created_by`, `modified_by` FROM `t_mst_coupon_template` WHERE `template_type` = 'BIRTHDAY_USER'", async (err, result) => {
	if (err) {
		logger.error('Query Select `t_mst_coupon_template` error: ', err);
	}
	else if (result.length === 0) {
		logger.warn("No data from `t_mst_coupon_template` where template_type = 'BIRTHDAY_USER'");
	}
	else {
		result[0].value = number_format(result[0].value, '.');
		await start(result[0])
	}
	db.end();
});

var start = async (coupon_template) => {
	await run_30(coupon_template);
	await run_birthday(coupon_template);
}

var run_birthday = (coupon_template) => {
	return new Promise((resolve) => {
		var query = db.query("SELECT `u`.`id_user`, `u`.`email`, `u`.`first_name`, `u`.`last_name`, `u`.`birthday`, `u`.`salutation`, `cb`.`has_birthday`, `cb`.`coupon_code` FROM `t_mst_users` AS `u` LEFT JOIN `t_mst_coupon_birthday` AS `cb` ON `u`.`id_user` = `cb`.`user_id` AND `cb`.`has_birthday` = '"+tahun_sekarang+"' WHERE `u`.`verified` = 0 AND `u`.`birthday` LIKE '%"+moment().format('-MM-DD')+"'", async (err, result) => {
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
					await send_mail(Object.assign(result[i], coupon_template), result[i].coupon_code, '15892b52-fc1b-4762-8d77-63cea0319a34', 'Selamat ulang tahun '+result[i].first_name);
				}
				resolve(true);
			}
		});
		logger.info(query.sql);
	});
}

var run_30 = (coupon_template) => {
	return new Promise((resolve) => {
		var query = db.query("SELECT `u`.`id_user`, `u`.`email`, `u`.`first_name`, `u`.`last_name`, `u`.`birthday`, `u`.`salutation`, `cb`.`has_birthday`, `cb`.`coupon_code` FROM `t_mst_users` AS `u` LEFT JOIN `t_mst_coupon_birthday` AS `cb` ON `u`.`id_user` = `cb`.`user_id` AND `cb`.`has_birthday` = '"+tahun_sekarang+"' WHERE DATEDIFF(DATE_FORMAT(`u`.`birthday`,'"+tahun_sekarang+"-%m-%d'), NOW()) <= 30 AND DATEDIFF(DATE_FORMAT(`u`.`birthday`,'"+tahun_sekarang+"-%m-%d'), NOW()) >= 0", async (err, result) => {
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
					if (result[i].has_birthday == null && result[i].coupon_code == null) {
						await insert_sendmail(Object.assign(result[i], coupon_template));
					}
				}
				resolve(true);
			}
		});
		logger.info(query.sql);
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
			var sql = "INSERT INTO `t_mst_coupon` (code, trans_type, product_id, value_type, value, min_transaction, min_pax, max_discount, reuse, maxlimit, email, actived_date, expired_date, description, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
			var query1 = db.query(sql, [code_voucher, data.trans_type, data.product_id, data.value_type, data.value, data.min_transaction, data.min_pax, data.max_discount, data.reuse, data.maxlimit, data.email, sekarang, ((data.expired_days) ? moment().add(data.expired_days, 'days').format('YYYY-MM-DD HH:mm:ss') : null), data.description, sekarang], (err, result) => {
				if (err) {
					logger.error('Query Insert `t_mst_coupon` error: ', err);
					resolve(false);
				}
				else {
					var query2 = db.query("INSERT INTO `t_mst_coupon_birthday` (`coupon_code`, `user_id`, `has_birthday`) VALUES (?, ?, ?)", [code_voucher, data.id_user, tahun_sekarang], async (err) => {
						if (err) {
							logger.error('Query Insert `t_mst_coupon_birthday` error: ', err);
							resolve(false);
						}
						else {
							await send_mail(data, code_voucher, 'c3caf892-4bde-4d56-a360-d88b6ad0574c', 'Rayakan ulang tahunmu bersama Momotrip.co.id');
							resolve(true);
						}
					});
					logger.info(query2.sql);
				}
			});
			logger.info(query1.sql);
		}
	});
}

var send_mail = (data, code_voucher, id_template, subject) => {
	return new Promise((resolve) => {
		var request = sendgrid.emptyRequest({
			method: 'POST',
			path: '/v3/mail/send',
			body: {
				personalizations: [{
					to: [{
						email: data.email
					}],
					subject: subject,
					substitutions: {
						"-nama-": data.first_name,
						"-kodevoucher-": code_voucher,
						"-hargavoucher-": data.value,
						"-reuse-": data.maxlimit.toString(),
						"-triptype-": data.trans_type
					} 
				}],
				from: {
					email: 'notif@momotrip.co.id',
					name: 'Momotrip.co.id'
				},
				content: [{
					type: 'text/html',
					value: ' '
				}],
				template_id: id_template
			}
		});

		sendgrid.API(request, (error, response) => {
			if (error) {
				logger.error('Error Sender Mail: ', error.response);
				resolve([false]);
			}
			else {
				logger.info('Email Response: ', response);
				resolve([true]);
			}

		});
	});
}