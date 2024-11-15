/**
 * @fileoverview Permission Controller
 *
 * This module provides controller functions for managing permissions and roles.
 * It handles operations for setting up and retrieving permissions for roles.
 *
 * @module PermissionController
 * @requires ../../../exception/AppError
 * @requires ../../../exception/catchAsync
 * @requires ../../../model/Permission
 * @requires ../../../model/Role
 * @requires ../../../validator/simpleValidator
 */

const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const Permission = require("../../../model/Permission");
const Role = require("../../../model/Role");
const SimpleValidator = require("../../../validator/simpleValidator");

/**
 * Updates permissions for roles
 *
 * This function validates the input and updates the permissions
 * associated with each role provided in the request.
 *
 * @function setupSubmit
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {Array} req.body.roles - Array of role objects with updated permissions
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response confirming the update
 * @throws {Error} If validation fails
 */
exports.setupSubmit = catchAsync(async (req, res) => {
  // Validate incoming data
  await SimpleValidator(req.body, {
    roles: "required|array",
  });

  for (const role of req.body?.roles ?? []) {
    await Role.findByIdAndUpdate(role.roleId, {
      permissions: role.permissions,
    });
  }

  res.status(201).json({
    message: "Permission updated successfully",
  });
});

/**
 * Retrieves all permissions and roles
 *
 * This function fetches all permissions and non-deleted roles from the database.
 *
 * @function setup
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with permissions and roles data
 */
exports.setup = catchAsync(async (req, res) => {
  const permissions = await Permission.find({}, {}).sort({ name: 1 });
  let roles = await Role.find({ deleted: false })
    .sort({ name: 1 })
    .populate("permissions");

  res.json({
    message: "Permissions fetched successfully",
    data: {
      permissions,
      roles,
    },
  });
});
