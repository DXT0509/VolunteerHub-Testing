import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Dọn dẹp data cũ theo thứ tự bảng CON trước bảng CHA
  await prisma.event_approvals.deleteMany();
  await prisma.event_channels.deleteMany();
  await prisma.event_attendance.deleteMany();
  await prisma.events.deleteMany();
  await prisma.locations.deleteMany();

  // 2. Lấy danh sách Manager và sắp xếp theo ID để đảm bảo thứ tự luôn giống nhau
  const managers = await prisma.users.findMany({
    where: {
      roles: { some: { role: { name: "EVENT_MANAGER" } } },
    },
    orderBy: { id: 'asc' } // Quan trọng: Luôn lấy theo thứ tự ID
  });

  if (managers.length === 0) {
    throw new Error("Không có EVENT_MANAGER nào trong database. Hãy tạo user trước!");
  }

  const categories = await prisma.categories.findMany();
  const catMap: Record<string, number> = Object.fromEntries(
    categories.map((c: { id: number; name: string }) => [c.name, c.id])
  );

  const data = [
    {
      title: "Ngay hoi hien mau tinh nguyen", // Dùng title không dấu để làm slug cho sạch
      displayTitle: "Ngày hội hiến máu tình nguyện",
      description: "Lan tỏa tinh thần nhân ái trong cộng đồng.",
      category: "Từ thiện",
      banner: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b",
      location: { name: "Nhà Văn Hóa Thanh Niên", address: "4 Phạm Ngọc Thạch", district: "Quận 1" },
    },
    {
      title: "Chien dich lam sach bai bien",
      displayTitle: "Chiến dịch làm sạch bãi biển",
      description: "Bảo vệ môi trường biển và hệ sinh thái.",
      category: "Môi trường",
      banner: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
      location: { name: "Bãi biển Vũng Tàu", address: "Thùy Vân", district: "TP. Vũng Tàu" },
    },
    // ... các sự kiện khác giữ nguyên nội dung nhưng thêm displayTitle nếu cần
  ];

  // Mốc thời gian cố định: 2026-05-01
  const FIXED_START_DATE = new Date("2026-05-01T08:00:00Z");

  for (let i = 0; i < data.length; i++) {
    // Tạo địa điểm
    const loc = await prisma.locations.create({
      data: {
        name: data[i].location.name,
        address_line: data[i].location.address,
        district: data[i].location.district,
        province: "TP. Hồ Chí Minh",
        country: "Việt Nam",
      },
    });

    // Tính toán thời gian cố định: Mỗi sự kiện cách nhau 1 ngày
    const start = new Date(FIXED_START_DATE);
    start.setDate(start.getDate() + i);
    const end = new Date(start);
    end.setHours(end.getHours() + 4);

    // PHÂN VIỆC CỐ ĐỊNH: Manager 1 làm các event chẵn, Manager 2 làm các event lẻ (nếu có 2 người)
    const manager = managers[i % managers.length];

    await prisma.events.create({
      data: {
        title: data[i].displayTitle || data[i].title,
        slug: data[i].title.toLowerCase().replace(/ /g, "-") + `-fixed-${i}`,
        description: data[i].description,
        category_id: catMap[data[i].category],
        location_id: loc.id,
        start_time: start,
        end_time: end,
        capacity: 100,
        banner_url: data[i].banner,
        manager_id: manager.id,
        status: "pending", // Mặc định tất cả là chờ duyệt để Admin có cái mà làm
      },
    });
  }

  console.log(`✅ Đã seed ${data.length} events cố định.`);
  console.log(`🔗 Các event đã được phân bổ đều cho ${managers.length} managers.`);
}

main()
  .catch((err: any) => console.error(err))
  .finally(() => prisma.$disconnect());