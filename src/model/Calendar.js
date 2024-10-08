const mongoose = require("mongoose");
const { Schema } = mongoose;
var aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const calendarSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: null,
    },
    visibility: {
      type: String,
      enum: ["public", "private", "protected"],
      default: "private",
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User", // Owner of the calendar
      required: true,
    },
    sharedWith: [
      {
        type: Schema.Types.ObjectId,
        ref: "User", // Users the protected calendar is shared with
        default: null,
      },
    ],
    sharedWithTeams: [
      {
        type: Schema.Types.ObjectId,
        ref: "Team", // Teams the protected calendar is shared with
        default: null,
      },
    ],
    status: {
      type: String,
      enum: ["active", "deleted"],
      default: "active",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    backgroundColor: {
      type: String,
      default: null,
    },
    foregroundColor: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

calendarSchema.plugin(aggregatePaginate);
module.exports = mongoose.model("Calendar", calendarSchema);
