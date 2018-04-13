# Setup
## Using [Node v8.9.0](https://nodejs.org/en/download/package-manager/) & [npm v5.5.1](https://docs.npmjs.com/)
* `npm install` for install module packages
* `node lib/TourComment/index.js` for running automatic send mail after trip which end date H-1  
* `node lib/TourComment/voucher.js` for running automatic generate voucher after trip comment posted
* `node lib/TourComment/api.js` for running API send mail after trip which end date based on params(YYYY-MM-DD)   
* `node lib/BirthdayVoucher/index.js` for running automatic generate voucher for user birthday H-30 and greeting card on his/her birthday
* `node lib/ReminderSaving/index.js` for running automatic send mail reminder users saving payment
* `node lib/SMSender/index.js` for running sender SMS feature
* `node lib/TourSubscribe/index.js` for running reminder tour available

# Note
*   Engine View in folder `./templates/` use [ejs](http://www.embeddedjs.com/)
*   Don't forget to fill `./config.json` data
*	Don't use `node lib/TourComment/api.js` in crontab, because call once running once

# Deployment
## Initial data
* insert table tour_comment_coupons with cut off comments to voucher

## Deploy with crontab
* `MAILTO="to@domain.com"
  0 8 * * * /usr/bin/node /<root path>/lib/TourComment/index.js`
* `*/5 * * * * /usr/bin/node lib/TourComment/voucher.js >/dev/null 2>&1`

