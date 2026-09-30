import express from "express";
import { successResponse } from "../utils/response.js";

const router = express.Router();

router.get("/", (req, res) => {
  return successResponse(
    res,
    {
      service: "LoadBalbin Backend",
      status: "healthy",
      timestamp: new Date().toISOString()
    },
    "Backend is running"
  );
});

export default router;