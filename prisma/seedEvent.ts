import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.event_approvals.deleteMany();
  await prisma.event_channels.deleteMany();
  await prisma.event_attendance.deleteMany();
  await prisma.events.deleteMany();
  await prisma.locations.deleteMany();

  const managers = await prisma.users.findMany({
    where: { roles: { some: { role: { name: "EVENT_MANAGER" } } } },
    orderBy: { id: 'asc' }
  });

  const categories = await prisma.categories.findMany();
  const catMap: Record<string, number> = Object.fromEntries(categories.map((c: any) => [c.name, c.id]));
  
  // Mốc thời gian thực tế của bạn
  // ... (Phần đầu file giữ nguyên)

  const TODAY = new Date("2026-04-26T10:00:00Z");
  const JULY_LATE = new Date("2026-07-31T23:59:59Z");

  for (let m = 0; m < managers.length; m++) {
    const manager = managers[m];

    for (let e = 1; e <= 12; e++) {
      const loc = await prisma.locations.create({
        data: {
          name: `Địa điểm ${e} - Mgr ${manager.id}`,
          address_line: "144 Xuân Thủy",
          district: "Cầu Giấy", province: "Hà Nội", country: "Việt Nam",
        },
      });

      let start: Date, end: Date, status: string, titleSuffix: string;

      if (e <= 2) { // PAST: Đã xong
        start = new Date(TODAY); start.setDate(TODAY.getDate() - 10);
        end = new Date(TODAY); end.setDate(TODAY.getDate() - 5);
        status = "active"; titleSuffix = "PAST";
      } else if (e <= 5) { // ONGOING: Bắt đầu rồi, tháng 7 mới hết
        start = new Date(TODAY); start.setDate(TODAY.getDate() - 2);
        end = new Date(JULY_LATE); 
        status = "active"; titleSuffix = "ONGOING";
      } else if (e <= 9) { // FUTURE: Tháng 7 mới bắt đầu
        start = new Date("2026-07-01T08:00:00Z"); start.setDate(1 + e);
        end = new Date(start); end.setHours(start.getHours() + 4);
        status = "active"; titleSuffix = "FUTURE";
      } else if (e === 10) { // PENDING
        start = new Date("2026-08-01T08:00:00Z"); end = new Date(start);
        status = "pending"; titleSuffix = "WAITING";
      } else { // REJECT
        start = new Date("2026-08-10T08:00:00Z"); end = new Date(start);
        status = "rejected"; titleSuffix = "REJECTED";
      }

      await prisma.events.create({
        data: {
          title: `Sự kiện ${e} (${titleSuffix}) - Mgr ${manager.id}`,
          slug: `event-${e}-mgr-${manager.id}-${Date.now()}-${e}`,
          description: `Sự kiện test logic.`,
          category_id: categories[e % categories.length].id,
          location_id: (await prisma.locations.create({ data: { name: `Sảnh ${e}`, address_line: "144 Xuân Thủy", district: "Cầu Giấy", province: "Hà Nội", country: "Việt Nam" } })).id,
          start_time: start,
          end_time: end,
          capacity: 100,
          manager_id: manager.id,
          status: status,
        },
      });
    }
  }
// ... (Phần cuối giữ nguyên)
  console.log("✅ Seed Event thành công với đủ loại: Past, Ongoing, Future, Pending, Reject.");
}

main().catch(console.error).finally(() => prisma.$disconnect());