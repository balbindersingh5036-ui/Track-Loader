const BASE_URL = "http://localhost:5000/api";

async function run() {
  console.log("--- STARTING E2E INTEGRATION TEST ---");

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/health`);
  const health = await healthRes.json();
  if (health.success !== true) throw new Error("Health check failed: " + JSON.stringify(health));
  console.log("Health Check: PASS");

  // 2. Customer Login
  let customerToken = "";
  let customerId = "";
  const cLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9000000001", password: "Demo@12345" })
  });
  if (cLogin.ok) {
    const cData = await cLogin.json();
    customerToken = cData.data?.token || cData.token;
    customerId = cData.data?.user?.id;
    console.log("Customer Login: PASS");
  } else {
    throw new Error(`Customer login failed: ${await cLogin.text()}`);
  }

  // 3. Driver Login
  let driverToken = "";
  let driverId = "";
  const dLogin = await fetch(`${BASE_URL}/auth/driver/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9100000001", password: "Demo@12345" })
  });
  if (dLogin.ok) {
    const dData = await dLogin.json();
    driverToken = dData.data?.token || dData.token;
    driverId = dData.data?.driver?.id;
    console.log("Driver Login: PASS");
  } else {
    throw new Error(`Driver login failed: ${await dLogin.text()}`);
  }

  // 4. Admin Login
  let adminToken = "";
  const aLogin = await fetch(`${BASE_URL}/auth/admin/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9999999999", password: "Admin@12345" })
  });
  if (aLogin.ok) {
    const aData = await aLogin.json();
    adminToken = aData.data?.token || aData.token;
    console.log("Admin Login: PASS");
  } else {
    throw new Error(`Admin login failed: ${await aLogin.text()}`);
  }

  // 5. Driver Go Online
  const dOnline = await fetch(`${BASE_URL}/driver/status`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ isOnline: true })
  });
  if (dOnline.ok) {
    console.log("Driver Online: PASS");
  } else {
    console.log("Driver Online: ERROR", await dOnline.text());
  }

  // 6. Get Vehicles
  const vehiclesRes = await fetch(`${BASE_URL}/vehicles`);
  const vehiclesData = await vehiclesRes.json();
  const vehicles = vehiclesData.data?.vehicles || vehiclesData.data || [];
  if (vehicles.length === 0) throw new Error("No vehicles found");
  // Find a vehicle assigned to the driver we just logged in as
  const vehicle = vehicles.find(v => (v.driver && v.driver._id === driverId) || v.driver === driverId) || vehicles[0];
  console.log("Vehicles API: PASS", vehicle._id);

  // 7. Create Booking (Customer)
  let bookingId = "";
  const bookRes = await fetch(`${BASE_URL}/bookings`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      vehicle: vehicle._id,
      pickup: { address: "Pickup Location A", latitude: 0, longitude: 0 },
      drop: { address: "Drop Location B", latitude: 0, longitude: 0 },
      goods: "Test Box",
      weight: { value: 10, unit: "kg" },
      preferredPickupDate: "2026-10-06",
      preferredPickupTime: "10:00",
      vehicleType: vehicle.vehicleType
    })
  });
  if (bookRes.ok) {
    const bData = await bookRes.json();
    bookingId = bData.data?.booking?._id || bData.data?._id;
    console.log("Booking Created: PASS", bookingId);
  } else {
    throw new Error(`Booking failed: ${await bookRes.text()}`);
  }

  // 8. Accept Booking (Driver)
  const bAccept = await fetch(`${BASE_URL}/driver/bookings/${bookingId}/accept`, {
    method: "PATCH", headers: { Authorization: `Bearer ${driverToken}` }
  });
  if (bAccept.ok) console.log("Booking Accepted: PASS");
  else throw new Error(`Accept failed: ${await bAccept.text()}`);

  // 9. Start Booking (Driver)
  const bStart = await fetch(`${BASE_URL}/driver/bookings/${bookingId}/start`, {
    method: "PATCH", headers: { Authorization: `Bearer ${driverToken}` }
  });
  if (bStart.ok) console.log("Booking Started: PASS");
  else throw new Error(`Start failed: ${await bStart.text()}`);

  // 10. Complete Booking (Driver)
  const bComplete = await fetch(`${BASE_URL}/driver/bookings/${bookingId}/complete`, {
    method: "PATCH", headers: { Authorization: `Bearer ${driverToken}` }
  });
  if (bComplete.ok) console.log("Booking Completed: PASS");
  else throw new Error(`Complete failed: ${await bComplete.text()}`);

  // 11. Customer Rating
  const rateRes = await fetch(`${BASE_URL}/ratings`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ bookingId: bookingId, rating: 5, feedback: "Great trip!" })
  });
  if (rateRes.ok) console.log("Customer Rating: PASS");
  else throw new Error(`Rating failed: ${await rateRes.text()}`);

  console.log("--- E2E FINISHED SUCCESSFULLY ---");
}

run().catch(console.error);
