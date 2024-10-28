/**
 * @fileoverview Case Controller
 * 
 * This module provides controller functions for managing cases in the system.
 * It handles CRUD operations for cases, including creation, retrieval, updating,
 * and soft deletion of case records. The controller also manages related data
 * such as clients, documents, teams, and case status history.
 * 
 * @module CaseController
 * @requires ../../../exception/AppError
 * @requires ../../../exception/catchAsync
 * @requires ../../../model/Case
 * @requires ../../../model/CaseTeamDesignation
 * @requires ../../../model/Client
 * @requires ../../../model/DocumentNode
 * @requires ../../../model/Team
 * @requires ../../../model/User
 * @requires ../../../services/CaseService
 * @requires ../../../services/PaperMerge
 * @requires ../../../validator/simpleValidator
 */

const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const Case = require("../../../model/Case");
const CaseTeamDesignation = require("../../../model/CaseTeamDesignation");
const Client = require("../../../model/Client");
const DocumentNode = require("../../../model/DocumentNode");
const Team = require("../../../model/Team");
const User = require("../../../model/User");
const { getNextCaseNumber } = require("../../../services/CaseService");
const { getInformation, createNode } = require("../../../services/PaperMerge");
const SimpleValidator = require("../../../validator/simpleValidator");

/**
 * Creates a new case
 * 
 * This function handles the creation of a new case in the system. It validates
 * the incoming data, creates a new case in the database, and sets up the
 * associated document structure in PaperMerge.
 *
 * @function createCase
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.body - The request body containing the case data
 * @param {Object} req.user - The authenticated user object
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with the created case
 * @throws {AppError} - If validation fails or case creation encounters an error
 */
exports.createCase = catchAsync(async (req, res) => {
  const { defaultWorkspace } = req.user;
  // Destructure and validate incoming data
  let {
    title,
    description,
    client,
    startDate,
    endDate,
    documents,
    defaultBillingType,
    serviceType,
    currency,
    convertRetainerFeeToPHP,
    vatSetting,
    billingStart,
    billingEnd,
    team,
    priority,
    caseNumber,
  } = req.body;

  await SimpleValidator(req.body, {
    title: "required|string",
    client: "required|mongoid",
    // team: "required|mongoid",
  });

  if (team) {
    team = await Team.findById(team);
    if (!team) {
      throw new AppError("Team not found", 422);
    }
  }

  if (!caseNumber) {
    caseNumber = await getNextCaseNumber();
  }
  let checkExistingCase = await Case.findOne({ caseNumber });
  if (checkExistingCase) {
    throw new AppError("Case number already exists", 422);
  }
  let nodeData = await createNode(
    defaultWorkspace?.paperMergeNodeId ?? null,
    caseNumber,
    "folder"
  );

  const newCase = await Case.create({
    workspace: defaultWorkspace._id,
    paperMergeNodeId: nodeData.id,
    caseNumber,
    title,
    description,
    status: "active",
    client,
    startDate,
    endDate,
    documents,
    defaultBillingType,
    serviceType,
    currency: currency || "PHP",
    convertRetainerFeeToPHP,
    vatSetting,
    billingStart,
    billingEnd,
    createdBy: req.user._id,
    team,
    priority,
    statusHistory: [
      {
        status: "Created",
        date: new Date(),
        updatedBy: req.user._id,
      },
    ],
  });

  let node = await DocumentNode.create({
    case: newCase._id,
    workspace: defaultWorkspace._id,
    paperMergeParentNodeId: nodeData?.parent_id,
    paperMergeNodeId: nodeData.id,
    title: nodeData.title,
    path: nodeData.breadcrumb,
    createdBy: req.user._id,
    metaData: nodeData,
    nodeType: "folder",
    visibility: "protected",
    sharedWithTeams: team ? [team._id] : [],
  });

  res.status(201).json({
    message: "Case created successfully",
    data: newCase,
  });
});

/**
 * Retrieves all cases with pagination and filtering options
 * 
 * @function getAllCases
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.query - Query parameters for filtering and pagination
 * @param {Object} req.user - The authenticated user object
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with paginated case data
 */
exports.getAllCases = catchAsync(async (req, res) => {
  const { defaultWorkspace } = req.user;
  const {
    search,
    status,
    client,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Create the main query object
  const query = {
    workspace: defaultWorkspace._id,
    ...(status && { status }),
    ...(client && { client }),
    ...(search && {
      $or: [
        { caseNumber: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
      ],
    }),
  };

  // Aggregation pipeline
  const aggregatedQuery = Case.aggregate([
    { $match: query },
    {
      $lookup: {
        from: "clients",
        localField: "client",
        foreignField: "_id",
        as: "clientData",
        pipeline: [
          {
            $lookup: {
              from: "contacts",
              localField: "contact",
              foreignField: "_id",
              as: "contact",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    firstName: 1,
                    lastName: 1,
                    emails: 1,
                    photo: 1,
                  },
                },
              ],
            },
          },

          {
            $unwind: {
              path: "$contact",
              preserveNullAndEmptyArrays: true,
            },
          }
        ],
      },
    },
    { $unwind: "$clientData" },

    {
      $lookup: {
        from: "teams",
        localField: "team",
        foreignField: "_id",
        as: "team",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "users.user",
              foreignField: "_id",
              as: "users",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    firstName: 1,
                    lastName: 1,
                    email: 1,
                    photo: 1,
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$team",
        preserveNullAndEmptyArrays: true,
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdByUser",
      },
    },
    { $unwind: "$createdByUser" },
    {
      $project: {
        caseNumber: 1,
        title: 1,
        status: 1,
        priority: 1,
        startDate: 1,
        endDate: 1,
        createdAt: 1,
        team: 1,
        "clientData": 1,
        "createdByUser.firstName": 1,
        "createdByUser.lastName": 1,
      },
    },
    { $sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 } },
  ]);

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const result = await Case.aggregatePaginate(aggregatedQuery, options);

  res.json({
    status: "success",
    data: result,
  });
});

