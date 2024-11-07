/**
 * @fileoverview Contact Controller
 * 
 * This module provides controller functions for managing contacts and their associated companies.
 * It handles CRUD operations for contacts, including creation, retrieval, updating, and deletion.
 * The controller also manages the relationship between contacts and companies.
 * 
 * @module ContactController
 * @requires mongoose
 * @requires ../../../config/file
 * @requires ../../../exception/AppError
 * @requires ../../../exception/catchAsync
 * @requires ../../../model/Client
 * @requires ../../../model/CompanyGroup
 * @requires ../../../model/Contact
 * @requires ../../../model/User
 * @requires ../../../validator/simpleValidator
 * @requires ../../../utils/utils
 * @requires moment
 */

const { isValidObjectId } = require("mongoose");
const {
  upload,
  uploadFromBase64,
  deleteFileByPath,
} = require("../../../config/file");
const AppError = require("../../../exception/AppError");
const catchAsync = require("../../../exception/catchAsync");
const Client = require("../../../model/Client");
const CompanyGroup = require("../../../model/CompanyGroup");
const Contact = require("../../../model/Contact");
const User = require("../../../model/User");
const SimpleValidator = require("../../../validator/simpleValidator");
const { getUniqueValues } = require("../../../utils/utils");
const moment = require("moment");

/**
 * Creates a new contact with associated companies
 * 
 * @function createContact
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing contact and company details
 * @param {Object} req.user - Authenticated user object
 * @param {Object} req.file - Uploaded profile photo file
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the created contact
 * @throws {Error} If validation fails or contact creation encounters an error
 */
exports.createContact = catchAsync(async (req, res) => {
  const { defaultWorkspace } = req.user;

  console.log("body", req.body);
  // Validate incoming data
  await SimpleValidator(req.body, {
    firstName: "required|string",
    emails: "required",
    phones: "required",
    companies: "required",
  });

  let {
    firstName,
    middleName,
    lastName,
    nickName,
    photo,
    emails,
    phones,
    addresses,
    dateOfBirth,
    title,
    suffix,
    prefix,
    companies,
  } = req.body;
  addresses = JSON.parse(addresses);
  emails = JSON.parse(emails);
  phones = JSON.parse(phones);
  companies = JSON.parse(companies);

  // Create the contact
  const contact = await Contact.create({
    workspace: defaultWorkspace._id,
    firstName,
    middleName,
    lastName,
    nickName,
    photo,
    emails,
    phones,
    addresses,
    dateOfBirth,
    title,
    suffix,
    prefix,
  });
  if (req.file) {
    let uploadData = await upload(req.file, "profile-photo", contact._id);
    const { Key } = uploadData;
    contact.photo = Key;
    await contact.save();
  }

  let companyIds = [];
  let companyGroupIds = [];

  // Save the companies
  for (const company of companies) {
    let companyGroupId = company.companyGroup;
    if (!isValidObjectId(companyGroupId)) {
      let companyGroup = await CompanyGroup.create({
        name: company.companyGroup,
      });
      companyGroupId = companyGroup._id;
    }
    companyGroupIds.push(companyGroupId);
    const client = await Client.create({
      companyName: company.companyName,
      companyGroup: companyGroupId,
      accountType: company.accountType,
      supervisingPartner: company.supervisingPartner,
      industry: company.industry,
      referredBy: company.referredBy,
      tin: company.tin,
      contact: contact._id,
      businessStyle: company.businessStyle,
      workspace: defaultWorkspace._id,
      status: "inDraft",
    });
    if (company.logo) {
      let uploadData = await uploadFromBase64(
        company.logo,
        "company-logo",
        client._id
      );
      console.log("Company logo", uploadData);
      const { Key } = uploadData;
      client.logo = Key;
      await client.save();
    }
    companyIds.push(client._id);
  }

  contact.companies = getUniqueValues(companyIds);
  contact.companyGroups = getUniqueValues(companyGroupIds);
  await contact.save();

  res.status(201).json({
    message: "Contact created successfully",
    data: {
      contact,
    },
  });
});

/**
 * Retrieves all contacts with optional filtering and pagination
 * 
 * @function getAllContacts
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters for filtering and pagination
 * @param {Object} req.user - Authenticated user object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with paginated contact data
 */
