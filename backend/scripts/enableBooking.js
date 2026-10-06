import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  await db.collection('systemsettings').updateOne(
    { key: 'booking.enabled' },
    { $set: { value: true, type: 'boolean', isActive: true, category: 'booking' } },
    { upsert: true }
  );
  console.log('Booking enabled');
  process.exit(0);
}

run().catch(console.error);
