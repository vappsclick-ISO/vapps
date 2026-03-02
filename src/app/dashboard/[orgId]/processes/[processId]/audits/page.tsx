"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Clock,
  EllipsisVertical,
  Funnel,
  Plus,
  Search,
} from "lucide-react";

type Audit = {
  id: string;
  title: string;
  reviewer: string;
  reviewerInitials: string;
  status: string;
  severity: string;
  dueDate: string;
  progress: number;
  findings: number;
};

const audits: Audit[] = [
  {
    id: "AUD-2024-08",
    title: "Security Compliance Audit",
    reviewer: "Sarah Johnson",
    reviewerInitials: "SJ",
    status: "In Progress",
    severity: "High",
    dueDate: "Nov 15, 2025",
    progress: 50,
    findings: 7,
  },
  {
    id: "AUD-2024-08",
    title: "Security Compliance Audit",
    reviewer: "Sarah Johnson",
    reviewerInitials: "SJ",
    status: "In Progress",
    severity: "High",
    dueDate: "Nov 15, 2025",
    progress: 50,
    findings: 7,
  },
];

const columns: ColumnDef<Audit>[] = [
  { accessorKey: "id", header: "Audit ID" },

  { accessorKey: "title", header: "Title" },

  {
    accessorKey: "reviewer",
    header: "Reviewer",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Avatar className="bg-[#432DD7] h-7 w-7 text-white">
          <AvatarFallback>{row.original.reviewerInitials}</AvatarFallback>
        </Avatar>
        <span>{row.original.reviewer}</span>
      </div>
    ),
  },

  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className="flex items-center gap-2 bg-amber-200 text-amber-600 py-1 px-2 rounded-2xl text-xs w-max">
        <Clock size={10} /> {row.original.status}
      </span>
    ),
  },

  { accessorKey: "dueDate", header: "Due Date" },

  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => (
      <span className="text-red-500 border border-red-500 rounded-2xl py-1 px-2 text-xs">
        {row.original.severity}
      </span>
    ),
  },

  {
    accessorKey: "progress",
    header: "Progress",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Progress value={row.original.progress} className="h-2 bg-gray-200" />
        <span className="text-xs">{row.original.progress}%</span>
      </div>
    ),
  },

  {
    accessorKey: "findings",
    header: "Findings",
    cell: ({ row }) => (
      <span className="flex items-center gap-1 py-1 px-2 border border-[#0000001A] rounded-2xl text-xs w-max">
        <Clock size={10} /> {row.original.findings}
      </span>
    ),
  },

  {
    id: "actions",
    header: "",
    cell: () => <EllipsisVertical className="cursor-pointer" />,
  },
];

export default function AuditsPage() {
  const table = useReactTable({
    data: audits,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      {/* Filter Bar */}
      <div className="filter flex flex-col sm:flex-row my-5 gap-4 justify-between items-center">
        <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-2 items-start sm:items-center w-full">
          <div className="relative w-full max-w-md">
            <Search
              size={18}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-500"
            />
            <Input
              className="pl-10 border-none bg-[#F3F3F5]"
              placeholder="Search tasks, docs, processes..."
            />
          </div>

          <div className="flex gap-2 sm:gap-3 flex-wrap">
            <Button variant="outline" className="flex items-center gap-2">
              <Funnel size={18} /> Filter By
            </Button>
            <Button variant="outline">Sort By</Button>
          </div>
        </div>

        <div className="flex gap-2 mt-3 sm:mt-0">
          <Button variant="dark" className="flex items-center gap-2">
            <Plus /> Create Audit
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="audits-progress-cards grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="card border border-[#0000001A] rounded-lg p-4">
          <p className="text-[#717182] text-base">Total Processes</p>
          <span className="text-lg font-semibold">6</span>
        </div>
        <div className="card border border-[#0000001A] rounded-lg p-4">
          <p className="text-[#717182] text-base">Active Projects</p>
          <span className="text-lg font-semibold text-[#155DFC]">4</span>
        </div>
        <div className="card border border-[#0000001A] rounded-lg p-4">
          <p className="text-[#717182] text-base">Total Issues</p>
          <span className="text-lg font-semibold text-green-500">2</span>
        </div>
        <div className="card border border-[#0000001A] rounded-lg p-4">
          <p className="text-[#717182] text-base">Avg. Progress</p>
          <span className="text-lg font-semibold text-orange-500">0 %</span>
        </div>
      </div>

      {/* Table */}
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="overflow-x-auto rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="p-2 text-left">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>

              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
