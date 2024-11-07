const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const Payment = require("../../../model/Payment");
const BillingHistory = require("../../../model/BillingHistory");
const SimpleValidator = require("../../../validator/simpleValidator");

/**
 * Create a new payment for a billing
 */
exports.createPayment = catchAsync(async (req, res) => {
  const { billingId, amount, date, note } = req.body;

  await SimpleValidator(req.body, {
    billingId: "required|mongoid",
    amount: "required|number|min:0.01",
    date: "required|date",
  });

  const billing = await BillingHistory.findById(billingId);
  if (!billing) {
    throw new AppError("Billing not found", 404);
  }

  const newPayment = await Payment.create({
    billing: billingId,
    amount,
    date,
    note,
    receivedBy: req.user._id,
  });

  res.status(201).json({
    message: "Payment created successfully",
    data: newPayment,
  });
});

/**
 * Get all payments for a specific billing
 */
exports.getPaymentsForBilling = catchAsync(async (req, res) => {
  const { billingId } = req.params;

  const payments = await Payment.find({ billing: billingId })
    .populate("receivedBy", "firstName lastName")
    .lean();

  if (!payments) {
    throw new AppError("No payments found for this billing", 404);
  }

  res.json({
    status: "success",
    data: payments,
  });
});

/**
 * Update a payment
 */
exports.updatePayment = catchAsync(async (req, res) => {
  const { paymentId } = req.params;
  const { amount, date, note } = req.body;

  await SimpleValidator(req.body, {
    amount: "number|min:0.01",
    date: "date",
  });

  const updatedPayment = await Payment.findByIdAndUpdate(
    paymentId,
    { amount, date, note },
    { new: true, runValidators: true }
  );

  if (!updatedPayment) {
    throw new AppError("Payment not found", 404);
  }

  res.json({
    message: "Payment updated successfully",
    data: updatedPayment,
  });
});

/**
 * Delete a payment
 */
exports.deletePayment = catchAsync(async (req, res) => {
  const { paymentId } = req.params;

  const deletedPayment = await Payment.findByIdAndDelete(paymentId);

  if (!deletedPayment) {
    throw new AppError("Payment not found", 404);
  }

  res.status(204).json({
    message: "Payment deleted successfully",
    data: null,
  });
});
