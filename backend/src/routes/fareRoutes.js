import express from "express";
import { getFares, getFareByVehicleType, getFareQuotes } from "../controllers/fareController.js";

const router = express.Router();

router.get("/quotes", getFareQuotes);
router.post("/quotes", getFareQuotes);
router.get("/", getFares);
router.get("/:vehicleType", getFareByVehicleType);

export default router;
