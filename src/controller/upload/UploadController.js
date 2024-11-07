const { upload } = require("../../config/file");
const AppError = require("../../exception/AppError");
const catchAsync = require("../../exception/catchAsync");

exports.upload = catchAsync(async (req, res, next) => {
  console.log("file", req.file);
  console.log("files", req.files);
  const uploaded_file = req.file;
  upload(uploaded_file, "/uploads/", "profile")
    .then((data) => {
      res.json({
        statusbar: "success",
        message: "Uploaded successfully",
        data,
      });
    })
    .catch((err) => {
      console.log(err.message);
      return next(new AppError("Something went wrong", 500));
    });
});
