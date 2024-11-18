const catchAsync = require("../../../exception/catchAsync");
const SimpleValidator = require("../../../validator/simpleValidator");
const DSRTimeTracking = require("../../../model/DSRTimeTracking");
const AppError = require("../../../exception/AppError");
const moment = require("moment");
const Case = require("../../../model/Case");
const User = require("../../../model/User");
const dateQueryGenerator = require("../../../utils/dateQueryGenerator");
const { Types } = require("mongoose");
exports.createDSRTimeTracking = catchAsync(async (req, res) => {
  let user = req.user;

  // Validate incoming data
  await SimpleValidator(req.body, {
    task: "required|string",
    case: "required|mongoid",
    hourCount: "required|numeric",
    date: "required",
  });
  const { task, hourCount, date } = req.body;

  let caseInfo = await Case.findById(req.body.case);

  if (!caseInfo) {
    throw new AppError("Invalid case id provided", 422);
  }
  let hourlyRate = user?.hourlyRate ?? 0;
  let members = caseInfo?.members ?? [];
  if (members?.length > 0) {
    let caseRate =
      members?.find((item) => {
        return item.user.toString() == user._id.toString();
      })?.hourlyRate ?? 0;
    if (caseRate) {
      hourlyRate = caseRate;
    }
  }

  const newDSRTimeTracking = await DSRTimeTracking.create({
    task,

    hourCount,
    hourlyRate,
    case: caseInfo._id,
    user: req?.body?.user ? req?.body?.user : req.user._id,
    date: moment(date).toDate(),
  });
  res.status(201).json({
    message: "DSR created successfully",
    data: newDSRTimeTracking,
  });
});

exports.getAllDSRTimeTrackings = catchAsync(async (req, res) => {
  let user = req.user;
  const { page = 1, limit = 10, search, caseId } = req.query;

  let match = {
    ...(caseId && { case: caseId }),
    ...(search && { task: { $regex: search, $options: "i" } }),
    user: user._id,
    status: "active",
  };

  const aggregatedQuery = DSRTimeTracking.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "cases",
        localField: "case",
        foreignField: "_id",
        as: "case",
        pipeline: [
          {
            $project: {
              caseNumber: 1,
              title: 1,
              startDate: 1,
              endDate: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$case",
        preserveNullAndEmptyArrays: true,
      },
    },
    { $sort: { date: -1 } },
  ]);

  const data = await DSRTimeTracking.aggregatePaginate(aggregatedQuery, {
    page: parseInt(page),
    limit: limit == -1 ? 99999999 : parseInt(limit),
  });

  res.json({
    message: "Fetched events successfully",
    data,
  });
});

exports.getDSRTimeTracking = catchAsync(async (req, res) => {
  const foundDSRTimeTracking = await DSRTimeTracking.findById(req.params.id)
    .populate("case", "title visibility")
    .populate("user", "firstName lastName email")
    .lean();

  if (!foundDSRTimeTracking) {
    throw new AppError("DSRTimeTracking not found", 404);
  }

  res.json({
    message: "Fetched event successfully",
    data: foundDSRTimeTracking,
  });
});

exports.updateDSRTimeTracking = catchAsync(async (req, res) => {
  const { task, hourCount, date } = req.body;

  await SimpleValidator(req.body, {
    task: "required|string",
    case: "required|mongoid",
    hourCount: "required|numeric",
    date: "required",
  });
  let caseInfo = await Case.findById(req.body.case);

  if (!caseInfo) {
    throw new AppError("Invalid case id provided", 422);
  }

  const updatedDSRTimeTracking = await DSRTimeTracking.findByIdAndUpdate(
    req.params.id,
    {
      task,
      case: caseInfo._id,
      hourCount,
      date: moment(date).toDate(),
    },
    { runValidators: true }
  );

  if (!updatedDSRTimeTracking) {
    throw new AppError("DSRTimeTracking not found", 404);
  }
  res.json({
    message: "DSRTimeTracking updated successfully",
    data: updatedDSRTimeTracking,
  });
});
exports.deleteDSRTimeTracking = catchAsync(async (req, res) => {
  const deletedDSRTimeTracking = await DSRTimeTracking.findByIdAndDelete(
    req.params.id
  );
  res.json({
    message: "DSRTimeTracking deleted successfully",
    data: null,
  });
});

exports.getDsrRecordsByCase = catchAsync(async (req, res) => {
  let user = req.user;

  const caseId = req.params?.caseId ?? "";
  if (!caseId) {
    throw new AppError("Case id is required", 422);
  }
  const { billingStart, billingEnd, search } = req.query;

  let dateQuery = await dateQueryGenerator(billingStart, billingEnd, "date");

  let match = {
    ...(caseId && { case: new Types.ObjectId(caseId) }),
    ...(search && { task: { $regex: search, $options: "i" } }),
    ...dateQuery,
  };

  console.log(match);

  const records = await DSRTimeTracking.aggregate([
    { $match: match },

    { $sort: { date: -1 } },
  ]);

  res.json({
    message: "Fetched events successfully",
    data: records,
  });
});

exports.getData = catchAsync(async (req, res) => {
  let cases = await Case.find({ status: "active" }).select(
    "title caseNumber _id"
  );
  let users = await User.find({ status: "activated" }).select(
    "firstName lastName email photo phone"
  );

  res.json({
    status: "success",
    data: {
      cases,
      users,
    },
  });
});
