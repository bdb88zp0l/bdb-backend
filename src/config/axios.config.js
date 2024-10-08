const { default: axios } = require("axios");
const { getConfigValue } = require("../utils/VariableManager");

// Create an Axios instance to communicate with the Papermerge API
const paperMergeRequest = axios.create({
  baseURL: process.env.PAPERMERGE_API_URL, // Base URL for Papermerge API (should be set in environment variables)
});

/**
 * Axios Request Interceptor to automatically add the Bearer token to the request headers.
 *
 * This interceptor runs before each request, fetching the PaperMerge token
 * and setting it as the Authorization header in the request.
 */
paperMergeRequest.interceptors.request.use(
  async (config) => {
    // Fetch the PaperMerge token (currently using a static one, but this can be dynamic)
    let token = await getConfigValue("PAPERMERGE_API_KEY");

    // Set the Authorization header with the Bearer token and content type
    config.headers = {
      ...config.headers, // Use existing headers or override with new ones
      // "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Cookie: `access_token=${token}`,
    };

    return config; // Return the updated config with headers
  },
  (err) => {
    // Log any error that occurs during the request setup
    console.log("Error", err.message);
    Promise.reject(err); // Reject the promise if there's an error
  }
);

module.exports = { paperMergeRequest }; // Export the PaperMerge request instance
