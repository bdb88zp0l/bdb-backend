/**
 * Defines the routes for the admin contacts API.
 *
 * This router handles the following routes:
 * - POST /contacts - Creates a new contact
 * - GET /contacts - Retrieves all contacts with optional filters and pagination
 * - GET /contacts/:id - Retrieves a specific contact by ID
 * - PATCH /contacts/:id - Updates a specific contact by ID
 * - DELETE /contacts/:id - Soft deletes a specific contact by ID
 *
 * The routes are protected by authentication and permission checks.
 */
const multerMiddleware = require("../../../config/multer");
const ContactController = require("../../../controller/admin/contact/ContactController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const contactRouter = require("express").Router();
require("express-group-routes");

contactRouter.group("/contacts", (contact) => {
  contact.use(Authenticated);

  // Create a new contact
  contact.post(
    "/",
    HasPermission("contact.create"),
    multerMiddleware.single("photo"),
    ContactController.createContact
  );

  // Get all contacts (with filters and pagination)
  contact.get(
    "/",
    HasPermission("contact.read"),
    ContactController.getAllContacts
  );

  // Get a specific contact by ID
  contact.get(
    "/:id",
    HasPermission("contact.read"),
    ContactController.getContact
  );

  // Update a specific contact by ID
  contact.patch(
    "/:id",
    HasPermission("contact.update"),
    multerMiddleware.single("photo"),
    ContactController.updateContact
  );

  // Soft delete a specific contact by ID
  contact.delete(
    "/:id",
    HasPermission("contact.delete"),
    ContactController.deleteContact
  );
  // Get data for client page
  contact.get("/data/get", ContactController.getData);
});

module.exports = contactRouter;
