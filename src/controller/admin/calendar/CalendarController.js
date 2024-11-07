/**
 * @fileoverview Calendar Controller
 *
 * This module provides controller functions for managing calendars in the system.
 * It handles CRUD operations for calendars, including creation, retrieval, updating,
 * and soft deletion of calendar records. The controller also manages related data
 * such as events, shared users, and teams.
 *
 * @module CalendarController
 * @requires ../../../events/CalendarCreated
 * @requires ../../../events/CalendarUpdated
 * @requires ../../../exception/AppError
 * @requires ../../../exception/catchAsync
 * @requires ../../../model/Calendar
 * @requires ../../../model/Team
 * @requires ../../../model/User
 * @requires ../../../validator/simpleValidator
 * @requires moment
 */

const { v4 } = require("uuid");
const CalendarCreated = require("../../../events/CalendarCreated");
const CalendarUpdated = require("../../../events/CalendarUpdated");
const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const Calendar = require("../../../model/Calendar");
const Team = require("../../../model/Team");
const User = require("../../../model/User");
const { getCalendarEvents } = require("../../../services/microsoftAzure");
const SimpleValidator = require("../../../validator/simpleValidator");
const moment = require("moment");

/**
 * Creates a new calendar
 *
 * This function handles the creation of a new calendar in the system. It validates
 * the incoming data, creates a new calendar in the database, and triggers a
 * CalendarCreated event.
 *
 * @function createCalendar
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.body - The request body containing the calendar data
 * @param {string} req.body.title - The title of the calendar
 * @param {string} [req.body.description] - The description of the calendar
 * @param {string} req.body.visibility - The visibility setting of the calendar
 * @param {Array} [req.body.sharedWith] - Array of user IDs to share the calendar with
 * @param {Array} [req.body.sharedWithTeams] - Array of team IDs to share the calendar with
 * @param {string} [req.body.backgroundColor] - The background color of the calendar
 * @param {string} [req.body.foregroundColor] - The foreground color of the calendar
 * @param {Object} req.user - The authenticated user object
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with the created calendar
 * @throws {AppError} - If validation fails or calendar creation encounters an error
 */
exports.createCalendar = catchAsync(async (req, res) => {
  const {
    title,
    description,
    visibility,
    sharedWith,
    sharedWithTeams,
    backgroundColor,
    foregroundColor,
  } = req.body;

  // Validate the incoming data
  await SimpleValidator(req.body, {
    title: "required|string",
    visibility: "in:public,private,protected",
  });

  // Create the calendar
  const newCalendar = await Calendar.create({
    title,
    description,
    visibility,
    owner: req.user._id,
    sharedWith,
    sharedWithTeams,
    backgroundColor,
    foregroundColor,
  });

  CalendarCreated(newCalendar._id);

  res.status(201).json({
    message: "Calendar created successfully",
    data: newCalendar,
  });
});

/**
 * Retrieves all calendars for the logged-in user
 *
 * This function fetches calendars that the user has access to, including public calendars,
 * calendars owned by the user, and calendars shared with the user or their teams.
 *
 * @function getAllCalendars
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.query - Query parameters for filtering and pagination
 * @param {number} [req.query.page=1] - The page number for pagination
 * @param {number} [req.query.limit=10] - The number of items per page
 * @param {string} [req.query.search] - Search term for filtering calendars by title
 * @param {Object} req.user - The authenticated user object
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with paginated calendar data
 */
