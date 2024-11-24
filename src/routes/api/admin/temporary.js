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
const moment = require("moment");
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



  temporary.get("/dump-contract-price", catchAsync(async (req, res) => {


    let cases = await Case.find({})
    for (const element of cases) {
      element.status = element?.metaData?.ISACTIVE == 0 ? "inactive" : "active"
      await element.save()
      console.log(element.caseNumber)

    }

    // let clients = await Client.find({})
    // for (const element of clients) {
    //   element.status = element?.metaData?.ISACTIVE == 0 ? "inactive" : "active"
    //   await element.save()
    //   console.log("ClientId ", element.clientNumber, moment.unix(element.metaData.CREATED_AT).format("YYYY-MM-DD"), " - ", element.metaData.CREATED_AT)
    // }
    // let clients = await Client.find({})
    // for (const element of clients) {
    //   element.engagedAt = element?.metaData?.CREATED_AT ? moment.unix(element.metaData.CREATED_AT).toDate() : null
    //   await element.save()
    //   console.log("ClientId ", element.clientNumber, moment.unix(element.metaData.CREATED_AT).format("YYYY-MM-DD"), " - ", element.metaData.CREATED_AT)
    // }

    // let clients = await Client.updateMany({ createdAt: { $lt: new Date("2024-10-15") } }, { $set: { status: "inDraft" } })
    // await Client.deleteMany({ status: "inDraft" })




    res.json({
      status: "Dumped successfully",
      data: "Done"
    });
  }));



  temporary.get("/dump-fileNumberToCaseNumber", catchAsync(async (req, res) => {


    let cases = await Case.find({
      "metaData.FILENUMBER": {
        $exists: true
      }
    })

    let count = 0;
    for (const element of cases) {
      await Case.findByIdAndUpdate(element._id, {
        natureOfWork: element?.metaData?.CONTROLNAME, //n
        fixedFee: element?.metaData?.FIXEDFEE,
        acceptanceFee: element?.metaData?.ACCEPTANCEFEE,
        successFee: element?.metaData?.SUCCESSFEE,
        capFee: element?.metaData?.CAPAMT,
      })

      count++

      console.log(count)

    }


    res.json({
      status: "Dumped successfully",
      data: cases
    });
  }));
});

module.exports = temporaryRouter;
