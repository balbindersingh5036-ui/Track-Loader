

const BASE_URL = "http://localhost:5000/api";
let adminToken = "";
let customerToken = "";
let driverToken = "";

async function login(phone, password, role) {
  let endpoint = `${BASE_URL}/auth/login`;
  if (role === "driver") endpoint = `${BASE_URL}/auth/driver/login`;
  if (role === "admin") endpoint = `${BASE_URL}/auth/admin/login`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Login failed for ${phone} (${role}): ${data.message || res.statusText}`);
  }
  console.log(`Login SUCCESS: ${phone} (${role})`);
  return data.data?.token || data.token;
}

async function getMe(token) {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`/auth/me failed: ${JSON.stringify(data)}`);
  console.log(`/auth/me SUCCESS, user role: ${data.data.user.role}`);
}

async function getVehicles() {
  const res = await fetch(`${BASE_URL}/vehicles`);
  const data = await res.json();
  if (!res.ok) throw new Error(`/vehicles failed`);
  const list = data.data?.vehicles || data.data || [];
  console.log(`Public Vehicles API SUCCESS, found ${list.length || 0} vehicles`);
}

async function getAdminData(endpoint, token) {
  const res = await fetch(`${BASE_URL}/admin/${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`/admin/${endpoint} failed`);
  const list = data.data?.customers || data.data?.drivers || data.data?.vehicles || data.data || [];
  console.log(`Admin ${endpoint} API SUCCESS, found ${list.length || 0} records`);
}

async function runTests() {
  try {
    console.log("--- 7. LOGIN VALIDATION ---");
    customerToken = await login("9000000001", "Demo@12345", "customer");
    await getMe(customerToken);

    driverToken = await login("9100000001", "Demo@12345", "driver");
    await getMe(driverToken);

    adminToken = await login("9999999999", "Admin@12345", "admin");

    console.log("\n--- 8. API VALIDATION ---");
    await getVehicles();
    await getAdminData("customers", adminToken);
    await getAdminData("drivers", adminToken);
    await getAdminData("vehicles", adminToken);

  } catch (err) {
    console.error("Test Error:", err.message);
  }
}

runTests();
