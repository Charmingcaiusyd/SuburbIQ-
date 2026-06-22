import { z } from "zod";
import { allowedMapAccessTiers, type MapEntitlement } from "@/domain/geography";
import { prisma } from "@/server/db/prisma";

export const suburbSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

function now() {
  return new Date();
}

function isPostcodeLike(query: string) {
  return /^\d{3,4}$/.test(query);
}

function publicScorePreview(scoreJson: unknown) {
  if (!scoreJson || typeof scoreJson !== "object" || Array.isArray(scoreJson)) {
    return {};
  }

  const score = scoreJson as Record<string, unknown>;

  return {
    price_band: score.price_band ?? score.priceBand ?? null,
    historical_median_price:
      score.historical_median_price ?? score.historicalMedianPrice ?? null,
    sales_count_history: score.sales_count_history ?? score.salesCountHistory ?? null,
    basic_demographics: score.basic_demographics ?? score.basicDemographics ?? null,
    data_freshness_summary:
      score.data_freshness_summary ?? score.dataFreshnessSummary ?? null,
    public_notes: score.public_notes ?? score.publicNotes ?? null
  };
}

function publicConfidencePreview(confidenceJson: unknown) {
  if (
    !confidenceJson ||
    typeof confidenceJson !== "object" ||
    Array.isArray(confidenceJson)
  ) {
    return {};
  }

  const confidence = confidenceJson as Record<string, unknown>;

  return {
    confidence_band: confidence.confidence_band ?? confidence.confidenceBand ?? null,
    data_quality_flags:
      confidence.data_quality_flags ?? confidence.dataQualityFlags ?? [],
    low_confidence_warning_required:
      confidence.low_confidence_warning_required ??
      confidence.lowConfidenceWarningRequired ??
      false
  };
}

export async function getActivePublishedScoringRelease(city = "Sydney") {
  return prisma.scoringRelease.findFirst({
    where: {
      status: "published",
      dataRelease: {
        city,
        status: "published"
      }
    },
    orderBy: [
      {
        publishedAt: "desc"
      },
      {
        createdAt: "desc"
      }
    ],
    include: {
      dataRelease: true
    }
  });
}

export async function searchConfirmedSuburbPostcodeRelationships(input: {
  q: string;
  limit?: number;
}) {
  const parsed = suburbSearchQuerySchema.parse(input);
  const query = parsed.q;
  const effectiveNow = now();
  const searchWhere = isPostcodeLike(query)
    ? {
        postcode: {
          postcode: {
            startsWith: query
          }
        }
      }
    : {
        suburb: {
          salName: {
            contains: query,
            mode: "insensitive" as const
          }
        }
      };

  const relationships = await prisma.suburbPostcodeRelationship.findMany({
    where: {
      selectableFlag: true,
      suburb: {
        activeFlag: true
      },
      postcode: {
        activeFlag: true
      },
      OR: [
        {
          effectiveTo: null
        },
        {
          effectiveTo: {
            gt: effectiveNow
          }
        }
      ],
      ...searchWhere
    },
    include: {
      suburb: true,
      postcode: true
    },
    orderBy: [
      {
        suburb: {
          salName: "asc"
        }
      },
      {
        postcode: {
          postcode: "asc"
        }
      }
    ],
    take: parsed.limit
  });

  const activeScoringRelease = await getActivePublishedScoringRelease();
  const scoringRecords = activeScoringRelease
    ? await prisma.suburbScoringRecord.findMany({
        where: {
          scoringReleaseId: activeScoringRelease.id,
          suburbId: {
            in: relationships.map((relationship) => relationship.suburbId)
          }
        }
      })
    : [];
  const scoringBySuburbId = new Map(
    scoringRecords.map((record) => [record.suburbId, record])
  );

  return relationships.map((relationship) => {
    const scoring = scoringBySuburbId.get(relationship.suburbId);

    return {
      relationship_id: relationship.id,
      suburb_id: relationship.suburbId,
      postcode_id: relationship.postcodeId,
      sal_code: relationship.suburb.salCode,
      sal_name: relationship.suburb.salName,
      postcode: relationship.postcode.postcode,
      city: relationship.suburb.city,
      state: relationship.suburb.state,
      sa2_code: relationship.suburb.sa2Code,
      lga_code: relationship.suburb.lgaCode,
      gccsa_code: relationship.suburb.gccsaCode,
      selectable_flag: relationship.selectableFlag,
      relationship_confidence: relationship.relationshipConfidence,
      report_generation_allowed_flag:
        scoring?.reportGenerationAllowedFlag ?? false,
      report_block_reason: scoring?.reportBlockReason ?? null,
      scoring_release_id: activeScoringRelease?.id ?? null
    };
  });
}

