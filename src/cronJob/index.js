const CheckDocumentOcrStatus = require("./CheckDocumentOcrStatus");
const EventReminderCronjob = require("./EventReminderCronjob");
EventReminderCronjob.start();
CheckDocumentOcrStatus.start()
