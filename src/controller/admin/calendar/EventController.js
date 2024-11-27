/**
 * @fileoverview Event Controller
 *
 * This module provides controller functions for managing events in the calendar system.
 * It handles CRUD operations for events, including creation, retrieval, updating,
 * and soft deletion of event records. The controller also manages related data
 * such as attendees, reminders, and calendar associations.
 *
 * @module EventController
 * @requires ../../../exception/catchAsync
 * @requires ../../../validator/simpleValidator
 * @requires ../../../model/Event
 * @requires ../../../exception/AppError
 * @requires ../../../events/EventCreated
 * @requires ../../../events/EventRescheduled
 * @requires moment
 */

const catchAsync = require("../../../exception/catchAsync");
const SimpleValidator = require("../../../validator/simpleValidator");
const Event = require("../../../model/Event");
const AppError = require("../../../exception/AppError");
const EventCreated = require("../../../events/EventCreated");
const EventRescheduled = require("../../../events/EventRescheduled");
const moment = require("moment");

/**
 * Creates a new event
 *
 * This function handles the creation of a new event in the system. It validates
 * the incoming data, creates a new event in the database, and triggers an
 * EventCreated event.
 *
 * @function createEvent
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.body - The request body containing the event data
 * @param {string} req.body.title - The title of the event
 * @param {string} [req.body.description] - The description of the event
 * @param {string} [req.body.location] - The location of the event
 * @param {Date} req.body.startDate - The start date and time of the event
 * @param {Date} req.body.endDate - The end date and time of the event
 * @param {boolean} [req.body.allDay] - Whether the event is an all-day event
 * @param {Object} [req.body.reminder] - Reminder settings for the event
 * @param {Array} [req.body.attendees] - Array of attendees for the event
 * @param {string} req.body.calendar - The ID of the calendar the event belongs to
 * @param {Object} req.user - The authenticated user object
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with the created event
 * @throws {Error} - If validation fails or event creation encounters an error
 */
exports.createEvent = catchAsync(async (req, res) => {
  const {
    title,
    description,
    location,
    startDate,
    endDate,
    allDay,
    reminder,
    attendees,
    calendar,
  } = req.body;

  // Validate incoming data
  await SimpleValidator(req.body, {
    title: "required|string",
    startDate: "required|date",
    endDate: "required|date",
    calendar: "required|mongoid",
  });

  const newEvent = await Event.create({
    title,
    description,
    location,
    startDate,
    endDate,
    allDay,
    reminder,
    attendees,
    calendar,
    createdBy: req.user._id,
  });

  EventCreated(newEvent);

  res.status(201).json({
    message: "Event created successfully",
    data: newEvent,
  });
});

/**
 * Retrieves all events for the logged-in user based on calendar permissions
 *
 * This function fetches events that the user has access to, including events
 * from public calendars and calendars shared with the user.
 *
 * @function getAllEvents
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.query - Query parameters for filtering and pagination
 * @param {string} [req.query.search] - Search term for filtering events by title
 * @param {string} [req.query.calendar] - Calendar ID for filtering events
 * @param {number} [req.query.page=1] - The page number for pagination
 * @param {number} [req.query.limit=10] - The number of items per page
 * @param {string} [req.query.sortBy="createdAt"] - Field to sort by
 * @param {string} [req.query.sortOrder="desc"] - Sort order (asc or desc)
 * @param {Object} req.user - The authenticated user object
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with paginated event data
 */
exports.getAllEvents = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, search, calendar } = req.query;

  let match = {
    ...(calendar && { calendar: calendar }),
    ...(search && { title: { $regex: search, $options: "i" } }),
    status: "active",
  };

  const aggregatedQuery = Event.aggregate([{ $match: match }]);

  const data = await Event.aggregatePaginate(aggregatedQuery, {
    page: parseInt(page),
    limit: parseInt(limit),
  });

  res.json({
    message: "Fetched events successfully",
    data,
  });
});

/**
 * Retrieves a specific event by ID
 *
 * @function getEvent
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Event ID
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with the event data
 * @throws {AppError} - If the event is not found
 */
exports.getEvent = catchAsync(async (req, res) => {
  const foundEvent = await Event.findById(req.params.id)
    .populate("calendar", "title visibility")
    .populate("attendees.user", "firstName lastName email")
    .lean();

  if (!foundEvent) {
    throw new AppError("Event not found", 404);
  }

  res.json({
    message: "Fetched event successfully",
    data: foundEvent,
  });
});

/**
 * Updates an existing event
 *
 * @function updateEvent
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Event ID
 * @param {Object} req.body - Request body containing updated event details
 * @param {Object} req.user - The authenticated user object
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with the updated event data
 * @throws {AppError} - If the event is not found or validation fails
 */
exports.updateEvent = catchAsync(async (req, res) => {
  const { title, description, startDate, endDate } = req.body;

  await SimpleValidator(req.body, {
    title: "string",
    startDate: "date",
    endDate: "date",
  });

  const updatedEvent = await Event.findByIdAndUpdate(
    req.params.id,
    {
      title,
      description,
      startDate,
      endDate,
      lastUpdatedBy: req.user._id,
    },
    { runValidators: true }
  );

  if (!updatedEvent) {
    throw new AppError("Event not found", 404);
  }
  if (!moment.utc(startDate).isSame(moment.utc(updatedEvent.startDate))) {
    EventRescheduled(updatedEvent);
  }

  res.json({
    message: "Event updated successfully",
    data: updatedEvent,
  });
});

/**
 * Soft deletes an event by updating its status to "cancelled"
 *
 * @function deleteEvent
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Event ID
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response confirming the deletion
 * @throws {AppError} - If the event is not found
 */
exports.deleteEvent = catchAsync(async (req, res) => {
  const deletedEvent = await Event.findByIdAndUpdate(
    req.params.id,
    { status: "cancelled", deletedAt: new Date() },
    { new: true }
  );

  if (!deletedEvent) {
    throw new AppError("Event not found", 404);
  }

  res.status(204).json({
    message: "Event deleted successfully",
    data: null,
  });
});
