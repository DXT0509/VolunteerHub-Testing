# VolunteerHub Backend

VolunteerHub là hệ thống quản lý và tổ chức hoạt động tình nguyện, phát triển bằng **Node.js + TypeScript + Express + Prisma + MySQL**.

---

## 🚀 Công nghệ

- Node.js / Express / TypeScript
- Prisma ORM (MySQL)
- JWT Authentication
- Bcrypt password hashing
- Modular architecture

---

## ⚙️ Cài đặt

### 1️⃣ Clone repo

```bash
git clone https://github.com/<your-username>/volunteerhub-backend.git
cd volunteerhub-backend
```

npm install
cp .env.example .env

Cập nhật các giá trị trong .env:

DATABASE_URL="mysql://root:@localhost:3306/volunteerhub"
JWT_SECRET="volunteerhub_secret"
PORT=4000

Tạo database & migrate
npx prisma migrate dev --name init

Seed dữ liệu (tạo roles mặc định)
npx ts-node prisma/seed.ts

Chạy server
npm run dev

Server chạy tại:
👉 http://localhost:4000
