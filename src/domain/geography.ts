export type MapEntitlement = "public" | "free" | "paid";

export function allowedMapAccessTiers(entitlement: MapEntitlement) {
  if (entitlement === "paid") {
    return ["public", "visitor", "free", "paid", "subscriber"] as const;
  }

  if (entitlement === "free") {
    return ["public", "visitor", "free"] as const;
  }

  return ["public", "visitor"] as const;
}
