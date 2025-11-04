import { PrismaClient } from "@prisma/client";
import { rootCertificates } from "tls";
const prisma = new PrismaClient();

//Volunteer
export async function getVolunteerDashboard(userId: number) {
  const [registered, completed, hotEvents] = await Promise.all([
    prisma.registrations.count({ where: { user_id: userId } }),
    prisma.registrations.count({
      where: { user_id: userId, status: "completed" },
    }),
    prisma.events.findMany({
      where: { status: "active" },
      orderBy: [
        { total_comments: "desc" },
        { total_likes: "desc" },
        { total_joined: "desc" },
      ],
      take: 10,
      select: {
        id: true,
        title: true,
        banner_url: true,
        start_time: true,
        total_comments: true,
        total_likes: true,
      },
    }),
  ]);
  return {
    total_registered: registered,
    total_completed: completed,
    hot_events: hotEvents,
  };
}

//Event Manager
export async function getManagerDashboard(userId: number) {
  const [eventCount, totalRegistrations, totalParticipants, topEvents] =
    await Promise.all([
      prisma.events.count({ where: { manager_id: userId } }),
      prisma.registrations.count({
        where: { event: { manager_id: userId } },
      }),
      prisma.registrations.count({
        where: {
          event: { manager_id: userId },
          status: "completed",
        },
      }),
      prisma.events.findMany({
        where: { manager_id: userId },
        orderBy: [{ total_comments: "desc" }, { total_likes: "desc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          banner_url: true,
          start_time: true,
          total_comments: true,
          total_likes: true,
        },
      }),
    ]);
  return {
    total_events: eventCount,
    total_registrations: totalRegistrations,
    total_participants: totalParticipants,
    top_events: topEvents,
  };
}

//Admin
export async function getAdminDashboard() {
  const [users, events, registrations, posts, comments, likes] =
    await Promise.all([
      prisma.users.count(),
      prisma.events.count(),
      prisma.registrations.count(),
      prisma.posts.count(),
      prisma.comments.count(),
      prisma.likes.count(),
    ]);

  const hotEvents = await prisma.events.findMany({
    where: { status: "active" },
    orderBy: [
      { total_comments: "desc" },
      { total_likes: "desc" },
      { total_joined: "desc" },
    ],
    take: 10,
    select: {
      id: true,
      title: true,
      category: { select: { name: true } },
      banner_url: true,
      start_time: true,
      total_comments: true,
      total_likes: true,
      total_joined: true,
    },
  });

  return {
    stats: {
      users,
      events,
      registrations,
      posts,
      comments,
      likes,
    },
    hot_events: hotEvents,
  };
}
