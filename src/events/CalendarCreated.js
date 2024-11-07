const Email = require("../config/email");
const Calendar = require("../model/Calendar");
const User = require("../model/User");
const { createNotification } = require("../services/NotificationService");

module.exports = async (calendarId) => {
  console.log("entered");
  const calendar = await Calendar.findById(calendarId)
    .populate("owner")
    .populate("sharedWith", "_id")
    .populate({
      path: "sharedWithTeams",
      select: "users",
      populate: {
        path: "users.user",
        select: "_id",
      },
    });

  // Collect recipient IDs
  const recipientIds = new Set();

  // Add users shared directly
  calendar.sharedWith.forEach((user) => recipientIds.add(user._id.toString()));

  // Add team members
  calendar.sharedWithTeams.forEach((team) => {
    team.users.forEach((member) =>
      recipientIds.add(member.user._id.toString())
    );
  });

  console.log(recipientIds);

  // Send notifications
  for (const recipientId of recipientIds) {
    await createNotification(recipientId, "tagged_in_calendar", calendar);

    let user = await User.findById(recipientId);
    await new Email(user?.email)
      .subject(`Calendar Has Been Shared With You: ${calendar.title}`)
      .file("tagged-in-calendar")
      .data({ user, calendar, owner: calendar.owner })
      .send();
  }
  return true;
};
