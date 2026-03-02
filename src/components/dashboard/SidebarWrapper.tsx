"use client";

import dynamic from "next/dynamic";
import { ComponentProps } from "react";

// Dynamically import Sidebar with SSR disabled to prevent hydration mismatches
const Sidebar = dynamic(() => import("@/components/dashboard/Sidebar"), {
    ssr: false,
});

export default function SidebarWrapper(props: ComponentProps<typeof import("@/components/dashboard/Sidebar").default>) {
    return <Sidebar {...props} />;
}
