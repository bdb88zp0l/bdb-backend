const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const BillingHistory = require("../../../model/BillingHistory");
const Case = require("../../../model/Case");
const Client = require("../../../model/Client");
const DSRTimeTracking = require("../../../model/DSRTimeTracking");
const SimpleValidator = require("../../../validator/simpleValidator");

/**
 * Creates a new billing record
 */
exports.createBilling = catchAsync(async (req, res) => {
    const {
        case: caseId,
        client,
        billingType,
        currency,
        title,
        billNumber,
        note,
        date,
        dueDate,
        items,
    } = req.body;

    await SimpleValidator(req.body, {
        title: "required|string",
        case: "required|mongoid",
        client: "required|mongoid",
        billingType: "required|in:oneTime,milestore,timeBased",
        date: "required|date",
        dueDate: "required|date",
    });

    // Validate case and client existence
    const caseData = await Case.findById(caseId);
    if (!caseData) {
        throw new AppError("Case not found", 404);
    }

    const clientData = await Client.findById(client);
    if (!clientData) {
        throw new AppError("Client not found", 404);
    }

    let billingItems = items;
    let calculatedTotals = { subTotal: 0, tax: 0, discount: 0, grandTotal: 0 };

    // Handle time-based billing
    if (billingType === "timeBased") {
        const timeTrackings = await DSRTimeTracking.find({
            case: caseId,
            status: "active",
            date: {
                $gte: date,
                $lte: dueDate
            }
        });

        billingItems = timeTrackings.map(track => ({
            particulars: track.title,
            quantity: track.hourCount,
            price: track.hourlyRate,
            discount: 0,
            vat: 0,
            amount: track.hourCount * track.hourlyRate
        }));
    }

    // Calculate totals
    calculatedTotals = billingItems.reduce((acc, item) => {
        const itemTotal = item.quantity * item.price;
        const itemDiscount = (itemTotal * item.discount) / 100;
        const itemVat = ((itemTotal - itemDiscount) * item.vat) / 100;

        return {
            subTotal: acc.subTotal + itemTotal,
            tax: acc.tax + itemVat,
            discount: acc.discount + itemDiscount,
            grandTotal: acc.grandTotal + (itemTotal - itemDiscount + itemVat)
        };
    }, calculatedTotals);

    const newBilling = await BillingHistory.create({
        case: caseId,
        client,
        billingType,
        currency,
        title,
        billNumber,
        note,
        date,
        dueDate,
        items: billingItems,
        ...calculatedTotals,
        createdBy: req.user._id,
    });

    res.status(201).json({
        message: "Billing created successfully",
        data: newBilling,
    });
});

/**
 * Get all billings with pagination and filtering
 */
exports.getAllBillings = catchAsync(async (req, res) => {
    const {
        search,
        status,
        client,
        case: caseId,
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
    } = req.query;

    const query = {
        ...(status && { status }),
        ...(client && { client }),
        ...(caseId && { case: caseId }),
        ...(search && {
            $or: [
                { billNumber: { $regex: search, $options: "i" } },
                { title: { $regex: search, $options: "i" } },
            ],
        }),
    };

    const aggregateQuery = BillingHistory.aggregate([
        { $match: query },
        {
            $lookup: {
                from: "cases",
                localField: "case",
                foreignField: "_id",
                as: "caseData",
            }
        },
        { $unwind: "$caseData" },
        {
            $lookup: {
                from: "clients",
                localField: "client",
                foreignField: "_id",
                as: "clientData",
            }
        },
        { $unwind: "$clientData" },
        {
            $lookup: {
                from: "payments",
                localField: "_id",
                foreignField: "billing",
                as: "payments"
            }
        },
        {
            $addFields: {
                totalPaid: { $sum: "$payments.amount" },
                dueAmount: {
                    $subtract: ["$grandTotal", { $sum: "$payments.amount" }]
                }
            }
        },
        {
            $project: {
                title: 1,
                billNumber: 1,
                date: 1,
                dueDate: 1,
                billingType: 1,
                currency: 1,
                status: 1,
                grandTotal: 1,
                totalPaid: 1,
                dueAmount: 1,
                "caseData.title": 1,
                "caseData.caseNumber": 1,
                "clientData.companyName": 1,
                "clientData.clientNumber": 1,
            }
        },
        { $sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 } }
    ]);

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
    };

    const result = await BillingHistory.aggregatePaginate(aggregateQuery, options);

    res.json({
        status: "success",
        data: result,
    });
});

