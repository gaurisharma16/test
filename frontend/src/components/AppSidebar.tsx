import {
	BarChart3,
	FileText,
	PenTool,
	TrendingUp,
	Bell,
	Settings,
	LogOut,
	Home,
	Shield,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
	{ title: "Dashboard", url: "/", icon: Home },
	{ title: "Financial Data Analysis", url: "/financial-data", icon: BarChart3 },
	{ title: "Editorial Assistant", url: "/editorial", icon: PenTool },
	{ title: "Broker Report Articles", url: "/broker-reports", icon: FileText },
	{ title: "Market Summary", url: "/market-summary", icon: TrendingUp },
	{ title: "Corporate Filings Alerts", url: "/filings-alerts", icon: Bell },
];

const settingsItems = [{ title: "Settings", url: "/settings", icon: Settings }];

export function AppSidebar() {
	const { state } = useSidebar();
	const location = useLocation();
	const currentPath = location.pathname;
	const collapsed = state === "collapsed";

	const isActive = (path: string) => currentPath === path;
	const getNavCls = ({ isActive }: { isActive: boolean }) =>
		isActive
			? "bg-primary text-primary-foreground font-medium"
			: "text-foreground hover:bg-muted hover:text-foreground";

	return (
		<Sidebar collapsible="icon" className="bg-card text-card-foreground">
			<SidebarContent className="bg-card border-r text-card-foreground">
				{/* Main Tools */}
				<SidebarGroup>
					<SidebarGroupLabel className="text-primary font-semibold px-2 text-sm">
						Financial AI Suite
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{mainItems.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										asChild
										className="text-black/50 hover:text-foreground"
									>
										<NavLink to={item.url} end className={getNavCls}>
											<item.icon className="text-black/50 mr-2 h-4 w-4" />
											<span className="text-black/50">{item.title}</span>
										</NavLink>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{/* Settings & Logout */}
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{settingsItems.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										asChild
										className="text-black/50 hover:text-foreground"
									>
										<NavLink to={item.url} className={getNavCls}>
											<item.icon className="text-black/50 mr-2 h-4 w-4" />
											<span className="text-black/50">{item.title}</span>
										</NavLink>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
							<SidebarMenuItem>
								<SidebarMenuButton className="text-foreground hover:bg-destructive/10 hover:text-destructive">
									<LogOut className="text-black/50 mr-2 h-4 w-4" />
									<span className="text-black/50">Logout</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
