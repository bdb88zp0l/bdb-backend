/**
 * @fileoverview File Manager Controller
 * 
 * This module provides controller functions for managing files and folders,
 * integrating with PaperMerge for document storage and retrieval. It handles
 * operations such as listing, creating, deleting, and retrieving file/folder
 * information.
 * 
 * @module FileManagerController
 * @requires mongoose
 * @requires ../../../config/axios.config
 * @requires ../../../exception/AppError
 * @requires ../../../exception/catchAsync
 * @requires ../../../model/DocumentNode
 * @requires ../../../model/User
 * @requires ../../../services/PaperMerge
 * @requires ../../../validator/simpleValidator
 * @requires form-data
 * @requires underscore
 * @requires ../../../model/Team
 */

const { Types } = require("mongoose");
const { paperMergeRequest } = require("../../../config/axios.config");
const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const DocumentNode = require("../../../model/DocumentNode");
const User = require("../../../model/User");
const {
  getNodes,
  createNode,
  getInformation,
  uploadFile,
  deleteNodes,
  getFolderInfo,
  getDocumentInfo,
  getUniqueTitle,
} = require("../../../services/PaperMerge");
const SimpleValidator = require("../../../validator/simpleValidator");
const FormData = require("form-data");
const { pluck } = require("underscore");
const Team = require("../../../model/Team");

/**
 * Retrieves paginated document nodes based on various filters and parameters
 * 
 * @function getPaginatedDocumentNodes
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object
 * @param {Object} req.query - Query parameters for filtering and pagination
 * @param {Object} req.params - URL parameters
 * @param {string} [req.params.parentId] - Parent folder ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with paginated document nodes
 */
exports.getPaginatedDocumentNodes = catchAsync(async (req, res) => {
  const { defaultWorkspace } = req.user;
  let {
    page = 1,
    limit = 10,
    filter,
    search,
    serviceType,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;
  const { parentId } = req.params;
  const userId = new Types.ObjectId(req.user._id);

  if (filter == "recent") {
    sortBy = "lastAccessed";
  }

  // Get all teams the user belongs to
  const teams = await Team.find({ "users.user": req.user._id }, "_id");

  let match = {
    ...(parentId
      ? { paperMergeParentNodeId: parentId }
      : { workspace: defaultWorkspace._id }),
    $or: [
      { visibility: "public" },
      { createdBy: req.user._id, visibility: "private" },
      {
        sharedWithTeams: { $in: teams.map((team) => team._id) },
        visibility: "protected",
      },
    ],

    ...(search && { title: { $regex: search, $options: "i" } }),
    ...(filter === "favourite"
      ? { whitelistedUsers: { $in: [userId] }, nodeType: "document" } // Check if the userId is in whitelistedUsers
      : filter === "shared"
      ? {
          sharedWith: { $in: [req.user._id] },
          sharedWithTeams: { $in: teams.map((team) => team._id) },
        }
      : filter === "recycleBin"
      ? { status: "deleted" }
      : filter === "recent"
      ? { nodeType: "document" }
      : filter === "cases"
      ? {
          case: {
            $ne: null,
            $exists: true,
          },
        }
      : {}),
    ...(filter !== "recycleBin" && { status: "active" }),
  };
  // console.log("match", match);

  // Base aggregation pipeline

  let nodes = await DocumentNode.aggregate([
    { $match: match },
    // Lookup for users and cases
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy",
      },
    },
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        localField: "deletedBy",
        foreignField: "_id",
        as: "deletedBy",
      },
    },
    { $unwind: { path: "$deletedBy", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        localField: "lastAccessedBy",
        foreignField: "_id",
        as: "lastAccessedBy",
      },
    },
    { $unwind: { path: "$lastAccessedBy", preserveNullAndEmptyArrays: true } },
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
              photo: 1,
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
      $lookup: {
        from: "cases",
        localField: "case",
        foreignField: "_id",
        as: "case",
      },
    },
    { $unwind: { path: "$case", preserveNullAndEmptyArrays: true } },
    ...(serviceType
      ? [
          {
            $match: {
              "case.serviceType": serviceType,
              nodeType: "document",
            },
          },
        ]
      : []),
    // Add a field to count children using paperMergeNodeId and paperMergeParentNodeId
    {
      $lookup: {
        from: "documentnodes",
        localField: "paperMergeNodeId",
        foreignField: "paperMergeParentNodeId",
        as: "children",
        pipeline: [{ $match: { status: "active" } }],
      },
    },
    {
      $addFields: {
        childrenCount: { $size: "$children" },
        isFavourited: { $in: [userId, { $ifNull: ["$whitelistedUsers", []] }] }, // Check if userId is in whitelistedUsers
      },
    },

    {
      $sort: {
        [sortBy]: sortOrder === "desc" ? -1 : 1,
      },
    },
    // Pagination logic
    {
      $skip: (parseInt(page) - 1) * parseInt(limit),
    },
    {
      $limit: parseInt(limit),
    },
    {
      $project: {
        _id: 1,
        title: 1,
        nodeType: 1,
        visibility: 1,
        paperMergeNodeId: 1,
        paperMergeParentNodeId: 1,
        path: 1,
        size: 1,
        lastAccessed: 1,
        lastAccessedBy: { firstName: 1, lastName: 1, _id: 1 },
        createdBy: { firstName: 1, lastName: 1, _id: 1 },
        deletedBy: { firstName: 1, lastName: 1, _id: 1 },
        sharedWith: 1,
        sharedWithTeams: 1,
        case: { _id: 1, title: 1, serviceType: 1 },
        status: 1,
        childrenCount: 1,
        isFavourited: 1,
        metaData: 1,
        deletedAt: 1,
        createdAt: 1,
      },
    },
  ]);

  const totalCount = await DocumentNode.countDocuments(match);

  // mapping data
  nodes = nodes.map((node) => {
    let metaData = node?.metaData ?? {};
    delete node?.metaData;

    return {
      ...node,
      ...metaData,
    };
  });

  // Fetch additional folder information for the given folder ID
  const folder_information = await getFolderInfo(parentId);

  res.json({
    success: "Fetched nodes successfully",
    data: {
      total_docs: totalCount,
      page_number: parseInt(page),
      page_size: parseInt(limit),
      num_pages: Math.ceil(totalCount / limit),
      items: nodes,
      folder_information,
    },
  });
});

