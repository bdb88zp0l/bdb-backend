const {
  getConfig,
  setConfig,
} = require("../../../controller/ConfigController");
const catchAsync = require("../../../exception/catchAsync");
const Authenticated = require("../../../middleware/Authenticated");
const Case = require("../../../model/Case");
const Client = require("../../../model/Client");
const CompanyGroup = require("../../../model/CompanyGroup");
const Contact = require("../../../model/Contact");
const DocumentNode = require("../../../model/DocumentNode");
const Workspace = require("../../../model/Workspace");
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

  temporary.get("/rand", catchAsync(async (req, res) => {

    // let caseNumber = await getCalendarEvents();

    let lookFor = "66f97457981447525a678de1"
    let replaceWith = "67062826b11ae1d85701cc5a"
    await Client.updateMany({ workspace: lookFor }, { workspace: replaceWith })
    await Contact.updateMany({ workspace: lookFor }, { workspace: replaceWith })

    res.json({
      status: "Next Number",
      // data: caseNumber,
    });
  }));




  temporary.get(
    "/import-clients",
    catchAsync(async (req, res) => {

      let workspaceId = "67062826b11ae1d85701cc5a";

      // Load the JSON data from 'data.json'
      const data = JSON.parse(
        fs.readFileSync("data/bdb_clients.json", "utf8")
      );

      try {
        for (const item of data) {
          let {
            CLIENTID: clientNumber,
            CLIENTNAME: clientName,
            CONTACTPERSON: contactName,
            DESIGNATION: designation,
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
          const firstName = contactName
          // console.log(firstName);
          // continue;
          // Check if contact already exists
          let contact = null;
          if (email || firstName || phone) {
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
                    firstName: firstName ? firstName : "N/A"
                  }),
              workspace: workspaceId,
            });
          }

          if (!contact) {
            // Create new contact
            contact = new Contact({
              firstName: firstName ? firstName : "N/A",
              emails: email ? [{ value: email }] : [],
              phones: phone ? [{ phoneNumber: phone }] : [],
              workspace: workspaceId,
              addresses: [address],
            });
            await contact.save();
            console.log(`Created new contact: ${firstName}`);
          } else {
            console.log(`Contact already exists: ${firstName}`);
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
              status: "active",
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
            client.status = "active"
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

  temporary.get(
    "/import-cases",
    catchAsync(async (req, res) => {

      let workspaceId = "67062826b11ae1d85701cc5a";
      // let workspaceId = "66e3ef9b49bcbc01d4b4be7d"
      let userId = "6705706ec895d52aa1e85076"
      let defaultWorkspace = await Workspace.findOne({ _id: workspaceId })

      // Load the JSON data from 'data.json'
      const data = JSON.parse(
        fs.readFileSync("data/bdb_cases.json", "utf8")
      );

      try {
        for (const item of data) {
          let {
            CLIENTID: clientNumber,
            CASEID,
            CASENAME,
            ENTRYDATE,
            FILENUMBER,
            CASESTATUS,
            PERSERVICECATEG,
            LASTBILLINGDATE,
            CASECURRENCY,
            DATECLOSED,
            CLIENTNAME,
            TIN,
            ADDRESSLINE1,
            ADDRESSLINE2,
          } = item;

          let address = {
            houseNumber: ADDRESSLINE1,
            street: ADDRESSLINE2,
            barangay: "",
            city: "",
            zip: "",
            region: "",
            country: "",
          };
          let clientInfo = await Client.findOne({ clientNumber })
          if (!clientInfo) {
            console.log(`Client Not found: ${clientNumber}`)


            // clientInfo = new Client({
            //   clientNumber,
            //   companyName: CLIENTNAME,
            //   addresses: [address],
            //   emails: [],
            //   phones: [],
            //   status: "active",
            //   tin: TIN,
            //   industry,
            //   workspace: workspaceId,
            //   // Add other fields as needed
            // });
            // await clientInfo.save();
          }

          console.log(`clientNumber: ${clientNumber}; clientId: ${clientInfo?._id};`)

          try {


            let nodeData = await createNode(
              defaultWorkspace?.paperMergeNodeId ?? null,
              FILENUMBER,
              "folder"
            );


            const newCase = await Case.create({
              workspace: workspaceId,
              paperMergeNodeId: nodeData.id,
              caseNumber: CASEID,
              title: CASENAME,
              description: "",
              status: "active",
              client: clientInfo?._id,
              startDate: ENTRYDATE,
              endDate: DATECLOSED,
              documents: [],
              defaultBillingType: "monthly",
              serviceType: PERSERVICECATEG,
              currency: CASECURRENCY || "PHP",
              convertRetainerFeeToPHP: false,
              billingStart: ENTRYDATE,
              billingEnd: LASTBILLINGDATE,
              createdBy: userId,

              statusHistory: [
                {

                  status: "Created",
                  date: new Date(),
                  updatedBy: userId,
                },
              ],
            });
            console.log(`Created new case: ${CASEID}; Id: ${newCase?._id}`)

            let node = await DocumentNode.create({
              case: newCase?._id,
              workspace: workspaceId,
              paperMergeParentNodeId: nodeData?.parent_id,
              paperMergeNodeId: nodeData.id,
              title: nodeData.title,
              path: nodeData.breadcrumb,
              createdBy: userId,
              metaData: nodeData,
              nodeType: "folder",
              visibility: "public",
              sharedWithTeams: [],
            });
            console.log(`Created new node: ${nodeData.id}; Id: ${node?._id}`)

          } catch (error) {
            console.log(error.message)
            continue
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
});

module.exports = temporaryRouter;
