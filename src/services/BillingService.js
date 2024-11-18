const BillingHistory = require("../model/BillingHistory");

exports.getNextBillingNumber = async () => {
  const result = await BillingHistory.aggregate([
    {
      $project: {
        numericPart: {
          $regexFind: {
            input: "$billNumber",
            regex: "\\d+", // This regex will find the first occurrence of a numeric sequence
          },
        },
      },
    },
    {
      $project: {
        numericPart: {
          $convert: {
            input: { $ifNull: ["$numericPart.match", "0"] }, // Use the matched numeric part or default to 0
            to: "int",
            onError: 0,
            onNull: 0,
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        maxBillingNumber: { $max: "$numericPart" }, // Find the highest numeric part
      },
    },
  ]);

  // If there are no case numbers or maxCaseNumber is null, default to 0
  let maxBillingNumber =
    result.length > 0 && result[0].maxBillingNumber != null
      ? result[0].maxBillingNumber
      : 0;

  const nextBillingNumber = maxBillingNumber + 1;

  // Return the next case number with leading zeros (you can customize the prefix)
  const prefix = "BILL-";
  return `${prefix}${nextBillingNumber.toString().padStart(6, "0")}`;
};
