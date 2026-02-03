import { RawOutbreakReport } from "./types";

// ReliefWeb requires a registered appname for API access.
// For now, this parser returns empty results and logs a notice.
// To enable: register at https://apidoc.reliefweb.int/parameters#appname
// and update the appname below.

export async function fetchReliefWebOutbreaks(): Promise<RawOutbreakReport[]> {
  console.log("ReliefWeb: Skipped (requires registered appname). WHO API is the primary source.");
  return [];
}
