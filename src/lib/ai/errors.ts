/** The server has no AI key, so the caller should drop the feature. */
export class AiUnavailableError extends Error {
  override name = "AiUnavailableError";
}

/** The request reached the server but failed; worth telling the user about */
export class AiRequestFailedError extends Error {
  override name = "AiRequestFailedError";

  readonly partial: string;

  constructor(message: string, partial = "") {
    super(message);
    this.partial = partial;
  }
}

/** No key configured */
export class AiNotConfiguredError extends Error {
  override name = "AiNotConfiguredError";

  constructor(
    message = "No AI provider is configured, so this feature is unavailable.",
  ) {
    super(message);
  }
}
