/**
 * Defines the routes for the admin case management functionality.
 * Includes CRUD operations for cases, as well as additional functionalities
 * such as updating case status and adding team members.
 * Requires authentication and appropriate permissions for each operation.
 */

const multerMiddleware = require("../../../config/multer");
const CaseController = require("../../../controller/admin/case/CaseController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const caseRouter = require("express").Router();
require("express-group-routes");

caseRouter.group("/cases", (route) => {
  route.use(Authenticated);
  // CRUD Operations
  route.post("/", HasPermission("case.create"), CaseController.createCase);
  route.get("/", HasPermission("case.read"), CaseController.getAllCases);
  route.get("/:id", HasPermission("case.read"), CaseController.getCase);
  route.patch("/:id", HasPermission("case.update"), CaseController.updateCase);
  route.delete("/:id", HasPermission("case.delete"), CaseController.deleteCase);

  // Additional Functionalities
  route.patch(
    "/:id/status",
    HasPermission("case.update"),

    multerMiddleware.array("files"),
    CaseController.updateCaseStatus
  );
  route.post("/:id/members",  CaseController.addMember);
  // Get data for case page
  route.get("/data/get", CaseController.getData);
});

module.exports = caseRouter;
