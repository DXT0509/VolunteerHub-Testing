import { PrismaClient } from "@prisma/client";
import webpush from "web-push";

const prisma = new PrismaClient();

//configure web-push
webpush.setVapidDetails(
  "https://volunteerhub.com", //Xác thực domain hợp lệ
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

//Send Notification
export async function sendNotification(
  userId: number,
  type: string,
  title: string,
  body: string,
  data?: any
) {
  //Tạo record thông báo trong DB
  const notification = await prisma.notifications.create({
    data: { user_id: userId, type, title, body, data },
  });

  //Gửi web push nếu user có đăng ký
  const subs = await prisma.push_subscriptions.findMany({
    where: { user_id: userId },
  });

  const payload = JSON.stringify({
    title,
    body,
    data,
  });

  await Promise.allSettled(
    //Giúp chạy song song, không bị dừng bởi lỗi
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
      } catch (err) {
        // nếu lỗi (unsubscribe, expired), xóa subscription
        if (
          (typeof err === "object" &&
            err !== null &&
            "statusCode" in err &&
            (err as any).statusCode === 410) ||
          (err as any).statusCode === 404
        ) {
          await prisma.push_subscriptions.delete({ where: { id: sub.id } });
        }
      }
    })
  );

  return notification;
}

//Get Notifications for User
export async function getUserNotifications(userId: number) {
  return prisma.notifications.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" }, //Mới nhất
    take: 50,
  });
}

//Mark Notification as Read
export async function markAsRead(userId: number, notificationId: number) {
  const notif = await prisma.notifications.findUnique({
    where: { id: notificationId },
  });
  if (!notif || notif.user_id !== userId)
    throw new Error("Không tìm thấy thông báo");

  return prisma.notifications.update({
    where: { id: notificationId },
    data: { is_read: true },
  });
}

//subscribe to Push Notifications
export async function subscribePush(
  userId: number,
  endpoint: string,
  p256dh: string,
  auth: string
) {
  return prisma.push_subscriptions.upsert({
    where: { endpoint },
    update: { last_used_at: new Date() },
    create: { user_id: userId, endpoint, p256dh, auth },
  });
}

//unsubscribe from Push Notifications
export async function unsubscribePush(userId: number, endpoint: string) {
  const sub = await prisma.push_subscriptions.findFirst({
    where: { user_id: userId, endpoint },
  });
  if (!sub) throw new Error("Không tìm thấy đăng ký");
  await prisma.push_subscriptions.delete({ where: { id: sub.id } });
  return { unsubscribed: true };
}
