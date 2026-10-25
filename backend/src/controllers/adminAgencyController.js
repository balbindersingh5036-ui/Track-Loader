import mongoose from "mongoose";
import Agency from "../models/Agency.js";
import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";
import { sanitizeDriverDocumentResponse } from "../utils/driverDocumentResponse.js";
import { sanitizeVehicleDocumentResponse } from "../utils/vehicleDocumentResponse.js";
import { extractCloudinaryAssetInfo, generateSignedDocumentUrl } from "../utils/documentSigner.js";

export const getAdminAgencies = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const { page, limit, skip } = pagination;
    const query = {};

    if (req.query.approvalStatus) {
      if (!["pending", "approved", "rejected", "suspended"].includes(req.query.approvalStatus)) {
        return errorResponse(res, "Invalid approvalStatus", 400);
      }
      query.approvalStatus = req.query.approvalStatus;
    }

    if (req.query.search) {
      const search = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(search, "i");
      query.$or = [{ agencyName: regex }, { phone: regex }, { email: regex }];
    }

    const [agencies, total] = await Promise.all([
      Agency.find(query)
        .select("-documents")
        .populate("owner", "name phone email profileImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Agency.countDocuments(query)
    ]);

    return successResponse(
      res,
      {
        agencies,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      },
      "Agencies fetched successfully"
    );
  } catch (error) {
    return errorResponse(res, "Failed to fetch agencies", 500);
  }
};

export const getAdminAgencyById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid agency ID", 400);
    }

    const agency = await Agency.findById(id).populate("owner", "name phone email profileImage");
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    const [drivers, vehicles] = await Promise.all([
      Driver.find({ agency: agency._id })
        .populate("user", "name phone email")
        .populate("documents.idProof.uploadedBy", "name")
        .populate("documents.drivingLicense.uploadedBy", "name"),
      Vehicle.find({ agency: agency._id })
        .populate("driver", "fullName phone")
        .populate("documents.registration.uploadedBy", "name")
        .populate("documents.registration.reviewedBy", "name")
        .populate("documents.insurance.uploadedBy", "name")
        .populate("documents.insurance.reviewedBy", "name")
    ]);

    const agencyObj = agency.toObject();

    if (agencyObj.documents) {
      for (const [key, doc] of Object.entries(agencyObj.documents)) {
        if (!doc) continue;
        let publicId = doc.publicId;
        let format = doc.format || "pdf";
        if (!publicId && doc.url) {
          const asset = extractCloudinaryAssetInfo(doc.url);
          if (asset) {
            publicId = asset.publicId;
            format = asset.format;
          }
        }
        doc.viewUrl = publicId?.startsWith("loadbalbin_kyc/")
          ? generateSignedDocumentUrl(publicId, format, 300, doc.resourceType || "image")
          : null;
        delete doc.url;
        delete doc.publicId;
      }
    }

    const enhancedDrivers = drivers.map((d) => {
      const dObj = d.toObject();
      return sanitizeDriverDocumentResponse(dObj, { includeSignedUrls: true });
    });

    return successResponse(res, {
      agency: agencyObj,
      drivers: enhancedDrivers,
      vehicles: vehicles.map((vehicle) => sanitizeVehicleDocumentResponse(vehicle.toObject(), { includeSignedUrls: true }))
    }, "Agency details fetched");
  } catch (error) {
    console.error("getAdminAgencyById failed:", error.code || error.name || "unknown error");
    return errorResponse(res, "Failed to fetch agency details", 500);
  }
};

export const approveAdminAgency = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid agency ID", 400);
    }

    const agency = await Agency.findByIdAndUpdate(
      id,
      {
        $set: {
          approvalStatus: "approved",
          approvedAt: new Date(),
          approvedBy: req.user._id,
          rejectionReason: ""
        }
      },
      { new: true }
    );

    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    return successResponse(res, { agency }, "Agency approved successfully");
  } catch (error) {
    return errorResponse(res, "Failed to approve agency", 500);
  }
};

export const rejectAdminAgency = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid agency ID", 400);
    }

    const agency = await Agency.findByIdAndUpdate(
      id,
      {
        $set: {
          approvalStatus: "rejected",
          rejectionReason: reason || "Documents rejected by administrator"
        }
      },
      { new: true }
    );

    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    return successResponse(res, { agency }, "Agency rejected successfully");
  } catch (error) {
    return errorResponse(res, "Failed to reject agency", 500);
  }
};

export const suspendAdminAgency = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid agency ID", 400);
    }

    const agency = await Agency.findByIdAndUpdate(
      id,
      {
        $set: {
          approvalStatus: "suspended",
          rejectionReason: reason || "Agency suspended by administrator"
        }
      },
      { new: true }
    );

    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    return successResponse(res, { agency }, "Agency suspended successfully");
  } catch (error) {
    return errorResponse(res, "Failed to suspend agency", 500);
  }
};
