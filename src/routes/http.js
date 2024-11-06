const AppError = require("../exception/AppError");
const catchAsync = require("../exception/catchAsync");
const authRouter = require("./api/admin/auth");
const caseStatusRouter = require("./api/admin/case-status");
const configRouter = require("./api/admin/config");
const contactRouter = require("./api/admin/contact");
const permissionRouter = require("./api/admin/permission");
const profileRouter = require("./api/admin/profile");
const roleRouter = require("./api/admin/role");
const securityRouter = require("./api/admin/security");
const userRouter = require("./api/admin/user");
const workspaceRouter = require("./api/admin/workspace");
const fileRouter = require("./api/admin/file");
const clientRouter = require("./api/admin/client");
const companyGroupRouter = require("./api/admin/company-group");
const caseTeamDesignationRouter = require("./api/admin/case-team-designation");
const caseRouter = require("./api/admin/case");
const { setConfigValue } = require("../utils/VariableManager");
const temporaryRouter = require("./api/admin/temporary");
const teamRouter = require("./api/admin/team");
const eventRouter = require("./api/admin/event");
const calendarRouter = require("./api/admin/calendar");
const notificationRouter = require("./api/admin/notification");
const dumpRouter = require("./api/admin/dump");
const dashboardRouter = require("./api/admin/dashboard");
const dsrRouter = require("./api/admin/dsr");

const router = require("express").Router();
require("express-group-routes");
router.group("/api", (api) => {
  api.use(configRouter);
  api.use(authRouter);
  api.use(dashboardRouter);
  api.use(profileRouter);
  api.use(securityRouter);
  api.use(permissionRouter);
  api.use(roleRouter);
  api.use(teamRouter);
  api.use(userRouter);
  api.use(workspaceRouter);
  api.use(companyGroupRouter);
  api.use(caseStatusRouter);
  api.use(caseTeamDesignationRouter);
  api.use(caseRouter);
  api.use(contactRouter);
  api.use(fileRouter);
  api.use(clientRouter);
  api.use(eventRouter);
  api.use(calendarRouter);
  api.use(notificationRouter);

  api.use("/hrm",dsrRouter)
  api.use(temporaryRouter);
  api.use(dumpRouter);
  api.get(
    "/",
    catchAsync(async (req, res) => {
      res.json({
        status: "Api server is running",
      });
    })
  );
});

module.exports = router;
