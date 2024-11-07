var cron = require("node-cron");
const { setConfigValue, getConfigValue } = require("../utils/VariableManager");
const { paperMergeRequest } = require("../config/axios.config");
const catchAsync = require("../exception/catchAsync");
module.exports = cron.schedule(
  "59 * * * * *",
  catchAsync(async () => {
    console.log(
      ` Generate papermerge token cron running at ${new Date().toUTCString()}`
    );

    paperMergeRequest
      .post("/api/token", {
        username: process.env.PAPERMERGE_USERNAME,
        password: process.env.PAPERMERGE_PASSWORD,
      })
      .then((response) => {
        console.log("response", response.data);
        setConfigValue("PAPERMERGE_API_KEY", response.data?.access_token);
      });
  })
);
