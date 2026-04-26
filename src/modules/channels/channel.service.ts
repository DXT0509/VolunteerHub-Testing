import { PrismaClient } from "@prisma/client";
import { sendNotification } from "../notifications/notification.service";
const prisma = new PrismaClient();

function detectFileType(url: string): string {
  const ext = url.split(".").pop()?.toLowerCase();
  if (!ext) return "file";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "video";
  if (["pdf", "docx", "xlsx"].includes(ext)) return "document";
  return "file";
}

async function assertChannelAccess(userId: number, eventId: number) {
  const event = await prisma.events.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Sự kiện không tồn tại");
  if (event.status !== "active")
    throw new Error("Kênh chỉ mở sau khi sự kiện đang hoạt động");
  const user = await prisma.users.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
  if (!user) throw new Error("Người dùng không tồn tại");
  if (event.manager_id === userId) return { event };
  if (user.roles[0].role.name === "ADMIN" || user.roles[0].role.name === "EVENT_MANAGER") return { event };
  const registered = await prisma.registrations.findFirst({
    where: { user_id: userId, event_id: eventId, status: "approved" },
  });
  if (!registered) throw new Error("Bạn chưa dược duyệt tham gia sự kiện này");
  return { event };
}

//Get Posts(Có sử dụng phân trang)
export async function getEventPosts(
  userId: number,
  eventId: number,
  page = 1,
  pageSize = 10
) {
  await assertChannelAccess(userId, eventId);

  const [total, items] = await Promise.all([
    prisma.posts.count({ where: { event_id: eventId } }),
    prisma.posts.findMany({
      where: { event_id: eventId },
      include: {
        author: { select: { id: true, full_name: true, avatar_url: true } },
        _count: { select: { comments: true, likes: true } },
        likes: { where: { user_id: userId }, select: { id: true } },
        attachments: {
          select: {
            id: true,
            file_url: true,
            file_type: true,
            created_at: true,
          },
        },
        comments: {
          orderBy: { created_at: "asc" },
          include: {
            author: { select: { id: true, full_name: true, avatar_url: true } },
            _count: { select: { likes: true } },
            likes: { where: { user_id: userId }, select: { id: true } },
            attachments: { select: { id: true, file_url: true, file_type: true, created_at: true } },
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    items: items.map((p: any) => ({
      ...p,
      liked: p.likes.length > 0,
      likes: undefined,
    })),
  };
}

//Create Post
export async function createPost(
  userId: number,
  eventId: number,
  content: string,
  attachments: string[] = []
) {
  if (!content && attachments.length === 0)
    throw new Error("Bài viết phải có nội dung hoặc ít nhất một tệp đính kèm");

  const { event } = await assertChannelAccess(userId, eventId);

  await prisma.event_channels.upsert({
    where: { event_id: event.id },
    update: {},
    create: { event_id: event.id, opened_by: userId },
  });

  const post = await prisma.posts.create({
    data: { event_id: eventId, author_id: userId, content },
  });

  const participants = await prisma.registrations.findMany({
    where: { event_id: eventId, status: "approved" },
    select: { user_id: true },
  });

  const author = await prisma.users.findUnique({
    where: { id: userId },
    select: { full_name: true },
  });
  const authorName = author ? author.full_name : "Một người dùng";

  for (const p of participants) {
    if (p.user_id !== userId) {
      await sendNotification(
        p.user_id,
        "new_post",
        "Bài viết mới trong sự kiện",
        `${authorName} vừa đăng bài trong ${event.title}`,
        { event_id: eventId }
      );
    }
  }

  if (attachments.length > 0) {
    await prisma.attachments.createMany({
      data: attachments.map((url) => ({
        file_url: url,
        file_type: detectFileType(url),
        post_id: post.id,
      })),
    });
  }

  await prisma.events.update({
    where: { id: eventId },
    data: { total_comments: { increment: 1 } },
  });

  return post;
}

//Delete Post
export async function deletePost(userId: number, postId: number) {
  const post = await prisma.posts.findUnique({
    where: { id: postId },
    include: { event: true },
  });
  if (!post) throw new Error("Bài viết không tồn tại");

  const isManager = post.event.manager_id === userId;
  const isAuthor = post.author_id === userId;
  if (!isManager && !isAuthor)
    throw new Error("Bạn không có quyển xóa bài viết này");

  const [likesCount, commentsCount] = await Promise.all([
    prisma.likes.count({ where: { post_id: postId } }),
    prisma.comments.count({ where: { post_id: postId } }),
  ]);

  await prisma.attachments.deleteMany({
    where: { post_id: postId },
  });
  await prisma.likes.deleteMany({ where: { post_id: postId } });
  await prisma.comments.deleteMany({ where: { post_id: postId } });
  await prisma.posts.delete({ where: { id: postId } });

  await prisma.events.update({
    where: { id: post.event_id },
    data: {
      total_likes: { decrement: likesCount },
      total_comments: { decrement: commentsCount + 1 },
    },
  });

  return { deleted: true };
}

//Create Comment
export async function createComment(
  userId: number,
  postId: number,
  content: string,
  attachments: string[] = []
) {
  if (!content && attachments.length === 0)
    throw new Error("Cần có nội dung hoặc ít nhất một tệp đính kèm");
  const post = await prisma.posts.findUnique({ where: { id: postId } });
  if (!post) throw new Error("Bài viết không tồn tại");

  await assertChannelAccess(userId, post.event_id);

  const cmt = await prisma.comments.create({
    data: { post_id: postId, author_id: userId, content },
    include: {
      author: { select: { id: true, full_name: true, avatar_url: true } },
    },
  });
  if (attachments.length > 0) {
    await prisma.attachments.createMany({
      data: attachments.map((url) => ({
        file_url: url,
        file_type: detectFileType(url),
        comment_id: cmt.id,
      })),
    });
  }
  await prisma.events.update({
    where: { id: post.event_id },
    data: { total_comments: { increment: 1 } },
  });

  await sendNotification(
    post.author_id,
    "new_comment",
    "Bình luận mới",
    `${cmt.author.full_name} vừa bình luận: "${content}"`,
    { post_id: postId }
  );

  // Re-fetch the comment with attachments and related info so the API response
  // contains attachments immediately after creation (client expects this).
  const fullComment = await prisma.comments.findUnique({
    where: { id: cmt.id },
    include: {
      author: { select: { id: true, full_name: true, avatar_url: true } },
      attachments: { select: { id: true, file_url: true, file_type: true, created_at: true } },
      _count: { select: { likes: true } },
      likes: { where: { user_id: userId }, select: { id: true } },
    },
  });

  return fullComment;
}

//Delete Comment
export async function deleteComment(userId: number, commentId: number) {
  const comment = await prisma.comments.findUnique({
    where: { id: commentId },
    include: { post: { include: { event: true } } },
  });
  if (!comment) throw new Error("Bình luận không tồn tại");

  const isManager = comment.post.event.manager_id === userId;
  const isAuthor = comment.author_id === userId;
  if (!isManager && !isAuthor)
    throw new Error("Bạn không có quyền xóa bình luận này");

  const likesCount = await prisma.likes.count({
    where: { comment_id: commentId },
  });

  await prisma.attachments.deleteMany({
    where: { comment_id: commentId },
  });
  await prisma.likes.deleteMany({ where: { comment_id: commentId } });
  await prisma.comments.delete({ where: { id: commentId } });

  await prisma.events.update({
    where: { id: comment.post.event_id },
    data: {
      total_likes: { decrement: likesCount },
      total_comments: { decrement: 1 },
    },
  });

  return { deleted: true };
}

//Toggle like
export async function toggleLike(
  userId: number,
  postId?: number,
  commentId?: number
) {
  if ((!postId && !commentId) || (postId && commentId))
    throw new Error("Cần chỉ định postId hoặc commentId");

  if (postId) {
    const post = await prisma.posts.findUnique({ where: { id: postId } });
    if (!post) throw new Error("Bài viết không tồn tại");
    await assertChannelAccess(userId, post.event_id);

    const existing = await prisma.likes.findFirst({
      where: { user_id: userId, post_id: postId },
    });
    if (existing) {
      await prisma.likes.delete({ where: { id: existing.id } });
      await prisma.events.update({
        where: { id: post.event_id },
        data: { total_likes: { decrement: 1 } },
      });
      return { liked: false };
    } else {
      await prisma.likes.create({ data: { user_id: userId, post_id: postId } });
      await prisma.events.update({
        where: { id: post.event_id },
        data: { total_likes: { increment: 1 } },
      });
      return { liked: true };
    }
  }

  const comment = await prisma.comments.findUnique({
    where: { id: commentId },
    include: { post: true },
  });
  if (!comment) throw new Error("Bình luận không tồn tại");

  await assertChannelAccess(userId, comment.post.event_id);

  const existing = await prisma.likes.findFirst({
    where: { user_id: userId, comment_id: commentId },
  });
  if (existing) {
    await prisma.likes.delete({ where: { id: existing.id } });
    await prisma.events.update({
      where: { id: comment.post.event_id },
      data: { total_likes: { decrement: 1 } },
    });
    return { liked: false };
  } else {
    await prisma.likes.create({
      data: { user_id: userId, comment_id: commentId },
    });
    await prisma.events.update({
      where: { id: comment.post.event_id },
      data: { total_likes: { increment: 1 } },
    });
    return { liked: true };
  }
}
