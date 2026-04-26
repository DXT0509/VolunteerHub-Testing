import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Dọn dẹp registrations cũ (đúng thứ tự FK để không lỗi database)
  await prisma.registration_status_history.deleteMany();
  await prisma.registrations.deleteMany();

  // 2. Lấy tất cả event hợp lệ (Sắp xếp theo ID để máy nào cũng ra thứ tự giống nhau)
  const events = await prisma.events.findMany({
    where: {
      status: "active", // Đảm bảo ở file seed event bạn đã để status là active
      // Bỏ start_time: { gt: new Date() } để tránh việc dữ liệu biến mất khi thời gian trôi qua
    },
    orderBy: { id: 'asc' }
  });

  if (events.length === 0) {
    console.log("⚠️ Cảnh báo: Không có event ACTIVE nào. Hãy chạy file seed Event trước!");
    return;
  }

  // 3. Lấy danh sách volunteer (Sắp xếp theo ID cố định)
  const volunteers = await prisma.users.findMany({
    where: {
      roles: { some: { role: { name: "VOLUNTEER" } } },
    },
    orderBy: { id: 'asc' }
  });

  if (volunteers.length === 0) {
    throw new Error("Không có VOLUNTEER nào trong hệ thống");
  }

  // 4. Seed dữ liệu cố định
  // Quy luật: Mỗi event sẽ lấy 5 người đầu tiên trong danh sách volunteers (nếu đủ 5 người)
  const NUM_REGS_PER_EVENT = 5;

  for (const event of events) {
    // Lấy tối đa 5 người đầu tiên để đăng ký
    const picked = volunteers.slice(0, Math.min(volunteers.length, NUM_REGS_PER_EVENT));

    for (const user of picked) {
      const reg = await prisma.registrations.create({
        data: {
          user_id: user.id,
          event_id: event.id,
          status: "pending",
        },
      });

      await prisma.registration_status_history.create({
        data: {
          registration_id: reg.id,
          new_status: "pending",
          changed_by: user.id,
        },
      });
    }
  }

  console.log(`✅ Đã seed cố định ${NUM_REGS_PER_EVENT} registrations cho mỗi event.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());