import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("123456", 10);

  // 1. Dọn dẹp User cũ (Tùy chọn: Mở comment nếu muốn xóa sạch trước khi seed)
   //await prisma.user_roles.deleteMany();
   //await prisma.users.deleteMany();

  // ----- 25 VOLUNTEER -----
  for (let i = 1; i <= 25; i++) {
    const isActive: boolean = i <= 23;
    // Tạo số điện thoại giả định: 0980000001, 0980000002...
    const phone = `098${i.toString().padStart(7, '0')}`;

    await prisma.users.create({
      data: {
        username: `volunteer${i}`,
        email: `volunteer${i}@gmail.com`,
        phone: phone, // Thêm trường phone
        password,
        full_name: `Volunteer ${i}${isActive === false ? " (Banned)" : ""}`,
        is_active: isActive,
        roles: {
          create: {
            role: { connect: { name: "VOLUNTEER" } },
          },
        },
      },
    });
  }

  // ----- 5 EVENT_MANAGER -----
  for (let i = 1; i <= 5; i++) {
    const isActive: boolean = i <= 4;
    // Tạo số điện thoại giả định đầu 091 cho Manager
    const phone = `091${i.toString().padStart(7, '0')}`;

    await prisma.users.create({
      data: {
        username: `manager${i}`,
        email: `manager${i}@gmail.com`,
        phone: phone, // Thêm trường phone
        password,
        full_name: `Event Manager ${i}${isActive === false ? " (Banned)" : ""}`,
        is_active: isActive,
        roles: {
          create: {
            role: { connect: { name: "EVENT_MANAGER" } },
          },
        },
      },
    });
  }


  console.log("✅ Đã seed thành công User có kèm số điện thoại.");
  console.log("- 25 Volunteers (với phone đầu 098)");
  console.log("- 5 Managers (với phone đầu 091)");
  console.log("- 1 Admin (với phone 090)");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());