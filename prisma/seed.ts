import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  async function ensureProduct(input: {
    productType: string;
    name: string;
    priceCents: number;
    gstInclusiveFlag: boolean;
  }) {
    const existing = await prisma.product.findFirst({
      where: {
        productType: input.productType,
        name: input.name
      }
    });

    if (existing) {
      return prisma.product.update({
        where: {
          id: existing.id
        },
        data: {
          priceCents: input.priceCents,
          gstInclusiveFlag: input.gstInclusiveFlag,
          activeFlag: true
        }
      });
    }

    return prisma.product.create({
      data: input
    });
  }

  await ensureProduct({
    productType: "single_report",
    name: "Single suburb paid report",
    priceCents: 4900,
    gstInclusiveFlag: true
  });
  await ensureProduct({
    productType: "ten_credit_pack",
    name: "10 report credits",
    priceCents: 39000,
    gstInclusiveFlag: true
  });
  await ensureProduct({
    productType: "subscription_1m",
    name: "Monthly subscription",
    priceCents: 9900,
    gstInclusiveFlag: true
  });
  await ensureProduct({
    productType: "subscription_6m",
    name: "Half-year subscription",
    priceCents: 49900,
    gstInclusiveFlag: true
  });
  await ensureProduct({
    productType: "subscription_12m",
    name: "Annual subscription",
    priceCents: 89900,
    gstInclusiveFlag: true
  });

  await prisma.coupon.upsert({
    where: {
      code: "DEVFREE"
    },
    update: {
      discountType: "free",
      value: 100,
      activeFlag: true
    },
    create: {
      code: "DEVFREE",
      discountType: "free",
      value: 100,
      activeFlag: true
    }
  });

  await prisma.profileQuestionVersion.upsert({
    where: {
      version: "v1.3-default"
    },
    update: {
      activeFlag: true
    },
    create: {
      version: "v1.3-default",
      activeFlag: true,
      schemaJson: {
        required: ["budgetRange", "buyingPurpose", "propertyTypePreference", "riskPreference"]
      },
      scoringWeightsJson: {
        budgetRange: 15,
        buyingPurpose: 10,
        propertyTypePreference: 10,
        preferredGeography: 10,
        riskPreference: 10
      }
    }
  });

  const suburb = await prisma.suburb.upsert({
    where: {
      salCode_city_state: {
        salCode: "SAL_STUB_SYDNEY",
        city: "Sydney",
        state: "NSW"
      }
    },
    update: {
      activeFlag: true
    },
    create: {
      salCode: "SAL_STUB_SYDNEY",
      salName: "Sydney",
      sa2Code: "SA2_STUB_SYDNEY",
      lgaCode: "LGA_STUB_SYDNEY",
      gccsaCode: "GCCSA_STUB_SYDNEY",
      city: "Sydney",
      state: "NSW"
    }
  });

  const postcode =
    (await prisma.postcode.findFirst({
      where: {
        postcode: "2000",
        city: "Sydney",
        state: "NSW"
      }
    })) ??
    (await prisma.postcode.create({
      data: {
        postcode: "2000",
        city: "Sydney",
        state: "NSW"
      }
    }));

  await prisma.suburbPostcodeRelationship.upsert({
    where: {
      suburbId_postcodeId: {
        suburbId: suburb.id,
        postcodeId: postcode.id
      }
    },
    update: {
      relationshipConfidence: "confirmed",
      selectableFlag: true,
      effectiveTo: null
    },
    create: {
      suburbId: suburb.id,
      postcodeId: postcode.id,
      relationshipConfidence: "confirmed",
      selectableFlag: true
    }
  });

  const dataRelease = await prisma.dataRelease.upsert({
    where: {
      releaseKey: "seed-data-release-v1"
    },
    update: {
      status: "published",
      publishedAt: new Date()
    },
    create: {
      releaseKey: "seed-data-release-v1",
      city: "Sydney",
      status: "published",
      sourceSummaryJson: {
        source: "seed",
        data_as_of_date: "2026-06-22"
      },
      publishedAt: new Date()
    }
  });

  const scoringRelease = await prisma.scoringRelease.upsert({
    where: {
      releaseKey: "seed-scoring-release-v1"
    },
    update: {
      status: "published",
      publishedAt: new Date()
    },
    create: {
      releaseKey: "seed-scoring-release-v1",
      dataReleaseId: dataRelease.id,
      modelRegistryVersion: "seed-model-v1",
      scoringTableVersion: "seed-scoring-table-v1",
      status: "published",
      publishedAt: new Date()
    }
  });

  await prisma.suburbScoringRecord.upsert({
    where: {
      scoringReleaseId_suburbId: {
        scoringReleaseId: scoringRelease.id,
        suburbId: suburb.id
      }
    },
    update: {
      reportGenerationAllowedFlag: true
    },
    create: {
      scoringReleaseId: scoringRelease.id,
      suburbId: suburb.id,
      salCode: suburb.salCode,
      latestYear: 2026,
      scoreJson: {
        price_band: "$1.0m-$1.5m",
        historical_median_price: [
          { year: 2024, value: 1200000 },
          { year: 2025, value: 1260000 }
        ],
        sales_count_history: [
          { year: 2024, value: 420 },
          { year: 2025, value: 438 }
        ],
        basic_demographics: {
          population_band: "high",
          dwelling_mix: "mixed"
        },
        data_freshness_summary: "Seed data for local development only."
      },
      predictionJson: {
        one_year_growth_signal: 0.04
      },
      confidenceJson: {
        confidence_band: "medium",
        data_quality_flags: [],
        low_confidence_warning_required: false
      },
      reportGenerationAllowedFlag: true
    }
  });

  await prisma.mapLayer.upsert({
    where: {
      layerKey: "base_map"
    },
    update: {
      activeFlag: true
    },
    create: {
      layerKey: "base_map",
      layerType: "mapbox",
      accessTier: "public",
      releaseVersion: "seed-map-v1",
      styleJson: {
        style: "mapbox://styles/mapbox/light-v11"
      }
    }
  });

  await prisma.mapLayer.upsert({
    where: {
      layerKey: "sample_heatmap"
    },
    update: {
      activeFlag: true
    },
    create: {
      layerKey: "sample_heatmap",
      layerType: "deck_gl",
      accessTier: "free",
      releaseVersion: "seed-map-v1",
      styleJson: {
        color: "blue"
      }
    }
  });

  await prisma.mapLayer.upsert({
    where: {
      layerKey: "growth_prediction"
    },
    update: {
      activeFlag: true
    },
    create: {
      layerKey: "growth_prediction",
      layerType: "deck_gl",
      accessTier: "paid",
      releaseVersion: "seed-map-v1",
      styleJson: {
        color: "green"
      }
    }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
