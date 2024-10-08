/**
 * Mongoose schema for a case status.
 * 
 * A case status has the following properties:
 * - `title`: The title of the case status (required and unique)
 * - `status`: The status of the case, which can be either "active" or "inactive" (default is "active")
 * 
 * The schema also includes timestamps for when the case status was created and last updated.
 */
const mongoose = require("mongoose");

const caseStatusSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CaseStatus", caseStatusSchema);
