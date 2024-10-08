const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const CaseStatus = require("../../../model/CaseStatus");
const SimpleValidator = require("../../../validator/simpleValidator");

// Create a new case status
exports.createCaseStatus = catchAsync(async (req, res) => {
  // Validate incoming data
  await SimpleValidator(req.body, {
    title: "required|string",
  });

  const { title } = req.body;

  // Create the case status
  const caseStatus = await CaseStatus.create({
    title,
  });

  res.status(201).json({
    message: "Case Status created successfully",
    data: {
      caseStatus,
    },
  });
});

// Get all case statuses (excluding deleted ones)
exports.getAllCaseStatuses = catchAsync(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;

  // Create the main query object
  let query = {
    status: "active",
    ...(search && {
      title: { $regex: search, $options: "i" },
    }),
  };

  // Aggregation pipeline
  const aggregatedQuery = CaseStatus.aggregate([
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
  const data = await CaseStatus.aggregatePaginate(aggregatedQuery, options);

  res.json({
    message: "Fetched successfully",
    data,
  });
});

// Get a specific case status by ID
exports.getCaseStatus = catchAsync(async (req, res) => {
  const caseStatus = await CaseStatus.findOne({
    _id: req.params.id,
    status: "active",
  });

  if (!caseStatus) {
    throw new AppError("Case Status not found", 404);
  }

  res.json({
    message: "Case Status fetched successfully",
    data: {
      caseStatus,
    },
  });
});

// Update a specific case status by ID
exports.updateCaseStatus = catchAsync(async (req, res) => {
  // Validate incoming data
  await SimpleValidator(req.body, {
    title: "required",
  });

  const { title } = req.body;
  const caseStatusId = req.params.id;

  // Find the case status
  const caseStatus = await CaseStatus.findOne({
    _id: caseStatusId,
    status: "active",
  });
  if (!caseStatus) {
    throw new AppError("Case Status not found", 404);
  }

  // Update fields if provided
  if (title) caseStatus.title = title;

  await caseStatus.save();

  res.json({
    message: "Case Status updated successfully",
    data: {
      caseStatus,
    },
  });
});

// Soft delete a specific case status by ID (setting status to "deleted")
exports.deleteCaseStatus = catchAsync(async (req, res) => {
  const caseStatusId = req.params.id;

  // Find the case status
  const caseStatus = await CaseStatus.findOne({
    _id: caseStatusId,
    status: "active",
  });
  if (!caseStatus) {
    throw new AppError("Case Status not found", 404);
  }

  // Soft delete the case status by setting status to "deleted"
  caseStatus.status = "deleted";
  await caseStatus.save();

  res.json({
    message: "Case Status deleted successfully",
  });
});
