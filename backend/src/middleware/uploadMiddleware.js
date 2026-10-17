import multer from "multer";

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf"
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    const error = new Error("Invalid file type. Only JPEG, PNG, WebP, GIF, and PDF files are allowed.");
    error.code = "INVALID_FILE_TYPE";
    cb(error, false);
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB limit
  },
  fileFilter
});

export const handleUploadSingle = (fieldName = "image") => {
  const single = upload.single(fieldName);
  return (req, res, next) => {
    single(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
              success: false,
              message: "File size exceeds the maximum limit of 5MB"
            });
          }
          if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
              success: false,
              message: `Unexpected field '${err.field}'. Expected '${fieldName}'`
            });
          }
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }
        if (err.code === "INVALID_FILE_TYPE" || err.message?.includes("Invalid file type")) {
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || "Failed to process image file"
        });
      }
      next();
    });
  };
};

export default upload;
