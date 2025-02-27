import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { Request, Response, Router } from "express";
import { db } from "../db";
import {
  lfaExperiments,
  lfaPresets,
  naatExperiments,
  naatPresets,
  users,
} from "../db/schema";
import { authenticateToken } from "../middleware/auth";
import {
  getPresignedUrl,
  saveFileMetadata,
  getExperimentFiles,
  deleteFile,
  getFileDownloadUrl,
} from "../controllers/files.controller";

const router = Router();

export type Experiment = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  ownerFullName: string;
  type: "LFA" | "NAAT";
  useAsPreset: boolean;
};

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    currentPage: number;
    lastPage: number;
    perPage: number;
  };
}

interface ExperimentsQuery {
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  type: "LFA" | "NAAT";
}

const getExperimentsQuery = async (
  query: ExperimentsQuery,
  userId: string,
  userRole: string
): Promise<PaginatedResponse<Experiment>> => {
  const page = query.page || 1;
  const perPage = query.perPage || 10;
  const offset = (page - 1) * perPage;

  let baseQuery;
  if (query.type === "NAAT") {
    baseQuery = db
      .select({
        experiment: {
          id: naatExperiments.id,
          name: naatExperiments.name,
          createdAt: naatExperiments.createdAt,
          updatedAt: naatExperiments.updatedAt,
          ownerId: naatExperiments.ownerId,
        },
        owner: {
          fullname: users.fullname,
        },
        preset: {
          id: naatPresets.id,
        },
      })
      .from(naatExperiments)
      .leftJoin(users, eq(naatExperiments.ownerId, users.id))
      .leftJoin(naatPresets, eq(naatExperiments.id, naatPresets.experimentId));
  } else {
    baseQuery = db
      .select({
        experiment: {
          id: lfaExperiments.id,
          name: lfaExperiments.name,
          createdAt: lfaExperiments.createdAt,
          updatedAt: lfaExperiments.updatedAt,
          ownerId: lfaExperiments.ownerId,
        },
        owner: {
          fullname: users.fullname,
        },
        preset: {
          id: lfaPresets.id,
        },
      })
      .from(lfaExperiments)
      .leftJoin(users, eq(lfaExperiments.ownerId, users.id))
      .leftJoin(lfaPresets, eq(lfaExperiments.id, lfaPresets.experimentId));
  }

  // Apply filters
  const conditions = [];

  // Filter by owner if not admin/supervisor
  if (!["admin", "supervisor"].includes(userRole)) {
    conditions.push(
      eq(
        query.type === "NAAT"
          ? naatExperiments.ownerId
          : lfaExperiments.ownerId,
        userId
      )
    );
  }

  // Search filter
  if (query.search) {
    conditions.push(
      ilike(
        query.type === "NAAT" ? naatExperiments.name : lfaExperiments.name,
        `%${query.search}%`
      )
    );
  }

  if (conditions.length > 0) {
    baseQuery = baseQuery.where(and(...conditions));
  }

  // Apply sorting
  if (query.sortBy) {
    const sortField = query.sortBy as keyof (
      | typeof naatExperiments.$inferSelect
      | typeof lfaExperiments.$inferSelect
    );
    const table = query.type === "NAAT" ? naatExperiments : lfaExperiments;
    if (sortField in table) {
      baseQuery = baseQuery.orderBy(
        query.sortOrder === "desc"
          ? desc(table[sortField])
          : asc(table[sortField])
      ) as any;
    }
  } else {
    baseQuery = baseQuery.orderBy(
      desc(
        query.type === "NAAT"
          ? naatExperiments.createdAt
          : lfaExperiments.createdAt
      )
    ) as any;
  }

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(query.type === "NAAT" ? naatExperiments : lfaExperiments)
    .where(and(...conditions));

  const totalCount = Number(countResult[0].count);

  // Apply pagination
  baseQuery = baseQuery.limit(perPage).offset(offset);

  const data = (await baseQuery) as Array<{
    experiment: Experiment;
    owner: { fullname: string };
    preset?: { id: string } | null;
  }>;

  return {
    data: data.map(({ experiment, owner, preset }) =>
      formatExperimentData(
        experiment,
        owner?.fullname || "Owner not found",
        query.type,
        !!preset
      )
    ),
    meta: {
      total: totalCount,
      currentPage: page,
      lastPage: Math.ceil(totalCount / perPage),
      perPage,
    },
  };
};

// Helper function to format experiment data for client
function formatExperimentData(
  experiment: Experiment,
  ownerName: string,
  type: "LFA" | "NAAT",
  useAsPreset: boolean
): Experiment {
  return {
    id: experiment.id,
    name: experiment.name,
    ownerFullName: ownerName,
    createdAt: experiment.createdAt,
    updatedAt: experiment.updatedAt,
    ownerId: experiment.ownerId,
    type: type,
    useAsPreset: useAsPreset,
  };
}

// Get experiments list
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const query = {
      page: parseInt(req.query.page as string),
      perPage: parseInt(req.query.perPage as string),
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as "asc" | "desc",
      search: req.query.search as string,
      type: (req.query.type || "NAAT") as "LFA" | "NAAT",
    };

    const result = await getExperimentsQuery(
      query,
      req.user!.id,
      req.user!.role
    );

    res.json(result);
  } catch (error: any) {
    console.error("Get experiments error:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch experiments", error: error.message });
  }
});

// File operations
router.post("/:experimentId/files/presign", authenticateToken, getPresignedUrl);

router.post("/:experimentId/files", authenticateToken, saveFileMetadata);

router.get("/:experimentId/files", authenticateToken, getExperimentFiles);

router.get(
  "/:experimentId/files/:fileId/download",
  authenticateToken,
  getFileDownloadUrl
);

router.delete("/:experimentId/files/:fileId", authenticateToken, deleteFile);

export default router;
