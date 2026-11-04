# InMây – In những giấc mơ

Web giới thiệu và nhận đặt hàng sản phẩm in 3D cá nhân hoá. React + Vite, dữ liệu trên Supabase.

## Chạy thử trên máy
```bash
npm install
npm run dev
```
Mặc định kết nối project Supabase `inmay`. Muốn đổi, copy `.env.example` thành `.env` và sửa giá trị.

## Trang
- Khách: `/` · `/san-pham` · `/san-pham/:slug` · `/bo-suu-tap` · `/bo-suu-tap/:slug` · `/dat-rieng`
- Quản trị: `/admin` (đơn hàng, sản phẩm, danh mục, bộ sưu tập, cài đặt)

## Đưa lên Vercel
1. Vào vercel.com → Add New → Project → chọn repo này.
2. Framework: Vite (tự nhận). Bấm Deploy.
3. (Tuỳ chọn) đặt biến `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Phân quyền
- Khách: xem sản phẩm/bộ sưu tập đang hiển thị, gửi đơn.
- Chỉ tài khoản có `profiles.role` là `admin` hoặc `owner` mới sửa được dữ liệu và tải ảnh.
- Tài khoản mới đăng ký mặc định `pending` (không có quyền). Cấp quyền bằng SQL:
  `update public.profiles set role = 'admin' where id = '<user id>';`
- Nên tắt đăng ký công khai: Supabase → Authentication → Sign In / Providers → tắt "Allow new users to sign up".

Lịch sử thay đổi database: thư mục `supabase/migrations`.
