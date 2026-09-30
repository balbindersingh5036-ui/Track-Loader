export const driverOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  if (req.user.role !== "driver") {
    return res.status(403).json({
      success: false,
      message: "Driver access required"
    });
  }

  next();
};