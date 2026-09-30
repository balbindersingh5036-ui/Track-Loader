import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import {
  getAdminSettings,
  getSingleSetting,
  createOrUpdateSetting,
  updateSettingStatus,
  deleteSetting
} from "../controllers/systemSettingController.js";

const router = express.Router();

router.use(protect, adminOnly);

router.route("/")
  .get(getAdminSettings)
  .post(createOrUpdateSetting);

router.route("/:key")
  .get(getSingleSetting)
  .put(createOrUpdateSetting)
  .delete(deleteSetting);

router.patch("/:key/status", updateSettingStatus);

export default router;
