const PermissionController = require("../../../controller/admin/user/PermissionController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const permissionRouter = require("express").Router();
require("express-group-routes");
permissionRouter.group("/permission", (permission) => {
  permission.use(Authenticated);
  // Create a new permission
  permission.get(
    "/setup",
    HasPermission("permission.setup"),
    PermissionController.setup
  );
  permission.post(
    "/setup",
    HasPermission("permission.setup"),
    PermissionController.setupSubmit
  );
});

module.exports = permissionRouter;
