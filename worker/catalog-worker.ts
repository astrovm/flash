import { handleCatalogRequest } from "../catalog/catalog";
import { handleRtcRequest } from "../rtc/rtc";
import { IMPORT_PATH, importPage } from "./legacy-domain";

export default {
  fetch(request: Request): Promise<Response> | Response {
    const url = new URL(request.url);
    if (url.pathname === IMPORT_PATH) return importPage();
    if (url.pathname === "/api/rtc") {
      return handleRtcRequest(request);
    }
    return handleCatalogRequest(request);
  },
};
