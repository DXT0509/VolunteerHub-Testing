import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  // Lấy tất cả event hợp lệ để đăng ký
    await prisma.registration_status_history.deleteMany(); // nếu có FK

  await prisma.registrations.deleteMany(); // nếu có FK
  const events = await prisma.events.findMany({
    where: {
      status: "active",
      start_time: { gt: new Date() },
    },
  });

  if (events.length === 0) {
    throw new Error("Không có event ACTIVE nào để đăng ký");
  }

  // Lấy volunteer
  const volunteers = await prisma.users.findMany({
    where: {
      roles: { some: { role: { name: "VOLUNTEER" } } },
    },
  });

  if (volunteers.length === 0) {
    throw new Error("Không có VOLUNTEER nào");
  }

  // Clear registrations cũ (đúng thứ tự FK)
  await prisma.registration_status_history.deleteMany();
  await prisma.registrations.deleteMany();

  // Mỗi event có 5–10 người đăng ký
  for (const event of events) {
    const numberOfRegs = Math.min(
      volunteers.length,
      Math.floor(Math.random() * 6) + 5
    );

    const picked = volunteers
      .sort(() => 0.5 - Math.random())
      .slice(0, numberOfRegs);

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

  console.log("Seeded registrations cho các events ACTIVE");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
