import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const ATTACHMENTS = [
  "https://images.unsplash.com/photo-1600891964599-f61ba0e24092",
  "https://images.unsplash.com/photo-1501004318641-b39e6451bec6",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b",
];

async function main() {
  // ===== CLEAR ĐÚNG THỨ TỰ =====
  await prisma.likes.deleteMany();
  await prisma.attachments.deleteMany();
  await prisma.comments.deleteMany();
  await prisma.posts.deleteMany();
  await prisma.event_channels.deleteMany();

  // ===== DATA =====
  const events = await prisma.events.findMany({
    where: { status: "active" },
  });
  if (events.length === 0) throw new Error("Không có event ACTIVE");

  const users = await prisma.users.findMany();
  if (users.length === 0) throw new Error("Không có users");

  for (const event of events) {
    // tạo channel
    await prisma.event_channels.upsert({
      where: { event_id: event.id },
      update: {},
      create: {
        event_id: event.id,
        opened_by: event.manager_id,
      },
    });

    const postCount = rand(7, 9);
    const postsWithAttachment = rand(1, 2);
    const attachmentPostIndexes = new Set<number>();

    while (attachmentPostIndexes.size < postsWithAttachment) {
      attachmentPostIndexes.add(rand(0, postCount - 1));
    }

    for (let i = 0; i < postCount; i++) {
      const author = pick(users);

      const post = await prisma.posts.create({
        data: {
          event_id: event.id,
          author_id: author.id,
          content: `Bài viết ${i + 1} trong sự kiện "${event.title}"`,
        },
      });

      // attachments cho post (1–2 bài / event)
      if (attachmentPostIndexes.has(i)) {
        const url = pick(ATTACHMENTS);
        await prisma.attachments.create({
          data: {
            post_id: post.id,
            file_url: url,
            file_type: "image",
          },
        });
      }

      // ===== COMMENTS =====
      const commentCount = rand(2, 4);
      for (let c = 0; c < commentCount; c++) {
        const commenter = pick(users);
        const comment = await prisma.comments.create({
          data: {
            post_id: post.id,
            author_id: commenter.id,
            content: `Bình luận ${c + 1} cho bài viết`,
          },
        });

        // likes cho comment
        const likeCount = rand(0, 3);
        const likedUsers = [...users].sort(() => 0.5 - Math.random()).slice(0, likeCount);
        for (const u of likedUsers) {
          await prisma.likes.create({
            data: {
              user_id: u.id,
              comment_id: comment.id,
            },
          });
        }
      }

      // ===== LIKES POST =====
      const postLikeCount = rand(1, 5);
      const postLikedUsers = [...users].sort(() => 0.5 - Math.random()).slice(0, postLikeCount);
      for (const u of postLikedUsers) {
        await prisma.likes.create({
          data: {
            user_id: u.id,
            post_id: post.id,
          },
        });
      }

    }
    const events = await prisma.events.findMany();

for (const event of events) {
  const posts = await prisma.posts.findMany({
    where: { event_id: event.id },
    select: { id: true },
  });

  const postIds = posts.map(p => p.id);

  const [postLikes, commentLikes, comments] = await Promise.all([
    prisma.likes.count({ where: { post_id: { in: postIds } } }),
    prisma.likes.count({ where: { comment: { post_id: { in: postIds } } } }),
    prisma.comments.count({ where: { post_id: { in: postIds } } }),
  ]);

  await prisma.events.update({
    where: { id: event.id },
    data: {
      total_likes: postLikes + commentLikes,
      total_comments: comments,
    },
  });
}
  }

  console.log("Seeded event channels + posts + comments + likes");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
