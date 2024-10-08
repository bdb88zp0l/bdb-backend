/**
 * @fileoverview PaperMerge Service
 * 
 * This module provides services for interacting with the PaperMerge API.
 * It includes functions for user information retrieval, node management,
 * folder and document operations, and file uploads.
 * 
 * @module PaperMergeService
 * @requires ../config/axios.config
 * @requires ../exception/AppError
 * @requires ../model/DocumentNode
 * @requires ../model/Setting
 */

const { paperMergeRequest } = require("../config/axios.config");
const AppError = require("../exception/AppError");
const DocumentNode = require("../model/DocumentNode");
const Setting = require("../model/Setting");

/**
 * Retrieves user information from Papermerge or fetches and stores it if not available in the settings.
 *
 * @async
 * @function getInformation
 * @returns {Promise<Object>} The user information data from Papermerge.
 * @throws {AppError} If there's an error fetching the information from Papermerge API.
 */
exports.getInformation = async () => {
  // Attempt to find the Papermerge information stored in the database
  let data = await Setting.findOne({ name: "PAPERMERGE_INFORMATION" }).lean();

  // If the information is already stored, return it
  if (data?.value) {
    return data?.value ?? {};
  }

  // If no information is found, fetch it from Papermerge API
  data = await paperMergeRequest
    .get(`/api/users/me`)
    .then((response) => {
      // Extract and return the user data from Papermerge API
      return response.data;
    })
    .catch((error) => {
      // Log the error and throw an exception in case of failure
      console.log(error.response?.data);
      throw new AppError("Something went wrong", 500);
    });

  // Store the fetched data in the database for future use
  await Setting.create({
    name: "PAPERMERGE_INFORMATION",
    value: data,
  });

  return data;
};

/**
 * Fetches nodes (files and folders) from Papermerge based on the parent folder ID.
 *
 * @async
 * @function getNodes
 * @param {string} parentId - The ID of the parent folder whose nodes are being retrieved.
 * @param {number} [pageSize=5] - The number of nodes to return per page.
 * @param {number} [pageNumber=1] - The current page number for pagination.
 * @param {string} [orderBy="-title"] - The order in which nodes are returned (default is descending by title).
 * @returns {Promise<Object>} The response data containing nodes.
 * @throws {AppError} If there's an error fetching nodes from Papermerge API.
 */
exports.getNodes = async (
  parentId,
  pageSize = 5,
  pageNumber = 1,
  orderBy = "-title"
) => {
  // Log the parent folder ID for debugging purposes
  console.log("Parent ID", parentId);

  // Fetch nodes from Papermerge API based on parent folder ID and pagination parameters
  return await paperMergeRequest
    .get(
      `/api/nodes/${parentId}?page_number=${pageNumber}&page_size=${pageSize}&order_by=${orderBy}`
    )
    .then((response) => {
      // Return the nodes data from the API
      return response.data;
    })
    .catch((error) => {
      // Log the error and throw an exception in case of failure
      console.log(error.response?.data);
      throw new AppError("Something went wrong", 500);
    });
};

/**
 * Retrieves folder information from Papermerge based on folder ID.
 *
 * @async
 * @function getFolderInfo
 * @param {string} id - The ID of the folder to retrieve information for.
 * @returns {Promise<Object|null>} The folder information or null if not found or an error occurs.
 */
exports.getFolderInfo = async (id) => {
  // Fetch folder information from Papermerge API
  return await paperMergeRequest
    .get(`api/folders/${id}`)
    .then((response) => {
      // Return the folder information from the API
      return response.data;
    })
    .catch(() => {
      // Return null in case of an error
      return null;
    });
};

/**
 * Retrieves document information from Papermerge based on document ID.
 *
 * @async
 * @function getDocumentInfo
 * @param {string} id - The ID of the document to retrieve information for.
 * @returns {Promise<Object>} The document information.
 * @throws {AppError} If there's an error fetching document information from Papermerge API.
 */
exports.getDocumentInfo = async (id) => {
  // Fetch document information from Papermerge API
  return await paperMergeRequest
    .get(`api/documents/${id}`)
    .then((response) => {
      // Return the document information from the API
      return response.data;
    })
    .catch((error) => {
      // Log the error and throw an exception in case of failure
      console.log(error.response);
      throw new AppError(
        "Something went wrong while getting document information",
        500
      );
    });
};

