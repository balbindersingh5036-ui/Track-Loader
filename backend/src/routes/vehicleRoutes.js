import express from "express";

import {
  getVehicleById,
  getVehicles,
  getVehiclesByType
} from "../controllers/vehicleController.js";

const router = express.Router();

router.get("/", getVehicles);
router.get("/type/:vehicleType", getVehiclesByType);
router.get("/:id", getVehicleById);

export default router;
