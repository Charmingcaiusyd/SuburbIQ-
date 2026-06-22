const requiredProductionEnv = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "APP_BASE_URL"
] as const;

const integrationEnv = [
  "STRIPE_SECRET_KEY",
  "PAYPAL_CLIENT_ID",
  "OPENAI_API_KEY",
  "MAPBOX_ACCESS_TOKEN",
  "REDIS_URL",
  "S3_ENDPOINT",
  "S3_BUCKET"
] as const;

export function getDeploymentEnvStatus() {
  const required = requiredProductionEnv.map((name) => ({
    name,
    configured: Boolean(process.env[name]) && process.env[name] !== "replace-with-local-secret"
  }));
  const integrations = integrationEnv.map((name) => ({
    name,
    configured: Boolean(process.env[name]) && process.env[name] !== "stub"
  }));

  return {
    required,
    integrations,
    missing_required: required
      .filter((item) => !item.configured)
      .map((item) => item.name),
    missing_integrations: integrations
      .filter((item) => !item.configured)
      .map((item) => item.name)
  };
}

export function assertProductionEnv() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const status = getDeploymentEnvStatus();
  if (status.missing_required.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${status.missing_required.join(", ")}`
    );
  }
}
