const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, unique: true, required: true },
    permissions: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Permission", default: [] },
    ],
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Role", roleSchema);
