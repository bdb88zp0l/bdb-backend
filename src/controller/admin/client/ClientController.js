/**
 * @fileoverview Client Controller
 * 
 * This module provides controller functions for managing clients in the system.
 * It handles CRUD operations for clients, including creation, retrieval, updating,
 * and soft deletion of client records. The controller also manages related data
 * such as company groups, contacts, and supervising partners.
 * 
 * @module ClientController
 * @requires mongoose
 * @requires ../../../exception/AppError
 * @requires ../../../exception/catchAsync
 * @requires ../../../model/Client
 * @requires ../../../model/CompanyGroup
 * @requires ../../../model/Contact
 * @requires ../../../model/User
 * @requires ../../../utils/dateQueryGenerator
 * @requires ../../../validator/simpleValidator
 * @requires ../../../services/ClientService
 */

const { isValidObjectId } = require("mongoose");
const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const Client = require("../../../model/Client");
const CompanyGroup = require("../../../model/CompanyGroup");
const Contact = require("../../../model/Contact");
const User = require("../../../model/User");
const dateQueryGenerator = require("../../../utils/dateQueryGenerator");
const SimpleValidator = require("../../../validator/simpleValidator");
const { getNextCounter } = require("../../../services/ClientService");

/**
 * Retrieves all clients with pagination and filtering options
 * 
 * @function getAllClients
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters for filtering and pagination
 * @param {Object} req.user - Authenticated user object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with paginated client data
 */
exports.getAllClients = catchAsync(async (req, res) => {
  const { defaultWorkspace } = req.user;

  const {
    search,
    fromDate,
    toDate,
    page = 1,
    limit = 10,
    status,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Generate date query
  const dateQuery = dateQueryGenerator(fromDate, toDate);

  // Create the main query object
  const query = {
    workspace: defaultWorkspace._id,
    ...dateQuery,
    status: status || { $in: ["active", "inactive", "withdrawn"] },
    ...(search && {
      $or: [
        { code: { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
        { serviceType: { $regex: search, $options: "i" } },
        { industry: { $regex: search, $options: "i" } },
        { tin: { $regex: search, $options: "i" } },
      ],
    }),
  };

  // Aggregation pipeline with sorting
  const aggregatedQuery = Client.aggregate([
    {
      $match: query,
    },

    {
      $lookup: {
        from: "users",
        localField: "supervisingPartner",
        foreignField: "_id",
        as: "supervisingPartner",
        pipeline: [
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              photo: 1,
              email: 1,
              phone: 1,
              mobile: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$supervisingPartner",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $lookup: {
        from: "users",
        localField: "referredBy",
        foreignField: "_id",
        as: "referredBy",
        pipeline: [
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              photo: 1,
              email: 1,
              phone: 1,
              mobile: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$referredBy",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $lookup: {
        from: "companygroups",
        localField: "companyGroup",
        foreignField: "_id",
        as: "companyGroup",
      },
    },
    {
      $unwind: {
        path: "$companyGroup",
        preserveNullAndEmptyArrays: true,
      },
    },

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
              middleName: 1,
              lastName: 1,
              nickName: 1,
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
  const data = await Client.aggregatePaginate(aggregatedQuery, options);

  res.json({
    status: "success",
    data,
  });
});

/**
 * Retrieves a specific client by ID
 * 
 * @function getClient
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Client ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the client data
 * @throws {AppError} If the client is not found
 */
exports.getClient = catchAsync(async (req, res) => {
  const client = await Client.findOne({
    _id: req.params.id,
    status: {
      $ne: "deleted",
    },
  })
    .populate("supervisingPartner", "firstName lastName email username photo")
    .populate("referredBy", "firstName lastName email username photo")
    .populate("companyGroup", "name")
    .populate(
      "contact",
      "firstName lastName middleName nickName photo email phone"
    );

  if (!client) {
    throw new AppError("Client not found", 404);
  }

  res.json({
    status: "success",
    data: {
      client,
    },
  });
});

/**
 * Updates a specific client by ID
 * 
 * @function updateClient
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Client ID
 * @param {Object} req.body - Request body containing updated client details
 * @param {Object} req.user - Authenticated user object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the updated client data
 * @throws {AppError} If the client is not found or validation fails
 */
exports.updateClient = catchAsync(async (req, res) => {
  let { defaultWorkspace } = req.user;
  // Destructure and validate incoming data
  let {
    clientNumber,
    accountType,
    addresses,
    emails,
    phones,
    engagedAt,
    withdrawnAt,
    status,
  } = req.body;
  await SimpleValidator(req.body, {
    accountType: "required",
    status: "required",
  });

  // Parse JSON strings if necessary
  if (typeof addresses === "string") addresses = JSON.parse(addresses);
  if (typeof emails === "string") emails = JSON.parse(emails);
  if (typeof phones === "string") phones = JSON.parse(phones);

  if (!clientNumber) {
    clientNumber = await getNextCounter();
  }

  // Find and update the client
  const client = await Client.findOneAndUpdate(
    { _id: req.params.id },
    {
      workspace: defaultWorkspace._id,
      clientNumber,
      accountType,
      addresses,
      emails,
      phones,
      engagedAt,
      withdrawnAt,
      status,
    },
    {
      new: true,
    }
  );

  if (!client) {
    throw new AppError("Client not found", 404);
  }

  res.json({
    status: "success",
    data: {
      client,
    },
  });
});

/**
 * Soft deletes a specific client by ID
 * 
 * @function deleteClient
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Client ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response confirming the deletion
 * @throws {AppError} If the client is not found
 */
exports.deleteClient = catchAsync(async (req, res) => {
  const client = await Client.findOneAndUpdate(
    { _id: req.params.id, status: "active" },
    {
      status: "deleted",
      deletedAt: new Date(),
    },
    { new: true }
  );

  if (!client) {
    throw new AppError("Client not found", 404);
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});

/**
 * Retrieves data necessary for client management pages
 * 
 * @function getData
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with users, contacts, and draft companies data
 */
exports.getData = catchAsync(async (req, res) => {
  let { defaultWorkspace } = req.user;
  let users = await User.find({ status: "activated" }).select(
    "firstName lastName email photo phone"
  );
  let contacts = await Contact.find({
    status: "active",
    workspace: defaultWorkspace,
  }).select("firstName middleName lastName nickName email photo phone mobile");
  let draftCompanies = await Client.find(
    { status: "inDraft" },
    "companyName logo"
  );

  res.json({
    status: "success",
    data: {
      draftCompanies,
      users,
      contacts,
    },
  });
});