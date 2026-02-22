import { CodeNavigationSidebar } from "../../../code-navigation-sidebar";

export default function TreeSidebarPage(props: {
	params: Promise<{ owner: string; name: string }>;
}) {
	return <CodeNavigationSidebar params={props.params} />;
}
