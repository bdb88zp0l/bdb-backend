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

    let activeCaseCount = await Case.countDocuments({ endDate: { $exists: true, $ne: null, $gt: moment.utc().toDate() } })

    let clientStatusStatistics = await Client.aggregate([
        {
            $group: {
                _id: "$status",   // Group by the 'fieldName' field
                count: { $sum: 1 }   // Count each document in the group
            }
        },
        {
            $sort: { count: -1 }   // Optional: sort by count in descending order
        }
    ])
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const clientMonthlyStatistics = await Client.aggregate([
        {
            // Group by year and month to get monthly totals
            $group: {
                _id: {
                    year: { $year: "$engagedAt" },
                    month: { $month: "$engagedAt" }
                },
                totalClients: { $sum: 1 } // Count each client
            }
        },
        {
            // Sort by year and month
            $sort: { "_id.year": 1, "_id.month": 1 }
        },
        {
            // Add fields to calculate monthly growth percentage
            $setWindowFields: {
                partitionBy: null, // Since we're working on the whole dataset
                sortBy: { "_id.year": 1, "_id.month": 1 },
                output: {
                    previousTotal: {
                        $shift: { output: "$totalClients", by: -1 }
                    }
                }
            }
        },
        {
            // Calculate the growth percentage
            $addFields: {
                growthPercentage: {
                    $cond: {
                        if: { $eq: ["$previousTotal", null] },
                        then: null, // No growth percentage for the first month
                        else: {
                            $multiply: [
                                {
                                    $divide: [
                                        { $subtract: ["$totalClients", "$previousTotal"] },
                                        "$previousTotal"
                                    ]
                                },
                                100
                            ]
                        }
                    }
                }
            }
        },
        {
            // Project to get a clean output
            $project: {
                month: "$_id.month",
                year: "$_id.year",
                totalClients: 1,
                growthPercentage: { $round: ["$growthPercentage", 2] } // Round to 2 decimal places
            }
        }
    ]);

    // Step 1: Generate the last 12 months' data structure with defaults
    // const last12Months = Array.from({ length: 12 }, (_, i) => {
    //     const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    //     return {
    //         month: date.getMonth() + 1,
    //         year: date.getFullYear(),
    //         totalClients: 0,
    //         growthPercentage: 0
    //     };
    // }).reverse();

    // Step 2: Map aggregated data to the last 12 months, filling in missing months with zeroes
    const monthlyData = last12Months.map((date, index) => {
        const found = clientMonthlyStatistics.find(
            stat => stat.year === date.year && stat.month === date.month
        );

        // If month data is found, return it; otherwise, keep the default (zero growth)
        return found
            ? {
                ...date,
                totalClients: found.totalClients,
                growthPercentage: found.growthPercentage
            }
            : {
                ...date,
                totalClients: 0,
                growthPercentage: 0
            };
    }).reverse();


    const caseMonthlyData = await Case.aggregate([
        // Group by year, month, and status for counts in each month
        {
            $group: {
                _id: {
                    year: { $year: "$startDate" },
                    month: { $month: "$startDate" },
                    status: "$status"
                },
                totalCases: { $sum: 1 }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        {
            $setWindowFields: {
                partitionBy: "$_id.status",
                sortBy: { "_id.year": 1, "_id.month": 1 },
                output: {
                    previousTotal: { $shift: { output: "$totalCases", by: -1 } }
                }
            }
        },
        {
            $addFields: {
                growthPercentage: {
                    $cond: {
                        if: { $eq: ["$previousTotal", null] },
                        then: null,
                        else: {
                            $multiply: [
                                {
                                    $divide: [
                                        { $subtract: ["$totalCases", "$previousTotal"] },
                                        "$previousTotal"
                                    ]
                                },
                                100
                            ]
                        }
                    }
                }
            }
        },
        {
            $project: {
                month: "$_id.month",
                year: "$_id.year",
                status: "$_id.status",
                totalCases: 1,
                growthPercentage: { $round: ["$growthPercentage", 2] }
            }
        },
        {
            // Create a facet for each status group with filled month data
            $facet: {
                active: [
                    { $match: { status: "active" } },
                    {
                        $group: {
                            _id: "active",
                            monthlyData: {
                                $push: {
                                    month: "$month",
                                    year: "$year",
                                    totalCases: "$totalCases",
                                    growthPercentage: "$growthPercentage"
                                }
                            }
                        }
                    },
                    // Calculate total count for all records with "active" status
                    {
                        $lookup: {
                            from: "cases",
                            let: { status: "active" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$status", "$$status"] } } },
                                { $count: "totalCount" }
                            ],
                            as: "totalCountArray"
                        }
                    },
                    {
                        $set: {
                            totalCount: { $arrayElemAt: ["$totalCountArray.totalCount", 0] }
                        }
                    },
                    {
                        // Merge with last 12 months to autofill missing months
                        $project: {
                            monthlyData: {
                                $map: {
                                    input: last12Months,
                                    as: "monthInfo",
                                    in: {
                                        $let: {
                                            vars: {
                                                data: {
                                                    $first: {
                                                        $filter: {
                                                            input: "$monthlyData",
                                                            cond: {
                                                                $and: [
                                                                    { $eq: ["$$monthInfo.year", "$$this.year"] },
                                                                    { $eq: ["$$monthInfo.month", "$$this.month"] }
                                                                ]
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            in: {
                                                month: "$$monthInfo.month",
                                                year: "$$monthInfo.year",
                                                totalCases: { $ifNull: ["$$data.totalCases", 0] },
                                                growthPercentage: { $ifNull: ["$$data.growthPercentage", 0] }
                                            }
                                        }
                                    }
                                }
                            },
                            totalCount: { $ifNull: ["$totalCount", 0] }
                        }
                    },
                    { $addFields: { monthlyData: { $slice: ["$monthlyData", -12] } } }
                ],
                inactive: [
                    { $match: { status: "inactive" } },
                    {
                        $group: {
                            _id: "inactive",
                            monthlyData: {
                                $push: {
                                    month: "$month",
                                    year: "$year",
                                    totalCases: "$totalCases",
                                    growthPercentage: "$growthPercentage"
                                }
                            }
                        }
                    },
                    // Calculate total count for all records with "inactive" status
                    {
                        $lookup: {
                            from: "cases",
                            let: { status: "inactive" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$status", "$$status"] } } },
                                { $count: "totalCount" }
                            ],
                            as: "totalCountArray"
                        }
                    },
                    {
                        $set: {
                            totalCount: { $arrayElemAt: ["$totalCountArray.totalCount", 0] }
                        }
                    },
                    {
                        $project: {
                            monthlyData: {
                                $map: {
                                    input: last12Months,
                                    as: "monthInfo",
                                    in: {
                                        $let: {
                                            vars: {
                                                data: {
                                                    $first: {
                                                        $filter: {
                                                            input: "$monthlyData",
                                                            cond: {
                                                                $and: [
                                                                    { $eq: ["$$monthInfo.year", "$$this.year"] },
                                                                    { $eq: ["$$monthInfo.month", "$$this.month"] }
                                                                ]
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            in: {
                                                month: "$$monthInfo.month",
                                                year: "$$monthInfo.year",
                                                totalCases: { $ifNull: ["$$data.totalCases", 0] },
                                                growthPercentage: { $ifNull: ["$$data.growthPercentage", 0] }
                                            }
                                        }
                                    }
                                }
                            },
                            totalCount: { $ifNull: ["$totalCount", 0] }
                        }
                    },
                    { $addFields: { monthlyData: { $slice: ["$monthlyData", -12] } } }
                ],
                all: [
                    {
                        $group: {
                            _id: "all",
                            monthlyData: {
                                $push: {
                                    month: "$month",
                                    year: "$year",
                                    totalCases: "$totalCases",
                                    growthPercentage: "$growthPercentage"
                                }
                            }
                        }
                    },
                    // Calculate total count for all records
                    {
                        $lookup: {
                            from: "cases",
                            pipeline: [{ $count: "totalCount" }],
                            as: "totalCountArray"
                        }
                    },
                    {
                        $set: {
                            totalCount: { $arrayElemAt: ["$totalCountArray.totalCount", 0] }
                        }
                    },
                    {
                        $project: {
                            monthlyData: {
                                $map: {
                                    input: last12Months,
                                    as: "monthInfo",
                                    in: {
                                        $let: {
                                            vars: {
                                                data: {
                                                    $first: {
                                                        $filter: {
                                                            input: "$monthlyData",
                                                            cond: {
                                                                $and: [
                                                                    { $eq: ["$$monthInfo.year", "$$this.year"] },
                                                                    { $eq: ["$$monthInfo.month", "$$this.month"] }
                                                                ]
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            in: {
                                                month: "$$monthInfo.month",
                                                year: "$$monthInfo.year",
                                                totalCases: { $ifNull: ["$$data.totalCases", 0] },
                                                growthPercentage: { $ifNull: ["$$data.growthPercentage", 0] }
                                            }
                                        }
                                    }
                                }
                            },
                            totalCount: { $ifNull: ["$totalCount", 0] }
                        }
                    },
                    { $addFields: { monthlyData: { $slice: ["$monthlyData", -12] } } }
                ]
            }
        },
        {
            $project: {
                data: {
                    $concatArrays: ["$all", "$active", "$inactive"]
                }
            }
        },
        { $unwind: "$data" },
        { $replaceRoot: { newRoot: "$data" } }
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
    res.json({
        message: "Fetched successfully",
        data: {
            topClients,
            contractPriceMonthlyStats,
            topCases,
            caseMonthlyData: caseMonthlyData,
            activeCaseCount,
            clientMonthlyStatistics: monthlyData,
            caseStatusStatistics,
            clientStatusStatistics, recentActivities
        }
    });
});
