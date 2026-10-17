import mongoose from "mongoose";
import Agency from "../models/Agency.js";
import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";

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
      Driver.find({ agency: agency._id }).populate("user", "name phone email"),
      Vehicle.find({ agency: agency._id }).populate("driver", "fullName phone")
    ]);

    const agencyObj = agency.toObject();
    const { generateSignedDocumentUrl, extractCloudinaryAssetInfo } = await import("../utils/documentSigner.js");

    // Augment agency KYC docs with signed delivery URLs
    if (agencyObj.documents) {
      for (const [key, doc] of Object.entries(agencyObj.documents)) {
        if (doc && (doc.publicId || doc.url)) {
          let pubId = doc.publicId;
          let fmt = doc.format || "pdf";
          let resType = doc.resourceType || "image";
          if (!pubId && doc.url) {
            const ext = extractCloudinaryAssetInfo(doc.url);
            if (ext) { pubId = ext.publicId; fmt = ext.format; }
          }
          if (pubId) {
            agencyObj.documents[key].viewUrl = generateSignedDocumentUrl(pubId, fmt, 300, resType);
          } else {
            agencyObj.documents[key].viewUrl = doc.url;
          }
        }
      }
    }

    // Augment driver KYC docs with signed delivery URLs
    const enhancedDrivers = drivers.map((d) => {
      const dObj = d.toObject();
      if (dObj.documents) {
        for (const [key, doc] of Object.entries(dObj.documents)) {
          if (doc && (doc.publicId || doc.url)) {
            let pubId = doc.publicId;
            let fmt = doc.format || "pdf";
            let resType = doc.resourceType || "image";
            if (!pubId && doc.url) {
              const ext = extractCloudinaryAssetInfo(doc.url);
              if (ext) { pubId = ext.publicId; fmt = ext.format; }
            }
            if (pubId) {
              dObj.documents[key].viewUrl = generateSignedDocumentUrl(pubId, fmt, 300, resType);
            } else {
              dObj.documents[key].viewUrl = doc.url;
            }
          }
        }
      }
      return dObj;
    });

    return successResponse(res, { agency: agencyObj, drivers: enhancedDrivers, vehicles }, "Agency details fetched");
  } catch (error) {
    console.error("getAdminAgencyById error:", error);
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
