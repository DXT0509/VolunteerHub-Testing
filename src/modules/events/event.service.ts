import { PrismaClient } from "@prisma/client";
import slugify from "slugify";
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

  let baseslug = slugify(title, { lower: true, strict: true });
  let slug = baseslug;
  let counter = 1;

  while (await prisma.events.findUnique({ where: { slug } })) {
    slug = `${baseslug}-${counter++}`;
  }

  return prisma.events.create({
    data: {
      title,
      slug,
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

//Get Event Details by slug
export async function getEventBySlug(slug: string) {
  return prisma.events.findUnique({
    where: { slug },
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

  let updateData: any = {
    description: data.description,
    category_id: data.category_id,
    location_id: data.location_id,
    start_time: data.start_time ? new Date(data.start_time) : undefined,
    end_time: data.end_time ? new Date(data.end_time) : undefined,
    capacity: data.capacity,
    banner_url: data.banner_url,
    updated_at: new Date(),
  };

  if (data.title && data.title !== event.title) {
    let newSlug = slugify(data.title, { lower: true, strict: true });
    let slug = newSlug;
    let counter = 1;

    while (await prisma.events.findUnique({ where: { slug } })) {
      slug = `${newSlug}-${counter++}`;
    }

    updateData.title = data.title;
    updateData.slug = slug;
  }

  return prisma.events.update({
    where: { id },
    data: updateData,
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
