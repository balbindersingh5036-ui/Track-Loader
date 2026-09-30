import express from "express";
import { getFares, getFareByVehicleType } from "../controllers/fareController.js";

const router = express.Router();

router.get("/", getFares);
router.get("/:vehicleType", getFareByVehicleType);

export default router;
