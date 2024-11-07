const express = require("express");
const PaymentController = require("../../../controller/admin/billing/PaymentController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const paymentRouter = express.Router();


paymentRouter.group("/payments", (route) => {
  route.use(Authenticated);


  // Route to create a new payment
  route.post(
    "/",
    HasPermission("payment.create"),
    PaymentController.createPayment
  );

  // Route to get all payments for a specific billing
  route.get(
    "/billing/:billingId",
    HasPermission("payment.read"),
    PaymentController.getPaymentsForBilling
  );

  // Route to update a payment
  route.patch(
    "/:paymentId",
    HasPermission("payment.update"),
    PaymentController.updatePayment
  );

  // Route to delete a payment
  route.delete(
    "/:paymentId",
    HasPermission("payment.delete"),
    PaymentController.deletePayment
  );
});


module.exports = paymentRouter;
