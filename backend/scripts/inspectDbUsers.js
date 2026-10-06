import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import Driver from '../src/models/Driver.js';
import { hashPassword } from '../src/utils/password.js';

dotenv.config();

async function inspectAndEnsure() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const users = await User.find({}, 'name phone email role isActive');
  console.log('Existing DB Users:');
  console.log(JSON.stringify(users, null, 2));

  // Ensure Admin
  let admin = await User.findOne({ role: 'admin' });
  const adminPass = await hashPassword('Admin@12345');
  if (!admin) {
    admin = await User.create({
      name: 'LoadBalbin Admin',
      phone: '9999999999',
      email: 'admin@loadbalbin.com',
      password: adminPass,
      role: 'admin',
      isActive: true
    });
    console.log('Created Admin user:', admin._id);
  } else {
    admin.password = adminPass;
    admin.email = 'admin@loadbalbin.com';
    admin.phone = '9999999999';
    admin.isActive = true;
    await admin.save();
    console.log('Updated Admin user password & active state');
  }

  // Ensure Driver
  let driverUser = await User.findOne({ role: 'driver' });
  const driverPass = await hashPassword('Driver@12345');
  if (!driverUser) {
    driverUser = await User.create({
      name: 'Test Driver',
      phone: '8888888888',
      email: 'driver@loadbalbin.com',
      password: driverPass,
      role: 'driver',
      isActive: true
    });
    console.log('Created Driver User:', driverUser._id);
  } else {
    driverUser.password = driverPass;
    driverUser.phone = '8888888888';
    driverUser.email = 'driver@loadbalbin.com';
    driverUser.isActive = true;
    await driverUser.save();
    console.log('Updated Driver User password & active state');
  }

  // Ensure Driver Profile
  let driverProfile = await Driver.findOne({ user: driverUser._id });
  if (!driverProfile) {
    driverProfile = await Driver.create({
      user: driverUser._id,
      fullName: 'Test Driver',
      phone: '8888888888',
      email: 'driver@loadbalbin.com',
      approvalStatus: 'approved',
      isOnline: true,
      isActive: true,
      rating: 5,
      totalTrips: 0
    });
    console.log('Created Driver Profile:', driverProfile._id);
  } else {
    driverProfile.approvalStatus = 'approved';
    driverProfile.isActive = true;
    await driverProfile.save();
    console.log('Updated Driver Profile to approved');
  }

  await mongoose.disconnect();
  console.log('Inspection & Ensure complete.');
}

inspectAndEnsure().catch(err => {
  console.error('Inspect error:', err);
  process.exit(1);
});
