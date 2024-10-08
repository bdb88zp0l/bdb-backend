const client = require("../config/azure");

const userId = "9fa92544-eb5d-4efe-b279-a92b4b26dda4";
exports.getUserInfo = async () => {
  const res = await client.api("/users/" + userId).get();
  return res;
};

exports.getCalendarEvents = async (email) => {
  if (!email) {
    return null;
  }
  const now = new Date().toISOString(); // Get the current time in ISO format
  const users = await client.api("/users").get();
  let selectedUser = users.value.find((user) => user.mail === email);
  if (!selectedUser) {
    return null;
  }
  const res = await client
    .api("/users/" + selectedUser.id + "/calendar/events")
    .filter(`start/dateTime ge '${now}'`)
    .get();
  return res?.value ?? [];
};
