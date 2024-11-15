/**
 * Defines the schema for a Contact document in the MongoDB database.
 * A Contact represents a person's contact information, including their name, photo, contact details, and the workspace they belong to.
 * The schema includes the following fields:
 * - firstName (required): The contact's first name.
 * - middleName (required): The contact's middle name.
 * - lastName (required): The contact's last name.
 * - nickName (required): The contact's nickname.
 * - photo (optional): The URL of the contact's profile photo.
 * - email (optional): The contact's email address.
 * - phone (optional): The contact's phone number.
 * - mobile (optional): The contact's mobile phone number.
 * - address (optional): The contact's address.
 * - workspace (required): The ObjectId of the Workspace the contact belongs to.
 * - status (default: 'active'): The status of the contact, either 'active' or 'deleted'.
 * The schema also includes timestamps for when the contact was created and last updated.
 */

const mongoose = require("mongoose");
var aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const contactSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    middleName: { type: String, default: null },
    lastName: { type: String, default: null },
    nickName: { type: String, default: null },
    photo: { type: String, default: null },
    emails: { type: Array, default: [] },
    title: { type: String, default: null },
    suffix: { type: String, default: null },
    prefix: { type: String, default: null },
    dateOfBirth: { type: Date, default: null },
    companyGroups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CompanyGroup", // Assuming companyGroup is another model
        default: null,
      },
    ],
    companies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Client", // Assuming Client is another model
        default: null,
      },
    ],
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    metaData: {
      type: mongoose.Schema.Types.Mixed, //Basically used to save legacy informations
      default: {},
    },

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

    status: { type: String, enum: ["active", "deleted"], default: "active" },
  },
  { timestamps: true }
);
contactSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("Contact", contactSchema);
