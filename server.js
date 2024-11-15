require("dotenv").config();
const process = require("process");
const app = require("./app");
const logger = require("./src/config/logger");
const port = process.env.PORT || 6000;


app.listen(port, "0.0.0.0", () => {
  logger.info(`Server is on 🔥 on port ${port}`)
});
