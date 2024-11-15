const mongoose = require("mongoose");
var aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, unique: true, required: true },
    description: { type: String, default: null },
    logo: { type: String, default: null },
    icon: { type: String, default: null },
    paperMergeNodeId: {
      type: String, // ID from Papermerge to reference the document
      default: null,
    },
    status: { type: String, enum: ["active", "deleted"], default: "active" },
  },
  { timestamps: true }
);

workspaceSchema.plugin(aggregatePaginate);
module.exports = mongoose.model("Workspace", workspaceSchema);
