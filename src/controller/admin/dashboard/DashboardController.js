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


    let caseStatusStatistics = await Case.aggregate([
        {
            $addFields: {
                isActive: {
                    $cond: {
                        if: { $eq: ["$caseStatus", "AC"] },
                        then: "activeCase",
                        else: "inactiveCase"
                    }
                }
            }
        },
        {
            $group: {
                _id: "$isActive",
                count: { $sum: 1 }
            }
        },
        {
            $sort: { _id: 1 }  // Sort alphabetically (activeCase will come before inactiveCase)
        }
    ]);

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
        // First add a field to categorize cases as active or inactive
        {
            $addFields: {
                caseCategory: {
                    $cond: {
                        if: { $eq: ["$caseStatus", "AC"] },
                        then: "active",
                        else: "inactive"
                    }
                }
            }
        },
        // Group by year, month, and the new category
        {
            $group: {
                _id: {
                    year: { $year: "$startDate" },
                    month: { $month: "$startDate" },
                    status: "$caseCategory"  // Using the new caseCategory instead of status
                },
                monthCount: { $sum: 1 }
            }
        },
        // Sort by date to calculate cumulative counts
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        // Calculate cumulative counts for each status
        {
            $group: {
                _id: "$_id.status",  // This will now group by active/inactive
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


    let recentActivities = await Notification.find({}).populate("user", "firstName lastName email ").sort({ createdAt: -1 }).limit(5);

    const clientStats = (await clientMonthlyData)[0];
    const caseStats = (await caseMonthlyData)[0];
    


    const topClientsByCase = await Case.aggregate([
        {
            $group: {
                _id: "$client",
                totalCases: { $sum: 1 }
            }
        },
        {
            $sort: { totalCases: -1 }
        },
        {
            $limit: 5
        },
        {
            // Lookup client information
            $lookup: {
                from: "clients",
                localField: "_id",
                foreignField: "_id",
                as: "clientInfo"
            }
        },
        {
            $unwind: "$clientInfo"
        },
        {
            // Add lookup for contact information
            $lookup: {
                from: "contacts",
                localField: "clientInfo.contact",
                foreignField: "_id",
                as: "contactInfo"
            }
        },
        {
            $unwind: "$contactInfo"
        },
        {
            $project: {
                _id: 0,
                clientId: "$_id",
                totalCases: 1,
                clientInfo: {
                    companyName: "$clientInfo.companyName",
                    email: "$clientInfo.email",
                    clientNumber: "$clientInfo.clientNumber",
                    code: "$clientInfo.code",
                    logo: "$clientInfo.logo"
                },
                contactInfo: {
                    firstName: "$contactInfo.firstName",
                    lastName: "$contactInfo.lastName",
                    email: "$contactInfo.email",
                    phone: "$contactInfo.phone",
                    designation: "$contactInfo.designation"
                }
            }
        }
    ]);

    const latestClients = await Client.aggregate([
        {
            $match: {
                status: "active"
            }
        },
        {
            $sort: {
                engagedAt: -1 // Sort by engagement date in descending order
            }
        },
        {
            $limit: 10
        },
        {
            // Lookup contact information
            $lookup: {
                from: "contacts",
                localField: "contact",
                foreignField: "_id",
                as: "contactInfo"
            }
        },
        {
            $unwind: "$contactInfo"
        },
        {
            $project: {
                _id: 1,
                companyName: 1,
                email: 1,
                clientNumber: 1,
                code: 1,
                engagedAt: 1,
                status: 1,
                logo: 1,
                contactInfo: {
                    firstName: "$contactInfo.firstName",
                    lastName: "$contactInfo.lastName",
                    emails: "$contactInfo.emails",
                    phone: "$contactInfo.phone",
                    designation: "$contactInfo.designation"
                }
            }
        }
    ]);

    const monthlyStatistics = await Promise.all([
        // Cases per month
        await Case.aggregate([
            {
                $match: {
                    startDate: {
                        $gte: new Date(new Date().setMonth(new Date().getMonth() - 12))
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$startDate" },
                        month: { $month: "$startDate" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    month: "$_id.month",
                    count: 1
                }
            }
        ]),
        // Clients per month
        await Client.aggregate([
            {
                $match: {
                    engagedAt: {
                        $gte: new Date(new Date().setMonth(new Date().getMonth() - 12))
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$engagedAt" },
                        month: { $month: "$engagedAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    month: "$_id.month",
                    count: 1
                }
            }
        ])
    ]).then(([caseCounts, clientCounts]) => {
        // Map the results to the last 12 months
        return last12Months.reverse().map(month => ({
            yearMonth: `${month.year}-${month.month}`,
            year: month.year,
            month: month.month,
            cases: caseCounts.find(c => c.year === month.year && c.month === month.month)?.count || 0,
            clients: clientCounts.find(c => c.year === month.year && c.month === month.month)?.count || 0
        }))
    });

    res.json({
        message: "Fetched successfully",
        data: {
            monthlyStatistics,
            topClientsByCase,
            latestClients,
            caseMonthlyData: caseStats,
            clientMonthlyData: clientStats,
            caseStatusStatistics,
            recentActivities
        }
    });
});
