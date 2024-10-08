/**
 * Defines the routes for managing case statuses in the admin API.
 * 
 * The following routes are available:
 * 
 * - POST /case-statuses - Create a new case status (requires "caseStatus.create" permission)
 * - GET /case-statuses - Get all case statuses with optional filters and pagination (requires "caseStatus.read" permission)
 * - GET /case-statuses/:id - Get a specific case status by ID (requires "caseStatus.read" permission)
 * - PATCH /case-statuses/:id - Update a specific case status by ID (requires "caseStatus.update" permission)
 * - DELETE /case-statuses/:id - Soft delete a specific case status by ID (requires "caseStatus.delete" permission)
 * 
 * All routes are protected by authentication and authorization middleware.
 */
const CaseStatusController = require("../../../controller/admin/case/CaseStatusController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const caseStatusRouter = require("express").Router();
require("express-group-routes");

caseStatusRouter.group("/case-statuses", (caseStatus) => {
  caseStatus.use(Authenticated);

  // Create a new case status
  caseStatus.post(
    "/",
    HasPermission("caseStatus.create"),
    CaseStatusController.createCaseStatus
  );

  // Get all case statuses (with filters and pagination)
  caseStatus.get(
    "/",
    HasPermission("caseStatus.read"),
    CaseStatusController.getAllCaseStatuses
  );

  // Get a specific case status by ID
  caseStatus.get(
    "/:id",
    HasPermission("caseStatus.read"),
    CaseStatusController.getCaseStatus
  );

  // Update a specific case status by ID
  caseStatus.patch(
    "/:id",
    HasPermission("caseStatus.update"),
    CaseStatusController.updateCaseStatus
  );

  // Soft delete a specific case status by ID
  caseStatus.delete(
    "/:id",
    HasPermission("caseStatus.delete"),
    CaseStatusController.deleteCaseStatus
  );
});

module.exports = caseStatusRouter;
