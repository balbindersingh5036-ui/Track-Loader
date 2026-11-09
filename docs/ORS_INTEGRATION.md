# LoadBalbin – OpenRouteService (ORS) Road Distance Integration

## 1. Overview & Architectural Philosophy

LoadBalbin is a goods transportation and logistics booking platform. In freight logistics, straight-line (Haversine) distance introduces significant error (often 20% to 50% underestimation), leading to undercharged trips, driver discontent, and inaccurate delivery estimates.

To ensure strict financial accuracy, LoadBalbin integrates **OpenRouteService (ORS) Directions V2** (`driving-hgv` profile) as the single authoritative source of truth for all distance calculations.

### Core Architecture Rules:
1. **Server-Side Authoritative Calculation**: All road routing, distances, durations, and fares are calculated exclusively by the backend server. The client never dictates or manipulates distance or pricing.
2. **Zero Fallback to Haversine**: If the routing service fails, the system returns a clear, actionable error (HTTP 400/429/502/504) rather than silently falling back to straight-line distance.
3. **Zero API Key Exposure**: The OpenRouteService API key and upstream endpoints are kept strictly on the backend. Frontend bundles (Customer App, Driver App, Admin Panel) never receive, bundle, or log API keys.
4. **Permanent Pricing Snapshots**: At the exact moment a booking is created, a complete, immutable `pricingSnapshot` is permanently stamped onto the Booking document. Subsequent updates to Admin vehicle fare tables never alter existing booking obligations.

---

## 2. OpenRouteService Configuration & Credentials

### Free Tier Quotas:
- **Daily Quota**: 2,000 requests / day
- **Per-Minute Quota**: 40 requests / minute
- **Profile**: `driving-hgv` (Heavy Goods Vehicle / Truck safe routing)

### Environment Variables:
Configured in `backend/.env`:
```env
# OpenRouteService (ORS) Credentials
ORS_API_KEY=eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjIzZjYzNzU3M2M5MTQ5MWI5NTZmNjYyNmE2MWM4MTcwIiwiaCI6Im11cm11cjY0In0=
ORS_BASE_URL=https://api.heigit.org/openrouteservice/v2
```

In `backend/src/config/env.js`:
```javascript
ors: {
  apiKey: process.env.ORS_API_KEY,
  baseUrl: process.env.ORS_BASE_URL || "https://api.heigit.org/openrouteservice/v2"
}
```

---

## 3. Quota Management & Caching Strategy

To protect the 2,000 req/day quota and stay well within the 40 req/min rate limit:

1. **In-Memory Normalized Route Cache**:
   - Implemented in `backend/src/services/routingService.js`.
   - **Key Format**: `${profile}_${pLat},${pLon}_${dLat},${dLon}` (coordinates rounded to 4 decimal places, ~11-meter resolution).
   - **TTL**: 12 hours (`43,200,000 ms`).
   - **Capacity**: LRU-style rolling eviction up to 1,000 cached routes.
   - Repeated requests for the same pickup and drop (e.g., during booking review or page refreshes) are served from cache with 0 ms upstream latency and zero quota consumption.
