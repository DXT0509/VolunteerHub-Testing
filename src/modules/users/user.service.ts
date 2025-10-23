import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

//All
export async function getProfile(userId: number) {
  return prisma.users.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
}

//All
export async function updateProfile(userId: number, data: any) {
  const { full_name, phone, avatar_url } = data;
  return prisma.users.update({
    where: { id: userId },
    data: { full_name, phone, avatar_url },
  });
}

//All
export async function changePassword(
  userId: number,
  oldPassword: string,
  newPassword: string
) {
  const user = await prisma.users.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Người dùng không tồn tại");

  const ok = await bcrypt.compare(oldPassword, user.password);
  if (!ok) throw new Error("Mật khẩu cũ không đúng");

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.users.update({
    where: { id: userId },
    data: { password: newHash },
  });
  return { message: "Đổi mật khẩu thành công" };
}

//Admin
export async function listUsers() {
  return prisma.users.findMany({
    include: { roles: { include: { role: true } } },
    orderBy: { created_at: "desc" },
  });
}

//Admin
export async function updateUserStatus(userId: number, isActive: boolean) {
  return prisma.users.update({
    where: { id: userId },
    data: { is_active: isActive },
  });
}