/**
 * Fetches nodes (files and folders) from Papermerge
 * 
 * @function nodes
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters for pagination
 * @param {Object} req.params - URL parameters
 * @param {string} [req.params.id] - Folder ID to fetch nodes from
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with fetched nodes and folder information
 */
exports.nodes = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query; // Pagination parameters
  let { id } = req.params; // The folder ID to fetch nodes from
  const homeFolderId = "4f884893-bd9f-45ea-88c5-50da4eb76289"; // Default Papermerge home folder ID

  // If no folder ID is provided, use the default home folder ID
  if (!id) {
    id = homeFolderId;
  }

  // Fetch nodes from Papermerge service based on folder ID, limit, and page number
  const nodes = await getNodes(id, limit, page);

  // Fetch additional folder information for the given folder ID
  const folder_information = await getFolderInfo(id);

  // Return the fetched nodes and folder information to the client
  res.json({
    message: "Fetched all nodes successfully",
    data: { ...nodes, folder_information },
  });
});

/**
 * Fetches the thumbnail image for a specific document
 * 
 * @function getThumbnail
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Document ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends the thumbnail image data
 * @throws {AppError} If there's an error fetching the thumbnail
 */
exports.getThumbnail = catchAsync(async (req, res) => {
  const { id } = req.params; // The document ID

  // Fetch the thumbnail data from Papermerge API
  const thumbnailResponse = await paperMergeRequest
    .get(`api/thumbnails/${id}`, { responseType: "arraybuffer" }) // Fetch as raw binary data
    .catch(() => {
      throw new AppError("Something went wrong while fetching thumbnails", 500);
    });

  // Get the content type from the API response headers
  const contentType = thumbnailResponse.headers["content-type"];

  // Set the appropriate content type for the image
  res.setHeader("Content-Type", contentType);
  res.send(thumbnailResponse.data); // Send the raw image data
});

