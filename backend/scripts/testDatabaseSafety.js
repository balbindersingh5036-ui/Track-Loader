import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const backendRoot = fileURLToPath(new URL("../", import.meta.url));
const testEnvPath = path.join(backendRoot, ".env.test");
const productionEnvPath = path.join(backendRoot, ".env");

const requiredTestVariables = [
  "MONGODB_URI_TEST",
  "TEST_JWT_SECRET",
  "TEST_ADMIN_EMAIL",
  "TEST_ADMIN_PASSWORD",
  "TEST_CUSTOMER_EMAIL",
  "TEST_CUSTOMER_PASSWORD",
  "TEST_DRIVER_EMAIL",
  "TEST_DRIVER_PASSWORD"
];

export const databaseIdentity = (value, variableName, allowDefaultDatabase = false) => {
  let uri;
  try {
    uri = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid MongoDB URI.`);
  }

  if (!["mongodb:", "mongodb+srv:"].includes(uri.protocol)) {
    throw new Error(`${variableName} must use mongodb:// or mongodb+srv://.`);
  }

  const database = decodeURIComponent(uri.pathname.replace(/^\/+/, "")) ||
    (allowDefaultDatabase ? "test" : "");
  if (!database) {
    throw new Error(`${variableName} must include an explicit database name.`);
  }

  return `${uri.protocol}//${uri.host.toLowerCase()}/${database}`;
};

export const assertDatabaseIsolation = (testUri, productionUri) => {
  const testIdentity = databaseIdentity(testUri, "MONGODB_URI_TEST");
  const productionIdentity = databaseIdentity(
    productionUri,
    "backend/.env MONGODB_URI",
    true
  );
  if (testIdentity === productionIdentity) {
    throw new Error(
      "MONGODB_URI_TEST resolves to the production MongoDB host and database; refusing to continue."
    );
  }
};

export const loadTestEnvironment = () => {
  if (!fs.existsSync(testEnvPath)) {
    throw new Error(
      "MONGODB_URI_TEST is missing because backend/.env.test is absent. Copy .env.test.example and configure an isolated test database."
    );
  }
  if (!fs.existsSync(productionEnvPath)) {
    throw new Error(
      "Cannot verify database isolation because backend/.env is missing."
    );
  }

  const testConfig = dotenv.parse(fs.readFileSync(testEnvPath));
  const productionConfig = dotenv.parse(fs.readFileSync(productionEnvPath));
  const missing = requiredTestVariables.filter((key) => !testConfig[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required .env.test variables: ${missing.join(", ")}`);
  }
  if (!productionConfig.MONGODB_URI?.trim()) {
    throw new Error(
      "Cannot verify database isolation because MONGODB_URI is missing from backend/.env."
    );
  }

  assertDatabaseIsolation(testConfig.MONGODB_URI_TEST, productionConfig.MONGODB_URI);
  if (
    productionConfig.JWT_SECRET &&
    testConfig.TEST_JWT_SECRET === productionConfig.JWT_SECRET
  ) {
    throw new Error("TEST_JWT_SECRET must not reuse the production JWT_SECRET.");
  }

  for (const [testKey, runtimeKey] of [
    ["MONGODB_URI_TEST", "MONGODB_URI"],
    ["TEST_JWT_SECRET", "JWT_SECRET"],
    ["TEST_ADMIN_EMAIL", "TEST_ADMIN_EMAIL"],
    ["TEST_ADMIN_PASSWORD", "TEST_ADMIN_PASSWORD"],
    ["TEST_CUSTOMER_EMAIL", "TEST_CUSTOMER_EMAIL"],
    ["TEST_CUSTOMER_PASSWORD", "TEST_CUSTOMER_PASSWORD"],
    ["TEST_DRIVER_EMAIL", "TEST_DRIVER_EMAIL"],
    ["TEST_DRIVER_PASSWORD", "TEST_DRIVER_PASSWORD"]
  ]) {
    process.env[runtimeKey] = testConfig[testKey];
  }

  return {
    uri: testConfig.MONGODB_URI_TEST,
    jwtSecret: testConfig.TEST_JWT_SECRET,
    adminEmail: testConfig.TEST_ADMIN_EMAIL.trim().toLowerCase(),
    adminPassword: testConfig.TEST_ADMIN_PASSWORD,
    customerEmail: testConfig.TEST_CUSTOMER_EMAIL.trim().toLowerCase(),
    customerPassword: testConfig.TEST_CUSTOMER_PASSWORD,
    driverEmail: testConfig.TEST_DRIVER_EMAIL.trim().toLowerCase(),
    driverPassword: testConfig.TEST_DRIVER_PASSWORD
  };
};
