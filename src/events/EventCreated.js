const Calendar = require("../model/Calendar");
const User = require("../model/User");
const { createNotification } = require("../services/NotificationService");

module.exports = async (event) => {
  // Fetch users to notify
  const calendar = await Calendar.findById(event.calendar)
    .populate("owner", "_id")
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

  // Add calendar owner
  recipientIds.add(calendar.owner._id.toString());

  // Add users shared directly
  calendar.sharedWith.forEach((user) => recipientIds.add(user._id.toString()));

  // Add team members
  calendar.sharedWithTeams.forEach((team) => {
    team.users.forEach((member) =>
      recipientIds.add(member.user._id.toString())
    );
  });

  // Send notifications
  for (const recipientId of recipientIds) {
    await createNotification(recipientId, "new_event", {
      eventId: event._id,
      eventTitle: event.title,
      newStartDate: event.startDate,
      newEndDate: event.endDate,
    });
    let user = await User.findById(recipientId);
    await new Email(user?.email)
      .subject("New Event Created")
      .file("event-create")
      .data({ user, event })
      .send();
  }

  return true;
};