/**
 * Fetches a page image from a given URL in Papermerge
 * 
 * @function getPageImage
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Page ID
 * @param {string} req.params.fileType - File type (e.g., 'svg', 'png')
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends the page image data
 * @throws {AppError} If there's an error fetching the page image
 */
exports.getPageImage = catchAsync(async (req, res) => {
  let { id, fileType } = req.params;
  // Validate that the URL is provided in the request body
  // SimpleValidator(req.body, {
  //   url: "required",
  // });
  // Fetch the page image  data from Papermerge API
  const pageResponse = await paperMergeRequest
    .get(`api/pages/${id}/${fileType}`, {
      responseType: fileType == "svg" ? "text" : "arraybuffer",
      ...(fileType == "svg" && { headers: { Accept: "image/svg+xml" } }),
    }) // Fetch as raw binary data
    .catch((error) => {
      console.log("server data error", error.response?.data);
      throw new AppError("Something went wrong while fetching page", 500);
    });
  // Get the content type from the API response headers
  const contentType = pageResponse.headers["content-type"];

  // Send the fetched page image data to the client
  res.setHeader("Content-Type", contentType);
  res.send(pageResponse.data); // Send the raw image data
});

/**
 * Fetches information for a specific folder in Papermerge
 * 
 * @function getFolderInfo
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Folder ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with folder information
 */
exports.getFolderInfo = catchAsync(async (req, res) => {
  const { id } = req.params; // The folder ID

  // Fetch the folder information from Papermerge
  const info = await getFolderInfo(id);

  // Return the folder information to the client
  res.json({
    message: "Fetched folder information successfully",
    data: info,
  });
});

/**
 * Fetches information for a specific document in Papermerge
 * 
 * @function getDocumentInfo
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Document ID
 * @param {Object} req.user - Authenticated user object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with document information
 */
exports.getDocumentInfo = catchAsync(async (req, res) => {
  const { id } = req.params; // The document ID

  // Fetch the document information from Papermerge
  const info = await getDocumentInfo(id);

  await DocumentNode.findOneAndUpdate(
    { paperMergeNodeId: id },
    {
      lastAccessedBy: req.user.id,
      lastAccessedAt: new Date(),
    }
  );

  // Return the document information to the client
  res.json({
    message: "Fetched document information successfully",
    data: info,
  });
});

/**
 * Creates a new node (folder or document) in Papermerge
 * 
 * @function createNode
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.title - Title of the new node
 * @param {string} req.body.parentId - Parent folder ID
 * @param {string} [req.body.cType] - Content type (folder or document)
 * @param {string} [req.body.caseId] - Associated case ID
 * @param {Object} req.user - Authenticated user object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the created node data
 * @throws {Error} If validation fails
 */
exports.createNode = catchAsync(async (req, res) => {
  const { defaultWorkspace } = req.user;
  // Validate that the required fields (title and parent ID) are provided in the request body
  SimpleValidator(req.body, {
    title: "required|string",
    parentId: "required|string",
  });

  let { title, cType, parentId, caseId } = req.body; // Node details: title, content type, and parent folder ID

  let parent = await DocumentNode.findOne({
    paperMergeNodeId: parentId,
  });

  title = await getUniqueTitle(title, parentId);

  // Create the new node in Papermerge
  const data = await createNode(parentId, title, cType);

  if (cType !== "document") {
    // Save the uploaded node's details in the database, associating it with the case
    await DocumentNode.create({
      case: caseId ? caseId : parent?.case ?? null,
      workspace: defaultWorkspace._id,
      paperMergeParentNodeId: data?.parent_id,
      paperMergeNodeId: data.id,
      title: data.title,
      path: data.breadcrumb,
      // size,
      createdBy: req.user._id,
      metaData: data,
      nodeType: "folder",
    });
  }

  // Return the newly created node to the client
  res.json({
    message: "Node created successfully",
    data,
  });
});

