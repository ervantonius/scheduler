require('./../../Global.js');
const logger = require('./../../Logger.js')('tour_subscribe');

db.query("SELECT `tan`.`id`, `tan`.`guide_tour_program_id`, `tan`.`email`, `t`.`trip_type`, `t`.`title`, `g`.`slug`, `t`.`category_name`, `p`.`slug` AS `province`, `c`.`name` AS `city`, `m`.`full_name` AS `momoranger`, `t`.`start_date`, `t`.`end_date`, `t`.`total_day`, `t`.`duration_type`, `tp`.`source` AS `photo` FROM `tour_available_notification` AS `tan` JOIN `tours` AS `t` ON `t`.`guide_tour_program_id` = `tan`.`guide_tour_program_id` AND `t`.`status` = 'open' JOIN `guide_tour_program` AS `g` ON `g`.`id` = `tan`.`guide_tour_program_id` JOIN `t_mst_provinces` AS `p` ON `p`.`id` = `g`.`province_id` JOIN `t_mst_cities` AS `c` ON `c`.`id` = `t`.`city_id` JOIN `t_mst_guides` AS `m` ON `m`.`id` = `g`.`guide_id` LEFT JOIN `tour_photo` AS `tp` ON `tp`.`tour_id` = `t`.`id` AND `primary_photo` = '1' WHERE `tan`.`is_notified` = 0", async (err, result) => {
	if (err) {
		logger.error('Query Select `tour_available_notification` error: ', err);
	}
	else if (result.length === 0) {
		logger.warn("No data from `tour_available_notification`");
	}
	else {
		for (var i = 0; i < result.length; i++) {
			var [success] = await update_data(result[i].id);
			if (success) {
				await send_mail(result[i]);
			}
		}
	}

	db.end();
});

var update_data = (id) => {
	return new Promise((resolve) => {
		var sql = "UPDATE `tour_available_notification` SET `is_notified` = 1 WHERE `id` = ?";
		db.query(sql, [id], (err, result) => {
			if (err) {
				logger.error('Query Update `tour_available_notification` Error: ', err);
				resolve([false]);
			}
			else {
				logger.info('Update id = '+id+' Success');
				resolve([true]);
			}
		});
	});
}

var send_mail = (data) => {
	data.photo = config.asset_phototour + data.guide_tour_program_id + "/square_" + data.photo;
	data.trip_link = config.config_url + data.category_name.toLowerCase() + '/' + data.province + '/' + data.slug + '#/' + moment(data.start_date).format('YYYY-MM-DD');
	data.start_date = moment(data.start_date).format('DD MMMM YYYY');
	data.end_date = moment(data.end_date).format('DD MMMM YYYY');
	return new Promise((resolve) => {
		ejs.renderFile(__dirname+'/../../templates/tour_subscribe.ejs', {data: data}, (err, html) => {
			if (err) {
				logger.error('Error renderFile: ', err);
				resolve([false]);
			}
			else {
				var mailOptions = {
					from: '"Momotrip.co.id" <'+config.mailer.email+'>',
					to: data.email,
					subject: 'Trip '+data.title+' sudah tersedia',
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