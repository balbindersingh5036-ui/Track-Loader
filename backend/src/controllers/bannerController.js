import Banner from "../models/Banner.js";

// @desc    Get all active banners (public/mobile)
// @route   GET /api/banners
// @access  Public
export const getActiveBanners = async (req, res) => {
  try {
    const { audience, serviceType } = req.query;

    const query = {
      isActive: true,
      $or: [
        { startDate: { $exists: false } },
        { startDate: null },
        { startDate: { $lte: new Date() } }
      ],
      $and: [
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: null },
            { endDate: { $gte: new Date() } }
          ]
        }
      ]
    };

    if (audience) {
      query.targetAudience = { $in: ["all", audience] };
    }

    if (serviceType) {
      query.serviceType = { $in: ["all", serviceType] };
    }

    const banners = await Banner.find(query).sort({ sortOrder: 1 });

    res.json({
      success: true,
      data: banners
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
      error: error.message
    });
  }
};

// @desc    Get all banners (Admin only)
// @route   GET /api/banners/admin
// @access  Admin
export const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ sortOrder: 1, createdAt: -1 });
    res.json({
      success: true,
      data: banners
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
      error: error.message
    });
  }
};

// @desc    Get banner by ID
// @route   GET /api/banners/:id
// @access  Admin
export const getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }
    res.json({ success: true, data: banner });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch banner",
      error: error.message
    });
  }
};

// @desc    Create banner
// @route   POST /api/banners
// @access  Admin
export const createBanner = async (req, res) => {
  try {
    const banner = await Banner.create(req.body);
    res.status(201).json({
      success: true,
      data: banner
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create banner",
      error: error.message
    });
  }
};

// @desc    Update banner
// @route   PATCH /api/banners/:id
// @access  Admin
export const updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }
    res.json({
      success: true,
      data: banner
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update banner",
      error: error.message
    });
  }
};

// @desc    Delete banner
// @route   DELETE /api/banners/:id
// @access  Admin
export const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }
    res.json({
      success: true,
      message: "Banner deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete banner",
      error: error.message
    });
  }
};
