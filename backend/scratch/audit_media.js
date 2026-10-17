import mongoose from "mongoose";
import { env } from "../src/config/env.js";

const run = async () => {
  await mongoose.connect(env.mongodbUri);
  const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));
  const users = await User.find({}).lean();
  const matched = users.filter(u => u.profileImage && u.profileImage.includes("loadbalbin_profiles"));
  console.log("Users with loadbalbin_profiles avatar:", matched.length);
  for (const u of matched) {
    console.log(`[User] ${u.name} (${u.role}) -> ${u.profileImage}`);
  }

  const Driver = mongoose.model("Driver", new mongoose.Schema({}, { strict: false }));
  const drivers = await Driver.find({}).lean();
  console.log("Total drivers:", drivers.length);
  for (const d of drivers) {
    if (d.documents) {
      console.log(`[Driver] ${d.fullName} -> docs:`, JSON.stringify(d.documents));
    }
  }

  const Agency = mongoose.model("Agency", new mongoose.Schema({}, { strict: false }));
  const agencies = await Agency.find({}).lean();
  console.log("Total agencies:", agencies.length);
  for (const a of agencies) {
    console.log(`[Agency] ${a.agencyName} -> docs:`, JSON.stringify(a.documents));
  }

  await mongoose.disconnect();
};

run().catch(console.error);
