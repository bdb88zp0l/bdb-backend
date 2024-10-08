const express = require("express");
const Authenticated = require("../../../middleware/Authenticated");
const {
  getAllNotifications,
} = require("../../../controller/admin/notification/NotificationController");

const notificationRouter = express.Router();
require("express-group-routes");

notificationRouter.group("/notification", (notification) => {
  notification.use(Authenticated);
  // Get a specific event by ID
  notification.get("/list", getAllNotifications);
});

module.exports = notificationRouter;
