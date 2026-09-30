import mongoose from "mongoose";
import User from "../models/User.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";

const customerFields = "name phone email profileImage role isActive createdAt lastLoginAt";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const safeCustomer = (customer) => ({
  id: customer._id,
  name: customer.name,
  phone: customer.phone,
  email: customer.email || "",
  profileImage: customer.profileImage || "",
  role: customer.role,
  isActive: customer.isActive,
  createdAt: customer.createdAt,
  lastLoginAt: customer.lastLoginAt
});

export const getAdminCustomers = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const query = { role: "customer" };
    if (req.query.isActive !== undefined) {
      if (!["true", "false"].includes(req.query.isActive)) {
        return errorResponse(res, "isActive must be true or false", 400);
      }
      query.isActive = req.query.isActive === "true";
    }
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const search = new RegExp(escapeRegex(req.query.search.trim()), "i");
      query.$or = [{ name: search }, { phone: search }, { email: search }];
    }

    const [customers, total] = await Promise.all([
      User.find(query).select(customerFields).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      User.countDocuments(query)
    ]);

    return successResponse(res, {
      customers: customers.map(safeCustomer),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    }, "Customers fetched");
  } catch (error) {
    console.error("Admin customer list error:", error);
    return errorResponse(res, "Failed to fetch customers", 500);
  }
};

export const getAdminCustomerById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return errorResponse(res, "Invalid customer ID", 400);
    }
    const customer = await User.findOne({ _id: req.params.id, role: "customer" })
      .select(customerFields)
      .lean();
    if (!customer) return errorResponse(res, "Customer not found", 404);
    return successResponse(res, { customer: safeCustomer(customer) }, "Customer fetched");
  } catch (error) {
    console.error("Admin customer detail error:", error);
    return errorResponse(res, "Failed to fetch customer", 500);
  }
};

export const updateAdminCustomerStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return errorResponse(res, "Invalid customer ID", 400);
    }
    if (typeof req.body?.isActive !== "boolean" || Object.keys(req.body).some((key) => key !== "isActive")) {
      return errorResponse(res, "Only a boolean isActive value may be updated", 400);
    }

    const customer = await User.findOneAndUpdate(
      { _id: req.params.id, role: "customer" },
      { $set: { isActive: req.body.isActive } },
      { new: true, runValidators: true }
    ).select(customerFields);
    if (!customer) return errorResponse(res, "Customer not found", 404);
    return successResponse(res, { customer: safeCustomer(customer) }, "Customer status updated");
  } catch (error) {
    console.error("Admin customer status update error:", error);
    return errorResponse(res, "Failed to update customer status", 500);
  }
};
