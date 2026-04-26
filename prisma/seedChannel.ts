import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ATTACHMENTS = [
  "https://images.unsplash.com/photo-1600891964599-f61ba0e24092",
  "https://images.unsplash.com/photo-1501004318641-b39e6451bec6",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b",
];

async function main() {
  // ===== CLEAR THEO THỨ TỰ =====
  await prisma.likes.deleteMany();
  await prisma.attachments.deleteMany();
  await prisma.comments.deleteMany();
  await prisma.posts.deleteMany();
  await prisma.event_channels.deleteMany();

  // ===== LẤY DATA GỐC =====
  const events = await prisma.events.findMany({
    where: { status: "active" },
    orderBy: { id: 'asc' }
  });
  if (events.length === 0) throw new Error("Không có event ACTIVE để tạo channel");

  const users = await prisma.users.findMany({ orderBy: { id: 'asc' } });
  if (users.length === 0) throw new Error("Không có users để tạo tương tác");

  for (const event of events) {
    // 1. Tạo channel
    await prisma.event_channels.upsert({
      where: { event_id: event.id },
      update: {},
      create: {
        event_id: event.id,
        opened_by: event.manager_id,
      },
    });

    // 2. Tạo 5 bài viết cố định cho mỗi event
    const FIXED_POST_COUNT = 5;
    for (let i = 0; i < FIXED_POST_COUNT; i++) {
      // Tác giả: Bài đầu là Manager, các bài sau xoay vòng User
      const authorId = i === 0 ? event.manager_id : users[i % users.length].id;

      const post = await prisma.posts.create({
        data: {
          event_id: event.id,
          author_id: authorId,
          content: `Noi dung bai viet so ${i + 1} cua su kien ${event.id}`,
        },
      });

      // 3. Đính kèm ảnh (Chỉ dành cho bài viết đầu tiên của mỗi event)
      if (i === 0) {
        await prisma.attachments.create({
          data: {
            post_id: post.id,
            file_url: ATTACHMENTS[0],
            file_type: "image",
          },
        });
      }

      // 4. Tạo 2 bình luận cố định cho mỗi bài viết
      const FIXED_COMMENT_COUNT = 2;
      for (let c = 0; c < FIXED_COMMENT_COUNT; c++) {
        const commenter = users[(c + 5) % users.length]; // Dùng user khác để comment
        const comment = await prisma.comments.create({
          data: {
            post_id: post.id,
            author_id: commenter.id,
            content: `Binh luan so ${c + 1} cho bai viet ${post.id}`,
          },
        });

        // 5. Like cho bình luận (Cố định 2 likes)
        for (let cl = 0; cl < 2; cl++) {
          await prisma.likes.create({
            data: {
              user_id: users[cl % users.length].id,
              comment_id: comment.id,
            },
          });
        }
      }

      // 6. Like cho bài viết (Cố định 3 likes)
      for (let pl = 0; pl < 3; pl++) {
        await prisma.likes.create({
          data: {
            user_id: users[(pl + 2) % users.length].id,
            post_id: post.id,
          },
        });
      }
    }
  }

  // 7. CẬP NHẬT TỔNG HỢP (Aggregations) vào bảng Events
  const allEvents = await prisma.events.findMany();
  for (const ev of allEvents) {
    const posts = await prisma.posts.findMany({
      where: { event_id: ev.id },
      select: { id: true },
    });

    const postIds = posts.map(p => p.id);

    const [postLikes, commentLikes, totalComments] = await Promise.all([
      prisma.likes.count({ where: { post_id: { in: postIds } } }),
      prisma.likes.count({ where: { comment: { post_id: { in: postIds } } } }),
      prisma.comments.count({ where: { post_id: { in: postIds } } }),
    ]);

    await prisma.events.update({
      where: { id: ev.id },
      data: {
        total_likes: postLikes + commentLikes,
        total_comments: totalComments,
      },
    });
  }

  console.log("✅ Seed thành công Channel, Post, Comment, Like cố định.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());