2. **Sliding-Window API Rate Limiter**:
   - Implemented in `backend/src/middleware/rateLimitMiddleware.js`.
   - Limits each authenticated user / IP to **35 requests per minute** (leaving a safe 5 req/min buffer below ORS's 40 req/min cap).
   - Exceeding clients receive HTTP 429 `"Rate limit exceeded for route distance calculation"`.
3. **10-Second AbortController Timeout**:
   - Every upstream call to ORS enforces a strict 10-second timeout.
   - Prevents backend worker starvation on network stalls.

---

## 4. Authoritative 3-Tier Pricing Formula

All vehicle categories (`mini-truck`, `pickup`, `small-truck`, `medium-truck`, `large-truck`) adhere to the standard 3-tier pricing model:

### Formula:
$$\text{Distance Charge} = \text{ORS Road Distance (KM)} \times \text{Rate per KM}$$
$$\text{Weight Charge} = \text{Cargo Weight (Ton)} \times \text{Rate per Ton}$$
$$\text{Calculated Fare} = \text{Distance Charge} + \text{Weight Charge}$$
$$\text{Final Fare} = \max(\text{Calculated Fare}, \text{Minimum Fare})$$

### Rules:
- Cargo weight in **Kilograms (KG)** is converted to **Tons**: $\text{Weight (Ton)} = \frac{\text{Weight (KG)}}{1000}$.
- Cargo weight in **Tons** is used directly.
- `baseFare` defaults to 0 across all vehicles in the 3-tier system.
- If $\text{Calculated Fare} < \text{Minimum Fare}$, $\text{Final Fare} = \text{Minimum Fare}$.

---

## 5. Backend Endpoints & Models

### 1. Distance Calculation Endpoint:
- **Route**: `POST /api/routes/calculate-distance`
- **Auth**: Customer / Driver / Admin (`protect` middleware)
- **Rate Limit**: 35 req/min
- **Payload**:
  ```json
  {
    "pickup": { "latitude": 26.8467, "longitude": 80.9462, "address": "Lucknow" },
    "drop": { "latitude": 28.6139, "longitude": 77.2090, "address": "Delhi" },
    "vehicleType": "medium-truck"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "distanceKm": 489.14,
    "distanceMeters": 489139,
    "durationSeconds": 22025,
    "durationMinutes": 367.08,
    "profile": "driving-hgv",
    "geometry": "encoded_polyline_string",
    "coordinates": [[26.8467, 80.9462], ...],
    "calculatedAt": "2026-11-07T04:30:00.000Z",
    "cached": false,
    "data": { ... }
  }
  ```

### 2. Booking Schema Fields (`backend/src/models/Booking.js`):
```javascript
distanceKm: { type: Number, default: 0, min: 0 },
routeGeometry: { type: String, default: "" },
pricingSnapshot: {
  ratePerKm: { type: Number, default: 0 },
  ratePerTon: { type: Number, default: 0 },
  minimumFare: { type: Number, default: 0 },
  distanceKm: { type: Number, default: 0 },
  distanceMeters: { type: Number, default: 0 },
  weightInTon: { type: Number, default: 0 },
  distanceCharge: { type: Number, default: 0 },
  weightCharge: { type: Number, default: 0 },
  calculatedFare: { type: Number, default: 0 },
  finalFare: { type: Number, default: 0 },
  durationSeconds: { type: Number, default: 0 },
  routingProfile: { type: String, default: "driving-hgv" },
  calculatedAt: { type: Date, default: Date.now }
}
```

### 3. Driver Location Endpoint (`backend/src/routes/driverRoutes.js`):
- **Route**: `PATCH /api/driver/location`
- **Auth**: Driver (`protect`, `driverOnly`)
- **Payload**: `{ "latitude": 26.8467, "longitude": 80.9462, "address": "Civil Lines" }`
- **Behavior**: On-demand single snapshot update. No background tracking.

---

## 6. Frontend Integrations

### 1. Customer App (`customer-app`)
- **Interactive Map Component (`src/components/RouteMap.jsx`)**:
  - Uses free Leaflet.js and OpenStreetMap tiles.
  - Requires zero Google Maps API keys.
  - Renders Pickup marker (green 'P'), Drop-off marker (red 'D'), and route polyline overlay.
  - Interactive tap-to-pin and marker drag-and-drop.
- **Location Screen (`src/screens/booking/LocationScreen.jsx`)**:
  - OpenStreetMap Nominatim live address suggestions.
  - "My Location" browser/device GPS snapshot (graceful fallback if denied — never blocks booking).
  - Live distance & duration display (`X km · ~Y hr Z min`).
- **Booking Confirmation (`src/screens/booking/BookingConfirmScreen.jsx`)**:
  - Displays authoritative road distance in KM and estimated driving time.
  - Clear 3-tier pricing breakdown (Distance charge, Cargo weight charge, Minimum fare).

### 2. Driver App (`driver-app`)
- **Driver Service (`src/services/driverService.js`)**:
  - Single snapshot on-demand geolocation (`requestLocationSnapshot`).
  - Zero background polling or continuous battery drain.

### 3. Admin Panel (`admin-panel`)
- **Fare Management Screen (`src/pages/fares/FareManagement.jsx`)**:
  - Full CRUD for the 5 vehicle categories.
  - Edit Rate per KM (₹), Rate per Ton (₹), and Minimum Fare (₹).
  - Enable / Disable status toggles.
  - **Live Interactive Pricing Simulator**: Allows administrators to test any road distance and weight combinations and visually verify formula calculations against minimum fare thresholds.
- **Navigation**: Linked in Super Admin sidebar under "Fare Pricing" and routed at `/fares`.

---

## 7. Automated Testing Suite & Verification

All test scenarios are implemented in `backend/tests/ors-routing.test.js`:

| # | Scenario | Status | Description |
|---|----------|--------|-------------|
| 1 | Valid Route Coordinates | Passed | Road distance (85.43 km) > straight-line distance (74.8 km) |
| 2 | Invalid Pickup Lat/Lon | Passed | Returns HTTP 400 Bad Request with coordinate error |
| 3 | Invalid Drop Lat/Lon | Passed | Returns HTTP 400 Bad Request with coordinate error |
| 4 | ORS 401 Unauthorized | Passed | Returns HTTP 502 without leaking `ORS_API_KEY` |
| 5 | ORS 429 Quota Limit | Passed | Returns HTTP 429 "quota limit exceeded" |
| 6 | ORS Request Timeout | Passed | Returns HTTP 504 "timed out" |
| 7 | Unroutable Coordinates | Passed | Returns HTTP 400 "No road route found" |
| 8 | Unit Conversion | Passed | Meters accurately converted to KM rounded to 2 decimals |
| 9 | KG to Ton Pricing | Passed | 500 kg converted to 0.5 ton |
| 10 | Direct Ton Pricing | Passed | 3 ton used directly in formula |
| 11 | Minimum Fare Threshold | Passed | Minimum fare applied when calculated fare is lower |
| 12 | Instant Booking Creation | Passed | Stores road distance & complete `pricingSnapshot` |
| 13 | Scheduled Booking Creation | Passed | Stores road distance & complete `pricingSnapshot` |
| 14 | Pricing Snapshot Immutability | Passed | Booking fare unaltered when vehicle fare rates change later |
| 15 | Razorpay Consistency & Security | Passed | Razorpay amount matches booking fare; 0 secret keys in frontends |

### Test Suite Execution:
```bash
# Run ORS Routing test suite
node --test tests/ors-routing.test.js

# Run full backend test suite
npm test
```
**Result**: 292 of 292 tests passing (100% success rate).

