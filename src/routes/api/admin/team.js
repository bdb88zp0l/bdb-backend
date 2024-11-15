const TeamController = require("../../../controller/admin/user/TeamController");
const Authenticated = require("../../../middleware/Authenticated");
const HasPermission = require("../../../middleware/HasPermission");

const teamRouter = require("express").Router();
require("express-group-routes");

teamRouter.group("/team", (team) => {
  team.use(Authenticated);

  // Create a new team
  team.post("/", HasPermission("team.create"), TeamController.createTeam);

  // Get all teams (with pagination)
  team.get("/", HasPermission("team.read"), TeamController.getAllTeams);

  // Get a specific team
  team.get("/:id", HasPermission("team.read"), TeamController.getTeam);

  // Update a team
  team.patch("/:id", HasPermission("team.update"), TeamController.updateTeam);

  // Soft delete (archive) a team
  team.delete("/:id", HasPermission("team.delete"), TeamController.deleteTeam);

  //update multiple users in teams
  team.patch(
    "/:id/bulkUpdate",
    HasPermission("team.update"),
    TeamController.bulkUpdateTeams
  );

  // Add a user to a team
  team.post(
    "/:id/addUser",
    HasPermission("team.update"),
    TeamController.addUserToTeam
  );

  // Remove a user from a team
  team.delete(
    "/:id/removeUser/:userId",
    HasPermission("team.update"),
    TeamController.removeUserFromTeam
  );
  // Get data for client page
  team.get("/data/get", TeamController.getData);
});

module.exports = teamRouter;
