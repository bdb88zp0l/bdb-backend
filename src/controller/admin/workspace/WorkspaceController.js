/**
 * @fileoverview Workspace Controller
 * 
 * This module provides controller functions for managing workspaces.
 * It handles CRUD operations for workspaces, including integration
 * with PaperMerge for document management.
 * 
 * @module WorkspaceController
 * @requires ../../../config/file
 * @requires ../../../exception/catchAsync
 * @requires ../../../model/DocumentNode
 * @requires ../../../model/Workspace
 * @requires ../../../services/PaperMerge
 * @requires ../../../utils/dateQueryGenerator
 * @requires ../../../validator/simpleValidator
 */

const { upload } = require("../../../config/file");
const catchAsync = require("../../../exception/catchAsync");
const DocumentNode = require("../../../model/DocumentNode");
const Workspace = require("../../../model/Workspace");
const { createNode, getInformation } = require("../../../services/PaperMerge");
const dateQueryGenerator = require("../../../utils/dateQueryGenerator");
const SimpleValidator = require("../../../validator/simpleValidator");

/**
 * Creates a new workspace
 * 
 * This function validates the input, creates a new node in PaperMerge,
 * uploads a logo if provided, and creates a new workspace in the database.
 *
 * @function createWorkspace
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Name of the workspace
 * @param {string} [req.body.description] - Description of the workspace
 * @param {Object} [req.file] - Uploaded logo file
 * @param {Object} req.user - Authenticated user object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the created workspace
 * @throws {Error} If validation fails or workspace creation fails
 */
exports.createWorkspace = catchAsync(async (req, res) => {
  // Validate incoming data
  await SimpleValidator(req.body, {
    name: "required|string",
  });

  const { name, description } = req.body;

  let paperMergeData = await getInformation();
  let nodeData = await createNode(
    paperMergeData?.home_folder_id,
    name,
    "folder"
  );

  let logo = "";
  if (req.file) {
    let uploadData = await upload(req.file, "workspace");
    const { Key } = uploadData;
    logo = Key;
  }

  // Create the workspace
  const workspace = await Workspace.create({
    name,
    description,
    paperMergeNodeId: nodeData?.id,
    logo,
  });

  await DocumentNode.create({
    workspace: workspace._id,
    paperMergeParentNodeId: nodeData?.parent_id,
    paperMergeNodeId: nodeData.id,
    title: nodeData.title,
    path: nodeData.breadcrumb,
    // size,
    createdBy: req.user._id,
    metaData: nodeData,
    nodeType: "folder",
  });

  res.status(201).json({
    message: "Workspace created successfully",
    data: {
      workspace,
    },
  });
});

/**
 * Retrieves all workspaces with optional filtering and pagination
 * 
 * This function fetches workspaces based on search criteria, date range,
 * and pagination parameters.
 *
 * @function getAllWorkspaces
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.search] - Search term for workspace name or description
 * @param {string} [req.query.fromDate] - Start date for filtering
 * @param {string} [req.query.toDate] - End date for filtering
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of items per page
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with paginated workspace data
 */
exports.getAllWorkspaces = catchAsync(async (req, res) => {
  const { search, fromDate, toDate, page = 1, limit = 10 } = req.query;

  // Generate date query using the provided function
  let dateQuery = dateQueryGenerator(fromDate, toDate);

  // Create the main query object
  let query = {
    ...dateQuery,
    status: "active",
    ...(search && {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ],
    }),
  };

  // Aggregation pipeline
  const aggregatedQuery = Workspace.aggregate([
    {
      $match: query,
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);

  // Pagination options
  const options = {
    page: parseInt(page),
    limit: parseInt(limit) === -1 ? 9999999 : parseInt(limit),
  };

  // Fetch paginated data
  const data = await Workspace.aggregatePaginate(aggregatedQuery, options);

  res.json({
    message: "Fetched successfully",
    data,
  });
});

/**
 * Retrieves a specific workspace by ID
 * 
 * This function fetches a single workspace based on the provided ID.
 *
 * @function getWorkspace
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Workspace ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the workspace data
 * @throws {AppError} If the workspace is not found
 */
exports.getWorkspace = catchAsync(async (req, res) => {
  const workspace = await Workspace.findOne({
    _id: req.params.id,
    status: "active",
  });

  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  res.json({
    message: "Workspace fetched successfully",
    data: {
      workspace,
    },
  });
});

/**
 * Updates a specific workspace by ID
 * 
 * This function validates the input and updates the workspace details,
 * including the logo if a new one is provided.
 *
 * @function updateWorkspace
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Workspace ID
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Updated name of the workspace
 * @param {string} [req.body.description] - Updated description of the workspace
 * @param {Object} [req.file] - New logo file
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the updated workspace
 * @throws {AppError} If the workspace is not found or validation fails
 */
exports.updateWorkspace = catchAsync(async (req, res) => {
  // Validate incoming data
  await SimpleValidator(req.body, {
    name: "required|string",
  });

  const { name, description,email,phone,addressLine1, addressLine2 } = req.body;
  const workspaceId = req.params.id;

  // Find the workspace
  const workspace = await Workspace.findOne({
    _id: workspaceId,
    status: "active",
  });
  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  // Update fields if provided
  if (name) workspace.name = name;
  if (description) workspace.description = description;
  if (email) workspace.email = email;
  if (phone) workspace.phone = phone;
  if (addressLine1) workspace.addressLine1 = addressLine1;
  if (addressLine2) workspace.addressLine2 = addressLine2;
  if (req.file) {
    let uploadData = await upload(req.file, "workspace");
    const { Key } = uploadData;
    workspace.logo = Key;
  }

  await workspace.save();

  res.json({
    message: "Workspace updated successfully",
    data: {
      workspace,
    },
  });
});

/**
 * Soft deletes a specific workspace by ID
 * 
 * This function marks a workspace as deleted without removing it from the database.
 *
 * @function deleteWorkspace
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Workspace ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response confirming the deletion
 * @throws {AppError} If the workspace is not found
 */
exports.deleteWorkspace = catchAsync(async (req, res) => {
  const workspaceId = req.params.id;

  // Find the workspace
  const workspace = await Workspace.findOne({
    _id: workspaceId,
    status: "active",
  });
  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  // Soft delete the workspace by setting status to "deleted"
  workspace.status = "deleted";
  await workspace.save();

  res.json({
    message: "Workspace deleted successfully",
  });
});