/**
 * Retrieves a specific case by ID
 * 
 * @function getCase
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Case ID
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with the case data
 * @throws {AppError} - If the case is not found
 */
exports.getCase = catchAsync(async (req, res) => {
  const caseData = await Case.findById(req.params.id)
    .populate("client", "companyName")
    .populate("createdBy", "firstName lastName")
    // .populate("team")
    // .populate("team.users.user")
    .populate({
      path: 'team',
      populate: {
        path: 'users.user',
        select: "firstName lastName email photo _id"

      }
    })
    .populate({
      path: 'team',
      populate: {
        path: 'users.designation'
      }
    }).populate({
      path: 'members',
      populate: {
        path: 'user',
        select: "firstName lastName email photo _id"

      }
    })
    .populate({
      path: 'members',
      populate: {
        path: 'designation'
      }
    })


  if (!caseData) {
    throw new AppError("Case not found", 404);
  }

  res.json({
    status: "success",
    data: caseData,
  });
});

/**
 * Updates a specific case by ID
 * 
 * @function updateCase
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Case ID
 * @param {Object} req.body - Request body containing updated case details
 * @param {Object} req.user - The authenticated user object
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with the updated case data
 * @throws {AppError} - If the case is not found or validation fails
 */
exports.updateCase = catchAsync(async (req, res) => {
  const {
    caseNumber,
    title,
    description,
    status,
    client,
    startDate,
    endDate,
    documents,
    defaultBillingType,
    serviceType,
    currency,
    convertRetainerFeeToPHP,
    vatSetting,
    billingStart,
    billingEnd,
    priority,
    team,
  } = req.body;

  await SimpleValidator(req.body, {
    caseNumber: "required|string",
    title: "required|string",
    client: "required|mongoid",
    team: "required|mongoid",
    status: "in:closed,active",
  });

  const updatedCase = await Case.findByIdAndUpdate(
    req.params.id,
    {
      caseNumber,
      title,
      description,
      status,
      client,
      startDate,
      endDate,
      documents,
      defaultBillingType,
      serviceType,
      currency,
      convertRetainerFeeToPHP,
      vatSetting,
      billingStart,
      billingEnd,
      updatedBy: req.user._id,
      priority,
      team,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedCase) {
    throw new AppError("Case not found", 404);
  }

  res.json({
    message: "Case updated successfully",
    data: updatedCase,
  });
});

exports.addMember = catchAsync(async (req, res) => {
  const { users } = req.body;
  await SimpleValidator(req.body, {
    users: "required|array",
  });

  const foundCase = await Case.findById(req.params.id);
  if (!foundCase) {
    throw new AppError("Case not found", 404);
  }
  await Case.findByIdAndUpdate(req.params.id, {
    members: users
  });

  let userIds = users.map(user => user.user);
  console.log(userIds);

  await DocumentNode.findOneAndUpdate({
    case: foundCase._id,
  }, {
    "sharedWith": userIds
  });


  res.json({
    message: "Member added successfully",
    data: null,
  });
});

/**
 * Soft deletes a case by updating its status to "deleted"
 * 
 * @function deleteCase
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Case ID
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response confirming the deletion
 * @throws {AppError} - If the case is not found
 */
exports.deleteCase = catchAsync(async (req, res) => {
  const deletedCase = await Case.findByIdAndUpdate(
    req.params.id,
    {
      status: "deleted",
      deletedAt: new Date(),
    },
    { new: true }
  );

  if (!deletedCase) {
    throw new AppError("Case not found", 404);
  }

  res.status(204).json({
    message: "Case deleted successfully",
    data: null,
  });
});

/**
 * Updates the status of a case and adds a status history entry
 * 
 * @function updateCaseStatus
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Case ID
 * @param {Object} req.body - Request body
 * @param {string} req.body.status - New status of the case
 * @param {string} req.body.description - Description of the status change
 * @param {Object} req.user - The authenticated user object
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with the updated case
 * @throws {AppError} - If the case is not found or validation fails
 */
exports.updateCaseStatus = catchAsync(async (req, res) => {
  const { status, description } = req.body;

  await SimpleValidator(req.body, {
    status: "required",
    description: "required",
  });

  const foundCase = await Case.findById(req.params.id);

  if (!foundCase) {
    throw new AppError("Case not found", 404);
  }

  let statusHistory = foundCase?.statusHistory ?? [];

  // Add status update to history
  statusHistory.push({
    status,
    description,
    date: new Date(),
    updatedBy: req.user._id,
  });

  await Case.findByIdAndUpdate(req.params.id, {
    statusHistory,
  });

  res.json({
    message: "Case status updated successfully",
    data: foundCase,
  });
});

/**
 * Retrieves data required for creating a new case
 * 
 * @function getData
 * @async
 * @param {Object} req - The HTTP request object
 * @param {Object} req.user - The authenticated user object
 * @param {Object} res - The HTTP response object
 * @returns {Promise<void>} - Sends a JSON response with designations, users, clients, and teams data
 */
exports.getData = catchAsync(async (req, res) => {
  let { defaultWorkspace } = req.user;
  let designations = await CaseTeamDesignation.find({ status: "active" });
  let users = await User.find({ status: "activated" }).select(
    "firstName lastName email photo phone"
  );
  let clients = await Client.find({
    status: "active",
    workspace: defaultWorkspace,
  }).select("companyName clientNumber accountType");
  let teams = await Team.find({ status: "active" });

  res.json({
    status: "success",
    data: {
      designations,
      users,
      clients,
      teams,
    },
  });
});