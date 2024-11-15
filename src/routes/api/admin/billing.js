/**
 * Defines the routes for the admin billing management functionality.
 * Includes CRUD operations for billings, as well as additional functionalities
 * such as updating billing status and adding team members.
 * Requires authentication and appropriate permissions for each operation.
 */

const BillingController = require("../../../controller/admin/billing/BillingController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const billingRouter = require("express").Router();
require("express-group-routes");

billingRouter.group("/billing", (route) => {
  route.use(Authenticated);
  // CRUD Operations
  route.post("/", HasPermission("billing.create"), BillingController.createBilling);
  route.get("/", HasPermission("billing.read"), BillingController.getAllBillings);
  route.get("/:id", HasPermission("billing.read"), BillingController.getBilling);
  route.patch("/:id", HasPermission("billing.update"), BillingController.updateBilling);
  route.delete("/:id", HasPermission("billing.delete"), BillingController.deleteBilling);

  // Additional Functionalities
  route.patch(
    "/:id/status",
    HasPermission("billing.read"),
    BillingController.getBillingStats
  );
  // Get data for billing page
  route.get("/data/get", BillingController.getData);
});

module.exports = billingRouter;
