const multerMiddleware = require("../../../config/multer");
const {
  nodes,
  createNode,
  pageData,
  uploadDocument,
  deleteNodes,
  getFolderInfo,
  getThumbnail,
  getDocumentInfo,
  getPageImage,
  search,
  getPaginatedDocumentNodes,
  toggleFavourite,
} = require("../../../controller/admin/file-manager/FileManagerController");
const { upload } = require("../../../controller/upload/UploadController");
const Authenticated = require("../../../middleware/Authenticated");

const fileRouter = require("express").Router();
require("express-group-routes");
fileRouter.group("/file", (file) => {
  file.use(Authenticated);
  // file.post("/upload", multerMiddleware.single("attachment"), upload);
  file.get("/getPaginatedDocumentNodes/:parentId?", getPaginatedDocumentNodes);
  file.get("/pageData", pageData);
  file.get("/getNodes/:id?", nodes);
  file.get("/getDocumentInfo/:id", getDocumentInfo);
  file.get("/getFolderInfo/:id", getFolderInfo);
  file.get("/getThumbnail/:id", getThumbnail);
  file.get("/toggleFavourite/:documentId", toggleFavourite);
  file.post("/createNode", createNode);
  file.get("/getPage/:id/:fileType", getPageImage);
  file.get("/search", search);
  file.delete("/deleteNodes", deleteNodes);
  // File upload route using Multer and Papermerge integration
  file.post(
    "/documents/upload",
    multerMiddleware.array("files"),
    uploadDocument
  );
});

module.exports = fileRouter;
