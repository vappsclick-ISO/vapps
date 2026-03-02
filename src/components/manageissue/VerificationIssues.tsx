"use client"

import { useState, useMemo, ReactNode, useRef, useEffect } from "react"
import { useParams } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Search,
    FileText,
    AlertCircle,
    CheckCircle2,
    Clock,
    Eye,
    MoreVertical,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    CircleCheck,
    CircleX,
    NotebookText,
    Info,
    Upload,
    CalendarIcon,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { cn } from "@/lib/utils"

import SignatureCanvas from "react-signature-canvas";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

interface Issue {
    id: string
    title: string
    description?: string
    status: string
    tags?: string[]
    source?: string
    assignee?: string
    priority?: string
    createdAt?: string
    updatedAt?: string
    // For display
    tag?: string
    tagVariant?: BadgeVariant
    kpi?: number
}

interface IssueReview {
    containmentText?: string
    rootCauseText?: string
    containmentFiles?: Array<{ name: string; size: number; type?: string; key?: string }>
    rootCauseFiles?: Array<{ name: string; size: number; type?: string; key?: string }>
    actionPlans?: Array<{
        action: string
        responsible: string
        plannedDate?: string
        actualDate?: string
        files?: Array<{ name: string; size: number; type?: string; key?: string }>
    }>
}

