const {
  getConfig,
  setConfig,
} = require("../../../controller/ConfigController");
const catchAsync = require("../../../exception/catchAsync");
const Authenticated = require("../../../middleware/Authenticated");
const Client = require("../../../model/Client");
const CompanyGroup = require("../../../model/CompanyGroup");
const Contact = require("../../../model/Contact");
const DocumentNode = require("../../../model/DocumentNode");
const { getNextCaseNumber } = require("../../../services/CaseService");
const { getCalendarEvents } = require("../../../services/microsoftAzure");
// const { getUserInfo, getCalendarEvents } = require("../../../services/microsoftAzure");
const { createNode } = require("../../../services/PaperMerge");
const { setConfigValue } = require("../../../utils/VariableManager");

const fs = require("fs");

const temporaryRouter = require("express").Router();

function parseEmails(emailString) {
  if (!emailString || emailString.trim() === "") {
    return [];
  }

  // Split emails by semicolon, comma, or newline
  const emailArray = emailString
    .split(/[,;\n\/]+/)
    .map((email) => email.trim())
    .filter((email) => email !== "");

  // Validate emails and return unique list
  const validEmails = Array.from(new Set(emailArray));

  return validEmails;
}
// Function to parse contact person information
function parseContactPerson(contactPerson) {
  let firstName = "";
  let lastName = "";
  let contactEmail = null;

  if (contactPerson && contactPerson.trim() !== "") {
    // Split by ' - ' to separate name and email if present
    let [namePart, emailPart] = contactPerson.split(" - ");
    if (emailPart) {
      contactEmail = parseEmails(emailPart.trim());
    }

    // Remove any titles (e.g., Mr., Ms., Dr.)
    namePart = namePart.replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.)\s*/i, "");

    // Split the name into parts
    const nameParts = namePart.trim().split(" ");
    firstName = nameParts[0];
    lastName = nameParts.slice(1).join(" ");
  }

  return { firstName, lastName, contactEmail };
}

const convertAddressArrayToObject = (addressArray) => {
  return {
    houseNumber: addressArray[0] || null, // Bonifacio Stopover Corporate Center
    street: addressArray[1] || null, // 2nd Avenue corner 31st Street
    barangay: addressArray[2] || null, // Fort Bonifacio
    city: addressArray[3] || null, // Taguig City
    zip: addressArray[4] || null, // Zip code (if available)
    region: addressArray[5] || null, // Region (if available)
    country: addressArray[6] || null, // Country (if available)
  };
};

function parseFullName(fullName) {
  const titles = ["Atty", "Mr", "Mrs", "Ms", "Dr", "Prof"]; // Add more titles if needed
  const nameParts = fullName.trim().split(" ");

  let title = null;
  let firstName = null;
  let middleName = null;
  let lastName = null;

  // Check if the first part is a title
  if (titles.includes(nameParts[0].replace(".", ""))) {
    title = nameParts.shift().replace(".", ""); // Remove the title and trim the period if exists
  }

  // Last part is always the last name
  lastName = nameParts.pop();

  // First part is the first name
  firstName = nameParts.shift();

  // The remaining part (if any) is the middle name
  if (nameParts.length > 0) {
    middleName = nameParts.join(" ");
  }

  return {
    title,
    firstName,
    middleName,
    lastName,
  };
}