/**
 * Get single billing details
 */
exports.getBilling = catchAsync(async (req, res) => {
    const billing = await BillingHistory.findById(req.params.id)
        .populate("case", "title caseNumber")
        .populate("client", "companyName clientNumber")
        .populate("createdBy", "firstName lastName")
        .lean();

    if (!billing) {
        throw new AppError("Billing not found", 404);
    }

    // Get payments for this billing
    const payments = await Payment.find({ billing: billing._id })
        .populate("receivedBy", "firstName lastName")
        .lean();

    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const dueAmount = billing.grandTotal - totalPaid;

    res.json({
        status: "success",
        data: {
            ...billing,
            payments,
            totalPaid,
            dueAmount
        },
    });
});

/**
 * Update billing details
 */
exports.updateBilling = catchAsync(async (req, res) => {
    const {
        title,
        billNumber,
        note,
        date,
        dueDate,
        items,
        status
    } = req.body;

    await SimpleValidator(req.body, {
        title: "string",
        date: "date",
        dueDate: "date",
        status: "in:active,inactive"
    });

    const billing = await BillingHistory.findById(req.params.id);
    if (!billing) {
        throw new AppError("Billing not found", 404);
    }

    // Don't allow updates if billing type is timeBased
    if (billing.billingType === "timeBased" && items) {
        throw new AppError("Cannot update items for time-based billing", 400);
    }

    let calculatedTotals = { subTotal: 0, tax: 0, discount: 0, grandTotal: 0 };

    if (items) {
        calculatedTotals = items.reduce((acc, item) => {
            const itemTotal = item.quantity * item.price;
            const itemDiscount = (itemTotal * item.discount) / 100;
            const itemVat = ((itemTotal - itemDiscount) * item.vat) / 100;

            return {
                subTotal: acc.subTotal + itemTotal,
                tax: acc.tax + itemVat,
                discount: acc.discount + itemDiscount,
                grandTotal: acc.grandTotal + (itemTotal - itemDiscount + itemVat)
            };
        }, calculatedTotals);
    }

    const updatedBilling = await BillingHistory.findByIdAndUpdate(
        req.params.id,
        {
            title,
            billNumber,
            note,
            date,
            dueDate,
            ...(items && { items }),
            ...calculatedTotals,
            status,
        },
        { new: true, runValidators: true }
    );

    res.json({
        message: "Billing updated successfully",
        data: updatedBilling,
    });
});

/**
 * Delete billing (soft delete)
 */
exports.deleteBilling = catchAsync(async (req, res) => {
    const billing = await BillingHistory.findByIdAndUpdate(
        req.params.id,
        {
            status: "inactive",
        },
        { new: true }
    );

    if (!billing) {
        throw new AppError("Billing not found", 404);
    }

    res.status(204).json({
        message: "Billing deleted successfully",
        data: null,
    });
});

/**
 * Get billing statistics
 */
exports.getBillingStats = catchAsync(async (req, res) => {
    const stats = await BillingHistory.aggregate([
        {
            $match: { status: "active" }
        },
        {
            $lookup: {
                from: "payments",
                localField: "_id",
                foreignField: "billing",
                as: "payments"
            }
        },
        {
            $group: {
                _id: null,
                totalBillings: { $sum: 1 },
                totalAmount: { $sum: "$grandTotal" },
                totalPaid: { $sum: { $sum: "$payments.amount" } },
                totalDue: {
                    $sum: {
                        $subtract: ["$grandTotal", { $sum: "$payments.amount" }]
                    }
                }
            }
        }
    ]);

    res.json({
        status: "success",
        data: stats[0] || {
            totalBillings: 0,
            totalAmount: 0,
            totalPaid: 0,
            totalDue: 0
        }
    });
});


exports.getData = catchAsync(async (req, res) => {
    let clients = await Client.find({ status: "active" }).select(
        "companyName emails photo phones addresses"
    );

    res.json({
        status: "success",
        data: {
            clients,
        },
    });
});