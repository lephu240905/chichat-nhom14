import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config(); // 🔥 phải có dòng này

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_CONNECTIONSTRING);
    console.log("✅ Liên kết CSDL thành công!");
  } catch (error) {
    console.error("❌ Lỗi khi kết nối CSDL:", error);
    process.exit(1);
  }
};
