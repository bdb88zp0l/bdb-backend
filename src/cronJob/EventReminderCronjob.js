var cron = require("node-cron");
const catchAsync = require("../exception/catchAsync");
const Event = require("../model/Event");
const Team = require("../model/Team");
const Calendar = require("../model/Calendar");
const Email = require("../config/email");
module.exports = cron.schedule(
  "00 * * * * *",
  catchAsync(async () => {
    console.log(` Event Reminder cron running at ${new Date().toUTCString()}`);
    const currentTime = new Date();

    try {
      // Find events with reminders that should be notified
      const eventsWithReminders = await Event.find({
        reminder: {
          $elemMatch: {
            time: { $lte: currentTime },
            notified: false,
          },
        },
      }).populate("calendar");

      for (const event of eventsWithReminders) {
        // Get the calendar associated with the event
        const calendar = await Calendar.findById(event.calendar._id)
          .populate("sharedWith", "email firstName lastName")
          .populate("owner", "email firstName lastName")
          .populate({
            path: "sharedWithTeams",
            select: "users",
            populate: {
              path: "users.user",
              select: "email firstName lastName",
            },
          })
          .lean();

        // Collect full user information from sharedWith users
        const users = [...calendar.sharedWith];
        // Include the owner
        if (calendar.owner) {
          // Check if owner is already in the users array
          const ownerExists = users.find(
            (user) => user._id.toString() === calendar.owner._id.toString()
          );
          if (!ownerExists) {
            users.push(calendar.owner);
          }
        }

        // Collect full user information from sharedWithTeams users
        for (const team of calendar.sharedWithTeams) {
          for (const member of team.users) {
            // Check if user already exists in users array to avoid duplicates
            if (
              !users.find(
                (user) => user._id.toString() === member.user._id.toString()
              )
            ) {
              users.push(member.user);
            }
          }
        }

        // Send emails to all collected users
        for (const reminder of event.reminder) {
          if (!reminder.notified && reminder.time <= currentTime) {
            for (const user of users) {
              if (user.email) {
                // await sendReminderEmail(user, event);
                await new Email(user?.email)
                  .subject("Reminder")
                  .file("event-reminder")
                  .data({ user, event })
                  .send();
              }
            }

            // Mark the reminder as notified
            reminder.notified = true;
          }
        }

        // Save the updated event
        await event.save();
      }
    } catch (error) {
      console.error("Error sending reminder emails:", error);
    }
  })
);
