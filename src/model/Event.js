const mongoose = require("mongoose");
const { Schema } = mongoose;
var aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const eventSchema = new Schema(
  {
    calendar: {
      type: Schema.Types.ObjectId,
      ref: "Calendar", // Reference to the calendar
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: null,
    },
    location: {
      type: String,
      default: null,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    allDay: {
      type: Boolean,
      default: false, // Option for all-day events
    },
    reminder: [
      {
        time: {
          type: Date, // Reminder time before the event starts
          required: true,
        },
        notified: {
          type: Boolean, // Status of notification
          default: false,
        },
      },
    ],
    
    status: {
      type: String,
      enum: ["active", "cancelled", "tentative"],
      default: "active",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // Admin or user who created the event
      required: true,
    },
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // User who last updated the event
      default: null,
    },
  },
  { timestamps: true }
);
eventSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("Event", eventSchema);
