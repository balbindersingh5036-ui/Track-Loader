import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { env } from "./src/config/env.js";
import cloudinary from "./src/config/cloudinary.js";
import fs from "fs";
import path from "path";
import os from "os";
import { Readable } from "stream";

async function runDiagnostics() {
  console.log("=== CLOUDINARY DIAGNOSTICS (IPv4 ONLY) ===");
  if (!env.cloudinary.apiKey) {
    console.log("SDK Initialized: NO");
    return;
  }
  console.log("SDK Initialized: YES");

  console.log("\n--- 1. PING ---");
  try {
    const pingResult = await cloudinary.api.ping();
    console.log("Ping Result:", pingResult);
  } catch (err) {
    console.error("Ping Error:", err.message || err);
  }

  console.log("\n--- 2. UPLOAD (FILE) ---");
  const tempFilePath = path.join(os.tmpdir(), "diagnostic_image_ipv4.png");
  const dummyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  fs.writeFileSync(tempFilePath, dummyPng);

  try {
    const uploadResult = await cloudinary.uploader.upload(tempFilePath, { folder: "loadbalbin-diagnostic", timeout: 10000 });
    console.log("Upload File Success! URL:", uploadResult.secure_url);
    await cloudinary.uploader.destroy(uploadResult.public_id);
    console.log("Deleted diagnostic image from Cloudinary.");
  } catch (err) {
    console.error("Upload File Error:", err.message || err.error?.message || err);
  }

  console.log("\n--- 3. UPLOAD STREAM ---");
  try {
    await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "loadbalbin-diagnostic", timeout: 10000 },
        async (error, result) => {
          if (error) {
            console.error("Upload Stream Error:", error.message || error.error?.message || error);
            return resolve();
          }
          console.log("Upload Stream Success! URL:", result.secure_url);
          await cloudinary.uploader.destroy(result.public_id);
          console.log("Deleted diagnostic streamed image from Cloudinary.");
          resolve();
        }
      );
      Readable.from(dummyPng).pipe(stream);
    });
  } catch (err) {
    console.error("Upload Stream Exception:", err);
  }

  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath);
  }
  console.log("\n=== DIAGNOSTICS COMPLETE ===");
}

runDiagnostics();
