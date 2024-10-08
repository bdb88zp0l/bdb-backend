/**
 * @fileoverview Case Service
 * 
 * This module provides services related to case management,
 * specifically for generating the next case number in sequence.
 * 
 * @module CaseService
 * @requires ../model/Case
 */

const Case = require("../model/Case");

/**
 * Generates the next case number in sequence
 * 
 * This function uses MongoDB's aggregation pipeline to find the highest
 * existing case number, increments it, and formats it with a prefix.
 * 
 * @async
 * @function getNextCaseNumber
 * @returns {Promise<string>} A promise that resolves to the next case number
 * 
 * @example
 * const nextCaseNumber = await getNextCaseNumber();
 * console.log(nextCaseNumber); // Outputs: "CAS-000001"
 */
exports.getNextCaseNumber = async () => {
  const result = await Case.aggregate([
    {
      $project: {
        numericPart: {
          $regexFind: {
            input: "$caseNumber",
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
        maxCaseNumber: { $max: "$numericPart" }, // Find the highest numeric part
      },
    },
  ]);

  // If there are no case numbers or maxCaseNumber is null, default to 0
  let maxCaseNumber =
    result.length > 0 && result[0].maxCaseNumber != null
      ? result[0].maxCaseNumber
      : 0;

  const nextCaseNumber = maxCaseNumber + 1;

  // Return the next case number with leading zeros (you can customize the prefix)
  const prefix = "CAS-";
  return `${prefix}${nextCaseNumber.toString().padStart(6, "0")}`;
};