exports.getAllContacts = catchAsync(async (req, res) => {
  const {
    search,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;
  const { defaultWorkspace } = req.user;

  // Create the main query object
  let query = {
    workspace: defaultWorkspace._id,
    status: "active",
    ...(search && {
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { nickName: { $regex: search, $options: "i" } },
        { emails: { $regex: search, $options: "i" } },
        { phones: { $regex: search, $options: "i" } },
      ],
    }),
  };

  // Aggregation pipeline
  const aggregatedQuery = Contact.aggregate([
    {
      $match: query,
    },
    {
      $lookup: {
        from: "clients",
        let: { contactId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$contact", "$$contactId"] },
            },
          },
          {
            $lookup: {
              from: "companygroups",
              localField: "companyGroup",
              foreignField: "_id",
              as: "companyGroup",
            },
          },
          {
            $unwind: {
              path: "$companyGroup",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "supervisingPartner",
              foreignField: "_id",
              as: "supervisingPartner",
            },
          },
          {
            $unwind: {
              path: "$supervisingPartner",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "referredBy",
              foreignField: "_id",
              as: "referredBy",
            },
          },
          {
            $unwind: {
              path: "$referredBy",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              companyName: 1,
              companyGroup: 1,
              supervisingPartner: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                photo: 1,
                email: 1,
                phone: 1,
              },
              referredBy: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                photo: 1,
                email: 1,
                phone: 1,
              },
              tin: 1,
              businessStyle: 1,
              industry: 1,
              status: 1,
              logo: 1,
            },
          },
        ],
        as: "companies",
      },
    },
    {
      $lookup: {
        from: "companygroups",
        localField: "companyGroups",
        foreignField: "_id",
        as: "companyGroups",
      },
    },
    {
      $sort: {
        // [sortBy]: sortOrder === "desc" ? -1 : 1,
        ...(sortBy == "phones"
          ? { "phones.phoneNumber": sortOrder === "desc" ? -1 : 1 }
          : sortBy == "emails"
          ? { "emails.value": sortOrder === "desc" ? -1 : 1 }
          : { [sortBy]: sortOrder === "desc" ? -1 : 1 }),
      },
    },
  ]);

  // Pagination options
  const options = {
    page: parseInt(page),
    limit: parseInt(limit) === -1 ? 9999999 : parseInt(limit),
  };

  // Fetch paginated data
  const data = await Contact.aggregatePaginate(aggregatedQuery, options);

  res.json({
    message: "Fetched successfully",
    data,
  });
});

/**
 * Retrieves a specific contact by ID
 * 
 * @function getContact
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Contact ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the contact data
 * @throws {AppError} If the contact is not found
 */
exports.getContact = catchAsync(async (req, res) => {
  const contact = await Contact.findOne({
    _id: req.params.id,
    status: "active",
  });

  if (!contact) {
    throw new AppError("Contact not found", 404);
  }

  res.json({
    message: "Contact fetched successfully",
    data: {
      contact,
    },
  });
});

/**
 * Updates an existing contact and its associated companies
 * 
 * @function updateContact
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Contact ID
 * @param {Object} req.body - Request body containing updated contact and company details
 * @param {Object} req.user - Authenticated user object
 * @param {Object} req.file - Uploaded profile photo file
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with the updated contact
 * @throws {Error} If validation fails or contact update encounters an error
 */