export async function getSuburbPreview(suburbId: string) {
  const suburb = await prisma.suburb.findFirst({
    where: {
      id: suburbId,
      activeFlag: true
    },
    include: {
      postcodeRelationships: {
        where: {
          selectableFlag: true,
          postcode: {
            activeFlag: true
          }
        },
        include: {
          postcode: true
        },
        orderBy: {
          postcode: {
            postcode: "asc"
          }
        }
      }
    }
  });

  if (!suburb) {
    return null;
  }

  const activeScoringRelease = await getActivePublishedScoringRelease(suburb.city);
  const scoringRecord = activeScoringRelease
    ? await prisma.suburbScoringRecord.findUnique({
        where: {
          scoringReleaseId_suburbId: {
            scoringReleaseId: activeScoringRelease.id,
            suburbId: suburb.id
          }
        }
      })
    : null;

  return {
    suburb: {
      id: suburb.id,
      sal_code: suburb.salCode,
      sal_name: suburb.salName,
      sa2_code: suburb.sa2Code,
      lga_code: suburb.lgaCode,
      gccsa_code: suburb.gccsaCode,
      city: suburb.city,
      state: suburb.state
    },
    postcodes: suburb.postcodeRelationships.map((relationship) => ({
      relationship_id: relationship.id,
      postcode_id: relationship.postcodeId,
      postcode: relationship.postcode.postcode,
      relationship_confidence: relationship.relationshipConfidence,
      selectable_flag: relationship.selectableFlag
    })),
    preview: {
      latest_year: scoringRecord?.latestYear ?? null,
      ...publicScorePreview(scoringRecord?.scoreJson),
      ...publicConfidencePreview(scoringRecord?.confidenceJson),
      data_release_key: activeScoringRelease?.dataRelease.releaseKey ?? null,
      scoring_release_key: activeScoringRelease?.releaseKey ?? null,
      report_generation_allowed_flag:
        scoringRecord?.reportGenerationAllowedFlag ?? false,
      report_block_reason: scoringRecord?.reportBlockReason ?? null
    },
    paid_prediction_data_included: false
  };
}

export async function getMapLayers(entitlement: MapEntitlement) {
  const layers = await prisma.mapLayer.findMany({
    where: {
      activeFlag: true,
      accessTier: {
        in: [...allowedMapAccessTiers(entitlement)]
      }
    },
    orderBy: {
      layerKey: "asc"
    }
  });

  return layers.map((layer) => ({
    id: layer.id,
    layer_key: layer.layerKey,
    layer_type: layer.layerType,
    access_tier: layer.accessTier,
    release_version: layer.releaseVersion,
    style: layer.styleJson,
    active_flag: layer.activeFlag
  }));
}

export async function resolveUserMapEntitlement(userId: string | null) {
  if (!userId) {
    return "public" satisfies MapEntitlement;
  }

  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "active",
      deletedAt: null,
      billingPeriodStart: {
        lte: now()
      },
      billingPeriodEnd: {
        gt: now()
      }
    },
    select: {
      id: true
    }
  });

  return activeSubscription
    ? ("paid" satisfies MapEntitlement)
    : ("free" satisfies MapEntitlement);
}
