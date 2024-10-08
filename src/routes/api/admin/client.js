const multerMiddleware = require("../../../config/multer");
const ClientController = require("../../../controller/admin/client/ClientController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const clientRouter = require("express").Router();
require("express-group-routes");

clientRouter.group("/clients", (client) => {
  client.use(Authenticated);
  // Get all clients
  client.get("/", HasPermission("client.read"), ClientController.getAllClients);

  // Get a specific client by ID
  client.get("/:id", HasPermission("client.read"), ClientController.getClient);

  // Update a specific client by ID
  client.patch(
    "/:id",
    HasPermission("client.update"),
    multerMiddleware.single("photo"),
    ClientController.updateClient
  );

  // Delete a specific client by ID
  client.delete(
    "/:id",
    HasPermission("client.delete"),
    ClientController.deleteClient
  );
  // Get data for client page
  client.get("/data/get", ClientController.getData);
});

module.exports = clientRouter;
