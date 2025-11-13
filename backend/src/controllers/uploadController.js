import cloudinary from "../libs/cloudinary.js";
import fs from "fs";

// Upload ảnh
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file được upload" });
    }

    console.log("📤 Đang upload ảnh lên Cloudinary:", req.file.originalname);

    // Upload file tạm thời từ multer lên Cloudinary với các options tối ưu
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "chat_app/images",
      resource_type: "image",
      timeout: 60000, // 60 giây timeout
      chunk_size: 6000000, // 6MB chunks để tránh timeout
      transformation: [
        { quality: "auto", fetch_format: "auto" } // Tự động tối ưu chất lượng và format
      ]
    });

    // Xóa file tạm sau khi upload thành công
    fs.unlinkSync(req.file.path);

    console.log("✅ Upload ảnh thành công:", result.secure_url);

    return res.status(200).json({
      message: "✅ Upload ảnh thành công",
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error("❌ Lỗi upload ảnh:", error);
    
    // Xóa file tạm nếu có lỗi
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Trả về thông báo lỗi chi tiết hơn
    const errorMessage = error.message || "Lỗi upload ảnh";
    res.status(500).json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === "development" ? error.toString() : undefined
    });
  }
};

