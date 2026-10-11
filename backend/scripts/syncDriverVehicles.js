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

  const vehicleInfo = {
    'mini-truck': {
      model: 'Tata Ace Mini Truck',
      image: 'https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705459/loadbalbin_vehicles/tata_ace_mini_truck.jpg',
      images: ['https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705460/loadbalbin_vehicles/tata_ace_gallery_1.jpg']
    },
    'pickup': {
      model: 'Mahindra Bolero Pickup',
      image: 'https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705464/loadbalbin_vehicles/mahindra_bolero_pickup.jpg',
      images: ['https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705464/loadbalbin_vehicles/mahindra_bolero_pickup.jpg']
    },
    'small-truck': {
      model: 'Ashok Leyland Dost',
      image: 'https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705465/loadbalbin_vehicles/ashok_leyland_dost.jpg',
      images: ['https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705469/loadbalbin_vehicles/ashok_leyland_gallery_1.jpg']
    },
    'medium-truck': {
      model: 'Tata 407 Medium Truck',
      image: 'https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705471/loadbalbin_vehicles/tata_407_medium_truck.jpg',
      images: ['https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705473/loadbalbin_vehicles/tata_407_gallery_1.jpg']
    },
    'large-truck': {
      model: 'Eicher Pro Heavy Truck',
      image: 'https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705475/loadbalbin_vehicles/eicher_pro_heavy_truck.jpg',
      images: ['https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705477/loadbalbin_vehicles/eicher_heavy_gallery_1.jpg']
    }
  };

  for (let i = 0; i < vehicleTypes.length; i++) {
    const vType = vehicleTypes[i];
    const vNum = `DL01TB${1000 + i}`;
    const info = vehicleInfo[vType];
    
    let veh = await Vehicle.findOne({ vehicleNumber: vNum });
    if (!veh) {
      veh = await Vehicle.create({
        driver: driver._id,
        vehicleNumber: vNum,
        vehicleModel: info.model,
        vehicleType: vType,
        loadCapacity: { value: 1000, unit: 'kg' },
        bodyType: 'closed',
        vehicleImage: info.image,
        vehicleImages: info.images,
        isAvailable: true,
        isActive: true
      });
      console.log(`Created vehicle ${vNum} (${vType}) for driver.`);
    } else {
      veh.driver = driver._id;
      veh.vehicleModel = info.model;
      veh.vehicleImage = info.image;
      veh.vehicleImages = info.images;
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
