const mongoose = require("mongoose");

require("dotenv").config();
const mongoURL = process.env.MONGODB_URL;

const RoleAndAdminSeeder = require("./seeders/roleAndAdmin.seeder");
const PermissionSeeder = require("./seeders/permission.seeder");

/**
 * Seeders List
 * order is important
 * @type {Object}
 */
exports.seedersList = {
  RoleAndAdminSeeder,
  PermissionSeeder,
};
/**
 * Connect to mongodb implementation
 * @return {Promise}
 */
exports.connect = async () => {
  await mongoose.connect(mongoURL, {});
};
/**
 * Drop/Clear the database implementation
 * @return {Promise}
 */
exports.dropdb = async () => mongoose.connection.db.dropDatabase();
