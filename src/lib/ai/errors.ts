/** The server has no Gateway key, so the caller should drop the feature . */
export class AiUnavailableError extends Error {
  override name = "AiUnavailableError";
}

/** The request reached the server but failed; tell the user */
export class AiRequestFailedError extends Error {
  override name = "AiRequestFailedError";
}
