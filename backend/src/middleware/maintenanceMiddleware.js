import { getSetting } from "../services/systemSettingService.js";

export const checkMaintenanceMode = async (req, res, next) => {
  try {
    // Check if maintenance mode is enabled
    const isMaintenance = await getSetting("system.maintenanceMode");
    
    if (isMaintenance) {
      // Exclude admin routes, health, and admin login
      if (
        req.originalUrl.includes("/api/admin") || 
        req.originalUrl.includes("/api/health") || 
        (req.originalUrl.includes("/api/auth") && req.body && req.body.email && req.body.password) // Allow logins to go through, auth guards itself
      ) {
        return next();
      }
      
      return res.status(503).json({
        success: false,
        message: "System is currently under maintenance"
      });
    }
    
    next();
  } catch (error) {
    next();
  }
};
