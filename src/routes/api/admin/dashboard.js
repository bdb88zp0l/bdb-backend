const multerMiddleware = require("../../../config/multer");
const { getDashboard } = require("../../../controller/admin/dashboard/DashboardController");
const Authenticated = require("../../../middleware/Authenticated");

const dashboardRouter = require("express").Router();
require("express-group-routes");

dashboardRouter.group("/dashboard", (dashboard) => {
  dashboard.use(Authenticated);

  // Create a new user
  dashboard.get(
    "/",
    getDashboard
  );
});

module.exports = dashboardRouter;
