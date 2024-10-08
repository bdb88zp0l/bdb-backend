const RoleController = require("../../../controller/admin/user/RoleController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const roleRouter = require("express").Router();
require("express-group-routes");

roleRouter.group("/roles", (role) => {
  role.use(Authenticated);

  // Create a new role
  role.post("/", HasPermission("role.create"), RoleController.createRole);

  // Get all roles (excluding soft-deleted ones)
  role.get("/", HasPermission("role.read"), RoleController.getAllRoles);

  // Get a specific role by ID
  role.get("/:id", HasPermission("role.read"), RoleController.getRole);

  // Update a specific role by ID
  role.patch(
    "/:id",
    HasPermission("role.update"),
    RoleController.updateRole
  );

  // Soft delete a specific role by ID
  role.delete(
    "/:id",
    HasPermission("role.delete"),
    RoleController.deleteRole
  );
});

module.exports = roleRouter;