/**
 * Deletes nodes (files or folders) in Papermerge
 * 
 * @function deleteNodes
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {Array<string>} req.body.ids - Array of node IDs to delete
 * @param {string} req.body.actionType - Action type (e.g., 'permanent')
 * @param {Object} req.user - Authenticated user object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the deletion status
 * @throws {Error} If validation fails
 */
exports.deleteNodes = catchAsync(async (req, res) => {
  let { user } = req;
  // Validate that the required 'ids' field (array of node IDs) is provided
  SimpleValidator(req.body, {
    ids: "required|array",
  });

  const { ids, actionType } = req.body; // Array of node IDs to delete

  if (ids.length > 0) {
    if (actionType === "permanent") {
      await deleteNodes(ids);
    }
    await DocumentNode.updateMany(
      { paperMergeNodeId: { $in: ids } },
      {
        status: "deleted",
        deletedAt: new Date(),
        deletedBy: user._id,
      }
    );
  }

  // Return the deletion result to the client
  res.json({
    message: "Node deleted successfully",
  });
});

/**
 * Uploads a document to Papermerge and associates it with a case
 * 
 * @function uploadDocument
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.parentId - Parent folder ID
 * @param {string} req.body.visibility - Visibility level (e.g., 'public', 'private', 'protected', 'inherit')
 * @param {Array<string>} [req.body.sharedWithTeams] - Array of team IDs to share the document with
 * @param {Array<string>} [req.body.sharedWith] - Array of user IDs to share the document with
 * @param {string} [req.body.caseId] - Associated case ID
 * @param {Object} req.user - Authenticated user object
 * @param {Object} req.files - Uploaded files
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the upload status
 * @throws {Error} If validation fails or no file is uploaded
 */
