import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { handleUploadSingle } from "../middleware/uploadMiddleware.js";
import { uploadImage } from "../controllers/uploadController.js";

const router = express.Router();

router.post("/image", protect, handleUploadSingle("image"), uploadImage);

export default router;
