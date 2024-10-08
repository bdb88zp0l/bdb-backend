/**
 * Mongoose schema for a client category.
 *
 * A client category has the following properties:
 * - `name`: The name of the client category, required and unique.
 * - `description`: An optional description of the client category.
 * - `status`: The status of the client category, either "active" or "deleted". Defaults to "active".
 *
 * The schema also includes timestamps for when the client category was created and last updated.
 */
const mongoose = require("mongoose");

const companyGroupSchema = new mongoose.Schema(
  {
    name: { type: String, default: null },
    description: { type: String, default: null },
    status: { type: String, enum: ["active", "deleted"], default: "active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CompanyGroup", companyGroupSchema);