exports.uploadDocument = catchAsync(async (req, res) => {
  const { defaultWorkspace, _id } = req.user;
  // Validate that the required 'parentId' field is provided
  SimpleValidator(req.body, {
    parentId: "required",
    visibility: "required|in:public,private,protected,inherit",
  });

  let { caseId, parentId, visibility, sharedWithTeams, sharedWith } = req.body; // Case ID and parent folder ID
  if (sharedWithTeams) {
    sharedWithTeams = JSON.parse(sharedWithTeams);
  }
  if (sharedWith) {
    sharedWith = JSON.parse(sharedWith);
  }

  // Ensure at least one file was uploaded
  if (!req.files.length) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  let parent = await DocumentNode.findOne({
    paperMergeNodeId: parentId,
  });

  // Loop through each uploaded file and process it
  for (const file of req.files) {
    let title = file?.originalname ?? ""; // Get the original file name
    const size = Number(file?.size / 1000); // Calculate the file size in the appropriate unit

    title = await getUniqueTitle(title, parentId);

    // Create a new node for the uploaded document
    const node = await createNode(parentId, title, "document", true);

    // Create a new FormData instance to hold the file data
    const formData = new FormData();

    // Append the file to the FormData object for uploading
    formData.append("file", file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    // Upload the file to Papermerge
    const paperMergeDoc = await uploadFile(node.id, formData, _id);

    // Save the uploaded document's details in the database, associating it with the case
    await DocumentNode.create({
      workspace: defaultWorkspace._id,
      case: caseId ? caseId : parent?.case ?? null,
      paperMergeParentNodeId: paperMergeDoc?.parent_id,
      paperMergeNodeId: paperMergeDoc.id,
      title: paperMergeDoc.title,
      path: paperMergeDoc.breadcrumb,
      size,
      createdBy: req.user._id,
      metaData: paperMergeDoc,
      nodeType: "document",
      ...(visibility == "inherit"
        ? {
            visibility: parent?.visibility ?? "private",
            sharedWith: parent?.sharedWith ?? [],
            sharedWithTeams: parent?.sharedWithTeams ?? [],
          }
        : { visibility }),
      ...(visibility == "protected" && {
        sharedWith: sharedWith,
        sharedWithTeams: sharedWithTeams,
      }),
    });
  }

  // Return a success message to the client
  res.status(201).json({
    message: "File uploaded successfully",
  });
});

/**
 * Searches for documents in Papermerge
 * 
 * @function search
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} req.query.q - Search query
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with search results
 * @throws {Error} If validation fails or an error occurs during the search
 */
exports.search = catchAsync(async (req, res) => {
  SimpleValidator(req.query, { q: "required" });
  let { q } = req.query;
  let data = await paperMergeRequest
    .get(`/api/search/?q=${q}`)
    .then((response) => {
      return response.data;
    })
    .catch((err) => {
      console.log(err.message);
      throw new AppError("Something went wrong while searching.", 500);
    });

  let allIds = pluck(data, "document_id");

  let activeIds = await DocumentNode.distinct("paperMergeNodeId", {
    paperMergeNodeId: { $in: allIds },
    status: "active",
  });

  data = data.filter((item) => activeIds.includes(item.document_id));

  // Return a success message to the client
  res.status(200).json({
    message: "Fetched successfully",
    activeIds,
    data,
  });
});

/**
 * Add or remove a user from the `whitelistedUsers` (favorites) for a document
 * 
 * @function toggleFavourite
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.documentId - Document ID
 * @param {Object} req.user - Authenticated user object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the updated document data
 * @throws {AppError} If the document is not found
 */
exports.toggleFavourite = catchAsync(async (req, res) => {
  const { documentId } = req.params;
  const userId = req.user._id;

  // Find the document node by its ID
  const document = await DocumentNode.findById(documentId);
  if (!document) {
    throw new AppError("Document not found", 404);
  }

  // Check if the user is already in the whitelistedUsers (favorites)
  const isFavourited = document.whitelistedUsers.some((user) =>
    user.equals(userId)
  );

  if (isFavourited) {
    // If user is already in favorites, remove them (un-favorite)
    document.whitelistedUsers = document.whitelistedUsers.filter(
      (user) => !user.equals(userId)
    );
    await document.save();
    return res.status(200).json({
      success: true,
      message: "User removed from favorites",
      data: document,
    });
  } else {
    // If user is not in favorites, add them
    document.whitelistedUsers.push(userId);
    await document.save();
    return res.status(200).json({
      success: true,
      message: "User added to favorites",
      data: document,
    });
  }
});

/**
 * Fetches home and inbox folder IDs from Papermerge
 * 
 * @function pageData
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.search] - Search query
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with folder IDs, API key, and other data
 */
exports.pageData = catchAsync(async (req, res) => {
  // Fetch home and inbox folder IDs from Papermerge
  const { home_folder_id, inbox_folder_id } = await getInformation();

  const { defaultWorkspace } = req.user;
  let users = await User.find({ status: "activated" }).select(
    "firstName lastName email photo phone"
  );

  const { search } = req.query;

  // Aggregation pipeline
  const dataByServiceType = await DocumentNode.aggregate([
    {
      $match: {
        workspace: defaultWorkspace._id,
        status: "active",
        ...(search && { title: { $regex: search, $options: "i" } }),
      },
    },
    {
      $lookup: {
        from: "cases",
        localField: "case",
        foreignField: "_id",
        as: "case",
      },
    },
    {
      $unwind: {
        path: "$case",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        "case.serviceType": { $ne: null },
      },
    },
    {
      $group: {
        _id: "$case.serviceType",
        totalDocuments: {
          $sum: {
            $cond: [{ $eq: ["$nodeType", "document"] }, 1, 0],
          },
        },
        totalNodes: { $sum: 1 },
        totalSize: {
          $sum: {
            $cond: [
              { $eq: ["$nodeType", "document"] },
              { $ifNull: ["$size", 0] },
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        serviceType: "$_id",
        totalDocuments: 1,
        totalNodes: 1,
        totalSize: 1,
      },
    },
    {
      $sort: {
        serviceType: 1,
      },
    },
  ]);

  // Return the folder IDs and the Papermerge API key to the client
  res.json({
    message: "Fetched successfully",
    data: {
      dataByServiceType,
      home_folder_id: defaultWorkspace?.paperMergeNodeId,
      inbox_folder_id,
      users,
    },
  });
});