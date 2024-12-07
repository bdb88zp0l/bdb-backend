/**
 * Defines the schema for a Case document in the MongoDB database.
 * The Case model represents a case or matter that is managed by the application.
 * It includes fields for case number, title, description, status, client, supervising partner,
 * start and end dates, associated documents, billing information, and a history of status changes.
 * The schema also includes an array of team members associated with the case, each with their own
 * designation and rate.
 */
const mongoose = require("mongoose");
const { Schema } = mongoose;
var aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const caseSchema = new Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    paperMergeNodeId: {
      type: String, // ID from Papermerge to reference the document
      default: null,
    },
    caseNumber: {
      type: String,
      required: true,
      unique: true,
      default: null,
    },
    title: {
      type: String,
      required: true,
      default: null,
    },
    description: {
      type: String,
      default: null,
    },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },
    status: {
      type: String,
      // enum: ["active", "deleted", "inactive"],
      default: "active",
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client", // Assuming Client is another model
      required: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    defaultBillingType: {
      type: String,
      default: null,
    },
    serviceType: {
      type: String,
      default: null,
    },
    caseStatus: {
      type: String,
      default: null,
    },
    contractPrice: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "PHP",
    },
    convertRetainerFeeToPHP: {
      type: Boolean,
      default: false,
    },
    vatSetting: {
      type: Object,
      default: {},
    },
    billingStart: {
      type: Date,
      default: null,
    },
    billingEnd: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    natureOfWork: {
      type: String,
      default: null,
    },
    fixedFee: {
      type: Number,
      default: 0,
    },
    acceptanceFee: {
      type: Number,
      default: 0,
    },
    successFee: {
      type: Number,
      default: 0,
    },
    capFee: {
      type: Number,
      default: 0,
    },
    fixedOpe: {
      type: Number,
      default: 0,
    },
    nonFixedOpe: {
      type: Number,
      default: 0,
    },
    team: {
      type: Schema.Types.ObjectId,
      ref: "Team", // Single team related to the case
      default: null,
    },
    members: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User", // Referencing the User model
          required: true,
        },
        rate: {
          type: Number,
          default: 0,
        },
      },
    ],
    metaData: {
      type: mongoose.Schema.Types.Mixed, //Basically used to save legacy informations
      default: {},
    },
    statusHistory: [
      {
        status: {
          type: String,
          default: "Created",
        },
        description: {
          type: String,
          default: null,
        },
        files: [
          {
            type: Object,
            default: {},
          },
        ],
        date: {
          type: Date,
          default: Date.now,
        },
        updatedBy: {
          type: Schema.Types.ObjectId,
          ref: "User", // Assuming User is another model
        },
      },
    ],
  },
  { timestamps: true }
);
caseSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("Case", caseSchema);
