import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  // Clear data cũ
  await prisma.event_approvals.deleteMany();   // nếu có
await prisma.event_channels.deleteMany();     // nếu có
await prisma.event_attendance.deleteMany(); // nếu có

// rồi mới xóa bảng CHA
await prisma.events.deleteMany();
await prisma.locations.deleteMany();

  const managers = await prisma.users.findMany({
    where: {
      roles: { some: { role: { name: "EVENT_MANAGER" } } },
    },
  });

  if (managers.length === 0) {
    throw new Error("Không có EVENT_MANAGER nào");
  }

  const categories = await prisma.categories.findMany();
  const catMap = Object.fromEntries(categories.map(c => [c.name, c.id]));

  const data = [
    {
      title: "Ngày hội hiến máu tình nguyện",
      description: "Lan tỏa tinh thần nhân ái trong cộng đồng.",
      category: "Từ thiện",
      banner:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b",
      location: { name: "Nhà Văn Hóa Thanh Niên", address: "4 Phạm Ngọc Thạch", district: "Quận 1" },
    },
    {
      title: "Chiến dịch làm sạch bãi biển",
      description: "Bảo vệ môi trường biển và hệ sinh thái.",
      category: "Môi trường",
      banner:
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
      location: { name: "Bãi biển Vũng Tàu", address: "Thùy Vân", district: "TP. Vũng Tàu" },
    },
    {
      title: "Trồng cây xanh vì môi trường",
      description: "Góp phần phủ xanh đô thị.",
      category: "Môi trường",
      banner:
        "https://images.unsplash.com/photo-1501004318641-b39e6451bec6",
      location: { name: "Công viên Gia Định", address: "Hoàng Minh Giám", district: "Gò Vấp" },
    },
    {
      title: "Tiếp sức mùa thi",
      description: "Hỗ trợ thí sinh trong kỳ thi.",
      category: "Giáo dục",
      banner:
        "https://images.unsplash.com/photo-1523050854058-8df90110c9f1",
      location: { name: "ĐH Khoa Học Tự Nhiên", address: "227 Nguyễn Văn Cừ", district: "Quận 5" },
    },
    {
      title: "Gian hàng 0 đồng",
      description: "Hỗ trợ nhu yếu phẩm cho người khó khăn.",
      category: "Từ thiện",
      banner:
        "https://images.unsplash.com/photo-1609137144813-7d9921338f24",
      location: { name: "Nhà Thiếu Nhi Thành Phố", address: "169 Nam Kỳ Khởi Nghĩa", district: "Quận 3" },
    },
    {
      title: "Dạy học miễn phí vùng cao",
      description: "Mang tri thức đến trẻ em khó khăn.",
      category: "Giáo dục",
      banner:
        "https://images.unsplash.com/photo-1509062522246-3755977927d7",
      location: { name: "Trường Tiểu Học Xã A", address: "Xã A", district: "Mù Cang Chải" },
    },
    {
      title: "Trung thu cho em",
      description: "Niềm vui cho trẻ em vùng khó.",
      category: "Cộng đồng",
      banner:
        "https://images.unsplash.com/photo-1603575448878-868a20723f5d",
      location: { name: "Trung tâm Bảo trợ Trẻ em", address: "12 Lý Thường Kiệt", district: "Quận 10" },
    },
    {
      title: "Nấu ăn từ thiện",
      description: "Suất ăn miễn phí cho người vô gia cư.",
      category: "Từ thiện",
      banner:
        "https://images.unsplash.com/photo-1600891964599-f61ba0e24092",
      location: { name: "Chùa Từ Tâm", address: "45 Lê Hồng Phong", district: "Quận 10" },
    },
    {
      title: "Chạy bộ gây quỹ cộng đồng",
      description: "Gây quỹ cho các dự án xã hội.",
      category: "Cộng đồng",
      banner:
        "https://images.unsplash.com/photo-1549576490-b0b4831ef60a",
      location: { name: "Công viên Tao Đàn", address: "Trương Định", district: "Quận 1" },
    },
    {
      title: "Mùa hè xanh",
      description: "Chiến dịch tình nguyện hè.",
      category: "Cộng đồng",
      banner:
        "https://images.unsplash.com/photo-1520975922284-8b456906c813",
      location: { name: "Xã Bình An", address: "Trung tâm xã", district: "Bình Đại" },
    },
  ];

  for (let i = 0; i < data.length; i++) {
    const loc = await prisma.locations.create({
      data: {
        name: data[i].location.name,
        address_line: data[i].location.address,
        district: data[i].location.district,
        province: "TP. Hồ Chí Minh",
        country: "Việt Nam",
      },
    });

    const start = new Date();
    start.setDate(start.getDate() + i + 1);
    const end = new Date(start);
    end.setHours(end.getHours() + 4);

    const manager = randomItem(managers);

    await prisma.events.create({
      data: {
        title: data[i].title,
        slug:
          data[i].title
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, "") + `-${i}`,
        description: data[i].description,
        category_id: catMap[data[i].category],
        location_id: loc.id,
        start_time: start,
        end_time: end,
        capacity: 100,
        banner_url: data[i].banner, // ✅ ĐÃ GÁN ẢNH
        manager_id: manager.id,
        status: "pending",
      },
    });
  }

  console.log("Seeded 10 events với banner_url");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
