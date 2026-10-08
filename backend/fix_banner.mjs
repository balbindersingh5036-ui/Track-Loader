import mongoose from 'mongoose';

async function fixBanner() {
  await mongoose.connect('mongodb+srv://balbindersingh5036_db_user:bg0gPFKYKyhq0C6Z@cluster0.lm0hpgn.mongodb.net/?appName=Cluster0');
  const collection = mongoose.connection.db.collection('banners');
  
  await collection.updateOne(
    { _id: new mongoose.Types.ObjectId('6ac7cb6575af5f47564db72f') },
    { 
      $set: { 
        startDate: new Date('2026-10-08T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.000Z')
      } 
    }
  );
  
  console.log('Banner updated successfully.');
  await mongoose.disconnect();
}

fixBanner().catch(console.error);
