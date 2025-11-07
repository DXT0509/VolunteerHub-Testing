import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signToken } from "../../utils/jwt";

const prisma = new PrismaClient();

//Register
export async function registerUser(
  email: string,
  password: string,
  full_name: string,
  roleName: string = "VOLUNTEER"
) {
  const exists = await prisma.users.findUnique({ where: { email } });
  if (exists) {
    throw new Error("Email đã được sử dụng");
  }

  const hash = await bcrypt.hash(password, 10);

  const role = await prisma.roles.findUnique({ where: { name: roleName } });
  if (!role) {
    throw new Error("Vai trò không hợp lệ");
  }

  const user = await prisma.users.create({
    data: {
      email,
      username: email.split("@")[0],
      password: hash,
      full_name,
      roles: {
        create: [{ role: { connect: { id: role.id } } }],
      },
    },
    include: {
      roles: { include: { role: true } },
    },
  });

  const token = signToken({ userId: user.id, role: role.name }, "1h");
  return { user, token };
}

//Login
export async function loginUser(email: string, password: string) {
  const user = await prisma.users.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  });

  if (!user) throw new Error("Tài khoản không tồn tại");
  if (!user.is_active) throw new Error("Tài khoản đã bị khóa");

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error("Sai mật khẩu");

  const roleName = user.roles[0]?.role.name || "VOLUNTEER";
  const token = signToken({ userId: user.id, role: roleName }, "1h");
  return { user, token };
}

//UserProfile
export async function getUserProfile(userId: number) {
  return prisma.users.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
}