exports.updateContact = catchAsync(async (req, res) => {
  const { defaultWorkspace } = req.user;
  const contactId = req.params.id;

  // Find the contact to update
  let contact = await Contact.findById(contactId);
  if (!contact) {
    return res.status(404).json({
      message: "Contact not found",
    });
  }

  // Validate incoming data
  await SimpleValidator(req.body, {
    firstName: "required|string",
    emails: "required",
    phones: "required",
    companies: "required",
  });

  let {
    firstName,
    middleName,
    lastName,
    nickName,
    emails,
    phones,
    addresses,
    dateOfBirth,
    title,
    suffix,
    prefix,
    companies,
  } = req.body;

  // Parse JSON strings if necessary
  if (typeof addresses === "string") addresses = JSON.parse(addresses);
  if (typeof emails === "string") emails = JSON.parse(emails);
  if (typeof phones === "string") phones = JSON.parse(phones);
  if (typeof companies === "string") companies = JSON.parse(companies);

  // Update the contact fields
  contact.firstName = firstName;
  contact.middleName = middleName;
  contact.lastName = lastName;
  contact.nickName = nickName;
  if (dateOfBirth && moment(dateOfBirth).isValid()) {
    contact.dateOfBirth = moment(dateOfBirth).toDate();
  }
  contact.title = title;
  contact.suffix = suffix;
  contact.prefix = prefix;
  contact.emails = emails;
  contact.phones = phones;
  contact.addresses = addresses;

  // Handle photo upload
  if (req.file) {
    if (contact?.photo) {
      await deleteFileByPath(contact.photo);
    }
    let uploadData = await upload(req.file, "profile-photo");
    const { Key } = uploadData;
    contact.photo = Key;
  }

  let companyIds = [];
  let companyGroupIds = [];

  // Process companies
  for (const company of companies) {
    let client;
    if (company._id && isValidObjectId(company._id)) {
      // Update existing client
      client = await Client.findById(company._id);
      if (client) {
        // Update client fields
        client.companyName = company.companyName;
        client.accountType = company.accountType;
        client.supervisingPartner =
          typeof company.supervisingPartner === "object"
            ? company.supervisingPartner._id
            : company.supervisingPartner;
        client.industry = company.industry;
        client.referredBy =
          typeof company.referredBy === "object"
            ? company.referredBy._id
            : company.referredBy;
        client.tin = company.tin;
        client.businessStyle = company.businessStyle;
        client.status = company.status || client.status;

        // Handle company group
        let companyGroupId = company.companyGroup;
        if (typeof company.companyGroup === "object") {
          companyGroupId = company.companyGroup._id;
        } else if (company.companyGroup && !isValidObjectId(companyGroupId)) {
          let companyGroup = await CompanyGroup.create({
            name: company.companyGroup,
          });
          companyGroupId = companyGroup._id;
        }
        if (companyGroupId) {
          client.companyGroup = companyGroupId;
          companyGroupIds.push(companyGroupId);
        }

        // Handle logo update
        if (company.logo !== client.logo) {
          if (client?.logo) {
            await deleteFileByPath(client.logo);
          }
          let uploadData = await uploadFromBase64(company.logo, "company-logo");
          const { Key } = uploadData;
          client.logo = Key;
        }

        await client.save();
        companyIds.push(client._id);
      } else {
        // Client not found; create a new one
        const newClientData = await createNewClient(
          company,
          contact._id,
          defaultWorkspace._id
        );
        companyIds.push(newClientData.clientId);
        companyGroupIds.push(newClientData.companyGroupId);
      }
    } else {
      // Create a new client
      const newClientData = await createNewClient(
        company,
        contact._id,
        defaultWorkspace._id
      );
      companyIds.push(newClientData.clientId);
      companyGroupIds.push(newClientData.companyGroupId);
    }
  }

  // Remove companies that are no longer associated
  const existingCompanyIds = contact.companies.map((id) => id.toString());
  const incomingCompanyIds = companyIds.map((id) => id.toString());
  const companiesToRemove = existingCompanyIds.filter(
    (id) => !incomingCompanyIds.includes(id)
  );

  for (const companyId of companiesToRemove) {
    let client = await Client.findById(companyId);
    if (client) {
      // Optionally, delete the client or update its contact reference
      // client.contact = null;
      // await client.save();
      await Client.findByIdAndDelete(companyId)
    }
  }

  contact.companies = getUniqueValues(companyIds);
  contact.companyGroups = getUniqueValues(companyGroupIds);

  await contact.save();

  res.status(200).json({
    message: "Contact updated successfully",
    data: {
      contact,
    },
  });
});

/**
 * Helper function to create a new client (company) for a contact
 * 
 * @function createNewClient
 * @async
 * @param {Object} company - Company details
 * @param {string} contactId - ID of the associated contact
 * @param {string} workspaceId - ID of the workspace
 * @returns {Promise<Object>} Object containing the new client ID and company group ID
 */
async function createNewClient(company, contactId, workspaceId) {
  let companyGroupId = company.companyGroup;
  if (!isValidObjectId(companyGroupId)) {
    let companyGroup = await CompanyGroup.create({
      name: company.companyGroup,
    });
    companyGroupId = companyGroup._id;
  }

  const client = await Client.create({
    companyName: company.companyName,
    companyGroup: companyGroupId,
    accountType: company.accountType,
    supervisingPartner: company.supervisingPartner,
    industry: company.industry,
    referredBy: company.referredBy,
    tin: company.tin,
    contact: contactId,
    businessStyle: company.businessStyle,
    workspace: workspaceId,
    status: company.status || "inDraft",
  });

  if (company.logo) {
    let uploadData = await uploadFromBase64(company.logo, "company-logo");
    const { Key } = uploadData;
    client.logo = Key;
    await client.save();
  }

  return {
    clientId: client._id,
    companyGroupId: companyGroupId,
  };
}

/**
 * Soft deletes a specific contact by ID
 * 
 * @function deleteContact
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Contact ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response confirming the deletion
 * @throws {AppError} If the contact is not found
 */
exports.deleteContact = catchAsync(async (req, res) => {
  const contactId = req.params.id;

  // Find the contact
  const contact = await Contact.findOne({ _id: contactId, status: "active" });
  if (!contact) {
    throw new AppError("Contact not found", 404);
  }

  // Soft delete the contact by setting status to "deleted"
  contact.status = "deleted";
  await contact.save();

  res.json({
    message: "Contact deleted successfully",
  });
});

/**
 * Retrieves data necessary for contact management pages
 * 
 * @function getData
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends a JSON response with groups and users data
 */
exports.getData = catchAsync(async (req, res) => {
  let { defaultWorkspace } = req.user;
  let groups = await CompanyGroup.find({ status: "active" });
  let users = await User.find({ status: "activated" }).select(
    "firstName lastName email photo phone"
  );

  res.json({
    status: "success",
    data: {
      groups,
      users,
    },
  });
});