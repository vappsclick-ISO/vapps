"use client";

import { ArrowUp, ChartNoAxesCombined, CircleAlert, CircleCheckBig, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

import { CartesianGrid, Line, LineChart, XAxis, Pie, PieChart, Cell } from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const lineChartData = [
    { month: "January", desktop: 186, mobile: 80 },
    { month: "February", desktop: 305, mobile: 200 },
    { month: "March", desktop: 237, mobile: 120 },
    { month: "April", desktop: 73, mobile: 190 },
    { month: "May", desktop: 209, mobile: 130 },
    { month: "June", desktop: 214, mobile: 140 },
];

const pieChartData = [
    { browser: "Chrome", visitors: 275, fill: "var(--chart-1)" },
    { browser: "Safari", visitors: 200, fill: "var(--chart-2)" },
    { browser: "Firefox", visitors: 187, fill: "var(--chart-3)" },
    { browser: "Edge", visitors: 173, fill: "var(--chart-4)" },
    { browser: "Other", visitors: 90, fill: "var(--chart-5)" },
];

const chartConfig = {
    desktop: { label: "Desktop", color: "var(--chart-1)" },
    mobile: { label: "Mobile", color: "var(--chart-2)" },
    chrome: { label: "Chrome", color: "var(--chart-1)" },
    safari: { label: "Safari", color: "var(--chart-2)" },
    firefox: { label: "Firefox", color: "var(--chart-3)" },
    edge: { label: "Edge", color: "var(--chart-4)" },
    other: { label: "Other", color: "var(--chart-5)" },
} satisfies ChartConfig;

export default function OrgDashboardPage({ params }: any) {
    return (
        <>
            {/* Top Cards */}
            <div className="dashboard-progress-cards grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Card 1 */}
                <div className="flex flex-col justify-between bg-card text-[#4A5565] rounded-xl border border-[#0000001A] p-5">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-xs">Active Projects</p>
                        <ChartNoAxesCombined size={18} />
                    </div>
                    <div>
                        <span className="">24</span>
                        <p className="flex items-center text-sm mt-1">
                            <span className="text-primary me-2">↑12%</span> from last month
                        </p>
                    </div>
                </div>

                {/* Card 2 */}
                <div className="flex flex-col justify-between bg-card text-[#4A5565] rounded-xl border border-[#0000001A] p-5">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-xs">Open Issues</p>
                        <CircleAlert size={18} />
                    </div>
                    <div>
                        <span className="">95</span>
                        <p className="flex items-center text-sm mt-1">
                            <span className="text-primary me-2">↑12%</span> from last month
                        </p>
                    </div>
                </div>

                {/* Card 3 */}
                <div className="flex flex-col justify-between bg-card text-[#4A5565] rounded-xl border border-[#0000001A] p-5">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-xs">Upcoming Audits</p>
                        <CircleCheckBig size={18} />
                    </div>
                    <div>
                        <span className="">—</span>
                        <p className="flex items-center text-sm mt-1">
                            <span className="text-primary me-2">↑12%</span> from last month
                        </p>
                    </div>
                </div>

                {/* Card 4 */}
                <div className="flex flex-col justify-between bg-card text-[#4A5565] rounded-xl border border-[#0000001A] p-5">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-xs">Compliance Score</p>
                        <TrendingUp size={18} />
                    </div>
                    <div className="space-y-3">
                        <span className="text-2xl font-semibold">94%</span>
                        <Progress value={94} className="h-2" />
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Line Chart Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Line Chart - Dots</CardTitle>
                        <CardDescription>January - June 2024</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        <ChartContainer config={chartConfig} className="max-h-[250px] w-full">
                            <LineChart
                                accessibilityLayer
                                data={lineChartData}
                                margin={{ left: 12, right: 12 }}
                            >
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickFormatter={(value) => value.slice(0, 3)}
                                />
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent hideLabel />}
                                />
                                <Line
                                    dataKey="desktop"
                                    type="natural"
                                    stroke="var(--chart-1)"
                                    strokeWidth={2}
                                    dot={{ fill: "var(--chart-1)" }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    dataKey="mobile"
                                    type="natural"
                                    stroke="var(--chart-2)"
                                    strokeWidth={2}
                                    dot={{ fill: "var(--chart-2)" }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ChartContainer>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-2 text-sm">
                        <div className="flex gap-2 leading-none font-medium">
                            Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
                        </div>
                        <div className="text-muted-foreground leading-none">
                            Showing total visitors for the last 6 months
                        </div>
                    </CardFooter>
                </Card>

                {/* Pie Chart Card */}
                <Card>
                    <CardHeader className="items-center pb-0">
                        <CardTitle>Pie Chart - Label</CardTitle>
                        <CardDescription>January - June 2024</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-0">
                        <ChartContainer
                            config={chartConfig}
                            className="mx-auto max-h-[250px] aspect-square [&_.recharts-pie-label-text]:fill-foreground"
                        >
                            <PieChart>
                                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                <Pie
                                    data={pieChartData}
                                    dataKey="visitors"
                                    nameKey="browser"
                                    label
                                    outerRadius={80}
                                >
                                    {pieChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ChartContainer>
                    </CardContent>
                    <CardFooter className="flex-col gap-2 text-sm">
                        <div className="flex items-center gap-2 leading-none font-medium">
                            Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
                        </div>
                        <div className="text-muted-foreground leading-none">
                            Showing total visitors for the last 6 months
                        </div>
                    </CardFooter>
                </Card>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                {/* Recent Activity Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>Latest updates from your team</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[1, 2, 3, 4].map((item) => (
                            <ul key={item} className="flex items-start gap-3">
                                <li>
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="bg-green-500 text-white">MT</AvatarFallback>
                                    </Avatar>
                                </li>
                                <li className="flex flex-col">
                                    <p className="text-[#6A7282]">
                                        <span className="text-[#0A0A0A] me-2">Mike Chen</span>
                                        uploaded Document: Q4 Report
                                    </p>
                                    <span className="text-[#6A7282] text-xs">2 minutes ago</span>
                                </li>
                            </ul>
                        ))}
                    </CardContent>
                </Card>

                {/* Upcoming Audits Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Upcoming Audits</CardTitle>
                        <CardDescription>Scheduled compliance reviews</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {["Security Compliance Audit", "Internal Audit", "External Audit"].map((audit, idx) => (
                            <ul key={idx} className="flex justify-between items-center border-b border-[#E5E7EB] py-2">
                                <li className="flex flex-col">
                                    <p>{audit}</p>
                                    <span className="text-xs text-muted-foreground">Nov 10, 2025</span>
                                </li>
                                <li>
                                    <span className="text-sm font-medium text-yellow-600">Pending</span>
                                </li>
                            </ul>
                        ))}
                    </CardContent>
                </Card>
            </div>
            <div className="mt-5 p-5 rounded-lg bg-[#E8F1FF] border border-[#C3D9FF] flex sm:flex-row flex-col sm:items-center justify-between">
                <div className="description mb-3.5 sm:mb-0">
                    <h3 className="font-semibold text-sm mb-1">Need Help? Ask VApps AI</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                        Get instant insights, generate reports, or find information quickly.
                    </p>
                </div>
                <Button variant="dark" size="lg" className="w-full sm:w-auto">Ask VApps AI</Button>
            </div>
        </>
    );
}