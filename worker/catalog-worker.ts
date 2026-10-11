import { handleCatalogRequest } from "../catalog/catalog";
import { handleRtcRequest } from "../rtc/rtc";
import {
  IMPORT_PATH,
  LEGACY_HOST,
  handleLegacyRequest,
  importPage,
} from "./legacy-domain";

export default {
  fetch(request: Request): Promise<Response> | Response {
    const url = new URL(request.url);
    if (url.hostname === LEGACY_HOST) return handleLegacyRequest(request);
    if (url.pathname === IMPORT_PATH) return importPage();
    if (url.pathname === "/api/rtc") {
      return handleRtcRequest(request);
    }
    return handleCatalogRequest(request);
  },
};
