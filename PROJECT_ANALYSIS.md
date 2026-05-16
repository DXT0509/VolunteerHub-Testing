# VolunteerHub - Phan tich luong hoat dong va cong nghe

## 1) Tong quan he thong
Du an gom 2 phan:
- Backend (Node.js + Express + TypeScript) quan ly API, xac thuc, du lieu, thong bao, tai file. Xem [src/app.ts](src/app.ts), [src/server.ts](src/server.ts), [package.json](package.json).
- Frontend (React + Vite) trong thu muc client-side, quan ly giao dien, router, i18n, va goi API. Xem [client-side/src/main.jsx](client-side/src/main.jsx), [client-side/src/assets/Routes/Routes.jsx](client-side/src/assets/Routes/Routes.jsx), [client-side/package.json](client-side/package.json).

## 2) Cong nghe su dung
### Backend
- Runtime va framework: Node.js, Express, TypeScript. Xem [package.json](package.json), [src/app.ts](src/app.ts).
- ORM va DB: Prisma ORM + MySQL. Xem [prisma/schema.prisma](prisma/schema.prisma).
- Bao mat: JWT (1h), bcryptjs. Xem [src/utils/jwt.ts](src/utils/jwt.ts), [src/modules/auth/auth.service.ts](src/modules/auth/auth.service.ts).
- Upload file: multer (luu vao /uploads, serve static). Xem [src/app.ts](src/app.ts), [src/modules/users/user.routes.ts](src/modules/users/user.routes.ts), [src/modules/events/event.routes.ts](src/modules/events/event.routes.ts).
- Thong bao: web-push + luu DB. Xem [src/modules/notifications/notification.service.ts](src/modules/notifications/notification.service.ts).
- Xuat du lieu: json2csv. Xem [src/modules/admin/admin.service.ts](src/modules/admin/admin.service.ts).

### Frontend
- React 18 + React Router. Xem [client-side/package.json](client-side/package.json), [client-side/src/assets/Routes/Routes.jsx](client-side/src/assets/Routes/Routes.jsx).
- Vite (rolldown-vite). Xem [client-side/package.json](client-side/package.json), [client-side/vite.config.js](client-side/vite.config.js).
- UI libs: MUI, Ionic, Tailwind, AOS animations. Xem [client-side/package.json](client-side/package.json), [client-side/src/main.jsx](client-side/src/main.jsx).
- i18n: i18next + react-i18next. Xem [client-side/src/i18n.ts](client-side/src/i18n.ts).

### Testing
- Playwright UI tests. Xem [playwright.config.ts](playwright.config.ts), [tests/home.spec.ts](tests/home.spec.ts).

