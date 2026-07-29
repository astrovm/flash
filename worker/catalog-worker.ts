import { handleCatalogRequest } from "../catalog/catalog";

export default {
	fetch(request: Request): Promise<Response> {
		return handleCatalogRequest(request);
	},
};