/**
 * Creates a new node (file or folder) in Papermerge.
 *
 * @async
 * @function createNode
 * @param {string} parentId - The ID of the parent folder where the new node will be created.
 * @param {string} title - The title of the new node.
 * @param {string} [cType="folder"] - The type of the node (either "folder" or "document").
 * @param {boolean} [ocr=true] - Whether to enable OCR processing (only applicable for documents).
 * @returns {Promise<Object>} The response data containing the new node details.
 * @throws {AppError} If there's an error creating the node in Papermerge API.
 */
exports.createNode = async (parentId, title, cType = "folder", ocr = true) => {
  // Log the node creation details for debugging
  // console.log({
  //   parent_id: parentId,
  //   title,
  //   ctype: cType,
  //   ...(cType == "document" && { ocr }),
  // });

  // Send a request to create the new node in Papermerge
  return await paperMergeRequest
    .post(`/api/nodes/`, {
      parent_id: parentId,
      title,
      ctype: cType,
      ...(cType == "document" && { ocr }),
    })
    .then((response) => {
      // Return the newly created node details from the API
      return response.data;
    })
    .catch((error) => {
      // Log the error and throw an exception in case of failure
      console.log(error.response?.data);
      throw new AppError("Something went wrong while creating node", 500);
    });
};

/**
 * Deletes nodes (files or folders) in Papermerge based on the provided IDs.
 *
 * @async
 * @function deleteNodes
 * @param {string[]} ids - The IDs of the nodes to be deleted.
 * @returns {Promise<Object|null>} The response data confirming deletion or null in case of an error.
 */
exports.deleteNodes = async (ids) => {
  // Send a request to delete nodes in Papermerge
  return await paperMergeRequest
    .delete(`/api/nodes/`, { data: ids })
    .then((response) => {
      // Return the deletion confirmation data from the API
      return response.data;
    })
    .catch((error) => {
      // Log the error and return null in case of failure
      console.log(error.response?.data.detail);
      return null;
    });
};

/**
 * Uploads a file to a specific document in Papermerge.
 *
 * @async
 * @function uploadFile
 * @param {string} documentId - The ID of the document where the file will be uploaded.
 * @param {Object} formData - The form data containing the file to upload.
 * @param {string|null} [userId=null] - The ID of the user uploading the file (optional).
 * @returns {Promise<Object>} The response data from the API.
 * @throws {AppError} If there's an error uploading the file to Papermerge API.
 */
exports.uploadFile = async (documentId, formData, userId = null) => {
  // Send a request to upload a file to Papermerge
  return await paperMergeRequest
    .post(`/api/documents/${documentId}/upload`, formData, {
      headers: { ...formData.getHeaders() },
    })
    .then((response) => {
      // Return the uploaded file details from the API
      return response.data;
    })
    .catch(async (error) => {
      // Log the error and attempt to delete the document if the upload fails
      console.log(error.response?.data);
      console.log(error.message);
      await this.deleteNodes([documentId], userId); // Delete the failed document

      // Throw an error for the failed upload
      throw new AppError("Something went wrong while uploading file", 500);
    });
};

/**
 * Generates a unique title for a new node to avoid conflicts.
 *
 * @async
 * @function getUniqueTitle
 * @param {string} originalTitle - The original title for the node.
 * @param {string} parentId - The ID of the parent folder.
 * @returns {Promise<string>} A unique title for the new node.
 */
exports.getUniqueTitle = async (originalTitle, parentId) => {
  // Replace spaces with hyphens
  let title = originalTitle.replace(/\s+/g, "-");

  // Separate the file extension
  let fileExtension = "";
  let baseTitle = title;
  const lastDotIndex = title.lastIndexOf(".");

  if (lastDotIndex !== -1) {
    fileExtension = title.substring(lastDotIndex); // Includes the dot
    baseTitle = title.substring(0, lastDotIndex);
  }

  let counter = 0;
  let newTitle = title;

  // Check if the title exists
  let titleExists = await DocumentNode.findOne({
    paperMergeParentNodeId: parentId,
    title: newTitle,
  });

  // Loop until a unique title is found
  while (titleExists) {
    counter += 1;
    if (counter === 1) {
      newTitle = `${baseTitle}-copy${fileExtension}`;
    } else {
      newTitle = `${baseTitle}-copy (${counter})${fileExtension}`;
    }

    // Check again with the new title
    titleExists = await DocumentNode.findOne({
      paperMergeParentNodeId: parentId,
      title: newTitle,
    });
  }

  return newTitle;
};