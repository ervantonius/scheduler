require('./../../Global.js');
const logger = require('./../../Logger.js')('tour_comment_voucher');

var query = db.query("SELECT template_type, trans_type, product_id, description, value_type, value, min_transaction, min_pax, max_discount, reuse, maxlimit, expired_days, created_by, modified_by FROM `t_mst_coupon_template` WHERE template_type = 'NEW_COMMENT'", async (err, result) => {
	if (err) {
		logger.error('Query Select `t_mst_coupon_template` error: ', err);
	}
	else if (result.length === 0) {
		logger.warn("No data from `t_mst_coupon_template` where template_type = 'NEW_COMMENT'");
	}
	else {
		await start(result[0]);
	}
	db.end();
});


var start = (coupon_template) => {
	return new Promise((resolve) => {
		var query = db.query("SELECT * FROM `tour_comment_coupons` ORDER BY id DESC LIMIT 1", async (err, result) => {
			if (err) {
				logger.error('Query Select `tour_comment_coupons` error: ', err);
				resolve(false);
			}
			else if (result.length === 0) {
				logger.warn('No data from `tour_comment_coupons`');
				resolve(false);
			}
			else {
				await tour_comment_id(result[0].comment_id, coupon_template);
			}
			resolve(true);
		});
		logger.info(query.sql);
	});
}

var tour_comment_id = (comment_id, coupon_template) => {
	return new Promise((resolve) => {
		var query = db.query("SELECT c.id, c.user_id, c.email, c.tour_id, cu.first_name, cu.last_name, ct.title FROM `tour_comments` AS c JOIN `t_mst_users` AS cu ON cu.id_user = c.user_id JOIN `tours` AS ct ON ct.id = c.tour_id WHERE c.id > "+comment_id, (err, result) => {
			if (err) {
				logger.error('Query Select `tour_comments` Join `t_mst_coupon_template` error: ', err);
				resolve(false);
			}
			else if (result.length === 0) {
				logger.warn('No data from `tour_comments`');
				resolve(false);
			}
			else {
				var insert_sendmail = async () => {
					for (var i = 0; i < result.length; i++) {
						var [success] = await insert_data(Object.assign(result[i], coupon_template));
						if (success !== false) {
							await send_mail(Object.assign(result[i], coupon_template), success);
						}
					}
					resolve(true);
				}
				insert_sendmail();
			}
		});
		logger.info(query.sql);
	});
}

var insert_data = (data) => {
	return new Promise((resolve) => {
		var generate_voucher = generate_code_voucher();
		var check_voucher = (code_voucher) => {
			db.query("SELECT * FROM `t_mst_coupon` WHERE code = '"+code_voucher+"' AND status = 'active'", (err, result) => { 
				if (err) {
					logger.error('Error Check Code Voucher: ', err);
					resolve([false]);
				}
				else if (result.length === 0) {
					insert(code_voucher);
				}
				else {
					return check_voucher(generate_code_voucher()); 
				}
			});
		}
		check_voucher(generate_voucher);

		var insert = (code_voucher) => {
			var sql = "INSERT INTO `t_mst_coupon` (code, trans_type, product_id, value_type, value, min_transaction, min_pax, max_discount, reuse, maxlimit, email, actived_date, expired_date, description, created_date) VALUES ('"+code_voucher+"', '"+data.trans_type+"', "+data.product_id+", '"+data.value_type+"', '"+data.value+"', '"+data.min_transaction+"', '"+data.min_pax+"', '"+data.max_discount+"', '"+data.reuse+"', '"+data.maxlimit+"', '"+data.email+"', '"+sekarang+"', '"+moment().add(data.expired_days, 'days').format('YYYY-MM-DD HH:mm:ss')+"', '"+data.description+"', '"+sekarang+"')";
			db.query(sql, (err, result) => {
				if (err) {
					logger.error('Query Insert `t_mst_coupon` error: ', err);
					resolve([false]);
				}
				else {
					logger.info(sql);
					db.query("INSERT INTO `tour_comment_coupons` (created_by, modified_by, comment_id, coupon_id) VALUES ('"+data.created_by+"', '"+data.modified_by+"', "+data.id+", "+result.insertId+")", (err) => {
						if (err) {
							logger.error('Query Insert `tour_comment_coupons` error: ', err);
							resolve([false]);
						}
						else {
							logger.info("INSERT INTO `tour_comment_coupons` (created_by, modified_by, comment_id, coupon_id) VALUES ('"+data.created_by+"', '"+data.modified_by+"', "+data.id+", "+result.insertId+")");
							resolve([code_voucher]);
						}
					});
				}
			});
		}
	});
}

var send_mail = (data, voucher) => {
	return new Promise((resolve) => {
		data.value = number_format(data.value, '.'); // rupiah format number
		ejs.renderFile(__dirname+'/../../templates/voucher.ejs', {data: data, code_voucher: voucher}, (err, html) => {
			if (err) {
				logger.error('Error renderFile: ', err);
				resolve([false]);
			}
			else {
				var mailOptions = {
					from: '"Momotrip.co.id" <'+config.mailer.email+'>',
					to: data.email,
					subject: 'Voucher Momotrip.co.id untuk kamu',
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