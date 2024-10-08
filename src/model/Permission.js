const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    title: { type: String, default: null },
    name: { type: String, unique: true, required: true },
    description: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Permission", permissionSchema);
