/**
 * Defines the routes for managing case team designations.
 *
 * This router handles the following routes:
 * - GET /case-team-designations: Retrieves all case team designations.
 * - POST /case-team-designations: Bulk creates or updates case team designations.
 * - DELETE /case-team-designations: Bulk soft deletes case team designations.
 *
 * The routes are protected by authentication and authorization middleware.
 */
const CaseTeamDesignationController = require("../../../controller/admin/case/CaseTeamDesignationController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const caseTeamDesignationRouter = require("express").Router();
require("express-group-routes");

caseTeamDesignationRouter.group(
  "/case-team-designations",
  (caseTeamDesignation) => {
    caseTeamDesignation.use(Authenticated);

    caseTeamDesignation.get(
      "/",
      // HasPermission("caseTeamDesignation.read"),
      CaseTeamDesignationController.getAllCaseTeamDesignations
    );

    // Bulk create or update designations
    caseTeamDesignation.post(
      "/",
      // HasPermission("caseTeamDesignation.create"),
      CaseTeamDesignationController.bulkCreateOrUpdateDesignations
    );

    // Bulk soft delete designations
    caseTeamDesignation.delete(
      "/",
      // HasPermission("caseTeamDesignation.delete"),
      CaseTeamDesignationController.bulkDeleteDesignations
    );
  }
);

module.exports = caseTeamDesignationRouter;
