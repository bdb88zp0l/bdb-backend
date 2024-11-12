const mongoose = require("mongoose");
const { Schema } = mongoose;
var aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const schema = new Schema(
  {
    case: {
      type: Schema.Types.ObjectId,
      ref: "Case",
      default: null,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User", // Admin or user who created the event
      default: null,
    },
    criteria: {
      type: String,
      enum: ["case"],
      default: "case",
    },
    task: {
      type: String,
      required: true,
    },
    // description: {
    //   type: String,
    //   default: null,
    // },
    date: {
      type: Date,
      default: null,
    },
    hourCount: {
      type: Number,
      default: 0,
    },
    hourlyRate: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);
schema.plugin(aggregatePaginate);

module.exports = mongoose.model("DSRTimeTracking", schema);
