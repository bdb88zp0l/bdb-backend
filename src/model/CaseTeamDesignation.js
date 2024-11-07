const mongoose = require("mongoose");
const { Schema } = mongoose;

const caseTeamDesignationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "deleted"],
      default: "active",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

module.exports = mongoose.model(
  "CaseTeamDesignation",
  caseTeamDesignationSchema
);
