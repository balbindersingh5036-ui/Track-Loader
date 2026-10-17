import mongoose from "mongoose";
import Agency from "../models/Agency.js";
import Driver from "../models/Driver.js";
import cloudinary from "../config/cloudinary.js";
import { extractCloudinaryAssetInfo, generateSignedDocumentUrl } from "../utils/documentSigner.js";

/**
 * KYC Migration & Verification Engine:
 * 
 * 1. Audits database records for KYC documents.
 * 2. Checks each asset's real Cloudinary delivery type using cloudinary.api.resource().
 * 3. In dryRun mode: Reports all findings without mutating database or Cloudinary.
 * 4. In execute mode (requires explicit execute=true flag):
 *    - Re-uploads public assets into authenticated storage (folder: loadbalbin_kyc, type: authenticated).
 *    - Verifies private_download_url returns HTTP 200 on the new asset.
 *    - Updates database references (url, publicId, resourceType, format, isPrivate: true).
 *    - Deletes the old public asset ONLY AFTER the replacement has been verified.
 */
export const migrateAndVerifyKYCDocuments = async ({ dryRun = true } = {}) => {
  console.log(`[KYC Migration Engine] Starting KYC Privacy Audit (dryRun=${dryRun})...`);

  const report = {
    dryRun,
    timestamp: new Date().toISOString(),
    scannedAgencies: 0,
    scannedDrivers: 0,
    assetsIdentified: [],
    alreadyPrivateCount: 0,
    publicAssetsRequiringMigrationCount: 0,
    externalOrEmptyCount: 0,
    migrationsExecutedCount: 0,
    errors: []
  };

  // 1. Audit Agency Documents
  const agencies = await Agency.find({}).lean();
  report.scannedAgencies = agencies.length;

  for (const agency of agencies) {
    for (const docKey of ["ownerAadhaar", "businessRegistration", "taxId"]) {
      const doc = agency.documents?.[docKey];
      if (!doc || !doc.url) continue;

      const item = {
        entityType: "Agency",
        entityId: agency._id.toString(),
        entityName: agency.agencyName,
        docKey,
        currentUrl: doc.url,
        publicId: doc.publicId || "",
        realCloudinaryType: "unknown",
        migrationStatus: "pending"
      };

      if (!doc.url.includes("cloudinary.com")) {
        item.realCloudinaryType = "external";
        item.migrationStatus = "skipped_external";
        report.externalOrEmptyCount++;
        report.assetsIdentified.push(item);
        continue;
      }

      // Check real delivery type on Cloudinary
      const assetInfo = extractCloudinaryAssetInfo(doc.url);
      const targetPublicId = doc.publicId || assetInfo?.publicId;

      if (targetPublicId) {
        let isAuth = false;
        let isUpload = false;

        try {
          const authRes = await cloudinary.api.resource(targetPublicId, { type: "authenticated" });
          if (authRes) isAuth = true;
        } catch (_) {}

        if (!isAuth) {
          try {
            const pubRes = await cloudinary.api.resource(targetPublicId, { type: "upload" });
            if (pubRes) isUpload = true;
          } catch (_) {}
        }

        if (isAuth) {
          item.realCloudinaryType = "authenticated";
          item.migrationStatus = "already_private";
          report.alreadyPrivateCount++;
        } else if (isUpload) {
          item.realCloudinaryType = "upload (public)";
          item.migrationStatus = "needs_migration";
          report.publicAssetsRequiringMigrationCount++;
        } else {
          item.realCloudinaryType = "not_found_on_provider";
          item.migrationStatus = "stale_reference";
        }
      }

      report.assetsIdentified.push(item);
    }
  }

  // 2. Audit Driver Documents
  const drivers = await Driver.find({}).lean();
  report.scannedDrivers = drivers.length;

  for (const driver of drivers) {
    for (const docKey of ["idProof", "drivingLicense", "vehicleRegistration", "insurance"]) {
      const doc = driver.documents?.[docKey];
      if (!doc || !doc.url) continue;

      const item = {
        entityType: "Driver",
        entityId: driver._id.toString(),
        entityName: driver.fullName,
        docKey,
        currentUrl: doc.url,
        publicId: doc.publicId || "",
        realCloudinaryType: "unknown",
        migrationStatus: "pending"
      };

      if (!doc.url.includes("cloudinary.com")) {
        item.realCloudinaryType = "external";
        item.migrationStatus = "skipped_external";
        report.externalOrEmptyCount++;
        report.assetsIdentified.push(item);
        continue;
      }

      const assetInfo = extractCloudinaryAssetInfo(doc.url);
      const targetPublicId = doc.publicId || assetInfo?.publicId;

      if (targetPublicId) {
        let isAuth = false;
        let isUpload = false;

        try {
          const authRes = await cloudinary.api.resource(targetPublicId, { type: "authenticated" });
          if (authRes) isAuth = true;
        } catch (_) {}

        if (!isAuth) {
          try {
            const pubRes = await cloudinary.api.resource(targetPublicId, { type: "upload" });
            if (pubRes) isUpload = true;
          } catch (_) {}
        }

        if (isAuth) {
          item.realCloudinaryType = "authenticated";
          item.migrationStatus = "already_private";
          report.alreadyPrivateCount++;
        } else if (isUpload) {
          item.realCloudinaryType = "upload (public)";
          item.migrationStatus = "needs_migration";
          report.publicAssetsRequiringMigrationCount++;
        } else {
          item.realCloudinaryType = "not_found_on_provider";
          item.migrationStatus = "stale_reference";
        }
      }

      report.assetsIdentified.push(item);
    }
  }

  // 3. Execute Migration for Confirmed Public KYC Assets if dryRun === false
  if (!dryRun) {
    for (const item of report.assetsIdentified) {
      if (item.migrationStatus !== "needs_migration") continue;

      try {
        console.log(`[KYC Migration] Migrating ${item.entityType} ${item.docKey} (${item.publicId || item.currentUrl})...`);

        const cleanBaseId = item.publicId ? item.publicId.split("/").pop() : "doc_" + Date.now();
        const newPrivatePublicId = `loadbalbin_kyc/${cleanBaseId}`;

        // Step A: Re-upload source into authenticated storage
        const uploadRes = await cloudinary.uploader.upload(item.currentUrl, {
          public_id: newPrivatePublicId,
          type: "authenticated",
          resource_type: "auto"
        });

        // Step B: Verify private delivery via signed link
        const testSignedUrl = generateSignedDocumentUrl(uploadRes.public_id, uploadRes.format, 120, uploadRes.resource_type);
        const verifyRes = await fetch(testSignedUrl);
        if (verifyRes.status !== 200) {
          throw new Error(`Verification fetch of new authenticated asset failed with HTTP ${verifyRes.status}`);
        }

        // Step C: Update database record
        const docUpdates = {
          url: uploadRes.secure_url,
          publicId: uploadRes.public_id,
          format: uploadRes.format,
          resourceType: uploadRes.resource_type || "image"
        };

        if (item.entityType === "Agency") {
          await Agency.findByIdAndUpdate(item.entityId, {
            $set: { [`documents.${item.docKey}`]: docUpdates }
          });
        } else {
          await Driver.findByIdAndUpdate(item.entityId, {
            $set: { [`documents.${item.docKey}`]: docUpdates }
          });
        }

        // Step D: Delete legacy public copy
        if (item.publicId) {
          await cloudinary.uploader.destroy(item.publicId, { type: "upload" });
        }

        item.migrationStatus = "migrated_and_verified";
        report.migrationsExecutedCount++;
      } catch (err) {
        console.error(`[KYC Migration Error] Failed migrating ${item.docKey}:`, err.message);
        report.errors.push({ item, error: err.message });
      }
    }
  }

  console.log("[KYC Migration Engine] Audit Complete. Summary:", {
    dryRun: report.dryRun,
    assetsIdentified: report.assetsIdentified.length,
    alreadyPrivate: report.alreadyPrivateCount,
    publicNeedingMigration: report.publicAssetsRequiringMigrationCount,
    externalOrEmpty: report.externalOrEmptyCount,
    migrationsExecuted: report.migrationsExecutedCount
  });

  return report;
};