## 3) Cau truc thu muc (rut gon)
- Backend:
  - src/app.ts: khai bao middleware, routes, static uploads.
  - src/server.ts: khoi dong server.
  - src/modules/*: tung module domain (auth, users, events, registrations, channels, notifications, dashboard, admin, categories).
  - prisma/schema.prisma: so do du lieu.
- Frontend:
  - client-side/src/main.jsx: entry, RouterProvider, AOS init.
  - client-side/src/assets/Routes/Routes.jsx: danh sach route.
  - client-side/src/assets/Pages/*: cac trang giao dien.

## 4) Luong hoat dong chinh (Backend)
### 4.1 Khoi dong va middleware
- Server load dotenv, cors, json body, va static /uploads. Xem [src/app.ts](src/app.ts), [src/server.ts](src/server.ts).
- Auth middleware doc Bearer token va gan req.user. Xem [src/middlewares/auth.middleware.ts](src/middlewares/auth.middleware.ts).
- Role middleware kiem tra role. Xem [src/middlewares/role.middleware.ts](src/middlewares/role.middleware.ts).

### 4.2 Auth
- Dang ky: tao user + role, hash password, tra ve JWT. Xem [src/modules/auth/auth.controller.ts](src/modules/auth/auth.controller.ts), [src/modules/auth/auth.service.ts](src/modules/auth/auth.service.ts).
- Dang nhap: verify password, tra ve JWT va user. Xem [src/modules/auth/auth.service.ts](src/modules/auth/auth.service.ts).
- Lay profile: /auth/me lay thong tin user. Xem [src/modules/auth/auth.controller.ts](src/modules/auth/auth.controller.ts).

### 4.3 Quan ly su kien (Event)
- Tao su kien: chi EVENT_MANAGER, tao location, slug, trang thai pending. Xem [src/modules/events/event.routes.ts](src/modules/events/event.routes.ts), [src/modules/events/event.service.ts](src/modules/events/event.service.ts).
- Duyet su kien: ADMIN approve/reject -> active/rejected. Xem [src/modules/admin/admin.service.ts](src/modules/admin/admin.service.ts).
- Cap nhat su kien: validate thoi gian, cap nhat location, banner. Xem [src/modules/events/event.service.ts](src/modules/events/event.service.ts).
- Ket thuc su kien: finalize -> completed/canceled. Xem [src/modules/events/event.service.ts](src/modules/events/event.service.ts).
- Xoa su kien: don du lieu lien quan (registrations, posts, likes...). Xem [src/modules/events/event.service.ts](src/modules/events/event.service.ts).

### 4.4 Dang ky tham gia (Registrations)
- Tinh nguyen vien dang ky: tao/restore registration (pending), ghi lich su. Xem [src/modules/registrations/registration.service.ts](src/modules/registrations/registration.service.ts).
- Huy dang ky: cap nhat status cancelled, tra lai capacity neu da approved. Xem [src/modules/registrations/registration.service.ts](src/modules/registrations/registration.service.ts).
- Manager duyet: approved/rejected, cap nhat attendance va thong bao. Xem [src/modules/registrations/registration.service.ts](src/modules/registrations/registration.service.ts).
- Check-in/out: cap nhat attendance status. Xem [src/modules/registrations/registration.service.ts](src/modules/registrations/registration.service.ts).
- Finalize tham gia: completed/absented + thong bao. Xem [src/modules/registrations/registration.service.ts](src/modules/registrations/registration.service.ts).

### 4.5 Kenh trao doi (Channels)
- Chi user duoc duyet/manager/admin moi vao duoc kenh. Xem [src/modules/channels/channel.service.ts](src/modules/channels/channel.service.ts).
- Post/Comment co the kem attachments, auto notify thanh vien. Xem [src/modules/channels/channel.controller.ts](src/modules/channels/channel.controller.ts), [src/modules/channels/channel.service.ts](src/modules/channels/channel.service.ts).
- Like toggle tren post/comment va cap nhat thong ke. Xem [src/modules/channels/channel.service.ts](src/modules/channels/channel.service.ts).

### 4.6 Thong bao
- Luu DB + gui web push (neu co subscription). Xem [src/modules/notifications/notification.service.ts](src/modules/notifications/notification.service.ts).
- Subscribe/Unsubscribe push. Xem [src/modules/notifications/notification.controller.ts](src/modules/notifications/notification.controller.ts).

### 4.7 Dashboard
- Dashboard theo role (volunteer/manager/admin). Xem [src/modules/dashboard/dashboard.service.ts](src/modules/dashboard/dashboard.service.ts).

### 4.8 Admin
- Quan ly user (lock/unlock, change role) va export data. Xem [src/modules/admin/admin.controller.ts](src/modules/admin/admin.controller.ts), [src/modules/admin/admin.service.ts](src/modules/admin/admin.service.ts).

## 5) Luong hoat dong chinh (Frontend)
### 5.1 Router va layout
- Router tao tu createBrowserRouter, gom cac trang chinh. Xem [client-side/src/assets/Routes/Routes.jsx](client-side/src/assets/Routes/Routes.jsx).
- MainLayout bao gom Navbar + Footer + Outlet. Xem [client-side/src/assets/Layouts/MainLayout.jsx](client-side/src/assets/Layouts/MainLayout.jsx).

### 5.2 Dang nhap/Dang ky
- Login/Register goi API /auth/login va /auth/register, luu token va user vao localStorage. Xem [client-side/src/assets/Pages/Login.jsx](client-side/src/assets/Pages/Login.jsx), [client-side/src/assets/Pages/Register.jsx](client-side/src/assets/Pages/Register.jsx).
- JWT het han duoc kiem tra o client, neu het han se clear va redirect. Xem [client-side/src/assets/utils/auth.js](client-side/src/assets/utils/auth.js).

### 5.3 Trang su kien va quan ly
- Chi tiet su kien load /events/:id, cho phep dang ky/huy theo trang thai. Xem [client-side/src/assets/Pages/ShowCampaignDetail.jsx](client-side/src/assets/Pages/ShowCampaignDetail.jsx).
- Quan ly su kien cua manager: tao/lenh sua/xoa, chon category va location. Xem [client-side/src/assets/Pages/ManageMyCampaign.jsx](client-side/src/assets/Pages/ManageMyCampaign.jsx).

### 5.4 Thong bao va navbar
- Navbar poll /notifications/my va danh dau da doc. Xem [client-side/src/assets/Components/Navbar/Navbar.jsx](client-side/src/assets/Components/Navbar/Navbar.jsx).

## 6) So do du lieu (rut gon)
Du lieu chinh gom:
- Users, roles, user_roles, sessions. Xem [prisma/schema.prisma](prisma/schema.prisma).
- Events, categories, locations, event_approvals.
- Registrations, registration_status_history, event_attendance.
- Channels: event_channels, posts, comments, likes, attachments.
- Notifications, push_subscriptions.
- Activity log: activity_log.

## 7) Bien moi truong quan trong
- Backend: DATABASE_URL, JWT_SECRET, PORT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY. Xem [README.md](README.md), [src/modules/notifications/notification.service.ts](src/modules/notifications/notification.service.ts).
- Frontend: VITE_API_URL, VITE_NOTIFICATIONS_URL (neu co). Xem [client-side/src/assets/Components/Navbar/Navbar.jsx](client-side/src/assets/Components/Navbar/Navbar.jsx).

## 8) Ghi chu rui ro/luu y
- Token JWT het han sau 1h, client co logic kiem tra het han. Xem [src/utils/jwt.ts](src/utils/jwt.ts), [client-side/src/assets/utils/auth.js](client-side/src/assets/utils/auth.js).
- Upload file luu vao /uploads trong backend, can dam bao volume neu deploy. Xem [src/app.ts](src/app.ts).
- Cac role can dung: VOLUNTEER, EVENT_MANAGER, ADMIN. Xem [src/middlewares/role.middleware.ts](src/middlewares/role.middleware.ts), [src/modules/auth/auth.service.ts](src/modules/auth/auth.service.ts).
