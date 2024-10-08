/**
 * Team Controller
 * 
 * This module contains all the controller functions for team-related operations.
 * It includes CRUD operations for teams, user management within teams, and data retrieval for team-related forms.
 * 
 * @module TeamController
 */

const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const CaseTeamDesignation = require("../../../model/CaseTeamDesignation");
const Team = require("../../../model/Team");
const User = require("../../../model/User");
const SimpleValidator = require("../../../validator/simpleValidator");

// Constants for team status
const TEAM_STATUS = {
  ACTIVE: 'active',
  DELETED: 'deleted',
};

/**
 * Create a new team
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing team details
 * @param {string} req.body.title - Title of the team
 * @param {string} [req.body.description] - Description of the team
 * @param {Array} req.body.users - Array of user IDs to be added to the team
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 * @throws {AppError} If validation fails
 */
exports.createTeam = catchAsync(async (req, res) => {
  const requestData = req.body;

  // Validate the request body
  await SimpleValidator(requestData, {
    title: "required|string",
    description: "string",
    users: "required|array",
  });

  const team = await Team.create({
    ...requestData,
    createdBy: req.user._id,
  });

  res.status(201).json({
    message: "Team created successfully!",
    data: team,
  });
});

/**
 * Get all teams with pagination and optional filtering
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters for filtering and pagination
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of items per page
 * @param {string} [req.query.search] - Search term for team title
 * @param {string} [req.query.status] - Filter by team status
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.getAllTeams = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, search, status } = req.query;

  // Build query
  let match = {
    ...(status ? { status } : { status: { $ne: "deleted" } }),
    ...(search && { title: { $regex: search, $options: "i" } }),
  };

  const aggregatedQuery = Team.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "users", // Lookup users from the 'users' collection
        localField: "users.user", // The 'user' field inside 'users' array
        foreignField: "_id", // Foreign field _id in 'users' collection
        as: "populatedUsers", // Populate the users data into 'populatedUsers'
        pipeline: [
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              email: 1,
              phone: 1,
              photo: 1,
              role: 1,
            },
          },
        ],
      },
    },
    // Lookup designations for users
    {
      $lookup: {
        from: "caseteamdesignations", // Lookup designations from 'CaseTeamDesignation'
        localField: "users.designation", // The 'designation' field inside 'users' array
        foreignField: "_id", // Foreign field _id in 'CaseTeamDesignation'
        as: "populatedDesignations", // Populate designation data into 'populatedDesignations'
      },
    },
    // Unwind the users array for further processing
    { $unwind: "$users" },
    // Add fields to map each user's populated data
    {
      $addFields: {
        "users.user": {
          $arrayElemAt: [
            {
              $filter: {
                input: "$populatedUsers",
                as: "user",
                cond: { $eq: ["$$user._id", "$users.user"] },
              },
            },
            0,
          ],
        },
        "users.designation": {
          $arrayElemAt: [
            {
              $filter: {
                input: "$populatedDesignations",
                as: "designation",
                cond: { $eq: ["$$designation._id", "$users.designation"] },
              },
            },
            0,
          ],
        },
      },
    },
    // Group back the users into an array
    {
      $group: {
        _id: "$_id",
        title: { $first: "$title" },
        description: { $first: "$description" },
        createdAt: { $first: "$createdAt" },
        status: { $first: "$status" },
        createdAt: { $first: "$createdAt" },
        users: { $push: "$users" },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
  ]);

  // Pagination options
  const options = {
    page: parseInt(page),
    limit: parseInt(limit) === -1 ? 9999999 : parseInt(limit),
  };

  // Fetch paginated data
  const data = await Team.aggregatePaginate(aggregatedQuery, options);

  res.json({
    message: "Fetched teams successfully!",
    data,
  });
});

/**
 * Get specific team details
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Team ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 * @throws {AppError} If team is not found
 */
exports.getTeam = catchAsync(async (req, res) => {
  const { id } = req.params;

  const team = await Team.findById(id)
    .populate("users.user", "firstName lastName email")
    .populate("createdBy", "firstName lastName email");

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  res.json({
    message: "Fetched team successfully!",
    data: team,
  });
});

/**
 * Update a team
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Team ID
 * @param {Object} req.body - Request body containing updated team details
 * @param {string} req.body.title - Updated title of the team
 * @param {string} req.body.description - Updated description of the team
 * @param {Array} req.body.users - Updated array of user IDs in the team
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 * @throws {AppError} If team is not found or validation fails
 */
exports.updateTeam = catchAsync(async (req, res) => {
  const { id } = req.params;
  const requestData = req.body;

  // Validate the request body
  await SimpleValidator(requestData, {
    title: "required|string",
    description: "required|string",
    users: "required|array",
  });

  const team = await Team.findById(id);

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  // Update the team fields
  Object.assign(team, requestData);

  await team.save();

  res.json({
    message: "Team updated successfully!",
    data: team,
  });
});

/**
 * Delete (soft delete) a team
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Team ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 * @throws {AppError} If team is not found
 */
exports.deleteTeam = catchAsync(async (req, res) => {
  const { id } = req.params;

  const team = await Team.findById(id);

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  // Soft delete the team by setting the status to deleted
  team.status = "deleted";
  await team.save();

  res.json({
    message: "Team deleted successfully!",
  });
});

/**
 * Add a user to a team
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Team ID
 * @param {Object} req.body - Request body
 * @param {string} req.body.userId - User ID to be added
 * @param {string} req.body.designation - User's designation in the team
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 * @throws {AppError} If team is not found or user is already in the team
 */
exports.addUserToTeam = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { userId, designation } = req.body;

  // Validate the input
  await SimpleValidator(req.body, {
    userId: "required|mongoid",
    designation: "required|string",
  });

  const team = await Team.findById(id);

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  const userExistsInTeam = team.users.some((u) => u.user.toString() === userId);

  if (userExistsInTeam) {
    throw new AppError("User is already a member of the team", 400);
  }

  team.users.push({ user: userId, designation });
  await team.save();

  res.json({
    message: "User added to team successfully!",
    data: team,
  });
});

/**
 * Remove a user from a team
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Team ID
 * @param {string} req.params.userId - User ID to be removed
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 * @throws {AppError} If team is not found
 */
exports.removeUserFromTeam = catchAsync(async (req, res) => {
  const { id, userId } = req.params;

  const team = await Team.findById(id);

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  team.users = team.users.filter((u) => u.user.toString() !== userId);

  await team.save();

  res.json({
    message: "User removed from team successfully!",
    data: team,
  });
});

/**
 * Bulk update team members
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Team ID
 * @param {Object} req.body - Request body
 * @param {Array} req.body.users - Updated array of user objects
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 * @throws {AppError} If team is not found or validation fails
 */
exports.bulkUpdateTeams = catchAsync(async (req, res) => {
  let { users } = req.body;

  await SimpleValidator(req.body, {
    users: "required|array",
  });

  const team = await Team.findById(req.params.id);

  if (!team) {
    throw new AppError("Team not found", 404);
  }
  await Team.findByIdAndUpdate(req.params.id, {
    users,
  });

  // TODO: Return the updated team data instead of the original team
  res.json({
    message: "Team member updated successfully",
    data: team,
  });
});

/**
 * Get page data for team management forms
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.getData = catchAsync(async (req, res) => {
  let users = await User.find({ status: "activated" }).select(
    "firstName lastName email photo phone"
  );
  let designations = await CaseTeamDesignation.find({ status: "active" });
  res.json({
    status: "success",
    data: {
      users,
      designations,
    },
  });
});