import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// Lấy đường dẫn thư mục hiện tại
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load biến môi trường từ thư mục backend (2 cấp trên thư mục libs)
dotenv.config({ path: path.join(__dirname, "../../.env") });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Sử dụng HTTPS
  timeout: 60000, // Tăng timeout lên 60 giây
});

// Debug log để kiểm tra (có thể bỏ sau khi fix xong)
if (!process.env.CLOUDINARY_API_KEY) {
  console.error("⚠️ CLOUDINARY_API_KEY không được tìm thấy trong biến môi trường!");
  console.error("📁 Đường dẫn .env:", path.join(__dirname, "../../.env"));
  console.error("🔍 Kiểm tra file .env có tồn tại và chứa CLOUDINARY_API_KEY không");
} else {
  console.log("✅ Cloudinary đã được cấu hình thành công");
}

export default cloudinary;
