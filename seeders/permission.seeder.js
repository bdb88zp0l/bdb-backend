const { Seeder } = require("mongoose-data-seed");
const _ = require("underscore");
const Role = require("../src/model/Role");
const User = require("../src/model/User");
const Permission = require("../src/model/Permission");

class PermissionSeeder extends Seeder {
  async shouldRun() {
    return Permission.countDocuments()
      .exec()
      .then((count) => count === 0);
  }

  async run() {
    let permissions = [
      {
        name: "contact.read",
        title: "Read Contacts",
      },
      {
        name: "contact.create",
        title: "Create Contacts",
      },
      {
        name: "contact.update",
        title: "Update Contacts",
      },
      {
        name: "contact.delete",
        title: "Delete Contacts",
      },
      {
        name: "calendar.read",
        title: "Read Calendars",
      },
      {
        name: "calendar.create",
        title: "Create Calendars",
      },
      {
        name: "calendar.update",
        title: "Update Calendars",
      },
      {
        name: "calendar.delete",
        title: "Delete Calendars",
      },
      {
        name: "event.read",
        title: "Read Events",
      },
      {
        name: "event.create",
        title: "Create Events",
      },
      {
        name: "event.update",
        title: "Update Events",
      },
      {
        name: "event.delete",
        title: "Delete Events",
      },
      {
        name: "user.read",
        title: "Read Users",
      },
      {
        name: "user.create",
        title: "Create Users",
      },
      {
        name: "user.update",
        title: "Update Users",
      },
      {
        name: "user.delete",
        title: "Delete Users",
      },
      {
        name: "user.change_password",
        title: "Change Passwords",
      },
      {
        name: "team.read",
        title: "Read Teams",
      },
      {
        name: "team.create",
        title: "Create Teams",
      },
      {
        name: "team.update",
        title: "Update Teams",
      },
      {
        name: "team.delete",
        title: "Delete Teams",
      },
      {
        name: "case.read",
        title: "Read Cases",
      },
      {
        name: "case.create",
        title: "Create Cases",
      },
      {
        name: "case.update",
        title: "Update Cases",
      },
      {
        name: "case.delete",
        title: "Delete Cases",
      },
      {
        name: "case.setting",
        title: "Case Settings",
      },
      {
        name: "client.read",
        title: "Read Clients",
      },
      {
        name: "client.create",
        title: "Create Clients",
      },
      {
        name: "client.update",
        title: "Update Clients",
      },
      {
        name: "client.delete",
        title: "Delete Clients",
      },
      {
        name: "client.setting",
        title: "Client Settings",
      },
      {
        name: "role.read",
        title: "Read Roles",
      },
      {
        name: "role.create",
        title: "Create Roles",
      },
      {
        name: "role.update",
        title: "Update Roles",
      },
      {
        name: "role.delete",
        title: "Delete Roles",
      },
      {
        name: "file_manager.read",
        title: "Read Files",
      },
      {
        name: "file_manager.createFolder",
        title: "Read Files",
      },
      {
        name: "file_manager.upload",
        title: "Upload Files",
      },
      {
        name: "file_manager.delete",
        title: "Delete Files",
      },
      {
        name: "permission.setup",
        title: "Permission Setup",
      },
      {
        name: "dashboard",
        title: "Dashboard",
      },
    ];

    return await Permission.create(permissions);
  }
}

module.exports = PermissionSeeder;
