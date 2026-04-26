import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ATTACHMENTS = [
  "https://images.unsplash.com/photo-1600891964599-f61ba0e24092",
  "https://images.unsplash.com/photo-1501004318641-b39e6451bec6",
];

async function main() {
  // 1. Dọn dẹp sạch sẽ data liên quan đến thảo luận
  await prisma.likes.deleteMany();
  await prisma.attachments.deleteMany();
  await prisma.comments.deleteMany();
  await prisma.posts.deleteMany();
  await prisma.event_channels.deleteMany();

  // CHỈ LẤY CÁC EVENT ACTIVE (Theo đúng yêu cầu của Vinh)
  const activeEvents = await prisma.events.findMany({
    where: { status: "active" },
    orderBy: { id: 'asc' }
  });

  // Lấy các user active để tạo tương tác cho thật
  const users = await prisma.users.findMany({ 
    where: { is_active: true },
    orderBy: { id: 'asc' } 
  });

  if (activeEvents.length === 0) {
    console.log("⚠️ Không có event ACTIVE nào để tạo channel. Hãy kiểm tra lại seedEvent!");
    return;
  }

  console.log(`🎬 Bắt đầu seed Channel cho ${activeEvents.length} sự kiện Active...`);

  for (let i = 0; i < activeEvents.length; i++) {
    const event = activeEvents[i];

    // Tạo channel: Chỉ event active mới có channel
    await prisma.event_channels.create({
      data: { 
        event_id: event.id, 
        opened_by: event.manager_id 
      },
    });

    // LOGIC PHÂN HÓA: Event có index i càng nhỏ thì càng nhiều bài viết (Top Home)
    const postCount = Math.max(1, 12 - i); 

    for (let p = 0; p < postCount; p++) {
      const post = await prisma.posts.create({
        data: {
          event_id: event.id,
          author_id: users[p % users.length].id,
          content: `Chào mọi người, đây là bài viết thảo luận thứ ${p + 1} cho sự kiện ${event.title}. Cùng nhau lan tỏa hành động đẹp nhé!`,
        },
      });

      // Thêm ảnh cho bài viết đầu tiên của mỗi event
      if (p === 0) {
        await prisma.attachments.create({
          data: {
            post_id: post.id,
            file_url: ATTACHMENTS[i % ATTACHMENTS.length],
            file_type: "image",
          },
        });
      }

      // Like cho bài viết: Giảm dần theo i
      const postLikeCount = Math.max(0, 15 - i); 
      for (let pl = 0; pl < postLikeCount; pl++) {
        await prisma.likes.create({
          data: { 
            user_id: users[pl % users.length].id, 
            post_id: post.id 
          },
        });
      }

      // Comment: Phân hóa để tạo độ sôi động khác nhau
      const commentCount = Math.max(0, 6 - Math.floor(i / 2));
      for (let c = 0; c < commentCount; c++) {
        const comment = await prisma.comments.create({
          data: {
            post_id: post.id,
            author_id: users[(c + 10) % users.length].id,
            content: `Thật tuyệt vời! Mình rất mong chờ sự kiện này 😍`,
          },
        });

        // Like cho comment
        const commLikeCount = Math.max(0, 5 - Math.floor(i / 3));
        for (let cl = 0; cl < commLikeCount; cl++) {
          await prisma.likes.create({
            data: { 
              user_id: users[cl % users.length].id, 
              comment_id: comment.id 
            },
          });
        }
      }
    }
  }

  // 2. CẬP NHẬT AGGREGATIONS CHO TẤT CẢ EVENT (Bao gồm cả event không có channel)
  const allEvents = await prisma.events.findMany();
  for (const ev of allEvents) {
    const posts = await prisma.posts.findMany({ 
        where: { event_id: ev.id }, 
        select: { id: true } 
    });
    const postIds = posts.map(p => p.id);

    const [pLikes, cLikes, tComments] = await Promise.all([
      prisma.likes.count({ where: { post_id: { in: postIds } } }),
      prisma.likes.count({ where: { comment: { post_id: { in: postIds } } } }),
      prisma.comments.count({ where: { post_id: { in: postIds } } }),
    ]);

    await prisma.events.update({
      where: { id: ev.id },
      data: {
        total_likes: pLikes + cLikes,
        total_comments: tComments,
      },
    });
  }

  console.log("✅ Seed Channel thành công!");
  console.log("💡 Tips: Chỉ các event ACTIVE mới có dữ liệu thảo luận. Các event Pending/Reject sẽ có 0 Like/Comment.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());