const moment = require('moment');
const kemaren = moment().add(-1, 'days').format('YYYY-MM-DD');

/* Run APP */
require('./Core.js')(kemaren);
/**********/