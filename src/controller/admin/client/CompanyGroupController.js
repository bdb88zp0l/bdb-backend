const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const CompanyGroup = require("../../../model/CompanyGroup");
const SimpleValidator = require("../../../validator/simpleValidator");

// Create a new client category
exports.createCompanyGroup = catchAsync(async (req, res) => {
  const { defaultWorkspace } = req.user;
  // Validate incoming data
  await SimpleValidator(req.body, {
    name: "required|string",
    description: "required|string",
  });

  const { name, description } = req.body;

  // Create the client category
  const companyGroup = await CompanyGroup.create({
    name,
    description,
  });

  res.status(201).json({
    message: "Client Category created successfully",
    data: {
      companyGroup,
    },
  });
});

// Get all client categories (excluding deleted ones)
exports.getAllClientCategories = catchAsync(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;

  // Create the main query object
  let query = {
    status: "active",
    ...(search && {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ],
    }),
  };

  // Aggregation pipeline
  const aggregatedQuery = CompanyGroup.aggregate([
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
  const data = await CompanyGroup.aggregatePaginate(aggregatedQuery, options);

  res.json({
    message: "Fetched successfully",
    data,
  });
});

// Get a specific client category by ID
exports.getCompanyGroup = catchAsync(async (req, res) => {
  const companyGroup = await CompanyGroup.findOne({
    _id: req.params.id,
    status: "active",
  });

  if (!companyGroup) {
    throw new AppError("Client Category not found", 404);
  }

  res.json({
    message: "Client Category fetched successfully",
    data: {
      companyGroup,
    },
  });
});

// Update a specific client category by ID
exports.updateCompanyGroup = catchAsync(async (req, res) => {
  // Validate incoming data
  await SimpleValidator(req.body, {
    name: "required",
    description: "required",
  });

  const { name, description } = req.body;
  const companyGroupId = req.params.id;

  // Find the client category
  const companyGroup = await CompanyGroup.findOne({
    _id: companyGroupId,
    status: "active",
  });
  if (!companyGroup) {
    throw new AppError("Client Category not found", 404);
  }

  // Update fields if provided
  if (name) companyGroup.name = name;
  if (description) companyGroup.description = description;

  await companyGroup.save();

  res.json({
    message: "Client Category updated successfully",
    data: {
      companyGroup,
    },
  });
});

// Soft delete a specific client category by ID (setting status to "deleted")
exports.deleteCompanyGroup = catchAsync(async (req, res) => {
  const companyGroupId = req.params.id;

  // Find the client category
  const companyGroup = await CompanyGroup.findOne({
    _id: companyGroupId,
    status: "active",
  });
  if (!companyGroup) {
    throw new AppError("Client Category not found", 404);
  }

  // Soft delete the client category by setting status to "deleted"
  companyGroup.status = "deleted";
  await companyGroup.save();

  res.json({
    message: "Client Category deleted successfully",
  });
});
