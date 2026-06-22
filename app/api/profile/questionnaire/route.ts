import { apiOk } from "@/server/api/response";
import { getActiveQuestionnaireVersion } from "@/server/services/profile-service";

export async function GET() {
  const questionnaire = await getActiveQuestionnaireVersion();

  return apiOk({
    version: questionnaire.version,
    schema: questionnaire.schemaJson,
    scoringWeights: questionnaire.scoringWeightsJson
  });
}
