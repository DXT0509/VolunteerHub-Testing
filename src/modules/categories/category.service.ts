import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function listCategories() {
  return prisma.categories.findMany({
    orderBy: { name: "asc" },
  });
}
