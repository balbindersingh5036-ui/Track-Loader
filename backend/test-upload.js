import fs from "fs";

async function testUpload() {
  // Login to Render backend to get a valid production token
  const loginRes = await fetch("https://track-loader.onrender.com/api/auth/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@loadbalbin.com", password: "Admin@12345" })
  });
  
  const loginData = await loginRes.json();
  if (!loginData.success) {
    throw new Error("Login failed: " + JSON.stringify(loginData));
  }
  const token = loginData.token;

  const formData = new FormData();
  const fileBuffer = fs.readFileSync("../customer-app/assets/loadbalbin-logo-cropped.png");
  const blob = new Blob([fileBuffer], { type: "image/png" });
  formData.append("image", blob, "logo.png");

  const res = await fetch("https://track-loader.onrender.com/api/uploads/image", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: formData
  });

  const json = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", json);
}

testUpload().catch(console.error);
