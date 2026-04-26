import { PrismaClient } from "@prisma/client";
import slugify from "slugify";
const prisma = new PrismaClient();

//Create Event (Event Manager)
export async function createEvent(managerId: number, data: any) {
  const {
    title,
    description,
    category_id,
    location, // <== nhận object location thay vì location_id
    start_time,
    end_time,
    capacity,
    banner_url,
  } = data;

  // Required field validation (except banner)
  if (!title || !description || !category_id || !location || !location.name || !location.address_line || !location.district || !location.province || !location.country || !start_time || !end_time || (!capacity && capacity !== 0)) {
    throw new Error("Vui lòng điền đầy đủ tất cả trường thông tin");
  }

  // Validate time range: end_time must be >= start_time
  const start = new Date(start_time);
  const end = new Date(end_time);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Thời gian bắt đầu/kết thúc không hợp lệ");
  }
  if (end.getTime() < start.getTime()) {
    throw new Error("Thời gian kết thúc phải lớn hơn hoặc bằng thời gian bắt đầu");
  }

  let baseslug = slugify(title, { lower: true, strict: true });
  let slug = baseslug;
  let counter = 1;

  while (await prisma.events.findUnique({ where: { slug } })) {
    slug = `${baseslug}-${counter++}`;
  }

  //Tạo location mới từ object
  const newLocation = await prisma.locations.create({
    data: {
      name: location.name,
      address_line: location.address_line,
      district: location.district,
      province: location.province,
      country: location.country,
    },
  });

  return prisma.events.create({
    data: {
      title,
      slug,
      description,
      category_id,
      location_id: newLocation.id,
      start_time: start,
      end_time: end,
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
  const event = await prisma.events.findUnique({
    where: { id },
    include: { location: true }, //Để so sánh
  });
  if (!event) throw new Error("Sự kiện không tồn tại");
  if (event.manager_id !== managerId)
    throw new Error("Bạn không có quyền chỉnh sửa sự kiện này");

  // Required field validation on update (except banner). Use existing values if not provided to check completeness.
  const reqTitle = data.title ?? event.title;
  const reqDesc = data.description ?? event.description;
  const reqCategoryId = data.category_id ?? event.category_id;
  const reqStart = data.start_time ?? event.start_time;
  const reqEnd = data.end_time ?? event.end_time;
  const reqCapacity = data.capacity ?? event.capacity;
  // Location can be either existing or new object
  const reqLocation = data.location ? data.location : event.location;
  if (!reqTitle || !reqDesc || !reqCategoryId || !reqStart || !reqEnd || (!reqCapacity && reqCapacity !== 0) || !reqLocation || !reqLocation.name || !reqLocation.address_line || !reqLocation.district || !reqLocation.province || !reqLocation.country) {
    throw new Error("Vui lòng điền đầy đủ tất cả trường thông tin");
  }

  // Determine new start/end to validate ordering
  const candidateStart = data.start_time ? new Date(data.start_time) : new Date(event.start_time);
  const candidateEnd = data.end_time ? new Date(data.end_time) : new Date(event.end_time);
  if (Number.isNaN(candidateStart.getTime()) || Number.isNaN(candidateEnd.getTime())) {
    throw new Error("Thời gian bắt đầu/kết thúc không hợp lệ");
  }
  if (candidateEnd.getTime() < candidateStart.getTime()) {
    throw new Error("Thời gian kết thúc phải lớn hơn hoặc bằng thời gian bắt đầu");
  }

  let updateData: any = {
    description: data.description,
    category_id: data.category_id,
    start_time: data.start_time ? candidateStart : undefined,
    end_time: data.end_time ? candidateEnd : undefined,
    capacity: data.capacity,
    banner_url: data.banner_url,
    updated_at: new Date(),
  };

  if (data.location) {
    const newLoc = data.location;
    const oldLoc = event.location;

    let needNewLocation = false;

    // Nếu event chưa có location hoặc location trống -> chắn chắn tạo mới
    if (!oldLoc) {
      needNewLocation = true;
    } else {
      // So sánh field
      const fields: (keyof typeof oldLoc)[] = [
        "name",
        "address_line",
        "district",
        "province",
        "country",
      ];

      for (const field of fields) {
        if ((newLoc[field] || null) !== (oldLoc[field] || null)) {
          needNewLocation = true;
          break;
        }
      }
    }

    if (needNewLocation) {
      // Tạo location mới
      const createdLoc = await prisma.locations.create({
        data: {
          name: newLoc.name,
          address_line: newLoc.address_line,
          district: newLoc.district,
          province: newLoc.province,
          country: newLoc.country,
        },
      });

      updateData.location_id = createdLoc.id;
    }
  }

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
  const role = await prisma.users.findUnique({
    where: { id: managerId },
    include: { roles: { include: { role: true } } },
  });
  if (event.manager_id !== managerId && !role?.roles.some((r: any) => r.role.name === "ADMIN"))
    throw new Error("Bạn không có quyền xóa sự kiện này");
  await prisma.event_attendance.deleteMany({
  where: { registration: { event_id: id } }
});
  await prisma.registration_status_history.deleteMany({
    where: { registration: { event_id: id } }
  });
  await prisma.event_channels.deleteMany({where: {event_id: id}});
  await prisma.registrations.deleteMany({ where: { event_id: id } });
  await prisma.comments.deleteMany({ where: { post: { event_id: id } } });
  await prisma.likes.deleteMany({ where: { post: { event_id: id } } });
  await prisma.attachments.deleteMany({ where: { post: { event_id: id } } });
  await prisma.posts.deleteMany({ where: { event_id: id } });
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