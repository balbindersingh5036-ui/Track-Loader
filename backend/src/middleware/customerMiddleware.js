import { errorResponse } from "../utils/response.js";

export const customerOnly = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, "Authentication required", 401);
  }

  if (req.user.role !== "customer") {
    return errorResponse(res, "Customer access required", 403);
  }

  return next();
};
