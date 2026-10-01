import assert from "node:assert/strict";
import test from "node:test";
import { assertDatabaseIsolation, databaseIdentity } from "../scripts/testDatabaseSafety.js";

test("test database URI must name an explicit database", () => {
  assert.throws(
    () => databaseIdentity("mongodb://localhost:27017", "MONGODB_URI_TEST"),
    /explicit database name/
  );
});

test("test database guard rejects the production host and database", () => {
  assert.throws(
    () => assertDatabaseIsolation(
      "mongodb+srv://user:pass@cluster.example/loadbalbin",
      "mongodb+srv://other:secret@cluster.example/loadbalbin"
    ),
    /production MongoDB/
  );
});

test("test database guard rejects the production default database", () => {
  assert.throws(
    () => assertDatabaseIsolation(
      "mongodb+srv://user:pass@cluster.example/test",
      "mongodb+srv://other:secret@cluster.example"
    ),
    /production MongoDB/
  );
});

test("test database guard permits a separate database on the same cluster", () => {
  assert.doesNotThrow(() => assertDatabaseIsolation(
    "mongodb+srv://user:pass@cluster.example/loadbalbin_test",
    "mongodb+srv://other:secret@cluster.example/loadbalbin"
  ));
});
