const express = require("express");
const DsrController = require("../../../controller/admin/hrm/DsrController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const dsrRouter = express.Router();
require("express-group-routes");

dsrRouter.group("/dsr", (dsr) => {
  dsr.use(Authenticated);

  // Create a new dsr
  dsr.post("/", HasPermission("dsr.create"), DsrController.createDSRTimeTracking);

  // Get all dsr accessible to the user
  dsr.get("/", HasPermission("dsr.read"), DsrController.getAllDSRTimeTrackings);
  // Get all dsr for specific case accessible to the user
  dsr.get("/getDsrRecordsByCase/:caseId", HasPermission("dsr.read"), DsrController.getDsrRecordsByCase);

  // Get a specific dsr by ID
  dsr.get("/:id", HasPermission("dsr.read"), DsrController.getDSRTimeTracking);

  // Update a specific dsr by ID
  dsr.patch(
    "/:id",
    HasPermission("dsr.update"),
    DsrController.updateDSRTimeTracking
  );

  // Delete a specific dsr by ID (soft delete)
  dsr.delete(
    "/:id",
    HasPermission("dsr.delete"),
    DsrController.deleteDSRTimeTracking
  );
  // Delete a specific dsr by ID (soft delete)
  dsr.get(
    "/data/get",
    HasPermission("dsr.read"),
    DsrController.getData
  );
});

module.exports = dsrRouter;
