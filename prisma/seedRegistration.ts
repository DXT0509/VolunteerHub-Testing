import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Dọn dẹp data cũ
  await prisma.registration_status_history.deleteMany();
  await prisma.registrations.deleteMany();

  // 2. CHỈ LẤY CÁC EVENT ACTIVE (Mới được phép có registration)
  const activeEvents = await prisma.events.findMany({
    where: { status: "active" },
    orderBy: { id: 'asc' }
  });

  // 3. Lấy danh sách Volunteer (Chỉ lấy những người không bị khóa is_active = 1)
  const volunteers = await prisma.users.findMany({
    where: { 
      roles: { some: { role: { name: "VOLUNTEER" } } },
      is_active: true 
    },
    orderBy: { id: 'asc' }
  });

  const TODAY = new Date("2026-04-26T10:00:00Z");
  let pastEventRound = 0;

  if (activeEvents.length === 0) {
    console.log("⚠️ Không tìm thấy Event ACTIVE nào. Nhớ chạy seedEvent trước!");
    return;
  }

  for (const event of activeEvents) {
    const isPastEvent = event.end_time < TODAY;
    // Mỗi event lấy 10 người đăng ký
    const picked = volunteers.slice(0, 10);

    for (let i = 0; i < picked.length; i++) {
      const user = picked[i];
      let finalStatus = "pending";

      /**
       * PHÂN BỔ TRẠNG THÁI THEO THỜI GIAN:
       */
      if (isPastEvent) {
        // A. Sự kiện ĐÃ KẾT THÚC (PAST): Luân phiên theo event để mỗi volunteer
        // đều có cả completed và Absented khi có nhiều event quá khứ.
        finalStatus = (pastEventRound + i) % 2 === 0 ? "Absent" : "completed";
      } 
      else if (event.start_time <= TODAY && event.end_time >= TODAY) {
        // B. Sự kiện ĐANG DIỄN RA (ONGOING): 5 người đầu đã Approved để test Checkout, 5 người sau vẫn Pending
        finalStatus = i < 5 ? "approved" : "pending";
      } 
      else {
        // C. Sự kiện TƯƠNG LAI (FUTURE): Trộn lẫn Approved và Pending để test quản lý đơn
        finalStatus = i < 3 ? "approved" : "pending";
      }

      // Tạo bản ghi Registration
      const reg = await prisma.registrations.create({
        data: {
          user_id: user.id,
          event_id: event.id,
          status: finalStatus,
        },
      });

      // Tạo lịch sử: Mọi đơn đều bắt đầu bằng dòng "pending"
      await prisma.registration_status_history.create({
        data: {
          registration_id: reg.id,
          new_status: "pending",
          changed_by: user.id,
          created_at: new Date("2026-04-20T08:00:00Z"),
        },
      });

      // Nếu trạng thái cuối cùng khác "pending" thì tạo thêm dòng lịch sử chuyển trạng thái
      if (finalStatus !== "pending") {
        await prisma.registration_status_history.create({
          data: {
            registration_id: reg.id,
            new_status: finalStatus,
            changed_by: event.manager_id, // Manager thực hiện duyệt/checkout
            created_at: new Date("2026-04-21T09:00:00Z"),
          },
        });
      }
    }

    if (isPastEvent) {
      pastEventRound += 1;
    }
  }

  console.log(`✅ Seed Registration thành công cho ${activeEvents.length} sự kiện Active.`);
  console.log(`📊 Các sự kiện Pending/Reject đã được để trống theo đúng logic nghiệp vụ!`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());