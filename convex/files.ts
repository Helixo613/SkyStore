import { v } from "convex/values";
import { mutation, query, internalAction, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

function getAwsConfig() {
  const region = process.env.CONVEX_AWS_REGION;
  const accessKeyId = process.env.CONVEX_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CONVEX_AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing AWS configuration environment variables");
  }

  return {
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };
}

function getS3Client() {
  return new S3Client(getAwsConfig());
}

function getBucketName() {
  const bucketName = process.env.CONVEX_AWS_S3_BUCKET;
  if (!bucketName) {
    throw new Error("Missing CONVEX_AWS_S3_BUCKET environment variable");
  }

  return bucketName;
}

async function assertOwnsParent(
  ctx: MutationCtx,
  parentId: Id<"folders"> | null | undefined,
  userId: Id<"users">,
) {
  if (!parentId) return;
  const parent = await ctx.db.get(parentId);
  if (!parent || parent.ownerId !== userId) throw new Error("Folder not found or unauthorized");
}

export const generateUploadUrl = mutation({
  args: { fileName: v.string(), fileType: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Prefix with the uploader's id so createFile can verify the key belongs to the caller
    const uniqueFileName = `${userId}/${uuidv4()}-${args.fileName}`;
    const s3Client = getS3Client();
    const contentType = args.fileType || "application/octet-stream";

    const command = new PutObjectCommand({
      Bucket: getBucketName(),
      Key: uniqueFileName, // Use the UUID as the file name
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // Optionally, return the unique file name along with the URL
    return { uploadUrl, uniqueFileName };
  },
});


// export const generateUploadUrl = mutation({
//   args: {},
//   handler: async (ctx) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) throw new Error("Not authenticated");
//     return await ctx.storage.generateUploadUrl();
//   },
// });

export const createFile = mutation({
  args: {
    name: v.string(),
    size: v.number(),
    storageId: v.string(),
    parentId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertOwnsParent(ctx, args.parentId, userId);

    // Only keys issued to this user by generateUploadUrl, and only once
    if (!args.storageId.startsWith(`${userId}/`)) throw new Error("Unauthorized");
    const existing = await ctx.db
      .query("files")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .first();
    if (existing) throw new Error("File already registered");

    return await ctx.db.insert("files", {
      name: args.name,
      size: args.size,
      storageId: args.storageId,
      parentId: args.parentId,
      ownerId: userId,
    });
  },
});

export const createFolder = mutation({
  args: {
    name: v.string(),
    parentId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertOwnsParent(ctx, args.parentId, userId);

    return await ctx.db.insert("folders", {
      name: args.name,
      parentId: args.parentId,
      ownerId: userId,
    });
  },
});


export const listItems = query({
  args: {
    parentId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { files: [], folders: [] };
    const s3Client = getS3Client();

    const files = await ctx.db
      .query("files")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .filter((q) => q.eq(q.field("ownerId"), userId))
      .collect();

    const folders = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .filter((q) => q.eq(q.field("ownerId"), userId))
      .collect();

    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        const command = new GetObjectCommand({
          Bucket: getBucketName(),
          Key: file.storageId,
        });
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        return { ...file, url };
      })
    );

    return { files: filesWithUrls, folders };
  },
});
// export const listItems = query({
//   args: {
//     parentId: v.optional(v.union(v.id("folders"), v.null())),
//   },
//   handler: async (ctx, args) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) return { files: [], folders: [] };

//     const files = await ctx.db
//       .query("files")
//       .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
//       .collect();

//     const folders = await ctx.db
//       .query("folders")
//       .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
//       .collect();

//     const filesWithUrls = await Promise.all(
//       files.map(async (file) => ({
//         ...file,
//         url: await ctx.storage.getUrl(file.storageId),
//       }))
//     );

//     return { files: filesWithUrls, folders };
//   },
// });

// export const deleteFile = mutation({
//   args: { fileId: v.id("files") },
//   handler: async (ctx, args) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) throw new Error("Not authenticated");

//     const file = await ctx.db.get(args.fileId);
//     if (!file || file.ownerId !== userId) {
//       throw new Error("File not found or unauthorized");
//     }

//     await ctx.storage.delete(file.storageId);
//     await ctx.db.delete(args.fileId);
//   },
// });

export const deleteFile = mutation({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Find the file in the database by storageId
    const file = await ctx.db
      .query("files")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .first();

    if (!file) {
      console.error("File not found in database:", {
        userId,
        storageId: args.storageId,
      });
      throw new Error("File not found");
    }
    
    if (file.ownerId !== userId) {
      console.error("Unauthorized file deletion attempt:", {
        userId,
        storageId: args.storageId,
        fileOwnerId: file.ownerId,
      });
      throw new Error("Unauthorized");
    }

    // Delete the file record from the database
    await ctx.db.delete(file._id);
    // S3 delete runs only after the ownership check above, and only if this mutation commits
    await ctx.scheduler.runAfter(0, internal.files.deleteFileFromS3, {
      storageId: args.storageId,
    });
  },
});

export const deleteFileFromS3 = internalAction({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const s3Client = getS3Client();
    const deleteParams = {
      Bucket: getBucketName(),
      Key: args.storageId,
    };

    try {
      await s3Client.send(new DeleteObjectCommand(deleteParams));
    } catch (error) {
      console.error("Error deleting file from S3:", error);
      throw new Error("Failed to delete file from S3");
    }
  },
});

export const deleteFolder = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.ownerId !== userId) {
      throw new Error("Folder not found or unauthorized");
    }

    // Walk the subtree so nested files/folders (and their S3 objects) aren't orphaned.
    // ponytail: single mutation, fine for personal folders; very large trees could hit Convex per-mutation limits
    const queue = [folder._id];
    while (queue.length > 0) {
      const id = queue.pop()!;
      const files = await ctx.db
        .query("files")
        .withIndex("by_parent", (q) => q.eq("parentId", id))
        .collect();
      for (const file of files) {
        if (file.ownerId !== userId) continue; // defense in depth; parent checks should prevent this
        await ctx.db.delete(file._id);
        await ctx.scheduler.runAfter(0, internal.files.deleteFileFromS3, {
          storageId: file.storageId,
        });
      }
      const children = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q) => q.eq("parentId", id))
        .collect();
      queue.push(...children.filter((c) => c.ownerId === userId).map((c) => c._id));
      await ctx.db.delete(id);
    }
  },
});
