import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

//Create Event (Event Manager)
export async function createEvent(managerId: number, data: any) {
  const {
    title,
    description,
    category_id,
    location_id,
    start_time,
    end_time,
    capacity,
    banner_url,
  } = data;

  return prisma.events.create({
    data: {
      title,
      description,
      category_id,
      location_id,
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      capacity,
      banner_url,
      manager_id: managerId,
      status: "pending",
    },
  });
}

//Get List Events (ALL Users)
export async function listEvents(filters: any) {
  const { status, cartergory_id, skip = 0, take = 20 } = filters;
  return prisma.events.findMany({
    where: {
      status: status || undefined,
      category_id: cartergory_id ? Number(cartergory_id) : undefined,
    },
    include: {
      category: true,
      location: true,
      manager: { select: { id: true, full_name: true, email: true } },
    },
    orderBy: { created_at: "desc" },
    skip: Number(skip),
    take: Number(take),
  });
}

//Get Event Details (ALL Users)
export async function getEventById(id: number) {
  return prisma.events.findUnique({
    where: { id },
    include: {
      category: true,
      location: true,
      manager: { select: { id: true, full_name: true, email: true } },
      registrations: true,
    },
  });
}

//Update Event (Event Manager)
export async function updateEvent(id: number, managerId: number, data: any) {
  const event = await prisma.events.findUnique({ where: { id } });
  if (!event) throw new Error("Sự kiện không tồn tại");
  if (event.manager_id !== managerId)
    throw new Error("Bạn không có quyền chỉnh sửa sự kiện này");

  return prisma.events.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      category_id: data.category_id,
      location_id: data.location_id,
      start_time: data.start_time ? new Date(data.start_time) : undefined,
      end_time: data.end_time ? new Date(data.end_time) : undefined,
      capacity: data.capacity,
      banner_url: data.banner_url,
      updated_at: new Date(),
    },
  });
}

//Delete Event (Event Manager)
export async function deleteEvent(id: number, managerId: number) {
  const event = await prisma.events.findUnique({ where: { id } });
  if (!event) throw new Error("Sự kiện không tồn tại");
  if (event.manager_id !== managerId)
    throw new Error("Bạn không có quyền xóa sự kiện này");

  await prisma.event_approvals.deleteMany({ where: { event_id: id } });
  await prisma.events.delete({ where: { id } });
  return { message: "Xóa sự kiện thành công" };
}

//Approve or Reject Event (Admin)
export async function approveEvent(
  eventId: number,
  action: "approve" | "reject",
  note?: string
) {
  const newStatus = action === "approve" ? "active" : "rejected";
  const updated = await prisma.events.update({
    where: { id: eventId },
    data: { status: newStatus },
  });
  await prisma.event_approvals.create({
    data: { event_id: eventId, action, note },
  });
  return updated;
}

//finalize Event (Event Manager)
export async function finalizeevent(
  eventId: number,
  managerId: number,
  action: "complete" | "cancel",
  note?: string
) {
  const event = await prisma.events.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Sự kiện không tồn tại");
  if (event.manager_id !== managerId)
    throw new Error("Bạn không có quyền hoàn tất sự kiện này");

  const newStatus = action === "complete" ? "completed" : "canceled";

  const update = await prisma.events.update({
    where: { id: eventId },
    data: { status: newStatus },
  });

  await prisma.event_approvals.create({
    data: { event_id: eventId, action: newStatus, note },
  });

  return update;
}
