const multerMiddleware = require("../../../config/multer");
const WorkspaceController = require("../../../controller/admin/workspace/WorkspaceController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const workspaceRouter = require("express").Router();
require("express-group-routes");

workspaceRouter.group("/workspaces", (workspace) => {
  workspace.use(Authenticated);

  // Create a new workspace
  workspace.post(
    "/",
    HasPermission("workspace.create"),
    multerMiddleware.single("logo"),
    WorkspaceController.createWorkspace
  );

  // Get all workspaces (with filters and pagination)
  workspace.get(
    "/",
    HasPermission("workspace.read"),
    WorkspaceController.getAllWorkspaces
  );

  // Get a specific workspace by ID
  workspace.get(
    "/:id",
    HasPermission("workspace.read"),
    WorkspaceController.getWorkspace
  );

  // Update a specific workspace by ID
  workspace.patch(
    "/:id",
    HasPermission("workspace.update"),
    multerMiddleware.single("logo"),
    WorkspaceController.updateWorkspace
  );

  // Soft delete a specific workspace by ID
  workspace.delete(
    "/:id",
    HasPermission("workspace.delete"),
    WorkspaceController.deleteWorkspace
  );
});

module.exports = workspaceRouter;
