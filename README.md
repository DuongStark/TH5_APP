# Mây — Bài thực hành 5

Ứng dụng chat 1-1 bằng React Native CLI, React Navigation và Firebase JS SDK.

## Chạy Android

Cần Node.js 24 LTS, JDK và Android SDK. Kết nối thiết bị hoặc mở máy ảo trước.

```bash
npm ci --ignore-scripts
npm start
```

Trong terminal khác:

```bash
npm run android
```

Ứng dụng đã cấu hình Firebase cloud trong `src/services/firebase.config.json`. Đăng ký hai tài khoản khác nhau trên hai thiết bị để chat. Luật Realtime Database nằm trong `database.rules.json`.

## Kiểm tra

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npm run test:firebase
```

Lệnh cuối dùng Firebase Emulator độc lập với cloud, không cần đăng nhập Google. Không chạy cùng lúc với tiến trình Emulator khác dùng cổng 9000/9099.

## Bản web nhẹ, không cần máy ảo

```bash
npm run web
```

Mở http://localhost:4173/dual.html để dùng hai khung điện thoại với hai tài khoản Firebase riêng. Mã HTML/CSS/JavaScript nằm trong `web/`. Có thể chạy riêng thư mục web bằng `npm start`, không cần cài dependency.
