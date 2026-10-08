import express from 'express';
import { env } from '../config/env.js';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

router.get('/cloudinary-env', (req, res) => {
  res.json({
    cloudName: env.cloudinary.cloudName,
    apiKey: env.cloudinary.apiKey,
    // Do not return secret
  });
});

router.post('/cloudinary-smoke', async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const params_to_sign = {
      folder: "loadbalbin_profiles",
      timestamp: timestamp,
    };
    
    const signature = cloudinary.utils.api_sign_request(params_to_sign, env.cloudinary.apiSecret);
    
    // 1x1 pixel transparent PNG
    const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const dataURI = "data:image/png;base64," + b64;
    
    const form = new FormData();
    form.append("file", dataURI);
    form.append("api_key", env.cloudinary.apiKey);
    form.append("timestamp", timestamp);
    form.append("signature", signature);
    form.append("folder", "loadbalbin_profiles");
    
    const response = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/image/upload`, {
      method: "POST",
      body: form
    });
    
    const body = await response.text();
    
    res.json({
      success: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: body
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
