import { env } from "./src/config/env.js";
import cloudinary from "./src/config/cloudinary.js";
import fs from "fs";
import path from "path";
import os from "os";

async function testUpload() {
  console.log("Testing Cloudinary Upload...");
  console.log("Cloud Name:", env.cloudinary.cloudName ? "SET" : "MISSING");
  console.log("API Key:", env.cloudinary.apiKey ? "SET" : "MISSING");
  console.log("API Secret:", env.cloudinary.apiSecret ? "SET" : "MISSING");

  const tempFilePath = path.join(os.tmpdir(), "test_image.png");
  // Create a dummy image file (1x1 transparent PNG)
  const dummyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  fs.writeFileSync(tempFilePath, dummyPng);

  try {
    const result = await cloudinary.uploader.upload(tempFilePath, { folder: "loadbalbin_profiles" });
    console.log("Upload Success! URL:", result.secure_url);
  } catch (err) {
    console.error("Upload Failed. Error:", err);
  }
}

testUpload();
