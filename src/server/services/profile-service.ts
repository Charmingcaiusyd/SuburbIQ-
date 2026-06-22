import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  calculateProfileCompleteness,
  getConfidenceBand,
  getMissingMandatoryFields,
  type BuyerProfileInput
} from "@/domain/profile";
import { prisma } from "@/server/db/prisma";

export const buyerProfileSchema = z.object({
  budgetRange: z.string().min(1),
  buyingPurpose: z.string().min(1),
  propertyTypePreference: z.string().min(1),
  preferredGeography: z.unknown().optional(),
  riskPreference: z.string().min(1),
  growthPreference: z.string().min(1).optional().nullable(),
  liquidityPreference: z.string().min(1).optional().nullable(),
  commuteRequirements: z.unknown().optional(),
  lifestylePriorities: z.unknown().optional(),
  schoolFamilyNeeds: z.unknown().optional(),
  rentalYieldImportance: z.string().min(1).optional().nullable(),
  futureDevelopmentTolerance: z.string().min(1).optional().nullable(),
  freeTextNotes: z.string().optional().nullable(),
  language2: z.string().optional().nullable(),
  language3: z.string().optional().nullable()
});

export type BuyerProfilePayload = z.infer<typeof buyerProfileSchema>;

type UserProfileRecord = Awaited<ReturnType<typeof getActiveProfile>>;

function jsonOrNull(value: unknown) {
  return value === undefined || value === null
    ? Prisma.DbNull
    : (value as Prisma.InputJsonValue);
}

export function toProfileInput(payload: BuyerProfilePayload): BuyerProfileInput {
  return {
    budgetRange: payload.budgetRange,
    buyingPurpose: payload.buyingPurpose,
    propertyTypePreference: payload.propertyTypePreference,
    preferredGeography: payload.preferredGeography,
    riskPreference: payload.riskPreference,
    growthPreference: payload.growthPreference,
    liquidityPreference: payload.liquidityPreference,
    commuteRequirements: payload.commuteRequirements,
    lifestylePriorities: payload.lifestylePriorities,
    schoolFamilyNeeds: payload.schoolFamilyNeeds,
    rentalYieldImportance: payload.rentalYieldImportance,
    futureDevelopmentTolerance: payload.futureDevelopmentTolerance,
    freeTextNotes: payload.freeTextNotes
  };
}

export function serializeProfile(profile: NonNullable<UserProfileRecord>) {
  const input: BuyerProfileInput = {
    budgetRange: profile.budgetRange,
    buyingPurpose: profile.buyingPurpose,
    propertyTypePreference: profile.propertyTypePreference,
    preferredGeography: profile.preferredGeographiesJson,
    riskPreference: profile.riskPreference,
    growthPreference: profile.growthPreference,
    liquidityPreference: profile.liquidityPreference,
    commuteRequirements: profile.commuteRequirementsJson,
    lifestylePriorities: profile.lifestylePrioritiesJson,
    schoolFamilyNeeds: profile.schoolFamilyNeedsJson,
    rentalYieldImportance: profile.rentalYieldImportance,
    futureDevelopmentTolerance: profile.futureDevelopmentTolerance,
    freeTextNotes: profile.freeTextNotes
  };

  return {
    id: profile.id,
    user_id: profile.userId,
    budgetRange: profile.budgetRange,
    buyingPurpose: profile.buyingPurpose,
    propertyTypePreference: profile.propertyTypePreference,
    preferredGeography: profile.preferredGeographiesJson,
    riskPreference: profile.riskPreference,
    growthPreference: profile.growthPreference,
    liquidityPreference: profile.liquidityPreference,
    commuteRequirements: profile.commuteRequirementsJson,
    lifestylePriorities: profile.lifestylePrioritiesJson,
    schoolFamilyNeeds: profile.schoolFamilyNeedsJson,
    rentalYieldImportance: profile.rentalYieldImportance,
    futureDevelopmentTolerance: profile.futureDevelopmentTolerance,
    freeTextNotes: profile.freeTextNotes,
    language2: profile.language2,
    language3: profile.language3,
    completenessScore: profile.completenessScore,
    confidenceBand: getConfidenceBand(profile.completenessScore),
    missingMandatoryFields: getMissingMandatoryFields(input),
    updatedAt: profile.updatedAt.toISOString()
  };
}

export function getActiveProfile(userId: string) {
  return prisma.userProfile.findFirst({
    where: {
      userId,
      activeFlag: true,
      deletedAt: null
    },
    orderBy: {
      updatedAt: "desc"
    }
  });
}

export async function saveActiveProfile(userId: string, payload: BuyerProfilePayload) {
  const input = toProfileInput(payload);
  const completenessScore = calculateProfileCompleteness(input);
  const existingProfile = await getActiveProfile(userId);
  const data = {
    budgetRange: payload.budgetRange,
    buyingPurpose: payload.buyingPurpose,
    propertyTypePreference: payload.propertyTypePreference,
    preferredGeographiesJson: jsonOrNull(payload.preferredGeography),
    riskPreference: payload.riskPreference,
    growthPreference: payload.growthPreference ?? null,
    liquidityPreference: payload.liquidityPreference ?? null,
    commuteRequirementsJson: jsonOrNull(payload.commuteRequirements),
    lifestylePrioritiesJson: jsonOrNull(payload.lifestylePriorities),
    schoolFamilyNeedsJson: jsonOrNull(payload.schoolFamilyNeeds),
    rentalYieldImportance: payload.rentalYieldImportance ?? null,
    futureDevelopmentTolerance: payload.futureDevelopmentTolerance ?? null,
    freeTextNotes: payload.freeTextNotes ?? null,
    language2: payload.language2 ?? null,
    language3: payload.language3 ?? null,
    completenessScore
  };

  const profile = existingProfile
    ? await prisma.userProfile.update({
        where: {
          id: existingProfile.id
        },
        data
      })
    : await prisma.userProfile.create({
        data: {
          userId,
          ...data
        }
      });

  return serializeProfile(profile);
}

export async function getActiveQuestionnaireVersion() {
  const version = await prisma.profileQuestionVersion.findFirst({
    where: {
      activeFlag: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return (
    version ?? {
      version: "v1.3-default",
      schemaJson: {
        required: [
          "budgetRange",
          "buyingPurpose",
          "propertyTypePreference",
          "preferredGeography",
          "riskPreference"
        ]
      },
      scoringWeightsJson: {
        budgetRange: 15,
        buyingPurpose: 10,
        propertyTypePreference: 10,
        preferredGeography: 10,
        riskPreference: 10
      }
    }
  );
}

export async function createProfileSnapshot(userId: string) {
  const profile = await getActiveProfile(userId);

  if (!profile) {
    return null;
  }

  const serializedProfile = serializeProfile(profile);
  const questionnaireVersion = await getActiveQuestionnaireVersion();

  const snapshot = await prisma.profileSnapshot.create({
    data: {
      userId,
      sourceProfileId: profile.id,
      snapshotJson: serializedProfile as Prisma.InputJsonValue,
      completenessScore: profile.completenessScore,
      confidenceBand: getConfidenceBand(profile.completenessScore),
      questionnaireVersion: questionnaireVersion.version
    }
  });

  return {
    id: snapshot.id,
    user_id: snapshot.userId,
    source_profile_id: snapshot.sourceProfileId,
    completeness_score: snapshot.completenessScore,
    confidence_band: snapshot.confidenceBand,
    questionnaire_version: snapshot.questionnaireVersion,
    created_at: snapshot.createdAt.toISOString()
  };
}
