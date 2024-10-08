const AppError = require("../exception/AppError");
const catchAsync = require("../exception/catchAsync");
const Role = require("../model/Role");

module.exports = (permissionName) => {
  return catchAsync(async (req, res, next) => {
    const user = req.user;

    // Allow access if user is superAdmin
    if (user.roleType === "superAdmin") {
      return next();
    }
    // Populate user's role and permissions
    const role = await Role.findOne({
      _id: user.role,
      deleted: false,
    }).populate({
      path: "permissions",
    });

    if (!role) {
      throw new AppError("User role not found or has been deleted", 403);
    }

    // Check if the user's role has the required permission
    const hasPermission = role.permissions.some(
      (permission) => permission.name === permissionName
    );

    if (!hasPermission) {
      throw new AppError(
        "You do not have permission to perform this action",
        403
      );
    }

    next();
  });
};
