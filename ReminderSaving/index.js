require('./../Global.js');
require('moment/locale/id');
const logger = require('./../Logger.js')('saving');

var due_date = () => {
	var data = '';
	for (var i = 1; i <= 16; i = i + 3) {
		if (i === 16) {
			data += "'"+moment().add(+i, 'days').format('YYYY-MM-DD')+"'";
		}
		else {
			data += "'"+moment().add(+i, 'days').format('YYYY-MM-DD')+"', ";
		}

	}
	
	return data;
}

var get_product_id = (booking_code, transaction_id) => {
	var pi_pos = booking_code.indexOf('PI');
	var pt_pos = booking_code.indexOf('PT');
	var id_len = 5;
	if(pi_pos >= 0){
		var exp = booking_code.split("PI");
		var order_key = 'PI';
	}else if(pt_pos >= 0){
		var exp = booking_code.split("PT");
		var order_key = 'PT';
	}else {
		var exp = booking_code.split("P");
		var order_key = 'P';
		id_len = 6;
	}
	var strcode = booking_code.replace(exp[0]+order_key, "");
	var code = strcode.substr(0, id_len);
	var tour_id = strcode.replace(code, "");
	if(order_key == 'PI'){
		tour_id = transaction_id;
	}
	
	return tour_id;
}


var query = "SELECT trx_booking.id, trx_booking.transaction_id, trx_booking.booking_code, trx_booking.dp_booking_code, trx_booking.price, trx_booking.total_pax, hotels.hotel_name, trx_booking.total_room, trx_booking.hotel_price, trx_booking.expired_time, tours.title, tours.category_name, tours.start_date, tours.end_date, tours.total_day, tours.duration_type, (SELECT (saving_simulation.total_price - (IFNULL(trx_booking.hotel_price, 0) * IFNULL(trx_booking.total_room, 0))) / trx_booking.total_pax) AS tour_price, t_mst_guides.full_name AS momoranger, t_mst_cities.name AS city, tour_photo.source AS photo, saving_simulation.total_price, saving_simulation.voucher_price, saving_simulation_detail.step_no AS step, (SELECT SUM(price) FROM saving_simulation_detail WHERE simulation_id = saving_simulation.id AND step_no < step) AS sudah_dibayar FROM trx_booking LEFT JOIN tours ON tours.id = trx_booking.transaction_id LEFT JOIN guide_tour_program ON guide_tour_program.id = tours.guide_tour_program_id LEFT JOIN t_mst_guides ON t_mst_guides.id = guide_tour_program.guide_id LEFT JOIN t_mst_cities ON t_mst_cities.id = guide_tour_program.city_id LEFT JOIN tour_photo ON tour_photo.tour_id = tours.id AND tour_photo.primary_photo = '1' LEFT JOIN saving_simulation ON saving_simulation.booking_code = trx_booking.booking_code LEFT JOIN saving_simulation_detail ON saving_simulation_detail.settlement_code = trx_booking.dp_booking_code LEFT JOIN hotels ON hotels.id = trx_booking.hotel_id WHERE trx_booking.payment_method = 'saving' AND trx_booking.status = 'pending' AND DATE(trx_booking.payment_date) = '"+moment().format('YYYY-MM-DD')+"' OR DATE(trx_booking.expired_time) IN ("+due_date()+")";

db.query(query, async (err, result) => {
	if (err) {
		logger.error('Query SELECT `trx_booking` error: ', err);
	}
	else if (result.length === 0) {
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
		logger.info('Check : '+data[i].dp_booking_code);
		var [contact] = await get_contact(data[i].booking_code);
		if (contact) {
			send_mail(Object.assign(data[i], contact));
		}
	}
}

var get_contact = (booking_code) => {
	return new Promise((resolve) => {
		db.query("SELECT id FROM trx_booking WHERE payment_method = 'saving' AND dp_booking_code = '"+booking_code+"-1'", async (err, result) => {
			if (err) {
				logger.error('Query SELECT id `trx_booking` error: ', err);
				resolve([false]);
			}
			if (result.length > 1) {
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
				else if (result.length > 1) {
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
	data.expired_duration = moment(data.expired_time).fromNow();
	data.expired_time = moment(data.expired_time).format('dddd, DD MMMM YYYY');
	data.start_date = moment(data.start_date).format('DD MMMM YYYY');
	data.end_date = moment(data.end_date).format('DD MMMM YYYY');
	data.total_price = number_format(data.total_price - data.voucher_price, ',');
	data.price = number_format(data.price, ',');
	data.hotel_price = (data.hotel_price == null) ? 0 : number_format(data.hotel_price, ',');
	data.tour_price = number_format(data.tour_price, ',');
	data.price_voucher = number_format(data.voucher_price, ',');
	data.sudah_dibayar = number_format(data.sudah_dibayar, ',');
	data.product_id = get_product_id(data.booking_code, data.transaction_id);
	data.photo = config.asset_phototour + data.product_id + "/square_" + data.photo;

	ejs.renderFile(__dirname+'/../templates/waiting.ejs', {data: data, config_url: config.config_url}, (err, html) => {
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