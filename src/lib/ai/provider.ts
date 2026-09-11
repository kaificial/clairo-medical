/** Which credential answers for a model */
export type ProviderChoice = "google";

export interface ProviderKeys {
  google: boolean;
}

/** The provider half of a "provider/model" id. */
export function modelProvider(modelId: string): string {
  return modelId.split("/")[0] ?? "";
}

/** The model half, which is what the provider SDK expects. */
export function modelName(modelId: string): string {
  const separator = modelId.indexOf("/");
  return separator === -1 ? modelId : modelId.slice(separator + 1);
}

/**
 * Pick the credential for a model (Google)
 * Null means the feature stays off rather than failing at request time.
 */
export function chooseProvider(
  modelId: string,
  keys: ProviderKeys,
): ProviderChoice | null {
  return modelProvider(modelId) === "google" && keys.google ? "google" : null;
}
