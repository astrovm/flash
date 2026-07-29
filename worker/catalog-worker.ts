import { handleCatalogRequest } from "../catalog/catalog";
import { handleRtcRequest } from "../rtc/rtc";

export default {
  fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/api/rtc") {
      return handleRtcRequest(request);
    }
    return handleCatalogRequest(request);
  },
};
