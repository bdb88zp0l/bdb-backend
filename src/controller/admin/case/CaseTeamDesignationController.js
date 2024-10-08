/**
 * Provides API endpoints for managing case team designations.
 *
 * @module CaseTeamDesignationController
 */

/**
 * Retrieves all case team designations, optionally filtered by status.
 *
 * @function getAllCaseTeamDesignations
 * @param {Object} req - The Express request object.
 * @param {string} [req.query.status] - The status to filter designations by (e.g. 'active', 'deleted').
 * @param {Object} res - The Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the response is sent.
 */

/**
 * Bulk creates or updates case team designations.
 *
 * @function bulkCreateOrUpdateDesignations
 * @param {Object} req - The Express request object.
 * @param {Object[]} req.body.data - An array of designation objects to create or update.
 * @param {string} req.body.data[].name - The name of the designation.
 * @param {string} [req.body.data[].id] - The ID of the designation to update.
 * @param {Object} res - The Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the response is sent.
 */
/**
 * Bulk soft deletes case team designations.
 *
 * @function bulkDeleteDesignations
 * @param {Object} req - The Express request object.
 * @param {string[]} req.body.ids - An array of designation IDs to delete.
 * @param {Object} res - The Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the response is sent.
 */
const catchAsync = require("../../../exception/catchAsync");
const CaseTeamDesignation = require("../../../model/CaseTeamDesignation");
const SimpleValidator = require("../../../validator/simpleValidator");

// Get all designations (only active ones by default)
exports.getAllCaseTeamDesignations = catchAsync(async (req, res) => {
  const { status } = req.query;

  // Default to fetching only active designations, but allow fetching all or deleted ones via query
  const query = {
    ...(status && { status }), // If status is provided in query, filter by it
  };

  const designations = await CaseTeamDesignation.find(query);

  res.status(200).json({
    success: true,
    data: designations,
  });
});

// Bulk create or update designations
exports.bulkCreateOrUpdateDesignations = catchAsync(async (req, res) => {
  const { data } = req.body;

  // Validate incoming data
  await SimpleValidator(req.body, {
    data: "required|array",
  });

  // Loop through each record and either update (if _id exists) or create new
  for (const record of data) {
    await SimpleValidator(record, {
      name: "required|string",
    });

    if (record._id) {
      await CaseTeamDesignation.findByIdAndUpdate(
        record._id,
        { name: record.name },
        { new: true, runValidators: true }
      );
    } else {
      await new CaseTeamDesignation({ name: record.name }).save();
    }
  }

  res.status(200).json({
    success: true,
    message: "Designations updated successfully.",
  });
});

// Bulk soft delete designations (status set to 'deleted' with deletedAt timestamp)
exports.bulkDeleteDesignations = catchAsync(async (req, res) => {
  const { ids } = req.body;

  // Validate incoming data
  await SimpleValidator(req.body, {
    ids: "required|array",
  });

  // Soft delete designations by setting status to 'deleted' and recording the deletion time
  await CaseTeamDesignation.updateMany(
    { _id: { $in: ids } },
    { status: "deleted", deletedAt: new Date() }
  );

  res.status(200).json({
    success: true,
    message: "Designations deleted successfully.",
  });
});
