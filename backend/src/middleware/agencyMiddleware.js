export const agencyOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  if (req.user.role !== "agency") {
    return res.status(403).json({
      success: false,
      message: "Agency access required"
    });
  }

  next();
};
