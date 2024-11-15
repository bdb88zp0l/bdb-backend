const express = require("express");
const EventController = require("../../../controller/admin/calendar/EventController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const eventRouter = express.Router();
require("express-group-routes");

eventRouter.group("/events", (events) => {
  events.use(Authenticated);

  // Create a new event
  events.post("/", HasPermission("event.create"), EventController.createEvent);

  // Get all events accessible to the user
  events.get("/", HasPermission("event.read"), EventController.getAllEvents);

  // Get a specific event by ID
  events.get("/:id", HasPermission("event.read"), EventController.getEvent);

  // Update a specific event by ID
  events.patch(
    "/:id",
    HasPermission("event.update"),
    EventController.updateEvent
  );

  // Delete a specific event by ID (soft delete)
  events.delete(
    "/:id",
    HasPermission("event.delete"),
    EventController.deleteEvent
  );
});

module.exports = eventRouter;
