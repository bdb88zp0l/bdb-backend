const { Seeder } = require('mongoose-data-seed');
const _ = require('underscore');
const Role = require('../src/model/Role');
const User = require('../src/model/User');


class RoleAndAdminSeeder extends Seeder {

  async shouldRun() {
    return Role.countDocuments().exec().then(count => count === 0);
  }

  async run() {


    let superAdmin = await User.create({
      firstName: "Super ",
      lastName: "Admin",

      email: "admin@metatrend.com.ph",
      password: "12345678",
      roleType: "superAdmin",

      status: "activated",
    });
    let roles = [
      {
        name: "admin",
      },
      {
        name: "lawyer",
      },
    ];


    return await Role.create(roles);
  }
}

module.exports = RoleAndAdminSeeder;