export default function IssuesDashboard() {
    const params = useParams()
    const orgId = params.orgId as string
    const processId = params.processId as string

    // Data state
    const [allIssues, setAllIssues] = useState<Issue[]>([])
    const [pendingIssues, setPendingIssues] = useState<Issue[]>([])
    const [processUsers, setProcessUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
    const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
    const [issueReview, setIssueReview] = useState<IssueReview | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingReview, setIsLoadingReview] = useState(false)

    // Filter/Sort state
    const [search, setSearch] = useState("")
    const [tag, setTag] = useState("all")
    const [status, setStatus] = useState("all")
    const [sortKey, setSortKey] = useState<string | null>(null)
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

    // Pagination
    const [pageSize, setPageSize] = useState(10)
    const [pageAll, setPageAll] = useState(1)
    const [pagePending, setPagePending] = useState(1)

    // Dialog state
    const [openFirst, setOpenFirst] = useState(false)
    const [openSubmit, setOpenSubmit] = useState(false)
    const [openNoSubmit, setOpenNoSubmit] = useState(false)

    // Verification form state
    const [closeOutDate, setCloseOutDate] = useState<Date | undefined>(new Date())
    const [verificationDate, setVerificationDate] = useState<Date | undefined>(new Date())
    const [signature, setSignature] = useState<string>("");
    const [closureComments, setClosureComments] = useState("")
    const [verificationFiles, setVerificationFiles] = useState<File[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Reassignment state
    const [selectedAssignee, setSelectedAssignee] = useState<string>("")
    const [dueDate, setDueDate] = useState<Date | undefined>()
    const [reassignmentInstructions, setReassignmentInstructions] = useState("")
    const [reassignmentFiles, setReassignmentFiles] = useState<File[]>([])

    const fileInputRef = useRef<HTMLInputElement>(null)
    const reassignmentFileInputRef = useRef<HTMLInputElement>(null)

    const sigCanvas = useRef<SignatureCanvas | null>(null);

    const handleClear = () => {
        if (sigCanvas.current) {
            sigCanvas.current.clear(); // Clears the signature canvas
        }
    };

    const handleSave = () => {
        if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
            const signatureData = sigCanvas.current.toDataURL();
            setSignature(signatureData); // Save the base64 image string
        } else {
            alert("Please provide a signature.");
        }
    };
    const handleClick = () => {
        fileInputRef.current?.click()
    }

    // Fetch data on mount
    useEffect(() => {
        if (!orgId || !processId) return

        const fetchData = async () => {
            try {
                setIsLoading(true)
                const [issuesRes, usersRes] = await Promise.all([
                    apiClient.getIssues(orgId, processId),
                    apiClient.getProcessUsers(orgId, processId),
                ])

                const issues = issuesRes.issues || []
                setAllIssues(issues)

                // Filter issues with status "in-review" for verification tab
                const inReviewIssues = issues.filter((i: Issue) => i.status === "in-review")
                setPendingIssues(inReviewIssues)

                setProcessUsers(usersRes.users || [])
            } catch (error: any) {
                console.error("Error fetching data:", error)
                toast.error("Failed to load issues")
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [orgId, processId])

    // Fetch issue review data when opening review dialog
    const handleReviewClick = async (issue: Issue) => {
        setSelectedIssue(issue)
        setOpenFirst(true)

        try {
            setIsLoadingReview(true)
            const reviewRes = await apiClient.getIssueReview(orgId, processId, issue.id)
            setIssueReview(reviewRes.review || null)
        } catch (error: any) {
            console.error("Error fetching review:", error)
            toast.error("Failed to load issue review data")
            setIssueReview(null)
        } finally {
            setIsLoadingReview(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return
        const files = Array.from(e.target.files)
        setVerificationFiles(files)
    }

    const handleReassignmentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return
        const files = Array.from(e.target.files)
        setReassignmentFiles(files)
    }

    // Handle effective submission
    const handleSubmitEffective = async () => {
        console.log("[VerificationIssues] handleSubmitEffective called", {
            selectedIssue: selectedIssue?.id,
            closureComments: closureComments?.length,
            closeOutDate,
            verificationDate,
            signature: signature?.length,
            orgId,
            processId,
        })

        if (!selectedIssue) {
            toast.error("No issue selected")
            return
        }

        if (!closureComments || !closureComments.trim()) {
            toast.error("Please provide closure comments")
            return
        }

        if (!closeOutDate) {
            toast.error("Please select issue close out date")
            return
        }

        if (!verificationDate) {
            toast.error("Please select effectiveness verification date")
            return
        }

        if (!signature || !signature.trim()) {
            toast.error("Please provide your signature")
            return
        }

        setIsSubmitting(true)
        try {
            console.log("[VerificationIssues] Starting submission...")
            // Upload verification files to S3
            const uploadedFiles: Array<{ name: string; size: number; type: string; key: string }> = []
            for (const file of verificationFiles) {
                try {
                    const result = await apiClient.uploadFile(
                        file,
                        orgId,
                        processId,
                        selectedIssue.id,
                        "actionPlan" // Using actionPlan type for verification files
                    )
                    uploadedFiles.push({
                        name: result.file.name,
                        size: result.file.size,
                        type: result.file.type,
                        key: result.file.key,
                    })
                } catch (error: any) {
                    console.error("Error uploading file:", error)
                    toast.error(`Failed to upload ${file.name}`)
                }
            }

            // Submit verification
            if (!closeOutDate || !verificationDate) {
                toast.error("Please select both close out date and verification date")
                setIsSubmitting(false)
                return
            }

            console.log("[VerificationIssues] Submitting effective verification:", {
                issueId: selectedIssue.id,
                orgId,
                processId,
                closureComments,
                closeOutDate: closeOutDate.toISOString(),
                verificationDate: verificationDate.toISOString(),
                signature,
                filesCount: uploadedFiles.length,
            })

            const response = await apiClient.verifyIssue(orgId, processId, selectedIssue.id, {
                verificationStatus: "effective",
                closureComments,
                verificationFiles: uploadedFiles,
                closeOutDate: closeOutDate.toISOString(),
                verificationDate: verificationDate.toISOString(),
                signature,
                kpiScore: 3, // Default KPI, can be calculated later
            })

            console.log("[VerificationIssues] Verification submitted successfully:", response)
            toast.success("Issue marked as effective and closed")

            // Notify board (and other tabs) so issue moves to Done
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("issueUpdated", {
                  detail: { processId, orgId, issueId: selectedIssue.id, status: "done" },
                })
              )
            }

            // Refresh data
            const issuesRes = await apiClient.getIssues(orgId, processId)
            setAllIssues(issuesRes.issues || [])
            const inReviewIssues = (issuesRes.issues || []).filter((i: Issue) => i.status === "in-review")
            setPendingIssues(inReviewIssues)

            // Close dialogs and reset form
            setOpenSubmit(false)
            setOpenFirst(false)
            setSelectedIssue(null)
            setIssueReview(null)
            setClosureComments("")
            setVerificationFiles([])
            setCloseOutDate(new Date())
            setVerificationDate(new Date())
            setSignature("")
        } catch (error: any) {
            console.error("Error submitting verification:", error)
            toast.error(error.message || "Failed to submit verification")
        } finally {
            setIsSubmitting(false)
        }
    }

    // Handle ineffective submission
    const handleSubmitIneffective = async () => {
        if (!selectedIssue || !selectedAssignee || !dueDate || !reassignmentInstructions) {
            toast.error("Please fill all required fields")
            return
        }

        setIsSubmitting(true)
        try {
            // Upload reassignment files to S3
            const uploadedFiles: Array<{ name: string; size: number; type: string; key: string }> = []
            for (const file of reassignmentFiles) {
                try {
                    const result = await apiClient.uploadFile(
                        file,
                        orgId,
                        processId,
                        selectedIssue.id,
                        "actionPlan" // Using actionPlan type for reassignment files
                    )
                    uploadedFiles.push({
                        name: result.file.name,
                        size: result.file.size,
                        type: result.file.type,
                        key: result.file.key,
                    })
                } catch (error: any) {
                    console.error("Error uploading file:", error)
                    toast.error(`Failed to upload ${file.name}`)
                }
            }

            // Submit verification
            await apiClient.verifyIssue(orgId, processId, selectedIssue.id, {
                verificationStatus: "ineffective",
                reassignedTo: selectedAssignee,
                reassignmentInstructions,
                reassignmentDueDate: dueDate.toISOString(),
                reassignmentFiles: uploadedFiles,
            })

            toast.success("Issue marked as ineffective and reassigned")

            // Refresh data
            const issuesRes = await apiClient.getIssues(orgId, processId)
            setAllIssues(issuesRes.issues || [])
            const inReviewIssues = (issuesRes.issues || []).filter((i: Issue) => i.status === "in-review")
            setPendingIssues(inReviewIssues)

            // Close dialogs and reset form
            setOpenNoSubmit(false)
            setOpenFirst(false)
            setSelectedIssue(null)
            setIssueReview(null)
            setSelectedAssignee("")
            setDueDate(undefined)
            setReassignmentInstructions("")
            setReassignmentFiles([])
        } catch (error: any) {
            console.error("Error submitting verification:", error)
            toast.error(error.message || "Failed to submit verification")
        } finally {
            setIsSubmitting(false)
        }
    }

    const sortBy = (key: string) => {
        if (sortKey === key) {
            setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
        } else {
            setSortKey(key)
            setSortDir("asc")
        }
    }

    const SortHeader = ({ field, children }: { field: string; children: ReactNode }) => (
        <TableHead
            className="cursor-pointer select-none hover:bg-muted/50"
            onClick={() => sortBy(field)}
        >
            <div className="flex items-center gap-1">
                {children}
                <ArrowUpDown className="h-4 w-4" />
            </div>
        </TableHead>
    )

    // ---------------- FILTERING + SORTING ---------------- //
    const applySorting = (data: any[]) => {
        if (!sortKey) return data
        return [...data].sort((a, b) => {
            const aVal = (a as any)[sortKey]
            const bVal = (b as any)[sortKey]
            if (aVal < bVal) return sortDir === "asc" ? -1 : 1
            if (aVal > bVal) return sortDir === "asc" ? 1 : -1
            return 0
        })
    }

    // Helper to get tag variant
    const getTagVariant = (tagName: string): BadgeVariant => {
        if (tagName?.toLowerCase().includes("risk")) return "destructive"
        if (tagName?.toLowerCase().includes("quality")) return "default"
        return "secondary"
    }

    const filteredAll = useMemo(() => {
        let data = allIssues.map(issue => ({
            ...issue,
            tag: issue.tags?.[0] || "Unknown",
            tagVariant: getTagVariant(issue.tags?.[0] || ""),
        }))

        if (search)
            data = data.filter(
                (i) =>
                    i.title.toLowerCase().includes(search.toLowerCase()) ||
                    i.id.includes(search)
            )

        if (tag !== "all") data = data.filter((i) => i.tag === tag)
        if (status !== "all")
            data = data.filter((i) =>
                status === "success" ? i.status === "done" : i.status !== "done"
            )

        return applySorting(data)
    }, [allIssues, search, tag, status, sortKey, sortDir])

    const filteredPending = useMemo(() => {
        let data = pendingIssues.map(issue => ({
            ...issue,
            tag: issue.tags?.[0] || "Unknown",
            tagVariant: getTagVariant(issue.tags?.[0] || ""),
        }))

        if (search)
            data = data.filter(
                (i) =>
                    i.title.toLowerCase().includes(search.toLowerCase()) ||
                    i.id.includes(search)
            )

        if (tag !== "all") data = data.filter((i) => i.tag === tag)

        return applySorting(data)
    }, [pendingIssues, search, tag, sortKey, sortDir])

    // ---------------- PAGINATION ---------------- //
    const paginatedAll = useMemo(
        () => filteredAll.slice((pageAll - 1) * pageSize, pageAll * pageSize),
        [filteredAll, pageAll, pageSize]
    )

    const paginatedPending = useMemo(
        () =>
            filteredPending.slice(
                (pagePending - 1) * pageSize,
                pagePending * pageSize
            ),
        [filteredPending, pagePending, pageSize]
    )

    const Pagination = ({
        page,
        total,
        setPage,
    }: {
        page: number
        total: number
        setPage: (p: number) => void
    }) => {
        const totalPages = Math.ceil(total / pageSize) || 1

        return (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
                <div className="text-sm text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                </div>

                <div className="flex items-center gap-3">
                    <Select
                        value={pageSize.toString()}
                        onValueChange={(v) => {
                            setPageSize(Number(v))
                            setPage(1)
                        }}
                    >
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="5">5 per page</SelectItem>
                            <SelectItem value="10">10 per page</SelectItem>
                            <SelectItem value="20">20 per page</SelectItem>
                            <SelectItem value="50">50 per page</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <span className="text-sm font-medium px-3">
                            Page {page} / {totalPages}
                        </span>

                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === totalPages}
                            onClick={() => setPage(page + 1)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-sm text-muted-foreground">Loading issues...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full">
            <Tabs defaultValue="all" className="w-full">
                {/* ---------------- TABS ---------------- */}
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-10">
                    <TabsTrigger value="all">All Issues</TabsTrigger>

                    <TabsTrigger value="verification">
                        Verification Required
                        <Badge className="text-[#8200DB] bg-[#F3E8FF] border-[#DAB2FF] rounded-md ml-2">
                            {filteredPending.length}
                        </Badge>
                    </TabsTrigger>
                </TabsList>

                {/* ---------------- ALL ISSUES TAB ---------------- */}
                <TabsContent value="all" className="space-y-8">
                    {/* Search + Filters */}
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                            <Input
                                placeholder="Search by title or reference..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Select value={tag} onValueChange={setTag}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="All Tags" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Tags</SelectItem>
                                    <SelectItem value="Quality Issue">Quality Issue</SelectItem>
                                    <SelectItem value="Process Improvement">Process Improvement</SelectItem>
                                    <SelectItem value="Risk Mitigation">Risk Mitigation</SelectItem>
                                    <SelectItem value="Customer Concern">Customer Concern</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="success">Success</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button variant="outline">Export</Button>
                        </div>
                    </div>

                    {/* Cards */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Card className="border-l-4 border-l-blue-500">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Total Issues</p>
                                        <p className="text-2xl font-bold mt-2">{filteredAll.length}</p>
                                    </div>
                                    <FileText className="h-8 w-8 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-orange-500">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Open Issues</p>
                                        <p className="text-2xl font-bold mt-2">
                                            {filteredAll.filter((i) => i.status === "Pending").length}
                                        </p>
                                    </div>
                                    <Clock className="h-8 w-8 text-orange-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-green-500">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Closed Issues</p>
                                        <p className="text-2xl font-bold mt-2">
                                            {filteredAll.filter((i) => i.status === "done").length}
                                        </p>
                                    </div>
                                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-purple-500">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Avg. KPI Score</p>
                                        <p className="text-2xl font-bold mt-2">2.3</p>
                                    </div>
                                    <AlertCircle className="h-8 w-8 text-purple-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Full Table */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <SortHeader field="ref">Issue Ref</SortHeader>
                                            <SortHeader field="title">Title</SortHeader>
                                            <SortHeader field="tag">TAG</SortHeader>
                                            <SortHeader field="source">Source</SortHeader>
                                            <SortHeader field="issuer">Issuer</SortHeader>
                                            <SortHeader field="assignee">Assignee</SortHeader>
                                            <SortHeader field="planDate">Plan Date</SortHeader>
                                            <SortHeader field="actualDate">Actual Date</SortHeader>
                                            <SortHeader field="dueDate">Due Date</SortHeader>
                                            <SortHeader field="status">Status</SortHeader>
                                            <SortHeader field="kpi">KPI</SortHeader>
                                            <TableHead>JIRA</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {paginatedAll.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={13} className="text-center py-12 text-muted-foreground">
                                                    No issues found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedAll.map((issue) => (
                                                <TableRow key={issue.id}>
                                                    <TableCell className="font-mono text-sm">{issue.id.substring(0, 8)}...</TableCell>
                                                    <TableCell className="font-medium max-w-md">{issue.title}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={issue.tagVariant}>{issue.tag}</Badge>
                                                    </TableCell>
                                                    <TableCell>{issue.source || "—"}</TableCell>
                                                    <TableCell>—</TableCell> {/* Issuer not in DB */}
                                                    <TableCell>{issue.assignee || "—"}</TableCell>
                                                    <TableCell>—</TableCell> {/* Plan date not in DB */}
                                                    <TableCell>—</TableCell> {/* Actual date not in DB */}
                                                    <TableCell>—</TableCell> {/* Due date not in DB */}
                                                    <TableCell>
                                                        <Badge variant={issue.status === "done" ? "default" : issue.status === "in-review" ? "secondary" : "destructive"}>
                                                            {issue.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{issue.kpi || 0}</TableCell>

                                                    <TableCell>
                                                        — {/* JIRA link not in DB */}
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            <Pagination page={pageAll} total={filteredAll.length} setPage={setPageAll} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---------------- VERIFICATION TAB ---------------- */}
                <TabsContent value="verification" className="space-y-8">
                    {/* Search + Filters */}
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                            <Input
                                placeholder="Search by title or ID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <div className="flex gap-3">
                            <Select value={tag} onValueChange={setTag}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="All Tags" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Tags</SelectItem>
                                    <SelectItem value="Quality Issue">Quality Issue</SelectItem>
                                    <SelectItem value="Risk Mitigation">Risk Mitigation</SelectItem>
                                    <SelectItem value="Customer Concern">Customer Concern</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline">Export</Button>
                        </div>
                    </div>

                    {/* Cards */}
                    <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
                        <Card className="border-l-4 border-l-purple-500">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Pending Verification</p>
                                        <p className="text-2xl font-bold mt-2">{filteredPending.length}</p>
                                    </div>
                                    <Clock className="h-8 w-8 text-purple-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-green-500">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Avg. Resolution Time</p>
                                        <p className="text-2xl font-bold mt-2">22 days</p>
                                    </div>
                                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-blue-500">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Expected KPI</p>
                                        <p className="text-2xl font-bold mt-2">2.7</p>
                                    </div>
                                    <FileText className="h-8 w-8 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Verification Table */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <SortHeader field="id">Issue ID</SortHeader>
                                            <SortHeader field="title">Title</SortHeader>
                                            <SortHeader field="tag">Tag</SortHeader>
                                            <SortHeader field="assignee">Assignee</SortHeader>
                                            <SortHeader field="assigned">Assigned</SortHeader>
                                            <SortHeader field="due">Due</SortHeader>
                                            <SortHeader field="completed">Completed</SortHeader>
                                            <SortHeader field="kpi">KPI</SortHeader>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {paginatedPending.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                                                    No pending verification issues
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedPending.map((issue) => (
                                                <TableRow key={issue.id}>
                                                    <TableCell className="font-mono text-sm">{issue.id}</TableCell>
                                                    <TableCell className="font-medium">{issue.title}</TableCell>

                                                    <TableCell>
                                                        <Badge variant={issue.tagVariant}>{issue.tag}</Badge>
                                                    </TableCell>

                                                    <TableCell>{issue.assignee}</TableCell>
                                                    <TableCell>{issue.assigned}</TableCell>
                                                    <TableCell>{issue.due}</TableCell>
                                                    <TableCell>{issue.completed}</TableCell>

                                                    <TableCell className="text-center">
                                                        <div
                                                            className={`inline-flex h-9 w-9 items-center justify-center rounded-full font-bold text-sm ${(issue.kpi || 0) > 0
                                                                ? "bg-green-100 text-green-800"
                                                                : "bg-red-100 text-red-800"
                                                                }`}
                                                        >
                                                            {issue.kpi || 0}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell>
                                                        <Badge variant="outline">Pending Verification</Badge>
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={() => handleReviewClick(issue)}
                                                        >
                                                            <Eye className="mr-1 h-4 w-4" /> Review
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            <Pagination page={pagePending} total={filteredPending.length} setPage={setPagePending} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            <Dialog open={openFirst} onOpenChange={setOpenFirst}>
                <DialogContent className="max-w-3xl! h-[90vh] overflow-y-scroll">
                    {/* Header */}
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">
                            Verify Corrective Action Effectiveness
                        </DialogTitle>
                        <DialogDescription>
                            Review the corrective action and determine if it is effective or requires reassignment
                        </DialogDescription>
                    </DialogHeader>

                    {/* Issue Summary */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm">Issue Summary</h3>

                        {isLoadingReview ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-sm text-muted-foreground">Loading issue review data...</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2 text-sm">
                                    <p>
                                        <span className="text-muted-foreground block">Issue ID</span>
                                        <span className="font-medium text-[#0A0A0A]">{selectedIssue?.id || "—"}</span>
                                    </p>

                                    <p>
                                        <span className="text-muted-foreground block">Title</span>
                                        <span className="font-medium text-[#0A0A0A]">
                                            {selectedIssue?.title || "—"}
                                        </span>
                                    </p>

                                    <p>
                                        <span className="text-muted-foreground block mb-1">Tag Category</span>
                                        <Badge variant={selectedIssue?.tagVariant || "default"}>
                                            {selectedIssue?.tag || "—"}
                                        </Badge>
                                    </p>
                                </div>

                                {/* Description */}
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                                    <p className="text-sm text-[#0A0A0A]">
                                        {selectedIssue?.description || "No description provided"}
                                    </p>
                                </div>

                                {/* Root Cause */}
                                {issueReview?.rootCauseText && (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-1">Root Cause Analysis</p>
                                        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                                            {issueReview.rootCauseText}
                                        </div>
                                    </div>
                                )}

                                {/* Containment Action */}
                                {issueReview?.containmentText && (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-1">Containment Action</p>
                                        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm">
                                            {issueReview.containmentText}
                                        </div>
                                    </div>
                                )}

                                {/* Corrective Action Plan */}
                                {issueReview?.actionPlans && issueReview.actionPlans.length > 0 && (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-1">Corrective Action Plan</p>
                                        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm space-y-2">
                                            {issueReview.actionPlans.map((plan, idx) => (
                                                <div key={idx} className="border-b last:border-b-0 pb-2 last:pb-0">
                                                    <p className="font-medium">{plan.action}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Responsible: {plan.responsible} |
                                                        Planned: {plan.plannedDate || "—"} |
                                                        Actual: {plan.actualDate || "—"}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Attachments */}
                                {(issueReview?.containmentFiles?.length || issueReview?.rootCauseFiles?.length ||
                                    issueReview?.actionPlans?.some(p => p.files?.length)) ? (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-2">Attachments</p>
                                        <div className="space-y-2">
                                            {/* Containment files */}
                                            {issueReview.containmentFiles?.map((file, idx) => (
                                                <div key={`containment-${idx}`} className="flex items-center justify-between rounded-md border p-3 text-sm">
                                                    <div className="flex items-center gap-1.5">
                                                        <NotebookText />
                                                        {file.name}
                                                        {file.key && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs ml-2"
                                                                onClick={async () => {
                                                                    try {
                                                                        const result = await apiClient.getFileDownloadUrl(file.key!)
                                                                        window.open(result.url, "_blank")
                                                                    } catch (error: any) {
                                                                        toast.error("Failed to download file")
                                                                    }
                                                                }}
                                                            >
                                                                Download
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <span className="text-muted-foreground text-xs">
                                                        {(file.size / 1024).toFixed(1)} KB
                                                    </span>
                                                </div>
                                            ))}
                                            {/* Root cause files */}
                                            {issueReview.rootCauseFiles?.map((file, idx) => (
                                                <div key={`rootcause-${idx}`} className="flex items-center justify-between rounded-md border p-3 text-sm">
                                                    <div className="flex items-center gap-1.5">
                                                        <NotebookText />
                                                        {file.name}
                                                        {file.key && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs ml-2"
                                                                onClick={async () => {
                                                                    try {
                                                                        const result = await apiClient.getFileDownloadUrl(file.key!)
                                                                        window.open(result.url, "_blank")
                                                                    } catch (error: any) {
                                                                        toast.error("Failed to download file")
                                                                    }
                                                                }}
                                                            >
                                                                Download
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <span className="text-muted-foreground text-xs">
                                                        {(file.size / 1024).toFixed(1)} KB
                                                    </span>
                                                </div>
                                            ))}
                                            {/* Action plan files */}
                                            {issueReview.actionPlans?.map((plan, planIdx) =>
                                                plan.files?.map((file, fileIdx) => (
                                                    <div key={`action-${planIdx}-${fileIdx}`} className="flex items-center justify-between rounded-md border p-3 text-sm">
                                                        <div className="flex items-center gap-1.5">
                                                            <NotebookText />
                                                            {file.name}
                                                            {file.key && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 px-2 text-xs ml-2"
                                                                    onClick={async () => {
                                                                        try {
                                                                            const result = await apiClient.getFileDownloadUrl(file.key!)
                                                                            window.open(result.url, "_blank")
                                                                        } catch (error: any) {
                                                                            toast.error("Failed to download file")
                                                                        }
                                                                    }}
                                                                >
                                                                    Download
                                                                </Button>
                                                            )}
                                                        </div>
                                                        <span className="text-muted-foreground text-xs">
                                                            {(file.size / 1024).toFixed(1)} KB
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-2">Attachments</p>
                                        <p className="text-sm text-muted-foreground">No attachments</p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Decision */}
                        <div className="pt-2">
                            <p className="text-sm font-semibold mb-3 text-[#0A0A0A]">
                                Issuer Verification Decision
                            </p>

                            <div className="space-y-3">
                                {/* GREEN BUTTON */}
                                <Button
                                    className="w-full justify-start h-auto gap-3 bg-green-600 hover:bg-green-700"
                                    onClick={() => {
                                        setOpenFirst(false)
                                        setOpenSubmit(true)
                                    }}
                                    disabled={!selectedIssue || isLoadingReview}
                                >
                                    <CircleCheck />
                                    <div className="flex flex-col items-start">
                                        <span className="text-base">Mark as Effective and Close Issue</span>
                                        <span className="text-xs">Corrective action successfully resolved the issue</span>
                                    </div>
                                </Button>

                                {/* RED BUTTON */}
                                <Button
                                    variant="outline"
                                    className="w-full justify-start gap-3 h-auto border-red-500 text-red-600 hover:bg-red-50"
                                    onClick={() => {
                                        setOpenFirst(false)
                                        setOpenNoSubmit(true)
                                    }}
                                    disabled={!selectedIssue || isLoadingReview}
                                >
                                    <CircleX />
                                    <div className="flex flex-col items-start">
                                        <span className="text-base">Mark as Ineffective & Reassign</span>
                                        <span className="text-xs">Corrective action did not adequately resolve the issue</span>
                                    </div>
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={openSubmit} onOpenChange={setOpenSubmit}>
                <DialogContent className="max-w-3xl! max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">
                            Effectiveness Verification & Closure
                        </DialogTitle>
                        <DialogDescription>
                            Review investigation details and verify corrective action effectiveness.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Assignee Investigation Summary */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-4">
                        <div className="flex items-center gap-2 font-semibold text-sm">
                            <Info className="text-[#155DFC]" /> Assignee Investigation Summary
                        </div>

                        <div className="space-y-2 text-sm">
                            {issueReview?.containmentText && (
                                <div>
                                    <p className="text-muted-foreground mb-1">
                                        Containment / Immediate Correction:
                                    </p>
                                    <div className="rounded-md border bg-white p-2">{issueReview.containmentText}</div>
                                </div>
                            )}

                            {issueReview?.rootCauseText && (
                                <div>
                                    <p className="text-muted-foreground mb-1">
                                        Root Cause of Problem:
                                    </p>
                                    <div className="rounded-md border bg-white p-2">{issueReview.rootCauseText}</div>
                                </div>
                            )}

                            {issueReview?.actionPlans && issueReview.actionPlans.length > 0 && (
                                <div>
                                    <p className="text-muted-foreground mb-1">Action Plan:</p>
                                    <div className="overflow-hidden rounded-md border bg-white">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Action</th>
                                                    <th className="px-3 py-2 text-left">Responsible</th>
                                                    <th className="px-3 py-2 text-left">Planned Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {issueReview.actionPlans.map((plan, idx) => (
                                                    <tr key={idx} className="border-t">
                                                        <td className="px-3 py-2">{plan.action}</td>
                                                        <td className="px-3 py-2">{plan.responsible}</td>
                                                        <td className="px-3 py-2">{plan.plannedDate ? format(new Date(plan.plannedDate), "MMMM do, yyyy") : "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Effectiveness Verification */}
                    <div className="space-y-4 pt-4">
                        <h3 className="font-semibold text-sm">
                            Effectiveness Verification & Closure
                        </h3>

                        <p className="text-sm text-muted-foreground">
                            As the issuer, review the assignee's investigation and corrective actions.
                            Verify if the actions taken effectively resolved the issue and prevented
                            recurrence.
                        </p>

                        {/* Closure Comments */}
                        <div>
                            <Label className="text-sm font-medium">
                                Closure Comments <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                className="mt-1"
                                rows={4}
                                placeholder="Enter your effectiveness verification comments here..."
                                value={closureComments}
                                onChange={(e) => setClosureComments(e.target.value)}
                                required
                            />
                        </div>

                        {/* Attachments */}
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-[#0A0A0A]">Attach Verification Evidence</p>
                                <p className="text-xs text-muted-foreground">
                                    Upload photos, documents, or test results proving effectiveness.
                                    Max 5 files, JPEG/JPG/PNG up to 2MB each.
                                </p>
                            </div>

                            <div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    multiple
                                    onChange={handleFileChange}
                                    accept=".jpg,.jpeg,.png,.pdf"
                                />

                                <div className="flex items-center gap-2">
                                    <Button variant="outline" onClick={handleClick}>
                                        <Upload className="mr-2 h-4 w-4" /> Upload Attachments
                                    </Button>
                                    {verificationFiles.length > 0 && (
                                        <span className="text-sm text-muted-foreground">
                                            {verificationFiles.length} file(s) selected
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Issue Close Out Date */}
                            <div>
                                <Label className="text-sm font-medium">
                                    Issue Close Out Date <span className="text-red-500">*</span>
                                </Label>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-left font-normal"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {closeOutDate
                                                ? format(closeOutDate, "MMMM do, yyyy")
                                                : "Pick a date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={closeOutDate}
                                            onSelect={setCloseOutDate}
                                            required
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Effectiveness Verification Date */}
                            <div>
                                <Label className="text-sm font-medium">
                                    Effectiveness Verification Date <span className="text-red-500">*</span>
                                </Label>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-left font-normal"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {verificationDate
                                                ? format(verificationDate, "MMMM do, yyyy")
                                                : "Pick a date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={verificationDate}
                                            onSelect={setVerificationDate}
                                            required
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>


                        {/* Signature */}
                        <div>
                            <Label className="text-sm font-medium">
                                Issuer Signature <span className="text-red-500">*</span>
                            </Label>

                            {/* Signature Pad */}
                            <div className="mt-2">
                                <SignatureCanvas
                                    ref={sigCanvas}
                                    backgroundColor="white"
                                    penColor="black"
                                    canvasProps={{
                                        width: 400,
                                        height: 100,
                                        className: "border bg-white p-2"
                                    }}
                                />
                            </div>


                            {/* Clear and Save Buttons */}
                            <div className="mt-2">
                                <button onClick={handleClear} className="mr-2 text-sm text-blue-500">
                                    Clear
                                </button>
                                <button onClick={handleSave} className="text-sm text-blue-500">
                                    Save Signature
                                </button>
                            </div>

                            {/* Signature Preview */}
                            <p className="text-xs text-muted-foreground mt-2">
                                Digital Signature Preview:
                            </p>
                            <div className="rounded-md border bg-white p-2 text-sm font-semibold font-times h-30">
                                {signature ? (
                                    <img src={signature} alt="Signature Preview" />
                                ) : (
                                    <i>Draw your signature above</i>
                                )}
                            </div>

                            <div className="mt-2 border p-2 rounded-md">
                                <input
                                    type="text"
                                    className="mt-1 w-full"
                                    value={signature || ""}
                                    onChange={(e) => setSignature(e.target.value)}
                                    placeholder="Enter signature (if not drawn)"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Decision */}
                    <p className="text-[#0A0A0A] font-semibold">Issuer Verification Decision</p>
                    <div className="rounded-lg border border-[#B9F8CF] bg-[#F0FDF4] p-4">
                        <div className="flex gap-2.5">
                            <CircleCheck className="text-[#00A63E]" size={20} />
                            <div>
                                <p className="font-semibold text-sm mb-1 text-[#00A63E]">
                                    Confirm Effectiveness
                                </p>
                                <p className="text-xs mb-3 text-[#00A63E]">
                                    This will close the issue, calculate the KPI score, and move it to
                                    Completed Issues.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                className="bg-green-600 hover:bg-green-700 w-[80%]"
                                onClick={handleSubmitEffective}
                                disabled={isSubmitting || !closureComments || !closeOutDate || !verificationDate || !signature}
                            >
                                {isSubmitting ? "Submitting..." : "Confirm & Close Issue"}
                            </Button>

                            <Button
                                className="w-[20%]"
                                variant="outline"
                                onClick={() => setOpenSubmit(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>


            <Dialog open={openNoSubmit} onOpenChange={setOpenNoSubmit}>
                <DialogContent className="max-w-3xl! max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">
                            Verify Corrective Action Effectiveness
                        </DialogTitle>
                        <DialogDescription>
                            Review the corrective action and determine if it is effective or requires reassignment
                        </DialogDescription>
                    </DialogHeader>
                    {/* Issue Summary */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm">Issue Summary</h3>
                        {isLoadingReview ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-sm text-muted-foreground">Loading issue review data...</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2 text-sm">
                                    <p>
                                        <span className="text-muted-foreground block">Issue ID</span>
                                        <span className="font-medium text-[#0A0A0A]">{selectedIssue?.id || "—"}</span>
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground block">Title</span>
                                        <span className="font-medium text-[#0A0A0A]">
                                            {selectedIssue?.title || "—"}
                                        </span>
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground block mb-1">Tag Category</span>
                                        <Badge variant={selectedIssue?.tagVariant || "default"}>
                                            {selectedIssue?.tag || "—"}
                                        </Badge>
                                    </p>
                                </div>
                                {/* Description */}
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                                    <p className="text-sm text-[#0A0A0A]">
                                        {selectedIssue?.description || "No description provided"}
                                    </p>
                                </div>
                                {/* Root Cause */}
                                {issueReview?.rootCauseText && (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-1">Root Cause Analysis</p>
                                        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                                            {issueReview.rootCauseText}
                                        </div>
                                    </div>
                                )}
                                {/* Containment Action */}
                                {issueReview?.containmentText && (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-1">Containment Action</p>
                                        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm">
                                            {issueReview.containmentText}
                                        </div>
                                    </div>
                                )}
                                {/* Corrective Action Plan */}
                                {issueReview?.actionPlans && issueReview.actionPlans.length > 0 && (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-1">Corrective Action Plan</p>
                                        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm space-y-2">
                                            {issueReview.actionPlans.map((plan, idx) => (
                                                <div key={idx} className="border-b last:border-b-0 pb-2 last:pb-0">
                                                    <p className="font-medium">{plan.action}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Responsible: {plan.responsible} |
                                                        Planned: {plan.plannedDate || "—"} |
                                                        Actual: {plan.actualDate || "—"}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Attachments */}
                                {(issueReview?.containmentFiles?.length || issueReview?.rootCauseFiles?.length ||
                                    issueReview?.actionPlans?.some(p => p.files?.length)) ? (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-2">Attachments</p>
                                        <div className="space-y-2">
                                            {/* Show all files with download buttons */}
                                            {issueReview.containmentFiles?.map((file, idx) => (
                                                <div key={`containment-${idx}`} className="flex items-center justify-between rounded-md border p-3 text-sm">
                                                    <div className="flex items-center gap-1.5">
                                                        <NotebookText />
                                                        {file.name}
                                                        {file.key && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs ml-2"
                                                                onClick={async () => {
                                                                    try {
                                                                        const result = await apiClient.getFileDownloadUrl(file.key!)
                                                                        window.open(result.url, "_blank")
                                                                    } catch (error: any) {
                                                                        toast.error("Failed to download file")
                                                                    }
                                                                }}
                                                            >
                                                                Download
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <span className="text-muted-foreground text-xs">
                                                        {(file.size / 1024).toFixed(1)} KB
                                                    </span>
                                                </div>
                                            ))}
                                            {issueReview.rootCauseFiles?.map((file, idx) => (
                                                <div key={`rootcause-${idx}`} className="flex items-center justify-between rounded-md border p-3 text-sm">
                                                    <div className="flex items-center gap-1.5">
                                                        <NotebookText />
                                                        {file.name}
                                                        {file.key && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs ml-2"
                                                                onClick={async () => {
                                                                    try {
                                                                        const result = await apiClient.getFileDownloadUrl(file.key!)
                                                                        window.open(result.url, "_blank")
                                                                    } catch (error: any) {
                                                                        toast.error("Failed to download file")
                                                                    }
                                                                }}
                                                            >
                                                                Download
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <span className="text-muted-foreground text-xs">
                                                        {(file.size / 1024).toFixed(1)} KB
                                                    </span>
                                                </div>
                                            ))}
                                            {issueReview.actionPlans?.map((plan, planIdx) =>
                                                plan.files?.map((file, fileIdx) => (
                                                    <div key={`action-${planIdx}-${fileIdx}`} className="flex items-center justify-between rounded-md border p-3 text-sm">
                                                        <div className="flex items-center gap-1.5">
                                                            <NotebookText />
                                                            {file.name}
                                                            {file.key && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 px-2 text-xs ml-2"
                                                                    onClick={async () => {
                                                                        try {
                                                                            const result = await apiClient.getFileDownloadUrl(file.key!)
                                                                            window.open(result.url, "_blank")
                                                                        } catch (error: any) {
                                                                            toast.error("Failed to download file")
                                                                        }
                                                                    }}
                                                                >
                                                                    Download
                                                                </Button>
                                                            )}
                                                        </div>
                                                        <span className="text-muted-foreground text-xs">
                                                            {(file.size / 1024).toFixed(1)} KB
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-2">Attachments</p>
                                        <p className="text-sm text-muted-foreground">No attachments</p>
                                    </div>
                                )}
                            </>
                        )}
                        <p className="text-sm font-semibold text-[#0A0A0A]">
                            Issuer Verification Decision
                        </p>
                        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 space-y-4">
                            {/* Header */}
                            <div className="flex items-start gap-2">
                                <AlertCircle className="text-red-700 mt-1" size={20} />
                                <div>
                                    <h3 className="font-semibold text-sm text-red-700">
                                        Reassignment Required
                                    </h3>
                                    <p className="text-sm text-red-600">
                                        Provide new instructions and reassign the issue for corrective action.
                                    </p>
                                </div>
                            </div>

                            {/* New Instructions */}
                            <div className="space-y-1">
                                <Label className="text-sm font-medium text-[#0A0A0A]">
                                    New Instructions <span className="text-red-600">*</span>
                                </Label>
                                <Textarea
                                    rows={3}
                                    placeholder="Explain why the corrective action was ineffective and provide new guidance..."
                                    className="w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                                />
                            </div>

                            {/* New Assignee */}
                            <div className="space-y-1">
                                <Label className="text-sm font-medium text-[#0A0A0A]">
                                    New Assignee <span className="text-red-600">*</span>
                                </Label>

                                <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                                    <SelectTrigger className="w-full border-red-200">
                                        <SelectValue placeholder="Select assignee" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {processUsers.map((user) => (
                                            <SelectItem key={user.id} value={user.id}>
                                                {user.name} {user.email && `(${user.email})`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* New Due Date */}
                            <div className="space-y-1">
                                <Label className="text-sm font-medium text-[#0A0A0A]">
                                    New Due Date <span className="text-red-600">*</span>
                                </Label>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left text-sm border-red-200",
                                                !dueDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                                        </Button>
                                    </PopoverTrigger>

                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={dueDate}
                                            onSelect={setDueDate}
                                            disabled={(date) => date < new Date()}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Attachment */}
                            <div className="space-y-1">
                                <Label className="text-sm font-medium text-[#0A0A0A]">
                                    Attachment (Optional)
                                </Label>
                                <input
                                    type="file"
                                    ref={reassignmentFileInputRef}
                                    className="hidden"
                                    multiple
                                    onChange={handleReassignmentFileChange}
                                />
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        type="button"
                                        onClick={() => reassignmentFileInputRef.current?.click()}
                                        className="border-red-200"
                                    >
                                        <Upload className="mr-2 h-4 w-4" /> Upload Files
                                    </Button>
                                    {reassignmentFiles.length > 0 && (
                                        <span className="text-sm text-muted-foreground">
                                            {reassignmentFiles.length} file(s) selected
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    className="bg-red-600 hover:bg-red-700 text-white w-[80%]"
                                    onClick={handleSubmitIneffective}
                                    disabled={isSubmitting || !selectedAssignee || !dueDate || !reassignmentInstructions}
                                >
                                    {isSubmitting ? "Submitting..." : "Reassign Issue"}
                                </Button>

                                <Button
                                    className="w-[20%]"
                                    variant="outline"
                                    onClick={() => setOpenNoSubmit(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    )
}

