/* This code snippet is defining a Mongoose schema for a "Client" model in a Node.js application.
Here's a breakdown of what each part of the code is doing: */
const mongoose = require("mongoose");
const { Schema } = mongoose;

var aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const clientSchema = new Schema(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace", // Assuming Workspace is another model
      default: null,
    },
    companyGroup: {
      type: Schema.Types.ObjectId,
      ref: "CompanyGroup", // Assuming companyGroup is another model
      default: null,
    },
    code: {
      type: String,
      default: null,
    },
    clientNumber: {
      type: String,
      default: null,
    },
    companyName: {
      type: String,
      default: null,
    },
    accountType: {
      type: String,
      default: null,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    supervisingPartner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    industry: {
      type: String,
      default: null,
    },
    tin: {
      type: String,
      default: null,
    },
    businessStyle: {
      type: String,
      default: null,
    },
    logo: {
      type: String,
      default: null,
    },
    emails: { type: Array, default: [] },

    addresses: [
      {
        label: {
          type: String,
          default: null,
        },
        houseNumber: {
          type: String,
          default: null,
        },
        street: {
          type: String,
          default: null,
        },
        barangay: {
          type: String,
          default: null,
        },
        city: {
          type: String,
          default: null,
        },
        zip: {
          type: String,
          default: null,
        },
        region: {
          type: String,
          default: null,
        },
        country: {
          type: String,
          default: null,
        },
      },
    ],
    phones: [
      {
        label: {
          type: String,
          default: null,
        },
        dialCode: {
          type: String,
          default: null,
        },
        phoneNumber: {
          type: String,
          default: null,
        },
      },
    ],

    contact: {
      type: Schema.Types.ObjectId,
      ref: "Contact",
      default: null,
    },
    status: {
      type: String,
      enum: ["inDraft", "active", "inactive", "withdrawn", "deleted"],
      default: "inDraft",
    },
    engagedAt: {
      type: Date,
      default: null,
    },
    withdrawnAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

clientSchema.plugin(aggregatePaginate);
module.exports = mongoose.model("Client", clientSchema);
