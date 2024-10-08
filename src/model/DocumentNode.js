const mongoose = require("mongoose");
const { Schema } = mongoose;

const documentSchema = new Schema(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },
    case: {
      type: Schema.Types.ObjectId,
      ref: "Case",
      default: null,
    },
    nodeType: {
      type: String,
      enum: ["folder", "document"],
      default: "folder",
    },
    visibility: {
      type: String,
      enum: ["private", "public", "protected"],
      default: "public",
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
    whitelistedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User", // Reference the User model
        default: null,
      },
    ],
    paperMergeParentNodeId: {
      type: String, // ID from Papermerge to reference the document
      default: null,
    },
    paperMergeNodeId: {
      type: String, // ID from Papermerge to reference the document
      default: null,
    },
    title: {
      type: String,
      required: true,
    },
    path: {
      type: Array, // File path in Papermerge system
      default: null,
    },
    size: {
      type: Number, // File size in bytes
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // Assuming User is another model
      default: null,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // Assuming User is another model
      default: null,
    },
    lastAccessedBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // Assuming User is another model
      default: null,
    },
    lastAccessed: {
      type: Date, // Track when the file was last accessed
      default: Date.now,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    downloadURL: {
      type: String,
      default: null,
    },
    metaData: {
      type: Schema.Types.Mixed, //Basically used to save papermerge response
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "deleted"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DocumentNode", documentSchema);
