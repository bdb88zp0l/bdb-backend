/**
 * @fileoverview User Controller
 * 
 * This module provides controller functions for managing user accounts.
 * It handles CRUD operations for users, including creation, retrieval,
 * updating, and soft deletion of user accounts.
 * 
 * @module UserController
 * @requires mongoose
 * @requires ../../../exception/AppError
 * @requires ../../../exception/catchAsync
 * @requires ../../../model/Role
 * @requires ../../../model/User
 * @requires ../../../utils/dateQueryGenerator
 * @requires ../../../validator/simpleValidator
 * @requires ../../../config/file
 */

const { Types } = require("mongoose");
const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const Role = require("../../../model/Role");
const User = require("../../../model/User");
const dateQueryGenerator = require("../../../utils/dateQueryGenerator");
const SimpleValidator = require("../../../validator/simpleValidator");
const { upload, deleteFileByPath } = require("../../../config/file");

/**
 * Creates a new user
 * 
 * This function validates the input, checks for existing email,
 * creates a new user in the database, and handles profile photo upload.
 *
 * @function createUser
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing user details
 * @param {string} req.body.firstName - First name of the user
 * @param {string} req.body.lastName - Last name of the user
 * @param {string} req.body.email - Email of the user
 * @param {string} req.body.password - Password for the user
 * @param {string} req.body.role - Role ID for the user
 * @param {string} [req.body.phone] - Phone number of the user
 * @param {Object} [req.file] - Uploaded profile photo file
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the created user
 * @throws {AppError} If validation fails, role doesn't exist, or email already exists
 */
exports.createUser = catchAsync(async (req, res) => {
  // Validate incoming data
  await SimpleValidator(req.body, {
    firstName: "required|string",
    lastName: "required|string",
    email: "required|email",
    password: "required|string|min:8",
    role: "required|mongoid",
  });

  const { firstName, lastName, email, password, phone, role, hourlyRate } = req.body;

  // Validate the role ID exists in the Role collection
  const roleExists = await Role.findById(role);
  if (!roleExists) {
    throw new AppError("Role does not exist in the database", 422);
  }

  // Validate the email exist
  const emailExists = await User.findOne({ email, status: { $ne: "deleted" } });
  if (emailExists) {
    throw new AppError("Email already exists", 422);
  }

  // Create the user
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone, hourlyRate,
    role: role,
    status: "activated",
  });
  if (req.file) {
    let uploadData = await upload(req.file, "profile-photo", user._id);
    const { Key } = uploadData;
    user.photo = Key;
    await user.save();
  }

  res.status(201).json({
    message: "User created successfully",
    data: user,
  });
});

/**
 * Retrieves all users with optional filtering and pagination
 * 
 * This function fetches users based on search criteria, date range,
 * role, status, and pagination parameters.
 *
 * @function getAllUsers
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.search] - Search term for user name or email
 * @param {string} [req.query.fromDate] - Start date for filtering
 * @param {string} [req.query.toDate] - End date for filtering
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of items per page
 * @param {string} [req.query.status] - User status filter
 * @param {string} [req.query.role] - Role ID filter
 * @param {string} [req.query.sortBy="createdAt"] - Field to sort by
 * @param {string} [req.query.sortOrder="desc"] - Sort order (asc or desc)
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with paginated user data
 */
exports.getAllUsers = catchAsync(async (req, res) => {
  const {
    search,
    fromDate,
    toDate,
    page = 1,
    limit = 10,
    status,
    role,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Generate date query using the provided function
  let dateQuery = dateQueryGenerator(fromDate, toDate);

  // Create the main query object
  let query = {
    ...(role && { role: new Types.ObjectId(role) }),
    ...dateQuery,
    ...(status ? { status } : { status: { $ne: "deleted" } }),
    ...(search && {
      $or: [
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ],
    }),
  };

  // Aggregation pipeline
  const aggregatedQuery = User.aggregate([
    {
      $match: query,
    },
    {
      $lookup: {
        from: "roles",
        localField: "role",
        foreignField: "_id",
        as: "role",
      },
    },
    {
      $unwind: {
        path: "$role",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $sort: {
        [sortBy]: sortOrder === "desc" ? -1 : 1,
      },
    },
  ]);

  // Pagination options
  const options = {
    page: parseInt(page),
    limit: parseInt(limit) === -1 ? 9999999 : parseInt(limit),
  };

  // Fetch paginated data
  const data = await User.aggregatePaginate(aggregatedQuery, options);

  res.json({
    message: "Fetched successfully",
    data,
  });
});

/**
 * Retrieves a specific user by ID
 * 
 * This function fetches a single user based on the provided ID.
 *
 * @function getUser
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - User ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the user data
 * @throws {AppError} If the user is not found
 */
exports.getUser = catchAsync(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.id,
    status: { $ne: "deleted" },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  res.json({
    message: "User fetched successfully",
    data: user,
  });
});

/**
 * Updates a specific user by ID
 * 
 * This function validates the input and updates the user details,
 * including the profile photo if a new one is provided.
 *
 * @function updateUser
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - User ID
 * @param {Object} req.body - Request body containing updated user details
 * @param {string} req.body.firstName - Updated first name of the user
 * @param {string} req.body.lastName - Updated last name of the user
 * @param {string} [req.body.email] - Updated email of the user
 * @param {string} [req.body.role] - Updated role ID for the user
 * @param {string} [req.body.status] - Updated status of the user
 * @param {string} [req.body.phone] - Updated phone number of the user
 * @param {string} [req.body.password] - Updated password for the user
 * @param {Object} [req.file] - New profile photo file
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the updated user
 * @throws {AppError} If the user is not found or validation fails
 */
exports.updateUser = catchAsync(async (req, res) => {
  // Validate incoming data
  await SimpleValidator(req.body, {
    firstName: "required",
    lastName: "required",
    // role: "required|mongoid",
  });

  const { firstName, lastName, email, role, status, phone, password, hourlyRate } =
    req.body;
  const userId = req.params.id;

  // Find the user
  const user = await User.findOne({ _id: userId, status: { $ne: "deleted" } });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Validate the role ID if provided
  if (role && user.roleType == "roleBasedUser") {
    const roleExists = await Role.findById(role);
    if (!roleExists) {
      throw new AppError("Role does not exist in the database", 422);
    }
    user.role = role;
  }

  // Update fields if provided
  if (firstName) {
    user.firstName = firstName;
  }
  if (lastName) {
    user.lastName = lastName;
  }
  if (email) {
    user.email = email;
  }
  if (phone) {
    user.phone = phone;
  }
  if (password) {
    user.password = password;
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
  if (status) {
    user.status = status;
  }

  await user.save();

  res.json({
    message: "User updated successfully",
    data: user,
  });
});

/**
 * Soft deletes a specific user by ID
 * 
 * This function marks a user as deleted without removing them from the database.
 *
 * @function deleteUser
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - User ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response confirming the deletion
 * @throws {AppError} If the user is not found
 */
exports.deleteUser = catchAsync(async (req, res) => {
  const userId = req.params.id;

  // Find the user
  const user = await User.findOne({ _id: userId, status: { $ne: "deleted" } });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Soft delete the user by setting status to "deleted"
  user.status = "deleted";
  await user.save();

  res.json({
    message: "User deleted successfully",
  });
});