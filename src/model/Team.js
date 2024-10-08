const mongoose = require("mongoose");
const { Schema } = mongoose;
var aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const teamSchema = new Schema(
  {
    title: {
      type: String,
      required: true, // Team name
    },
    description: {
      type: String,
      default: null,
    },
    users: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User", // Referencing the User model
          required: true,
        },
        designation: {
          type: Schema.Types.ObjectId,
          ref: "CaseTeamDesignation",
        },
        rate: {
          type: Number,
          default: 0,
        },
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // The user who created the team
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "deleted"],
      default: "active",
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
  }
);
teamSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("Team", teamSchema);
