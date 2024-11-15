/**
 * Defines the routes for managing client categories in the admin API.
 *
 * The following routes are defined:
 *
 * - `POST /company-group`: Creates a new client category.
 * - `GET /company-group`: Retrieves all client categories with optional filtering and pagination.
 * - `GET /company-group/:id`: Retrieves a specific client category by ID.
 * - `PATCH /company-group/:id`: Updates a specific client category by ID.
 * - `DELETE /company-group/:id`: Soft deletes a specific client category by ID.
 *
 * All routes are protected by authentication and authorization middleware.
 */
const CompanyGroupController = require("../../../controller/admin/client/CompanyGroupController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const companyGroupRouter = require("express").Router();
require("express-group-routes");

companyGroupRouter.group("/company-group", (companyGroup) => {
  companyGroup.use(Authenticated);

  // Create a new client category
  companyGroup.post(
    "/",
    HasPermission("companyGroup.create"),
    CompanyGroupController.createCompanyGroup
  );

  // Get all client categories (with filters and pagination)
  companyGroup.get(
    "/",
    HasPermission("companyGroup.read"),
    CompanyGroupController.getAllClientCategories
  );

  // Get a specific client category by ID
  companyGroup.get(
    "/:id",
    HasPermission("companyGroup.read"),
    CompanyGroupController.getCompanyGroup
  );

  // Update a specific client category by ID
  companyGroup.patch(
    "/:id",
    HasPermission("companyGroup.update"),
    CompanyGroupController.updateCompanyGroup
  );

  // Soft delete a specific client category by ID
  companyGroup.delete(
    "/:id",
    HasPermission("companyGroup.delete"),
    CompanyGroupController.deleteCompanyGroup
  );
});

module.exports = companyGroupRouter;
