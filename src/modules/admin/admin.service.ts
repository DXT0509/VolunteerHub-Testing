import { PrismaClient } from "@prisma/client";
import { Parser } from "json2csv";
import { sendNotification } from "../notifications/notification.service";

const prisma = new PrismaClient();

//Approve or Reject Event
export async function approveEvent(
  eventId: number,
  action: "approved" | "rejected",
  note?: string
) {
  const newStatus = action === "approved" ? "active" : "rejected";
  const updated = await prisma.events.update({
    where: { id: eventId },
    data: { status: newStatus },
  });
  await prisma.event_approvals.create({
    data: { event_id: eventId, action, note },
  });
  if (action === "approved") {
    await sendNotification(
      updated.manager_id,
      "event_approved",
      "Sự kiện đã được duyệt",
      `Sự kiện "${updated.title}" của bạn đã được phê duyệt và công khai.`,
      { event_id: updated.id }
    );
  } else if (action === "rejected") {
    await sendNotification(
      updated.manager_id,
      "event_rejected",
      "Sự kiện bị từ chối",
      `Sự kiện "${updated.title}" của bạn không được duyệt.`,
      { event_id: updated.id }
    );
  }
  return updated;
}

//Get All Users
export async function listUsers() {
  return prisma.users.findMany({
    include: { roles: { include: { role: true } } },
    orderBy: { created_at: "desc" },
  });
}

//Update User Status (Lock/Unlock)
export async function updateUserStatus(
  adminId: number,
  userId: number,
  isActive: boolean
) {
  const user = await prisma.users.findUnique({
    where: { id: userId },
  });
  if (!user) throw new Error("Người dùng không tồn tại");

  await prisma.activity_log.create({
    data: {
      actor_id: adminId,
      action: isActive ? "unlock_user" : "lock_user",
      entity_type: "user",
      entity_id: userId,
    },
  });

  if (!isActive) {
    await sendNotification(
      user.id,
      "account_locked",
      "Tài khoản của bạn đã bị khóa",
      "Tài khoản của bạn tạm thời bị khóa bởi quản trị viên."
    );
  } else {
    await sendNotification(
      user.id,
      "account_unlocked",
      "Tài khoản của bạn đã được mở khóa",
      "Bạn có thể đăng nhập và sử dụng lại VolunteerHub."
    );
  }

  return prisma.users.update({
    where: { id: userId },
    data: { is_active: isActive },
  });
}

//Change User Role
export async function changeUserRole(
  adminId: number,
  userId: number,
  newRole: string
) {
  const role = await prisma.roles.findUnique({ where: { name: newRole } });
  if (!role) throw new Error("Vai trò không tồn tại");

  //change role
  await prisma.user_roles.deleteMany({ where: { user_id: userId } });
  await prisma.user_roles.create({
    data: { user_id: userId, role_id: role.id },
  });

  //log
  await prisma.activity_log.create({
    data: {
      actor_id: adminId,
      action: "change_user_role",
      entity_type: "user",
      entity_id: userId,
      metadata: { newRole },
    },
  });

  return { userId, newRole };
}

//Export Users Data
export async function exportData(
  type: "users" | "events" | "registrations",
  format: "csv" | "json"
) {
  let data: any[] = [];

  switch (type) {
    case "users":
      data = await prisma.users.findMany({
        select: {
          id: true,
          full_name: true,
          email: true,
          is_active: true,
          created_at: true,
        },
      });
      break;
    case "events":
      data = await prisma.events.findMany({
        select: {
          id: true,
          title: true,
          start_time: true,
          end_time: true,
          status: true,
          total_joined: true,
        },
      });
      break;
    case "registrations":
      data = await prisma.registrations.findMany({
        select: {
          id: true,
          user_id: true,
          event_id: true,
          status: true,
          created_at: true,
        },
      });
      break;
    default:
      throw new Error("Loại dữ liệu không hợp lệ");
  }

  if (format === "json") {
    return {
      content: JSON.stringify(data, null, 2),
      contentType: "application/json",
    };
  } else {
    const parser = new Parser();
    let csv = parser.parse(data);
    // Normalize Windows line endings for Excel compatibility
    // Prepend UTF-8 BOM so Excel correctly renders Vietnamese characters
    csv = "\uFEFF" + csv;
    return { content: csv, contentType: "text/csv; charset=utf-8" };
  }
}
