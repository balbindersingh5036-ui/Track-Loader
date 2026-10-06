import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import Driver from '../src/models/Driver.js';
import Vehicle from '../src/models/Vehicle.js';

dotenv.config();

async function syncDriverVehicles() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const driverUser = await User.findOne({ phone: '8888888888', role: 'driver' });
  const driver = await Driver.findOne({ user: driverUser._id });

  console.log('Found Driver:', driver._id);

  const vehicleTypes = ['mini-truck', 'pickup', 'small-truck', 'medium-truck', 'large-truck'];

  for (let i = 0; i < vehicleTypes.length; i++) {
    const vType = vehicleTypes[i];
    const vNum = `DL01TB${1000 + i}`;
    
    let veh = await Vehicle.findOne({ vehicleNumber: vNum });
    if (!veh) {
      veh = await Vehicle.create({
        driver: driver._id,
        vehicleNumber: vNum,
        vehicleModel: `Model-${vType}`,
        vehicleType: vType,
        loadCapacity: { value: 1000, unit: 'kg' },
        bodyType: 'closed',
        isAvailable: true,
        isActive: true
      });
      console.log(`Created vehicle ${vNum} (${vType}) for driver.`);
    } else {
      veh.driver = driver._id;
      veh.isAvailable = true;
      veh.isActive = true;
      veh.vehicleType = vType;
      await veh.save();
      console.log(`Updated vehicle ${vNum} (${vType}) for driver.`);
    }
  }

  await mongoose.disconnect();
  console.log('Driver vehicles synchronized successfully.');
}

syncDriverVehicles().catch(err => {
  console.error(err);
  process.exit(1);
});
