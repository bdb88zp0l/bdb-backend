const catchAsync = require("../../../exception/catchAsync");
const Case = require("../../../model/Case");
const Client = require("../../../model/Client");
const moment = require("moment");
const Notification = require("../../../model/Notification");

exports.getDashboard = catchAsync(async (req, res) => {


    // Generate the last 12 months as a sequence of months to ensure autofill
    const currentDate = new Date();
    const last12Months = [];
    for (let i = 0; i < 12; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        last12Months.push({ year: date.getFullYear(), month: date.getMonth() + 1 });
    }



    const topClients = await Case.aggregate([
        {
            // Group by client and calculate the total contract price
            $group: {
                _id: "$client",
                totalContractPrice: { $sum: "$contractPrice" }
            }
        },
        {
            // Sort by total contract price in descending order
            $sort: { totalContractPrice: -1 }
        },
        {
            // Limit to the top 6 clients (adjust the limit as needed)
            $limit: 6
        },
        {
            // Populate client information
            $lookup: {
                from: "clients", // Collection name in MongoDB
                localField: "_id",
                foreignField: "_id",
                as: "clientInfo"
            }
        },
        {
            // Unwind clientInfo array to get a single object
            $unwind: "$clientInfo"
        },
        {
            // Project only required fields
            $project: {
                _id: 0,
                clientId: "$_id",
                totalContractPrice: 1,
                clientInfo: 1
            }
        }
    ]);



    let caseStatusStatistics = await Case.aggregate([
        {
            $group: {
                _id: "$caseStatus",   // Group by the 'fieldName' field
                count: { $sum: 1 }   // Count each document in the group
            }
        },
        {
            $sort: { count: -1 }   // Optional: sort by count in descending order
        }
    ])

    const clientMonthlyData = await Client.aggregate([
        // First stage: Group by year, month, and status
        {
            $group: {
                _id: {
                    year: { $year: "$engagedAt" },
                    month: { $month: "$engagedAt" },
                    status: "$status"
                },
                monthCount: { $sum: 1 }
            }
        },
        // Sort by date to calculate cumulative counts
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        // Calculate cumulative counts for each status
        {
            $group: {
                _id: "$_id.status",
                monthlyData: {
                    $push: {
                        year: "$_id.year",
                        month: "$_id.month",
                        count: "$monthCount"
                    }
                }
            }
        },
        // Calculate cumulative sums
        {
            $project: {
                monthlyData: {
                    $map: {
                        input: { $range: [0, { $size: "$monthlyData" }] },
                        as: "index",
                        in: {
                            year: { $arrayElemAt: ["$monthlyData.year", "$$index"] },
                            month: { $arrayElemAt: ["$monthlyData.month", "$$index"] },
                            totalClients: {
                                $sum: {
                                    $slice: ["$monthlyData.count", 0, { $add: ["$$index", 1] }]
                                }
                            }
                        }
                    }
                }
            }
        },
        // Calculate growth percentages
        {
            $project: {
                monthlyData: {
                    $map: {
                        input: { $range: [0, { $size: "$monthlyData" }] },
                        as: "index",
                        in: {
                            year: { $arrayElemAt: ["$monthlyData.year", "$$index"] },
                            month: { $arrayElemAt: ["$monthlyData.month", "$$index"] },
                            totalClients: { $arrayElemAt: ["$monthlyData.totalClients", "$$index"] },
                            growthPercentage: {
                                $cond: {
                                    if: { $eq: ["$$index", 0] },
                                    then: 0,
                                    else: {
                                        $multiply: [
                                            {
                                                $divide: [
                                                    {
                                                        $subtract: [
                                                            { $arrayElemAt: ["$monthlyData.totalClients", "$$index"] },
                                                            { $arrayElemAt: ["$monthlyData.totalClients", { $subtract: ["$$index", 1] }] }
                                                        ]
                                                    },
                                                    { $arrayElemAt: ["$monthlyData.totalClients", { $subtract: ["$$index", 1] }] }
                                                ]
                                            },
                                            100
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        // Create facets for active and inactive clients
        {
            $facet: {
                active: [
                    { $match: { _id: "active" } },
                    {
                        $project: {
                            _id: "active",
                            monthlyData: { $slice: ["$monthlyData", -12] },
                            totalCount: { $arrayElemAt: ["$monthlyData.totalClients", -1] },
                            latestGrowth: {
                                $arrayElemAt: ["$monthlyData.growthPercentage", -1]
                            }
                        }
                    }
                ],
                inactive: [
                    { $match: { _id: "inactive" } },
                    {
                        $project: {
                            _id: "inactive",
                            monthlyData: { $slice: ["$monthlyData", -12] },
                            totalCount: { $arrayElemAt: ["$monthlyData.totalClients", -1] },
                            latestGrowth: {
                                $arrayElemAt: ["$monthlyData.growthPercentage", -1]
                            }
                        }
                    }
                ]
            }
        },
        // Get first object from each status array
        {
            $project: {
                active: { $arrayElemAt: ["$active", 0] },
                inactive: { $arrayElemAt: ["$inactive", 0] }
            }
        }
    ]);

    const caseMonthlyData = await Case.aggregate([
        // First stage: Group by year, month, and status
        {
            $group: {
                _id: {
                    year: { $year: "$startDate" },
                    month: { $month: "$startDate" },
                    status: "$status"
                },
                monthCount: { $sum: 1 }
            }
        },
        // Sort by date to calculate cumulative counts
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        // Calculate cumulative counts for each status
        {
            $group: {
                _id: "$_id.status",
                monthlyData: {
                    $push: {
                        year: "$_id.year",
                        month: "$_id.month",
                        count: "$monthCount"
                    }
                }
            }
        },
        // Calculate cumulative sums and growth
        {
            $project: {
                monthlyData: {
                    $map: {
                        input: { $range: [0, { $size: "$monthlyData" }] },
                        as: "index",
                        in: {
                            year: { $arrayElemAt: ["$monthlyData.year", "$$index"] },
                            month: { $arrayElemAt: ["$monthlyData.month", "$$index"] },
                            totalCases: {
                                $sum: {
                                    $slice: ["$monthlyData.count", 0, { $add: ["$$index", 1] }]
                                }
                            }
                        }
                    }
                }
            }
        },
        // Calculate growth percentages
        {
            $project: {
                monthlyData: {
                    $map: {
                        input: { $range: [0, { $size: "$monthlyData" }] },
                        as: "index",
                        in: {
                            year: { $arrayElemAt: ["$monthlyData.year", "$$index"] },
                            month: { $arrayElemAt: ["$monthlyData.month", "$$index"] },
                            totalCases: { $arrayElemAt: ["$monthlyData.totalCases", "$$index"] },
                            growthPercentage: {
                                $cond: {
                                    if: { $eq: ["$$index", 0] },
                                    then: 0,
                                    else: {
                                        $multiply: [
                                            {
                                                $divide: [
                                                    {
                                                        $subtract: [
                                                            { $arrayElemAt: ["$monthlyData.totalCases", "$$index"] },
                                                            { $arrayElemAt: ["$monthlyData.totalCases", { $subtract: ["$$index", 1] }] }
                                                        ]
                                                    },
                                                    { $arrayElemAt: ["$monthlyData.totalCases", { $subtract: ["$$index", 1] }] }
                                                ]
                                            },
                                            100
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        // Create facets for active, inactive, and all cases
        {
            $facet: {
                active: [
                    { $match: { _id: "active" } },
                    {
                        $project: {
                            _id: "active",
                            monthlyData: { $slice: ["$monthlyData", -12] },
                            totalCount: { $arrayElemAt: ["$monthlyData.totalCases", -1] },
                            latestGrowth: {
                                $arrayElemAt: ["$monthlyData.growthPercentage", -1]
                            }
                        }
                    }
                ],
                inactive: [
                    { $match: { _id: "inactive" } },
                    {
                        $project: {
                            _id: "inactive",
                            monthlyData: { $slice: ["$monthlyData", -12] },
                            totalCount: { $arrayElemAt: ["$monthlyData.totalCases", -1] },
                            latestGrowth: {
                                $arrayElemAt: ["$monthlyData.growthPercentage", -1]
                            }
                        }
                    }
                ]
            }
        },
        // Get first object from each status array
        {
            $project: {
                active: { $arrayElemAt: ["$active", 0] },
                inactive: { $arrayElemAt: ["$inactive", 0] }
            }
        }
    ]);
    const topCases = await Case.find()
        .sort({ contractPrice: -1 }) // Sort by contractPrice in descending order
        .limit(5) // Limit to the top 5 results
        .populate("client", "companyName")
        .select("caseNumber title contractPrice"); // Select only necessary fields


    const contractPriceMonthlyStats = await Case.aggregate([
        // Match cases from the last 12 months
        {
            $match: {
                startDate: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 12)) },
            },
        },
        // Project the year and month from startDate
        {
            $project: {
                contractPrice: 1,
                yearMonth: {
                    $dateToString: { format: "%Y-%m", date: "$startDate" },
                },
            },
        },
        // Group by yearMonth and sum contract prices
        {
            $group: {
                _id: "$yearMonth",
                totalContractPrice: { $sum: "$contractPrice" },
            },
        },
        // Sort by yearMonth in ascending order
        {
            $sort: { _id: 1 },
        },
    ]);

    let recentActivities = await Notification.find({}).populate("user", "firstName lastName email ").sort({ createdAt: -1 }).limit(5);

    const clientStats = (await clientMonthlyData)[0];
    const caseStats = (await caseMonthlyData)[0];

    res.json({
        message: "Fetched successfully",
        data: {
            topClients,
            contractPriceMonthlyStats,
            topCases,
            caseMonthlyData: caseStats,
            clientMonthlyData: clientStats,
            caseStatusStatistics,
            recentActivities
        }
    });
});
