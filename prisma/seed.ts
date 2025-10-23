import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function main() {
  const roles = ["VOLUNTEER", "EVENT_MANAGER", "ADMIN"];
  for (const r of roles) {
    await prisma.roles.upsert({
      where: { name: r },
      update: {},
      create: { name: r, label: r.replace("_", " ") },
    });
  }

  const adminPass = await bcrypt.hash("admin123", 10);
  const admin = await prisma.users.upsert({
    where: { email: "admin@gmail.com" },
    update: {},
    create: {
      username: "admin",
      email: "admin@gmail.com",
      password: adminPass,
      full_name: "System Admin",
      roles: {
        create: {
          role: { connect: { name: "ADMIN" } },
        },
      },
    },
  });
  console.log("Seeded admin:", admin.email);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
