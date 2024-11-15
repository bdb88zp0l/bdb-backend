const mongoose = require("mongoose");
const { Schema } = mongoose;
var aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const schema = new Schema(
  {
    billing: {
      type: Schema.Types.ObjectId,
      ref: "BillingHistory",
      default: null,
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // Admin or user who created the event
      required: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    date: {
      type: Date,
      default: null,
    },
    paymentMethod: {
      type: String,
      default: null,
    },
    receipt: {
      type: String,
      default: null,
    },
    transactionId: {
      type: String,
      default: null,
    },

    note: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["collected", "pending"],
      default: "collected",
    },
  },
  { timestamps: true }
);
schema.plugin(aggregatePaginate);

module.exports = mongoose.model("Payment", schema);
