# Setup
## Using [Node v8.9.0](https://nodejs.org/en/download/package-manager/) & [npm v5.5.1](https://docs.npmjs.com/)
* `npm install` for install module packages
* `node TourComment/index.js` for running automatic send mail after trip which end date H-1  
* `node TourComment/voucher.js` for running automatic generate voucher after trip comment posted
* `node TourComment/api.js` for running API send mail after trip which end date based on params(YYYY-MM-DD)   
* `node BirthdayVoucher/index.js` for running automatic generate voucher for user birthday H-30 and greeting card on his/her birthday
* `node ReminderSaving/index.js` for running automatic send mail reminder users saving payment
* `node SMSender/index.js` for running sender SMS feature

# Note
*   Engine View in folder `./templates/` use [ejs](http://www.embeddedjs.com/)
*   Don't forget to fill `./config.json` data
*	Don't use `node TourComment/api.js` in crontab, because call once running once