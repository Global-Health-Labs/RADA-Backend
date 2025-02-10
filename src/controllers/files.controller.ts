import { Request, Response } from "express";
import { db } from "../db";
import { experimentFiles, naatExperiments, lfaExperiments } from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { z } from "zod";
import config from "../config";

type ExperimentType = "NAAT" | "LFA";

const s3Client = new S3Client({
  region: config.aws.region,
});

const BUCKET_NAME = config.aws.documentsBucketName;

// Validation schemas
const presignRequestSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  fileSize: z.number(),
});

const fileMetadataSchema = z.object({
  fileName: z.string(),
  s3Key: z.string(),
  fileSize: z.number(),
  contentType: z.string(),
});

async function getExperiment(experimentId: string, type: ExperimentType) {
  if (type === "NAAT") {
    return db.query.naatExperiments.findFirst({
      where: eq(naatExperiments.id, experimentId),
    });
  }

  return db.query.lfaExperiments.findFirst({
    where: eq(lfaExperiments.id, experimentId),
  });
}

export async function getPresignedUrl(req: Request, res: Response) {
  try {
    const { experimentId } = req.params;
    const experimentType = req.query.type as ExperimentType;
    const validation = presignRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    const { fileName, contentType, fileSize } = validation.data;

    // Verify experiment exists and get its type
    const experiment = await getExperiment(experimentId, experimentType);

    if (!experiment) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    // Generate a unique key for the file
    const fileExtension = fileName.split(".").pop();
    const s3Key = `experiments/${experimentType.toLowerCase()}/${experimentId}/${randomUUID()}.${fileExtension}`;

    // Create the pre-signed POST command
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
      ChecksumAlgorithm: "CRC32",
      Metadata: {
        experimentId,
        experimentType,
      },
    });

    try {
      const url = await getSignedUrl(s3Client, command, { 
        expiresIn: 3600,
      });

      res.json({
        url,
        fields: {},
        key: s3Key,
      });
    } catch (error) {
      console.error("Error generating pre-signed URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
}

export async function saveFileMetadata(req: Request, res: Response) {
  try {
    const { experimentId } = req.params;
    const experimentType = req.query.type as ExperimentType;

    const validation = fileMetadataSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    const { fileName, s3Key, fileSize, contentType } = validation.data;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify experiment exists and get its type
    const experiment = await getExperiment(experimentId, experimentType);

    if (!experiment) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    const [file] = await db
      .insert(experimentFiles)
      .values({
        experimentId,
        experimentType,
        fileName,
        s3Key,
        contentType,
        fileSize,
        uploadedBy: userId,
      })
      .returning();

    res.json(file);
  } catch (error) {
    console.error("Error saving file metadata:", error);
    res.status(500).json({ error: "Failed to save file metadata" });
  }
}

export async function getExperimentFiles(req: Request, res: Response) {
  try {
    const { experimentId } = req.params;

    const files = await db.query.experimentFiles.findMany({
      where: eq(experimentFiles.experimentId, experimentId),
      with: {
        uploader: {
          columns: {
            id: true,
            fullname: true,
            email: true,
          },
        },
      },
      orderBy: (files, { desc }) => [desc(files.createdAt)],
    });

    res.json(files);
  } catch (error) {
    console.error("Error fetching experiment files:", error);
    res.status(500).json({ error: "Failed to fetch experiment files" });
  }
}

export async function deleteFile(req: Request, res: Response) {
  try {
    const { experimentId, fileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const file = await db.query.experimentFiles.findFirst({
      where: and(
        eq(experimentFiles.id, fileId),
        eq(experimentFiles.experimentId, experimentId)
      ),
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Delete from S3
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: file.s3Key,
        })
      );
    } catch (error) {
      console.error("Error deleting file from S3:", error);
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete from database
    await db
      .delete(experimentFiles)
      .where(
        and(
          eq(experimentFiles.id, fileId),
          eq(experimentFiles.experimentId, experimentId)
        )
      );

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
}

export async function getFileDownloadUrl(req: Request, res: Response) {
  try {
    const { experimentId, fileId } = req.params;
    const { type } = req.query;

    if (!type || (type !== "NAAT" && type !== "LFA")) {
      return res.status(400).json({ error: "Invalid experiment type" });
    }

    // Get file metadata from database
    const file = await db.query.experimentFiles.findFirst({
      where: and(
        eq(experimentFiles.id, fileId),
        eq(experimentFiles.experimentId, experimentId),
        eq(experimentFiles.experimentType, type)
      ),
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Generate presigned URL for downloading
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: file.s3Key,
      ResponseContentDisposition: `attachment; filename="${file.fileName}"`,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL expires in 1 hour

    res.json({ url });
  } catch (error) {
    console.error("Error generating download URL:", error);
    res.status(500).json({ error: "Failed to generate download URL" });
  }
}