require("express-group-routes");
temporaryRouter.group("/temporary", (temporary) => {
  // temporary.use(Authenticated);
  temporary.post(
    "/setConfig",
    catchAsync(async (req, res) => {
      let { name, value } = req.body;

      await setConfigValue(name, value);
      res.json({
        status: "Configuration is all set",
      });
    })
  );

  temporary.post(
    "/createNode",
    catchAsync(async (req, res) => {
      const { defaultWorkspace } = req.user;
      let { title, parentId, cType, ocr } = req.body;
      const data = await createNode(parentId, title, cType, ocr);

      if (cType !== "document") {
        // Save the uploaded node's details in the database, associating it with the case
        await DocumentNode.create({
          workspace: defaultWorkspace._id,
          paperMergeParentNodeId: parentId,
          paperMergeNodeId: data.id,
          title: data.title,
          path: data.breadcrumb,
          createdBy: req.user._id,
          metaData: data,
          nodeType: "folder",
        });
      }
      res.json({
        status: "Node Created",
        data,
      });
    })
  );

  temporary.post(
    "/import-contacts",
    catchAsync(async (req, res) => {

      let workspaceId = "66f97457981447525a678de1";

      // Load the JSON data from 'data.json'
      const data = JSON.parse(
        fs.readFileSync("data/bdb_contacts.json", "utf8")
      );

      try {
        for (const item of data) {
          let {
            CODE: clientNumber,
            "CLIENT NAME": clientName,
            "CONTACT PERSON": contactName,
            ADDRESSLINE1: addressLine1,
            ADDRESSLINE2: addressLine2,
            BARANGAY: barangay,
            TOWN_CITY: city,
            PROVINCE_STATE: region,
            ZIPCODE: zip,
            PHONEEXT: phoneExt,
            PHONE2: phone2,
            PHONE2EXT: phone2Ext,
            FAX: fax,
            PHONE: phone,
            EMAIL: email,
            CELLNO: cellNo,
            INDUSTRY: industry,
            TIN: tin,
            PARTNERLAWYERNO: partnerLawyerNo,
            PARTNERLAWYERNAME: partnerLawyerName,
          } = item;

          // address = convertAddressArrayToObject(address.split(","));
          let address = {
            houseNumber: addressLine1,
            street: addressLine2,
            barangay,
            city,
            zip,
            region,
            country: "",
          };

          // continue;

          // Parse contact information from 'Contact Person'
          const { title, firstName, middleName, lastName } =
            parseFullName(contactName);
          console.log(title, firstName, middleName, lastName);
          // continue;
          // Check if contact already exists
          let contact = null;
          if (email || firstName || lastName || phone) {
            contact = await Contact.findOne({
              ...(email
                ? {
                    "emails.value": {
                      $in: [email],
                    },
                  }
                : phone
                ? {
                    "phones.phoneNumber": {
                      $in: [phone],
                    },
                  }
                : {
                    firstName: firstName ? firstName : "N/A",
                    lastName: lastName ? lastName : "",
                  }),
              workspace: workspaceId,
            });
          }

          if (!contact) {
            // Create new contact
            contact = new Contact({
              firstName: firstName ? firstName : "N/A",
              lastName: lastName ? lastName : "N/A",
              emails: email ? [{ value: email }] : [],
              phones: phone ? [{ phoneNumber: phone }] : [],
              workspace: workspaceId,
              addresses: [address],
              title,
              // Add other fields as needed
            });
            await contact.save();
            console.log(`Created new contact: ${firstName} ${lastName}`);
          } else {
            console.log(`Contact already exists: ${firstName} ${lastName}`);
          }
          // Check if client already exists
          let client = await Client.findOne({ clientName });
          if (!client) {
            // Create new client
            client = new Client({
              clientNumber,
              companyName: clientName,
              addresses: [address],
              emails: email ? [{ value: email }] : [],
              phones: phone ? [{ phoneNumber: phone }] : [],
              addresses: [address],
              contact: contact._id,
              status: "inDraft",
              tin,
              industry,
              workspace: workspaceId,
              // Add other fields as needed
            });
            await client.save();
            let tempCompanies = contact?.companies ?? [];
            if (!tempCompanies.includes(client._id)) {
              tempCompanies.push(client._id);
            }

            contact.companies = tempCompanies;
            await contact.save();
            console.log(`Created new client: ${clientName}`);
          } else {
            // Update existing client

            client.addresses = [address];
            client.emails = email ? [{ value: email }] : []; // Client's email
            client.phones = phone ? [{ phoneNumber: phone }] : [];
            client.contact = contact._id;
            client.addresses = [address];
            client.tin = tin;
            client.industry = industry;
            await client.save();
            console.log(`Updated existing client: ${clientName}`);
          }
        }
      } catch (error) {
        console.error("Error importing data:", error);
      } finally {
      }

      res.json({
        status: "Imported",
        data,
      });
    })
  );

  temporary.get("/getNextCaseNumber", catchAsync(async (req, res) => {
    
    let caseNumber = await getCalendarEvents();
    res.json({
      status: "Next Number",
      data: caseNumber,
    });
  }));
});

module.exports = temporaryRouter;
