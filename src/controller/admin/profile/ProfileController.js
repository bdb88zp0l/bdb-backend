/**
 * @fileoverview Profile Controller
 * 
 * This module provides controller functions for managing user profiles.
 * It handles operations for retrieving user information, updating profiles,
 * and switching workspaces.
 * 
 * @module ProfileController
 * @requires ../../../config/file
 * @requires ../../../exception/AppError
 * @requires ../../../exception/catchAsync
 * @requires ../../../model/User
 * @requires ../../../model/Workspace
 * @requires ../../../validator/simpleValidator
 */

const { upload, deleteFileByPath } = require("../../../config/file");
const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const User = require("../../../model/User");
const Workspace = require("../../../model/Workspace");
const SimpleValidator = require("../../../validator/simpleValidator");

/**
 * Retrieves the profile information of the authenticated user
 * 
 * @function info
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with user profile data
 */
exports.info = catchAsync(async (req, res) => {
  let { user } = req;

  let permissions = user?.role?.permissions ?? [];

  let data = {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    photo: user.photo,
    googleAuthenticator: user.googleAuthenticator,
    roleType: user.roleType,
    role: user.role,
    hourlyRate: user?.hourlyRate ?? 0,
    defaultWorkspace: user.defaultWorkspace,
    permissions,
    status: user.status,
    createdAt: user.createdAt,
  };
  res.json({
    message: "Fetched successfully",
    data,
  });
});

/**
 * Updates the profile of the authenticated user
 * 
 * @function updateProfile
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.firstName - Updated first name
 * @param {string} [req.body.lastName] - Updated last name
 * @param {Object} req.file - Uploaded profile photo file
 * @param {Object} req.user - Authenticated user object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with updated user data
 * @throws {AppError} If user is not found or validation fails
 */
exports.updateProfile = catchAsync(async (req, res) => {
  let { user } = req;
  // 1. Validate incoming data
  await SimpleValidator(req.body, {
    firstName: "required",
  });

  const { firstName, lastName, hourlyRate } = req.body;

  // 2. Find the user by ID
  user = await User.findById(user._id);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  // 3. Update only the fields provided in the payload
  if (firstName) {
    user.firstName = firstName;
  }
  if (lastName) {
    user.lastName = lastName;
  }
  if (hourlyRate) {
    user.hourlyRate = hourlyRate
  }

  if (req.file) {
    if (user?.photo) {
      await deleteFileByPath(user.photo);
    }
    let uploadData = await upload(req.file, "profile-photo");
    const { Key } = uploadData;
    user.photo = Key;
  }

  // 4. Save the updated user
  await user.save();

  // 5. Send response
  res.json({
    message: "Profile updated successfully",
    data: {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        photo: user.photo,
        hourlyRate: user?.hourlyRate ?? 0,
        role: user.roleType,
        status: user.status,
      },
    },
  });
});

/**
 * Switches the default workspace for the authenticated user
 * 
 * @function switchWorkspace
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Workspace ID to switch to
 * @param {Object} req.user - Authenticated user object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response confirming the workspace switch
 * @throws {AppError} If workspace is not found or validation fails
 */
exports.switchWorkspace = catchAsync(async (req, res) => {
  let { user } = req;
  // 1. Validate incoming data
  await SimpleValidator(req.params, {
    id: "required|mongoid",
  });

  const { id } = req.params;

  // 2. Find the workspace by ID
  let workspace = await Workspace.findOne({ _id: id, status: "active" });
  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  // 3. Update Update workspace for user
  await User.findByIdAndUpdate(
    user._id,
    {
      defaultWorkspace: workspace._id,
    },
    { new: true }
  );
  // 4. Send response
  res.json({
    message: "Workspace updated successfully",
  });
});
