import { cn } from "@/lib/utils";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/stores/useAuthStore";
import { useNavigate } from "react-router";
import { User, Mail, Lock, Zap, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

const signUpSchema = z.object({
  firstName: z.string().min(1, "Tên bắt buộc phải có"),
  lastName: z.string().min(1, "Họ bắt buộc phải có"),
  username: z.string().min(3, "Tên đăng nhập phải có ít nhất 3 ký tự"),
  email: z.email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { signUp } = useAuthStore();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: SignUpFormValues) => {
    setApiError("");
    const { firstName, lastName, username, email, password } = data;

    try {
      await signUp(username, password, email, firstName, lastName);
      navigate("/signin");
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        "Đăng ký không thành công. Vui lòng thử lại.";
      setApiError(errorMsg);
    }
  };

  return (
    <div className={cn("w-full max-w-6xl", className)} {...props}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
        {/* Form Section */}
        <div className="flex flex-col justify-center order-2 lg:order-1">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-8 md:p-12 transform transition-all duration-300 hover:shadow-3xl">
            {/* Header */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-600 via-pink-600 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/50 transform transition-transform duration-300 hover:scale-110 hover:rotate-6">
                  <Zap className="w-7 h-7 text-white" fill="white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Chitchat
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Chat App
                  </p>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Tạo tài khoản mới
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Bắt đầu hành trình của bạn ngay hôm nay
                </p>
              </div>
            </div>

            {/* API Error Message */}
            {apiError && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 shadow-lg">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 dark:text-red-300 font-semibold">
                    Lỗi đăng ký
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{apiError}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Username */}
              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  Tên đăng nhập
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-600 transition-colors duration-200" />
                  <input
                    id="username"
                    type="text"
                    placeholder="Nhập tên đăng nhập của bạn"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 dark:focus:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                    {...register("username")}
                  />
                </div>
                {errors.username && (
                  <p className="text-red-500 dark:text-red-400 text-sm mt-1.5 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-500"></span>
                    {errors.username.message}
                  </p>
                )}
              </div>

              {/* Họ & Tên */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Họ
                  </label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-600 transition-colors duration-200" />
                    <input
                      id="lastName"
                      type="text"
                      placeholder="Nguyễn"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 dark:focus:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                      {...register("lastName")}
                    />
                  </div>
                  {errors.lastName && (
                    <p className="text-red-500 dark:text-red-400 text-sm mt-1.5 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-red-500"></span>
                      {errors.lastName.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Tên
                  </label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-600 transition-colors duration-200" />
                    <input
                      id="firstName"
                      type="text"
                      placeholder="Văn A"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 dark:focus:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                      {...register("firstName")}
                    />
                  </div>
                  {errors.firstName && (
                    <p className="text-red-500 dark:text-red-400 text-sm mt-1.5 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-red-500"></span>
                      {errors.firstName.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-600 transition-colors duration-200" />
                  <input
                    id="email"
                    type="email"
                    placeholder="Nhập email của bạn"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 dark:focus:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-red-500 dark:text-red-400 text-sm mt-1.5 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-500"></span>
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  Mật khẩu
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-600 transition-colors duration-200" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu của bạn"
                    className="w-full pl-12 pr-12 py-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 dark:focus:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 dark:text-red-400 text-sm mt-1.5 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-500"></span>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-700 hover:via-pink-700 hover:to-rose-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Đang xử lý...
                    </>
                  ) : (
                    "Tạo tài khoản"
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-center text-gray-600 dark:text-gray-400 text-sm">
                Đã có tài khoản?{" "}
                <a
                  href="/signin"
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold transition-colors duration-200 inline-flex items-center gap-1 group"
                >
                  Đăng nhập
                  <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Illustration Section */}
        <div className="hidden lg:flex items-center justify-center order-1 lg:order-2">
          <div className="relative w-full h-full min-h-[500px] flex items-center justify-center">
            {/* Animated Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/30 via-pink-400/30 to-blue-400/30 rounded-3xl blur-3xl animate-pulse"></div>

            {/* Floating Elements */}
            <div className="absolute top-10 left-10 w-20 h-20 bg-purple-400/20 rounded-full blur-xl animate-float"></div>
            <div className="absolute bottom-20 right-10 w-32 h-32 bg-pink-400/20 rounded-full blur-xl animate-float-delayed"></div>

            {/* Main Illustration */}
            <div className="relative flex items-center justify-center h-full transform transition-transform duration-500 hover:scale-105">
              <div className="relative">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-2xl scale-150 animate-pulse"></div>

                <svg
                  viewBox="0 0 400 500"
                  className="w-full h-full max-w-md drop-shadow-2xl relative z-10"
                >
                  {/* Animated Background Circle */}
                  <circle
                    cx="200"
                    cy="250"
                    r="180"
                    fill="url(#gradient1)"
                    opacity="0.1"
                    className="animate-pulse"
                  />

                  {/* Device/Phone */}
                  <g className="transform transition-transform duration-300 hover:scale-105">
                    <rect
                      x="80"
                      y="60"
                      width="240"
                      height="380"
                      rx="30"
                      fill="url(#gradient2)"
                      opacity="0.95"
                    />
                    <rect
                      x="95"
                      y="80"
                      width="210"
                      height="340"
                      rx="20"
                      fill="#FFE5EB"
                    />

                    {/* Screen Content */}
                    <rect
                      x="110"
                      y="100"
                      width="180"
                      height="12"
                      rx="6"
                      fill="#8B5CF6"
                      opacity="0.7"
                      className="animate-pulse"
                    />
                    <rect
                      x="110"
                      y="125"
                      width="150"
                      height="12"
                      rx="6"
                      fill="#8B5CF6"
                      opacity="0.5"
                    />
                    <rect
                      x="110"
                      y="150"
                      width="170"
                      height="12"
                      rx="6"
                      fill="#8B5CF6"
                      opacity="0.5"
                    />

                    {/* Chat Bubbles */}
                    <ellipse
                      cx="180"
                      cy="220"
                      rx="60"
                      ry="40"
                      fill="#8B5CF6"
                      opacity="0.6"
                      className="animate-bounce"
                      style={{ animationDuration: '2s' }}
                    />
                    <ellipse
                      cx="220"
                      cy="280"
                      rx="50"
                      ry="35"
                      fill="#EC4899"
                      opacity="0.6"
                      className="animate-bounce"
                      style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}
                    />
                  </g>

                  {/* Floating Icons */}
                  <g className="animate-float">
                    <circle cx="320" cy="150" r="25" fill="#8B5CF6" opacity="0.8">
                      <animate attributeName="cy" values="150;140;150" dur="3s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="320" cy="150" r="15" fill="white" />
                  </g>

                  <g className="animate-float-delayed">
                    <circle cx="80" cy="350" r="20" fill="#EC4899" opacity="0.8">
                      <animate attributeName="cy" values="350;340;350" dur="3.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="80" cy="350" r="12" fill="white" />
                  </g>

                  {/* Gradients */}
                  <defs>
                    <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8B5CF6" />
                      <stop offset="50%" stopColor="#EC4899" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                    <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FE4A7D" />
                      <stop offset="100%" stopColor="#FF6B9D" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terms */}
      <div className="text-xs text-balance px-6 text-center text-gray-500 dark:text-gray-400 mt-8">
        Bằng cách tiếp tục, bạn đồng ý với{" "}
        <a href="#" className="underline hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200">
          Điều khoản dịch vụ
        </a>{" "}
        và{" "}
        <a href="#" className="underline hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200">
          Chính sách bảo mật
        </a>{" "}
        của chúng tôi.
      </div>
    </div>
  );
}
