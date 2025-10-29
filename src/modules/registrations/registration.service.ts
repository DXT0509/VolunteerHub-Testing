import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

//User
export async function registerEvent(userId: number, eventId: number) {
  const event = await prisma.events.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Sự kiện không tồn tại");
  if (event.status !== "active") throw new Error("Sự kiện chưa được duyệt");
  if (new Date(event.start_time) < new Date())
    throw new Error("Sự kiện đã diễn ra");

  const existing = await prisma.registrations.findFirst({
    where: { user_id: userId, event_id: eventId },
  });
  if (existing && existing.status !== "cancelled") {
    throw new Error("Bạn đã đăng ký sự kiện này");
  }

  const registration = existing
    ? await prisma.registrations.update({
        where: { id: existing.id },
        data: { status: "pending", updated_at: new Date() },
      })
    : await prisma.registrations.create({
        data: { user_id: userId, event_id: eventId, status: "pending" },
      });

  await prisma.registration_status_history.create({
    data: {
      registration_id: registration.id,
      new_status: "pending",
      changed_by: userId,
    },
  });

  return registration;
}

//User
export async function cancelRegistration(userId: number, eventId: number) {
  const reg = await prisma.registrations.findUnique({
    where: { event_id_user_id: { event_id: eventId, user_id: userId } },
    include: { event: true },
  });
  if (!reg || reg.user_id !== userId)
    throw new Error("Không tìm thấy đăng ký hợp lệ");

  const event = await prisma.events.findUnique({ where: { id: reg.event_id } });
  if (!event || new Date(event.start_time) < new Date())
    throw new Error("Không thể hủy sau khi sự kiện đã diễn ra");

  await prisma.registration_status_history.create({
    data: {
      registration_id: reg.id,
      old_status: reg.status,
      new_status: "cancelled",
      changed_by: userId,
    },
  });

  return prisma.registrations.update({
    where: { id: reg.id },
    data: { status: "cancelled" },
  });
}

//User
export async function getUserRegistrations(userId: number) {
  return prisma.registrations.findMany({
    where: { user_id: userId },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          start_time: true,
          end_time: true,
          location: { select: { name: true } },
          status: true,
          banner_url: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
  });
}

//Event Manager
export async function updateRegistrationStatus(
  managerId: number,
  regId: number,
  newStatus: "approved" | "rejected"
) {
  const reg = await prisma.registrations.findUnique({
    where: { id: regId },
    include: { event: true, user: true },
  });
  if (!reg) throw new Error("Không tìm thấy đăng ký");

  await prisma.registration_status_history.create({
    data: {
      registration_id: regId,
      old_status: reg.status,
      new_status: newStatus,
      changed_by: managerId,
    },
  });

  if (newStatus === "approved") {
    await prisma.event_attendance.upsert({
      where: { registration_id: regId },
      update: { status: "approved" },
      create: {
        registration_id: regId,
        event_id: reg.event_id,
        user_id: reg.user_id,
        status: "approved",
      },
    });
  }

  return prisma.registrations.update({
    where: { id: regId },
    data: { status: newStatus },
  });
}

//Event Manager
export async function finalizeRegistration(
  managerId: number,
  regId: number,
  newStatus: "completed" | "Absented"
) {
  const reg = await prisma.registrations.findUnique({
    where: { id: regId },
    include: { attendance: true },
  });
  if (!reg) throw new Error("Không tìm thấy đăng ký");

  const atten = await prisma.event_attendance.findUnique({
    where: { id: regId },
  });
  if (atten?.status !== "checked_out")
    throw new Error("Chưa được check out thành công");

  await prisma.registration_status_history.create({
    data: {
      registration_id: regId,
      old_status: reg.status,
      new_status: newStatus,
      changed_by: managerId,
    },
  });

  if (reg.attendance) {
    await prisma.event_attendance.update({
      where: { id: reg.attendance.id },
      data: { status: newStatus },
    });
  }

  return prisma.registrations.update({
    where: { id: regId },
    data: { status: newStatus },
  });
}

//Event Manager
export async function checkIn(regId: number) {
  const reg = await prisma.registrations.findUnique({ where: { id: regId } });
  if (!reg) throw new Error("Không tìm thấy đăng ký");

  return prisma.event_attendance.update({
    where: { registration_id: regId },
    data: { status: "checked_in" },
  });
}
export async function checkOut(regId: number) {
  const reg = await prisma.registrations.findUnique({ where: { id: regId } });
  if (!reg) throw new Error("Không tìm thấy đăng ký");

  const atten = await prisma.event_attendance.findUnique({
    where: { id: regId },
  });
  if (atten?.status !== "checked_in")
    throw new Error("Chưa được check in thành công");

  return prisma.event_attendance.update({
    where: { registration_id: regId },
    data: { status: "checked_out" },
  });
}

//Event Manager
export async function getEventRegistrations(
  managerId: number,
  eventId: number
) {
  // Kiểm tra xem event có thuộc quyền quản lý không
  const event = await prisma.events.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Sự kiện không tồn tại");
  if (event.manager_id !== managerId)
    throw new Error("Bạn không có quyền xem danh sách đăng ký của sự kiện này");

  return prisma.registrations.findMany({
    where: { event_id: eventId },
    include: {
      user: {
        select: {
          id: true,
          full_name: true,
          email: true,
          phone: true,
          avatar_url: true,
        },
      },
      histories: {
        select: {
          old_status: true,
          new_status: true,
          changed_by: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
        take: 1,
      },
      attendance: {
        select: {
          status: true,
          certificate_url: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
  });
}
