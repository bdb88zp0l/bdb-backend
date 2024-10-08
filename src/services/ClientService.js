/**
 * @fileoverview Client Service
 * 
 * This module provides services related to client management,
 * specifically for generating the next client number in sequence.
 * 
 * @module ClientService
 * @requires ../model/Client
 */

const Client = require("../model/Client");

/**
 * Generates the next client number in sequence
 * 
 * This function uses MongoDB's aggregation pipeline to find the highest
 * existing client number, increments it, and formats it with a prefix.
 * 
 * @async
 * @function getNextCounter
 * @returns {Promise<string>} A promise that resolves to the next client number
 * 
 * @example
 * const nextClientNumber = await getNextCounter();
 * console.log(nextClientNumber); // Outputs: "000001" (or the next number in sequence)
 */
exports.getNextCounter = async () => {
  const prefix = ""; // Set your desired prefix here

  const result = await Client.aggregate([
    {
      $project: {
        numericPart: {
          $convert: {
            input: {
              $substrBytes: [
                { $ifNull: ["$clientNumber", ""] },
                prefix.length,
                -1,
              ],
            },
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
        maxClientNumber: { $max: "$numericPart" },
      },
    },
  ]);

  // If there are no clients or maxClientNumber is null, default to 0
  let maxClientNumber =
    result.length > 0 && result[0].maxClientNumber != null
      ? result[0].maxClientNumber
      : 0;

  const nextClientNumber = maxClientNumber + 1;

  // Ensure the next client number is formatted with leading zeros
  return `${prefix}${nextClientNumber.toString().padStart(6, "0")}`;
};
