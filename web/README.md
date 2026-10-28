# Mây — bản web HTML

Chạy trong thư mục này (chỉ cần Node.js, không cần cài thư viện):

```bash
npm start
```

- Một điện thoại: http://localhost:4173/
- Hai điện thoại cạnh nhau: http://localhost:4173/dual.html

Đăng nhập hai tài khoản khác nhau trong hai khung, mở Danh bạ rồi chọn đối phương. Chat dùng Firebase thật và liên thông với app React Native. Mỗi khung giữ phiên đăng nhập riêng. Có thể tự đăng ký tài khoản ngay trên web.

Chạy qua HTTP local như trên, không mở index.html bằng cách nhấp đúp. Nút vị trí xin quyền trình duyệt; tọa độ lấy từ máy tính và mở bằng Google Maps. Máy cần Internet để kết nối Firebase và tải SDK.

Cấu hình Firebase client: `services/firebase-config.json`. Đây là cấu hình Web công khai; không đặt khóa service account hoặc mật khẩu vào đây.

Kiểm tra: `npm test`.