exports.getAllCalendars = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;

  // Get all teams the user belongs to
  const teams = await Team.find({ "users.user": req.user._id }, "_id");

  let match = {
    $or: [
      { visibility: "public" },
      { owner: req.user._id },
      { sharedWith: { $in: [req.user._id] }, visibility: "protected" },
      {
        sharedWithTeams: { $in: teams.map((team) => team._id) },
        visibility: "protected",
      },
    ],
    ...(search && { title: { $regex: search, $options: "i" } }),
    status: "active",
  };

  const aggregatedQuery = Calendar.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "users",
        localField: "sharedWith",
        foreignField: "_id",
        as: "sharedWith",
        pipeline: [
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              email: 1,
            },
          },
        ],
      },
    },
    // Populate sharedWithTeams
    {
      $lookup: {
        from: "teams",
        localField: "sharedWithTeams",
        foreignField: "_id",
        as: "sharedWithTeams",
        pipeline: [
          {
            $project: {
              _id: 1,
              title: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "events",
        localField: "_id",
        foreignField: "calendar",
        as: "events",
        pipeline: [{ $match: { status: "active" } }],
      },
    },
    // Filter events to include only future events
    {
      $addFields: {
        events: {
          $filter: {
            input: "$events",
            as: "event",
            cond: {
              $gte: ["$$event.endDate", moment.utc().toDate()], // Only include future events
            },
          },
        },
      },
    },
    // Collect all unique attendee user IDs from the events
    {
      $addFields: {
        attendeeUserIds: {
          $reduce: {
            input: "$events",
            initialValue: [],
            in: { $setUnion: ["$$value", "$$this.attendees.user"] },
          },
        },
      },
    },
    // Lookup attendee user information
    {
      $lookup: {
        from: "users",
        localField: "attendeeUserIds",
        foreignField: "_id",
        as: "attendeeUsers",
        pipeline: [
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              email: 1,
              // Add other fields you want to include
            },
          },
        ],
      },
    },
    // Map over events to populate attendees with user information
    {
      $addFields: {
        events: {
          $map: {
            input: "$events",
            as: "event",
            in: {
              $mergeObjects: [
                "$$event",
                {
                  attendees: {
                    $map: {
                      input: "$$event.attendees",
                      as: "attendee",
                      in: {
                        $mergeObjects: [
                          "$$attendee",
                          {
                            user: {
                              $arrayElemAt: [
                                {
                                  $filter: {
                                    input: "$attendeeUsers",
                                    as: "user",
                                    cond: {
                                      $eq: ["$$user._id", "$$attendee.user"],
                                    },
                                  },
                                },
                                0,
                              ],
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
    // Remove temporary fields
    {
      $project: {
        attendeeUserIds: 0,
        attendeeUsers: 0,
      },
    },
  ]);

  const data = await Calendar.aggregatePaginate(aggregatedQuery, {
    page: parseInt(page),
    limit: parseInt(limit),
  });

  // let outlookEvents = await getCalendarEvents(req.user.email);
  let outlookEvents = await getCalendarEvents("jane.rizo@bdblaw.com.ph");
  if (outlookEvents) {
    outlookEvents = outlookEvents?.map((event) => {
      return {
        _id: v4(),
        title: event.subject,
        description: event?.body?.content ?? "",
        startDate: event.start.dateTime,
        endDate: event.end.dateTime,
        attendees: event.attendees,
        location: event.location?.displayName ?? "",
        isOnlineMeeting: event.isOnlineMeeting,
        onlineMeetingUrl: event.onlineMeetingUrl,
        source: "outlook",
        webLink: event.webLink,
      };
    });

    let outlookCalendar = {
      _id: "1234567890",
      source: "outlook",
      title: "Outlook Events",
      description: "Outlook Events",
      visibility: "protected",
      sharedWith: [],
      sharedWithTeams: [],
      status: "active",
      backgroundColor: "#ffffff",
      foregroundColor: "#000000",
      __v: 0,
      events: outlookEvents,
    };

    data.docs.unshift(outlookCalendar);
  }

  res.json({
    message: "Fetched calendars successfully",
    data,
  });
});

/**
 * Retrieves a specific calendar by ID
 *
 * @function getCalendar
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Calendar ID
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with the calendar data
 * @throws {AppError} - If the calendar is not found
 */
exports.getCalendar = catchAsync(async (req, res) => {
  const foundCalendar = await Calendar.findById(req.params.id)
    .populate("sharedWith", "firstName lastName email")
    .populate("sharedWithTeams", "title")
    .lean();

  if (!foundCalendar) {
    throw new AppError("Calendar not found", 404);
  }

  res.json({
    message: "Fetched calendar successfully",
    data: foundCalendar,
  });
});

/**
 * Updates a specific calendar by ID
 *
 * @function updateCalendar
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Calendar ID
 * @param {Object} req.body - Request body containing updated calendar details
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with the updated calendar data
 * @throws {AppError} - If the calendar is not found or validation fails
 */
exports.updateCalendar = catchAsync(async (req, res) => {
  const {
    title,
    description,
    visibility,
    sharedWith,
    sharedWithTeams,
    backgroundColor,
    foregroundColor,
  } = req.body;

  await SimpleValidator(req.body, {
    title: "string",
    visibility: "in:public,private,protected",
  });

  const updatedCalendar = await Calendar.findByIdAndUpdate(
    req.params.id,
    {
      title,
      description,
      visibility,
      sharedWith,
      sharedWithTeams,
      backgroundColor,
      foregroundColor,
    },
    { new: true, runValidators: true }
  );

  if (!updatedCalendar) {
    throw new AppError("Calendar not found", 404);
  }

  CalendarUpdated(updatedCalendar);
  res.json({
    message: "Calendar updated successfully",
    data: updatedCalendar,
  });
});

/**
 * Soft deletes a calendar by updating its status to "deleted"
 *
 * @function deleteCalendar
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Calendar ID
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response confirming the deletion
 * @throws {AppError} - If the calendar is not found
 */
exports.deleteCalendar = catchAsync(async (req, res) => {
  const deletedCalendar = await Calendar.findByIdAndUpdate(
    req.params.id,
    { status: "deleted", deletedAt: new Date() },
    { new: true }
  );

  if (!deletedCalendar) {
    throw new AppError("Calendar not found", 404);
  }

  res.status(204).json({
    message: "Calendar deleted successfully",
    data: null,
  });
});

/**
 * Retrieves data required for calendar management
 *
 * @function getData
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with users and teams data
 */
exports.getData = catchAsync(async (req, res) => {
  let users = await User.find({ status: "activated" }).select(
    "firstName lastName email photo phone"
  );
  let teams = await Team.find({ status: "active" });

  res.json({
    status: "success",
    data: {
      users,
      teams,
    },
  });
});
