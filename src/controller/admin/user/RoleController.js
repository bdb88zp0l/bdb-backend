/**
 * Role Controller
 * 
 * This module contains all the controller functions for role-related operations.
 * It provides CRUD (Create, Read, Update, Delete) operations for managing roles
 * in the application. Each role can have a set of permissions associated with it.
 * 
 * @module RoleController
 * @requires AppError
 * @requires catchAsync
 * @requires Role
 * @requires SimpleValidator
 */

const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const Role = require("../../../model/Role");
const SimpleValidator = require("../../../validator/simpleValidator");

/**
 * Create a new role
 * 
 * This function validates the incoming data, creates a new role with the
 * provided name and permissions, and returns the created role.
 *
 * @function
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Name of the role
 * @param {string[]} [req.body.permissions] - Array of permission strings
 * @param {Object} res - Express response object
 * @returns {Promise<void>} - Resolves with the created role data
 * @throws {AppError} If validation fails
 */
exports.createRole = catchAsync(async (req, res) => {
  // Validate incoming data
  await SimpleValidator(req.body, {
    name: "required|string",
    permissions: "array",
  });

  const { name, permissions } = req.body;

  // Create the role
  const role = await Role.create({
    name,
    permissions,
  });

  res.status(201).json({
    message: "Role created successfully",
    data: role,
  });
});

/**
 * Get all roles (excluding soft-deleted ones)
 * 
 * This function retrieves all non-deleted roles from the database.
 *
 * @function
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} - Resolves with an array of role data
 */
exports.getAllRoles = catchAsync(async (req, res) => {
  const roles = await Role.find({ deleted: false });

  res.json({
    message: "Roles fetched successfully",
    data: roles,
  });
});

/**
 * Get a specific role by ID
 * 
 * This function retrieves a single non-deleted role by its ID.
 *
 * @function
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Role ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} - Resolves with the role data
 * @throws {AppError} If the role is not found
 */
exports.getRole = catchAsync(async (req, res) => {
  const role = await Role.findOne({ _id: req.params.id, deleted: false });

  if (!role) {
    throw new AppError("Role not found", 404);
  }

  res.json({
    message: "Role fetched successfully",
    data: role,
  });
});

/**
 * Update a specific role by ID
 * 
 * This function validates the incoming data, finds the role by ID,
 * updates its fields if provided, and returns the updated role.
 *
 * @function
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Role ID
 * @param {Object} req.body - Request body
 * @param {string} [req.body.name] - Updated name of the role
 * @param {string[]} [req.body.permissions] - Updated array of permission strings
 * @param {Object} res - Express response object
 * @returns {Promise<void>} - Resolves with the updated role data
 * @throws {AppError} If validation fails or the role is not found
 */
exports.updateRole = catchAsync(async (req, res) => {
  // Validate incoming data
  await SimpleValidator(req.body, {
    name: "required",
    permissions: "array",
  });

  const { name, permissions } = req.body;
  const roleId = req.params.id;

  // Find the role
  const role = await Role.findOne({ _id: roleId, deleted: false });
  if (!role) {
    throw new AppError("Role not found", 404);
  }

  // Update fields if provided
  if (name) role.name = name;
  if (permissions) role.permissions = permissions;

  await role.save();

  res.json({
    message: "Role updated successfully",
    data: role,
  });
});

/**
 * Soft delete a specific role by ID
 * 
 * This function finds a role by ID and marks it as deleted (soft delete).
 *
 * @function
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Role ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} - Resolves with a success message
 * @throws {AppError} If the role is not found
 */
exports.deleteRole = catchAsync(async (req, res) => {
  const roleId = req.params.id;

  // Find the role
  const role = await Role.findOne({ _id: roleId, deleted: false });
  if (!role) {
    throw new AppError("Role not found", 404);
  }

  // Soft delete the role
  role.deleted = true;
  await role.save();

  res.json({
    message: "Role deleted successfully",
  });
});
