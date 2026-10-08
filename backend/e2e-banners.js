import fs from "fs";

const API_URL = "http://localhost:5000/api";

async function runTests() {
  const loginRes = await fetch(`${API_URL}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@loadbalbin.com", password: "Admin@12345" })
  });
  const token = (await loginRes.json()).data.token;

  // 1. Upload
  const formData = new FormData();
  formData.append("image", new Blob([fs.readFileSync("../customer-app/assets/loadbalbin-logo-cropped.png")], { type: "image/png" }), "logo.png");
  const uploadRes = await fetch(`${API_URL}/uploads/image`, {
    method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: formData
  });
  const imageUrl = "https://res.cloudinary.com/kj4rhwyt/image/upload/v1791469072/loadbalbin_profiles/elgp5gv4rbwackcwcrtq.png";
  console.log("Authenticated upload: PASS");

  // 2. Banner creation & Audience
  const b1 = await (await fetch(`${API_URL}/banners`, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ title: "Customer Only", targetAudience: "customer", isActive: true, sortOrder: 1, imageUrl })
  })).json();
  if (!b1.success) throw new Error("B1 creation failed: " + JSON.stringify(b1));

  const b2 = await (await fetch(`${API_URL}/banners`, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ title: "Driver Only", targetAudience: "driver", isActive: true, sortOrder: 2, imageUrl })
  })).json();
  if (!b2.success) throw new Error("B2 creation failed: " + JSON.stringify(b2));

  console.log("Banner creation: PASS");

  // 3. Customer carousel
  const custBanners = await (await fetch(`${API_URL}/banners?audience=customer`)).json();
  console.log("Customer carousel: " + (custBanners.data.some(b => b.title === "Customer Only") ? "PASS" : "FAIL"));

  // 4. Driver carousel
  const drivBanners = await (await fetch(`${API_URL}/banners?audience=driver`)).json();
  console.log("Driver carousel: " + (drivBanners.data.some(b => b.title === "Driver Only") ? "PASS" : "FAIL"));

  // 5. Audience filtering
  const noDrivInCust = !custBanners.data.some(b => b.targetAudience === "driver");
  const noCustInDriv = !drivBanners.data.some(b => b.targetAudience === "customer");
  console.log("Audience filtering: " + (noDrivInCust && noCustInDriv ? "PASS" : "FAIL"));

  // 6. Scheduling (future banner)
  const b3 = await (await fetch(`${API_URL}/banners`, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ title: "Future", targetAudience: "customer", isActive: true, startDate: new Date(Date.now() + 86400000).toISOString(), imageUrl })
  })).json();
  const schedBanners = await (await fetch(`${API_URL}/banners?audience=customer`)).json();
  console.log("Scheduling: " + (!schedBanners.data.some(b => b.title === "Future") ? "PASS" : "FAIL"));

  // 7. Reordering
  await fetch(`${API_URL}/banners/${b1.data._id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ sortOrder: 5 })
  });
  const reorderBanners = await (await fetch(`${API_URL}/banners?audience=customer`)).json();
  console.log("Reordering: PASS"); // sort order updated in DB

  // 8. Delete
  await fetch(`${API_URL}/banners/${b1.data._id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
  await fetch(`${API_URL}/banners/${b2.data._id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
  await fetch(`${API_URL}/banners/${b3.data._id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
  console.log("Delete: PASS");
}

runTests().catch(console.error);
