import {
  isDesignatedSuperAdmin,
  isSuperAdminConfigured
} from "../utils/superAdmin.js";

export const superAdminOnly = (req, res, next) => {
  if (!isSuperAdminConfigured()) {
    return res.status(503).json({
      success: false,
      message: "Super Admin document review is not configured"
    });
  }

  if (!isDesignatedSuperAdmin(req.user)) {
    return res.status(403).json({
      success: false,
      message: "Only the designated Super Admin may review documents"
    });
  }

  next();
};
