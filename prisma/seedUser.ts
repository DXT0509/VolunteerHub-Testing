import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("123456", 10);

  // 13 VOLUNTEER
  for (let i = 1; i <= 13; i++) {
    await prisma.users.create({
      data: {
        username: `volunteer${i}`,
        email: `volunteer${i}@gmail.com`,
        password,
        full_name: `Volunteer ${i}`,
        roles: {
          create: {
            role: { connect: { name: "VOLUNTEER" } },
          },
        },
      },
    });
  }

  // 2 EVENT_MANAGER
  for (let i = 1; i <= 2; i++) {
    await prisma.users.create({
      data: {
        username: `manager${i}`,
        email: `manager${i}@gmail.com`,
        password,
        full_name: `Event Manager ${i}`,
        roles: {
          create: {
            role: { connect: { name: "EVENT_MANAGER" } },
          },
        },
      },
    });
  }

  console.log("Seeded 13 VOLUNTEER + 2 EVENT_MANAGER");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
