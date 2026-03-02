"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, File, FolderClosed, EllipsisVertical, Search, Funnel, Upload, Plus } from "lucide-react";

export default function DocumentsPage() {
  const [search, setSearch] = useState("");

  const documents = [
    {
      name: "Q4 Financial Report.pdf",
      icon: <FileText />,
      type: "PDF",
      size: "2.4 MB",
      linkedIssues: ["DEV-23", "PROD-15"],
      lastUpdated: "2 hours ago",
      updatedBy: "Sarah Johnson",
    },
    {
      name: "Q5 Financial Report.pdf",
      icon: <File />,
      type: "PDF",
      size: "2.4 MB",
      linkedIssues: ["DEV-23", "PROD-15"],
      lastUpdated: "2 hours ago",
      updatedBy: "Sarah Johnson",
    },
    {
      name: "Q8 Financial Report.pdf",
      icon: <FolderClosed />,
      type: "PDF",
      size: "2.4 MB",
      linkedIssues: ["DEV-23", "PROD-15"],
      lastUpdated: "2 hours ago",
      updatedBy: "Sarah Johnson",
    },
  ];

  // Filter documents based on search input
  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Filter & Action Bar */}
      <div className="filter flex flex-col sm:flex-row my-5 gap-4 justify-between items-center">
        {/* Search + Filter/Sort Buttons */}
        <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-2 items-start sm:items-center w-full">
          <div className="relative w-full max-w-md">
            <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

        {/* Upload + New Folder */}
        <div className="flex gap-2 mt-3 sm:mt-0">
          <Button variant="outline" className="flex items-center gap-2">
            <Upload /> Upload
          </Button>
          <Button variant="dark" className="flex items-center gap-2">
            <Plus /> New Folder
          </Button>
        </div>
      </div>

      {/* Documents Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Linked Issues</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead>Updated By</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {filteredDocuments.map((doc, index) => (
            <TableRow key={index}>
              <TableCell className="flex items-center gap-2">
                {doc.icon} {doc.name}
              </TableCell>
              <TableCell>
                <span className="text-xs font-semibold bg-[#ECEEF2] px-2 py-1 rounded-3xl">
                  {doc.type}
                </span>
              </TableCell>
              <TableCell>{doc.size}</TableCell>
              <TableCell className="flex gap-2">
                {doc.linkedIssues.map((issue) => (
                  <span
                    key={issue}
                    className="text-xs font-semibold px-2 py-1 rounded-3xl border-[0.83px] border-[#0000001A]"
                  >
                    {issue}
                  </span>
                ))}
              </TableCell>
              <TableCell>{doc.lastUpdated}</TableCell>
              <TableCell>{doc.updatedBy}</TableCell>
              <TableCell>
                <EllipsisVertical className="cursor-pointer" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
