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
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client", // Admin or user who created the event
      default: null,
    },
    billingType: {
      type: String,
      enum: ["oneTime", "progressBased", "timeBased", "taskBased"],
      default: "oneTime",
    },
    currency: {
      type: String,
      default: "PH",
    },
    // title: {
    //   type: String,
    //   required: true,
    // },
    billNumber: {
      type: String,
      default: null,
    },
    note: {
      type: String,
      default: null,
    },
    billingStart: {
      type: Date,
      default: null,
    },
    billingEnd: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    items: [
      {
        particulars: {
          type: String,
          default: null,
        },

        quantity: {
          type: Number,
          default: 0,
        },

        price: {
          type: Number,
          default: 0,
        },

        discount: {
          type: Number,
          default: 0,
        },

        vat: {
          type: Object,
          default: {},
        },

        amount: {
          type: Number,
          default: 0,
        },
      },
    ],
    subTotal: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // Admin or user who created the event
      required: true,
    },

    status: {
      type: String,
      enum: ["unpaid", "paid", "partiallyPaid", "overdue", "overPaid"],
      default: "unpaid",
    },
  },
  { timestamps: true }
);
schema.plugin(aggregatePaginate);

module.exports = mongoose.model("BillingHistory", schema);
