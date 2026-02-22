import { redirect } from "next/navigation";

/**
 * GitHub App installation callback page.
 *
 * After a user installs (or reconfigures) the GitHub App, GitHub redirects
 * them to this page with query parameters:
 *   - `installation_id` — the numeric GitHub App installation ID
 *   - `setup_action` — "install" | "update" | "request"
 *
 * The actual installation records are created by the `installation.created`
 * and `installation_repositories.added` webhooks, which fire independently.
 * This page simply acknowledges the installation and redirects to the
 * dashboard so the user sees their repos appearing via the real-time
 * Convex subscription.
 */
export default async function GitHubSetupPage(props: {
	searchParams: Promise<{
		installation_id?: string;
		setup_action?: string;
	}>;
}) {
	return handleGitHubSetupRedirect(props.searchParams);
}

async function handleGitHubSetupRedirect(
	searchParamsPromise: Promise<{
		installation_id?: string;
		setup_action?: string;
	}>,
) {
	const searchParams = await searchParamsPromise;
	const installationId = searchParams.installation_id;
	const setupAction = searchParams.setup_action;

	if (!installationId || !setupAction) {
		// Invalid callback — redirect home
		redirect("/");
	}

	// Redirect to the root dashboard. The sidebar subscription will
	// reactively pick up any new repos as the webhook processor creates them.
	redirect("/");
}
