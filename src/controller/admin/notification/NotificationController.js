/**
 * @fileoverview Notification Controller
 * 
 * This module provides controller functions for managing user notifications.
 * It handles operations for retrieving, marking as read, and deleting notifications.
 * 
 * @module NotificationController
 * @requires mongoose
 * @requires ../../../exception/AppError
 * @requires ../../../exception/catchAsync
 * @requires ../../../model/Notification
 * @requires ../../../validator/simpleValidator
 */

const { Types } = require("mongoose");
const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const Notification = require("../../../model/Notification");
const SimpleValidator = require("../../../validator/simpleValidator");

/**
 * Retrieves all notifications for a specific user
 * 
 * This function fetches notifications for the authenticated user,
 * with optional pagination.
 *
 * @function getAllNotifications
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of items per page
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with paginated notification data
 */
exports.getAllNotifications = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const { page = 1, limit = 10 } = req.query;

  const aggregatedQuery = Notification.aggregate([
    {
      $match: {
        user: new Types.ObjectId(userId),
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);

  const data = await Notification.aggregatePaginate(aggregatedQuery, {
    page: parseInt(page),
    limit: parseInt(limit),
  });

  res.json({
    message: "Notifications fetched successfully",
    data,
  });
});

/**
 * Marks a specific notification as read
 * 
 * This function updates the 'read' status of a notification to true.
 *
 * @function markAsRead
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Notification ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response confirming the update
 * @throws {AppError} If the notification is not found
 */
exports.markAsRead = catchAsync(async (req, res) => {
  const notificationId = req.params.id;
  const userId = req.user._id;

  // Validate notificationId
  await SimpleValidator(
    { notificationId },
    {
      notificationId: "required|string",
    }
  );

  // Find the notification
  const notification = await Notification.findOne({
    _id: notificationId,
    user: userId,
  });

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  // Mark as read
  notification.read = true;
  await notification.save();

  res.json({
    message: "Notification marked as read",
    data: notification,
  });
});

/**
 * Deletes a specific notification
 * 
 * This function removes a notification from the database.
 *
 * @function deleteNotification
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Notification ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response confirming the deletion
 * @throws {AppError} If the notification is not found
 */
exports.deleteNotification = catchAsync(async (req, res) => {
  const notificationId = req.params.id;
  const userId = req.user._id;

  // Validate notificationId
  await SimpleValidator(
    { notificationId },
    {
      notificationId: "required|string",
    }
  );

  // Find the notification
  const notification = await Notification.findOne({
    _id: notificationId,
    user: userId,
  });

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  // Delete the notification
  await notification.remove();

  res.json({
    message: "Notification deleted successfully",
  });
});
