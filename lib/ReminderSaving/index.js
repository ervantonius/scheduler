require('./../../Global.js');
require('moment/locale/id');
const logger = require('./../../Logger.js')('saving');

var due_date = () => {
	var data = '';
	for (var i = 1; i <= 16; i = i + 3) {
		data += "'"+moment().add(+i, 'days').format('YYYY-MM-DD')+"', ";

	}
	data += "'"+moment().format('YYYY-MM-DD')+"'";
	
	return data;
}

var expired_duration_words = (expired_time) => {
	var different = moment(expired_time).diff(moment().format('YYYY-MM-DD'), 'days');
	if (different == 1) {
		return "dalam sehari";
	}
	else if (different == 0) {
		return "hanya hari ini";
	}
	else {
		return moment(expired_time).fromNow();
	}
}


var query = "SELECT DISTINCT a.booking_code, (SELECT SUM(price) FROM trx_booking AS b WHERE b.booking_code = a.booking_code) AS total_price FROM trx_booking AS a WHERE a.payment_method = 'saving' AND a.status = 'pending' AND (DATE(a.payment_date) = '"+moment().format('YYYY-MM-DD')+"' OR DATE(a.expired_time) IN ("+due_date()+"))";

db.query(query, async (err, result) => {
	if (err) {
		logger.error('Query SELECT `trx_booking` error: ', err);
	}
	
	if (result.length === 0) {
		logger.warn("No data from `trx_booking` payment_date: "+moment().format('YYYY-MM-DD')+" OR expired_date: "+due_date());
	}
	else {
		logger.info("Check payment_date: "+moment().format('YYYY-MM-DD')+" OR expired_date: "+due_date());
		await start(result);
	}
	db.end();
});

var start = async (data) => {
	for (var i = 0; i < data.length; i++) {
		await get_data(data[i].booking_code, data[i].total_price);
	}
}

var get_data = async (booking_code, total_price) => {
	return new Promise((resolve) => {
		var query2 = "SELECT trx_booking.id, trx_booking.transaction_id, trx_booking.booking_code, trx_booking.dp_booking_code, trx_booking.price, trx_booking.total_pax, hotels.hotel_name, trx_booking.total_room, trx_booking.hotel_price, trx_booking.expired_time, trx_booking.diskon_price, tours.title, tours.category_name, tours.start_date, tours.end_date, tours.total_day, tours.duration_type, tours.guide_tour_program_id AS product_id, (SELECT (("+total_price+" + trx_booking.diskon_price) - (IFNULL(trx_booking.hotel_price, 0) * IFNULL(trx_booking.total_room, 0))) / trx_booking.total_pax) AS tour_price, t_mst_guides.full_name AS momoranger, t_mst_cities.name AS city, tour_photo.source AS photo, CONVERT(SUBSTRING_INDEX(trx_booking.dp_booking_code,'-',-1), UNSIGNED INTEGER) AS step, (SELECT SUM(price) FROM trx_booking AS a WHERE a.booking_code = '"+booking_code+"' AND CONVERT(SUBSTRING_INDEX(a.dp_booking_code,'-',-1), UNSIGNED INTEGER) < step) AS sudah_dibayar FROM trx_booking JOIN tours ON tours.id = trx_booking.transaction_id JOIN guide_tour_program ON guide_tour_program.id = tours.guide_tour_program_id JOIN t_mst_guides ON t_mst_guides.id = guide_tour_program.guide_id JOIN t_mst_cities ON t_mst_cities.id = guide_tour_program.city_id LEFT JOIN tour_photo ON tour_photo.tour_id = tours.id AND tour_photo.primary_photo = '1' LEFT JOIN hotels ON hotels.id = trx_booking.hotel_id WHERE trx_booking.booking_code = '"+booking_code+"' AND trx_booking.payment_method = 'saving' AND trx_booking.status = 'pending' AND (DATE(trx_booking.payment_date) = '"+moment().format('YYYY-MM-DD')+"' OR DATE(trx_booking.expired_time) IN ("+due_date()+"))";
		db.query(query2, async (err, result) => {
			if (err) {
				logger.error('Query SELECT `trx_booking` for detail error: ', err);
				resolve(false);
			}

			if (result.length === 0) {
				logger.warn("No data from `trx_booking` for detail payment_date: "+moment().format('YYYY-MM-DD')+" OR expired_date: "+due_date());
				resolve(false);
			}
			else {
				for (var i = 0; i < result.length; i++) {
					logger.info('Check : '+result[i].dp_booking_code);
					var [contact] = await get_contact(result[i].booking_code);
					if (contact) {
						result[i].total_price = total_price;
						await send_mail(Object.assign(result[i], contact));
					}
				}
				resolve(true);
			}
		});
	});
}

var get_contact = (booking_code) => {
	return new Promise((resolve) => {
		db.query("SELECT id FROM trx_booking WHERE payment_method = 'saving' AND dp_booking_code = '"+booking_code+"-1'", async (err, result) => {
			if (err) {
				logger.error('Query SELECT id `trx_booking` error: ', err);
				resolve([false]);
			}

			if (result.length === 0) {
				logger.warn('ID with `dp_booking_code` = '+booking_code+'-1 not found');
				resolve([false]);
			}
			else {
				info_contact(result[0].id);
			}
		});

		var info_contact = (booking_id) => {
			db.query("SELECT email, title AS title_name, first_name, last_name, phone_number FROM trx_booking_contact WHERE primary_contact = '1' AND booking_id = "+booking_id, (err, result) => {
				if (err) {
					logger.error('Query SELECT `trx_booking_contact` error: ', err);
					resolve([false]);
				}
				
				if (result.length === 0) {
					logger.warn('Data Contact with `booking_id` = '+booking_id+' not found');
					resolve([false]);
				}
				else {
					resolve([result[0]]);
				}
			});
		}
	});
}

var send_mail = (data) => {
	data.expired_duration = expired_duration_words(data.expired_time);
	data.expired_time = moment(data.expired_time).format('dddd, DD MMMM YYYY');
	data.start_date = moment(data.start_date).format('DD MMMM YYYY');
	data.end_date = moment(data.end_date).format('DD MMMM YYYY');
	data.total_price = number_format(data.total_price, ',');
	data.price = number_format(data.price, ',');
	data.hotel_price = (data.hotel_price == null) ? 0 : number_format(data.hotel_price, ',');
	data.tour_price = number_format(data.tour_price, ',');
	data.price_voucher = number_format(data.diskon_price, ',');
	data.sudah_dibayar = number_format(data.sudah_dibayar, ',');
	data.photo = config.asset_phototour + data.product_id + "/square_" + data.photo;

	ejs.renderFile(__dirname+'/../../templates/waiting.ejs', {data: data, config_url: config.config_url}, (err, html) => {
		if (err) {
			logger.error('Error renderFile: ', err);
		}
		else {
			var mailOptions = {
				from: '"Momotrip.co.id" <'+config.mailer.email+'>',
				to: data.email,
				subject: 'Menunggu Pembayaran ke '+data.step+' - Tour di Momotrip.co.id : '+data.booking_code,
				html: html
			};

			sender.sendMail(mailOptions, (err, info) => {
				if (err) {
					logger.error('Error Sender Mail: ', err);
				}
				else {
					logger.info('Email Response: ', info);								
				}
			});
		}
	});
}