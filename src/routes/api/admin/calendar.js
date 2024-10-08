const express = require("express");
const CalendarController = require("../../../controller/admin/calendar/CalendarController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const calendarRouter = express.Router();
require("express-group-routes");

calendarRouter.group("/calendars", (calendars) => {
  calendars.use(Authenticated);

  // Create a new calendar
  calendars.post(
    "/",
    HasPermission("calendar.create"),
    CalendarController.createCalendar
  );

  // Get all calendars accessible to the user
  calendars.get(
    "/",
    HasPermission("calendar.read"),
    CalendarController.getAllCalendars
  );

  // Get a specific calendar by ID
  calendars.get(
    "/:id",
    HasPermission("calendar.read"),
    CalendarController.getCalendar
  );

  // Update a specific calendar by ID
  calendars.patch(
    "/:id",
    HasPermission("calendar.update"),
    CalendarController.updateCalendar
  );

  // Delete a specific calendar by ID (soft delete)
  calendars.delete(
    "/:id",
    HasPermission("calendar.delete"),
    CalendarController.deleteCalendar
  );
  // Get data for client page
  calendars.get("/data/get", CalendarController.getData);
});

module.exports = calendarRouter;
