import { handleLegacyRequest } from "./legacy-domain";

export default {
  fetch(request: Request): Promise<Response> | Response {
    return handleLegacyRequest(request);
  },
};
