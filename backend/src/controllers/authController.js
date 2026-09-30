import User from "../models/User.js";
import Driver from "../models/Driver.js";

import {
  hashPassword,
  comparePassword
} from "../utils/password.js";

import {
  generateToken
} from "../utils/generateToken.js";
import { getSetting } from "../services/systemSettingService.js";

/* =========================================================
   CUSTOMER REGISTER
========================================================= */

export const register = async (req, res) => {
  try {
    const registrationEnabled = await getSetting("customer.registrationEnabled");
    if (registrationEnabled === false) {
      return res.status(403).json({
        success: false,
        message: "Customer registration is currently unavailable"
      });
    }

    const {
      name,
      phone,
      email,
      password
    } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, phone and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const normalizedPhone = String(phone).replace(/\D/g, "");

    const existingUser = await User.findOne({
      phone: normalizedPhone
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Phone number already registered"
      });
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      name: String(name).trim(),
      phone: normalizedPhone,
      email: email
        ? String(email).trim().toLowerCase()
        : undefined,
      password: hashedPassword,
      role: "customer"
    });

    const token = generateToken({
      userId: user._id.toString(),
      role: user.role
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email || "",
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
};


/* =========================================================
   CUSTOMER LOGIN
========================================================= */

export const login = async (req, res) => {
  try {
    const {
      phone,
      password
    } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone and password are required"
      });
    }

    const normalizedPhone = String(phone).replace(/\D/g, "");

    const user = await User.findOne({
      phone: normalizedPhone
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone or password"
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive"
      });
    }

    if (user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Please use the correct login"
      });
    }

    const passwordMatch = await comparePassword(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone or password"
      });
    }

    user.lastLoginAt = new Date();

    await user.save();

    const token = generateToken({
      userId: user._id.toString(),
      role: user.role
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email || "",
          role: user.role,
          profileImage: user.profileImage || ""
        }
      }
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
};


/* =========================================================
   DRIVER LOGIN
========================================================= */

export const driverLogin = async (req, res) => {
  try {
    const {
      phone,
      password
    } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone and password are required"
      });
    }

    const normalizedPhone = String(phone).replace(/\D/g, "");

    const user = await User.findOne({
      phone: normalizedPhone,
      role: "driver"
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid driver credentials"
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Driver account is inactive"
      });
    }

    const passwordMatch = await comparePassword(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid driver credentials"
      });
    }

    const driver = await Driver.findOne({
      user: user._id
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver profile not found"
      });
    }

    if (driver.approvalStatus === "pending") {
      return res.status(403).json({
        success: false,
        message: "Driver account is pending approval"
      });
    }

    if (driver.approvalStatus === "rejected") {
      return res.status(403).json({
        success: false,
        message: "Driver application has been rejected"
      });
    }

    if (driver.approvalStatus === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Driver account is suspended"
      });
    }

    user.lastLoginAt = new Date();

    await user.save();

    const token = generateToken({
      userId: user._id.toString(),
      role: "driver"
    });

    return res.status(200).json({
      success: true,
      message: "Driver login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email || "",
          role: user.role
        },
        driver: {
          id: driver._id,
          fullName: driver.fullName,
          approvalStatus: driver.approvalStatus,
          isOnline: driver.isOnline,
          rating: driver.rating,
          totalTrips: driver.totalTrips
        }
      }
    });
  } catch (error) {
    console.error("Driver login error:", error);

    return res.status(500).json({
      success: false,
      message: "Driver login failed"
    });
  }
};


/* =========================================================
   ADMIN LOGIN
========================================================= */

export const adminLogin = async (req, res) => {
  try {
    const {
      phone,
      email,
      password
    } = req.body;

    if (!password || (!phone && !email)) {
      return res.status(400).json({
        success: false,
        message: "Phone/email and password are required"
      });
    }

    const query = {
      role: "admin"
    };

    if (phone) {
      query.phone = String(phone).replace(/\D/g, "");
    } else {
      query.email = String(email).trim().toLowerCase();
    }

    const admin = await User.findOne(query).select("+password");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin credentials"
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Admin account is inactive"
      });
    }

    const passwordMatch = await comparePassword(
      password,
      admin.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin credentials"
      });
    }

    admin.lastLoginAt = new Date();

    await admin.save();

    const token = generateToken({
      userId: admin._id.toString(),
      role: "admin"
    });

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      data: {
        token,
        user: {
          id: admin._id,
          name: admin.name,
          phone: admin.phone,
          email: admin.email || "",
          role: admin.role
        }
      }
    });
  } catch (error) {
    console.error("Admin login error:", error);

    return res.status(500).json({
      success: false,
      message: "Admin login failed"
    });
  }
};


/* =========================================================
   CURRENT USER
========================================================= */

export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "User fetched successfully",
    data: {
      user: req.user
    }
  });
};