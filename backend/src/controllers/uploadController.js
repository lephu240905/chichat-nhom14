import cloudinary from "../libs/cloudinary.js";
import fs from "fs";
import { promises as fsPromises } from "fs";

// Upload ảnh với retry logic
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file được upload" });
    }

    console.log("📤 Đang upload ảnh lên Cloudinary:", req.file.originalname);
    console.log("📂 File path:", req.file.path);
    console.log("📏 File size:", req.file.size, "bytes");

    // Retry logic với exponential backoff
    let result;
    let retries = 3;
    let lastError;

    for (let i = 0; i < retries; i++) {
      try {
        console.log(`🔄 Thử upload lần ${i + 1}/${retries}...`);
        
        // Upload file tạm thời từ multer lên Cloudinary với các options tối ưu
        result = await cloudinary.uploader.upload(req.file.path, {
          folder: "chat_app/images",
          resource_type: "image",
          timeout: 120000, // 120 giây timeout
          chunk_size: 6000000, // 6MB chunks để tránh timeout
          transformation: [
            { quality: "auto", fetch_format: "auto" } // Tự động tối ưu chất lượng và format
          ]
        });
        
        // Nếu thành công, break khỏi loop
        break;
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ Upload lần ${i + 1} thất bại:`, err.message);
        
        // Nếu còn retry, đợi trước khi thử lại
        if (i < retries - 1) {
          const waitTime = Math.pow(2, i) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`⏳ Đợi ${waitTime / 1000}s trước khi thử lại...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // Nếu sau tất cả retries vẫn thất bại
    if (!result) {
      throw lastError || new Error("Upload thất bại sau nhiều lần thử");
    }

    // Xóa file tạm sau khi upload thành công
    try {
      await fsPromises.unlink(req.file.path);
    } catch (unlinkError) {
      console.warn("⚠️ Không thể xóa file tạm:", unlinkError.message);
    }

    console.log("✅ Upload ảnh thành công:", result.secure_url);

    return res.status(200).json({
      message: "✅ Upload ảnh thành công",
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error("❌ Lỗi upload ảnh:", error);
    console.error("❌ Stack trace:", error.stack);

    // Xóa file tạm nếu có lỗi
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        await fsPromises.unlink(req.file.path);
      } catch (unlinkError) {
        console.warn("⚠️ Không thể xóa file tạm:", unlinkError.message);
      }
    }

    // Trả về thông báo lỗi chi tiết hơn
    const errorMessage = error.message || "Lỗi upload ảnh";
    res.status(500).json({
      message: errorMessage,
      error: process.env.NODE_ENV === "development" ? error.toString() : undefined
    });
  }
};
