import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding categories & locations...");

  // --- CATEGORIES ---
  const categories = [
    { name: "Môi trường", description: "Hoạt động bảo vệ môi trường" },
    { name: "Giáo dục", description: "Hỗ trợ dạy học, truyền đạt kỹ năng" },
    { name: "Từ thiện", description: "Các hoạt động thiện nguyện" },
    { name: "Cộng đồng", description: "Phát triển cộng đồng, hỗ trợ xã hội" },
  ];

  for (const cat of categories) {
    await prisma.categories.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  // --- LOCATIONS ---
  const locations = [
    // --- TP. Hồ Chí Minh ---
    {
      name: "Công viên Gia Định",
      address_line: "Đường Hoàng Minh Giám, P.3",
      district: "Gò Vấp",
      province: "TP. Hồ Chí Minh",
    },
    {
      name: "Nhà văn hóa Thanh Niên",
      address_line: "Số 4 Phạm Ngọc Thạch, P.Bến Nghé",
      district: "Quận 1",
      province: "TP. Hồ Chí Minh",
    },
    {
      name: "Trường Tiểu học Tân Phú A",
      district: "Tân Phú",
      province: "TP. Hồ Chí Minh",
    },

    // --- Hà Nội ---
    {
      name: "Công viên Thống Nhất",
      address_line: "Đường Trần Nhân Tông, P.Nguyễn Du",
      district: "Hai Bà Trưng",
      province: "Hà Nội",
    },
    {
      name: "Trường Đại học Bách Khoa Hà Nội",
      address_line: "Số 1 Đại Cồ Việt",
      district: "Hai Bà Trưng",
      province: "Hà Nội",
    },
    {
      name: "Nhà Văn hóa Thanh Niên Hà Nội",
      address_line: "37 Trần Bình Trọng",
      district: "Hoàn Kiếm",
      province: "Hà Nội",
    },
    {
      name: "Công viên Cầu Giấy",
      address_line: "Đường Thành Thái, Dịch Vọng",
      district: "Cầu Giấy",
      province: "Hà Nội",
    },

    // --- Bắc Ninh ---
    {
      name: "Trung tâm Văn hóa Kinh Bắc",
      address_line: "Số 02 Lý Thái Tổ",
      district: "TP. Bắc Ninh",
      province: "Bắc Ninh",
    },
    {
      name: "Trường Đại học Kinh Bắc",
      address_line: "Số 10 Đường Nguyễn Văn Cừ",
      district: "TP. Bắc Ninh",
      province: "Bắc Ninh",
    },
    {
      name: "Công viên Nguyễn Văn Cừ",
      district: "TP. Bắc Ninh",
      province: "Bắc Ninh",
    },
  ];

  for (const loc of locations) {
    await prisma.locations.create({ data: loc });
  }

  console.log("✅ Seeded categories & locations successfully!");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
