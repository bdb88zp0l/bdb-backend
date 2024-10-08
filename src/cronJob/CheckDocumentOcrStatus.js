var cron = require("node-cron");
const { setConfigValue, getConfigValue } = require("../utils/VariableManager");
const { paperMergeRequest } = require("../config/axios.config");
const catchAsync = require("../exception/catchAsync");
const DocumentNode = require("../model/DocumentNode");
const { getDocumentInfo } = require("../services/PaperMerge");
const { pushNotification } = require("../services/PusherService");
module.exports = cron.schedule(
  "0 * * * * *",
  catchAsync(async () => {
    console.log(
      ` Checking document OCR status cron running at ${new Date().toUTCString()}`
    );

    let docs = await DocumentNode.find({
      "metaData.ocr_status": {
        $in: ["UNKNOWN", "STARTED"],
      },
      nodeType: "document",
    }).lean();
    console.log("Total Pending OCR", docs.length);
    try {
      for (const document of docs) {
        let metaData = document?.metaData ?? {};
        try {
          if (metaData?.id) {
            let documentInfo = await getDocumentInfo(metaData?.id);
            console.log(
              "Current status of:" +
                metaData?.id +
                " is :" +
                documentInfo?.ocr_status,
              document?._id
            );
            if (documentInfo?.ocr_status != metaData?.ocr_status) {
              metaData.ocr_status = documentInfo?.ocr_status;
              console.log("Trying to update", metaData);

              await pushNotification(
                `ocr_status_${document._id}`,
                "update_ocr_status",
                documentInfo?.ocr_status
              );
              await DocumentNode.findByIdAndUpdate(document?._id, {
                metaData,
              });
            }
          }
        } catch (error) {
          console.log("Getting Error while Updating: " + metaData?.id);
          await DocumentNode.findByIdAndUpdate(document?._id, {
            metaData: { ...metaData, ocr_status: "FAILED" },
          });
        }
      }
    } catch (error) {
      console.log("Error", error.message);
    }
  })
);
