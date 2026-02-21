import { Autumn } from "@useautumn/convex";
import { components } from "./_generated/api";

const autumnSecretKey = process.env.AUTUMN_SECRET_KEY ?? "";

export const AUTUMN_ORG_SEAT_FEATURE_ID =
	process.env.AUTUMN_ORG_SEAT_FEATURE_ID ?? "org_seat";

export const AUTUMN_ORG_SEAT_PRODUCT_ID =
	process.env.AUTUMN_ORG_SEAT_PRODUCT_ID ?? "org-seat";

export const isAutumnConfigured = autumnSecretKey.length > 0;

const toOrgCustomerId = (ownerLogin: string) => `org:${ownerLogin}`;

export const createOrgAutumn = (ownerLogin: string) =>
	new Autumn(components.autumn, {
		secretKey: autumnSecretKey,
		identify: async () => ({
			customerId: toOrgCustomerId(ownerLogin),
			customerData: {
				name: ownerLogin,
			},
		}),
	});
