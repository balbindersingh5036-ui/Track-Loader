import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const additionalFares = [
  { vehicleType: 'trailer', baseFare: 1200, perKmRate: 45, perTonRate: 15, minimumFare: 1200, description: 'Heavy multi-axle trailer', isActive: true },
  { vehicleType: 'container', baseFare: 1000, perKmRate: 40, perTonRate: 12, minimumFare: 1000, description: 'Closed high-security container truck', isActive: true },
  { vehicleType: 'open-body', baseFare: 600, perKmRate: 28, perTonRate: 10, minimumFare: 600, description: 'Open body transport truck', isActive: true },
  { vehicleType: 'closed-body', baseFare: 700, perKmRate: 30, perTonRate: 10, minimumFare: 700, description: 'Covered body transport truck', isActive: true },
  { vehicleType: 'tanker', baseFare: 1500, perKmRate: 50, perTonRate: 20, minimumFare: 1500, description: 'Liquid & bulk tanker', isActive: true },
  { vehicleType: 'refrigerated', baseFare: 1400, perKmRate: 48, perTonRate: 18, minimumFare: 1400, description: 'Cold storage / reefer truck', isActive: true },
  { vehicleType: 'tipper', baseFare: 900, perKmRate: 35, perTonRate: 14, minimumFare: 900, description: 'Hydraulic tipping truck for aggregates', isActive: true }
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  for (const fare of additionalFares) {
    await db.collection('fares').updateOne(
      { vehicleType: fare.vehicleType },
      { $set: fare },
      { upsert: true }
    );
  }
  const count = await db.collection('fares').countDocuments({});
  console.log('Fares updated successfully. Total count:', count);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
