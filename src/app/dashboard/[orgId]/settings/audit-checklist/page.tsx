"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileCheck, Plus, Pencil, Trash2, ChevronRight } from "lucide-react";

type ChecklistSummary = { id: string; name: string; questionCount: number; createdAt: string };
type Question = {
  id: string;
  clause: string;
  subclause: string;
  requirement: string;
  question: string;
  evidenceExample: string;
  sortOrder: number;
};

export default function AuditChecklistSettingsPage() {
  const params = useParams();
  const orgId = params?.orgId as string;

  const [checklists, setChecklists] = useState<ChecklistSummary[]>([]);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [selectedChecklistName, setSelectedChecklistName] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [isCreateChecklistOpen, setIsCreateChecklistOpen] = useState(false);
  const [newChecklistName, setNewChecklistName] = useState("");
  const [isCreatingChecklist, setIsCreatingChecklist] = useState(false);

  const [isEditChecklistOpen, setIsEditChecklistOpen] = useState(false);
  const [editChecklistName, setEditChecklistName] = useState("");
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);

  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionForm, setQuestionForm] = useState({
    clause: "",
    subclause: "",
    requirement: "",
    question: "",
    evidenceExample: "",
  });
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);

  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  const [deleteChecklistId, setDeleteChecklistId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadChecklists = useCallback(async () => {
    if (!orgId) return;
    try {
      setIsLoadingList(true);
      const res = await apiClient.getAuditChecklists(orgId);
      setChecklists(res.checklists ?? []);
    } catch (e) {
      toast.error("Failed to load checklists");
      setChecklists([]);
    } finally {
      setIsLoadingList(false);
    }
  }, [orgId]);

  const loadChecklistDetail = useCallback(
    async (checklistId: string) => {
      if (!orgId) return;
      try {
        setIsLoadingDetail(true);
        const res = await apiClient.getAuditChecklist(orgId, checklistId);
        const c = res.checklist;
        if (c) {
          setSelectedChecklistName(c.name);
          setQuestions(c.questions ?? []);
        }
      } catch (e) {
        toast.error("Failed to load checklist");
        setQuestions([]);
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [orgId]
  );

  useEffect(() => {
    loadChecklists();
  }, [loadChecklists]);

  useEffect(() => {
    if (selectedChecklistId) {
      loadChecklistDetail(selectedChecklistId);
    } else {
      setQuestions([]);
      setSelectedChecklistName("");
    }
  }, [selectedChecklistId, loadChecklistDetail]);

  const handleCreateChecklist = async () => {
    const name = newChecklistName.trim();
    if (!name) {
      toast.error("Enter a checklist name");
      return;
    }
    try {
      setIsCreatingChecklist(true);
      const res = await apiClient.createAuditChecklist(orgId, { name });
      if (res.checklist) {
        toast.success("Checklist created");
        setNewChecklistName("");
        setIsCreateChecklistOpen(false);
        await loadChecklists();
        setSelectedChecklistId(res.checklist.id);
      }
    } catch (e) {
      toast.error("Failed to create checklist");
    } finally {
      setIsCreatingChecklist(false);
    }
  };

  const handleUpdateChecklist = async () => {
    const name = editChecklistName.trim();
    if (!selectedChecklistId || !name) return;
    try {
      setIsSavingChecklist(true);
      await apiClient.updateAuditChecklist(orgId, selectedChecklistId, { name });
      toast.success("Checklist updated");
      setSelectedChecklistName(name);
      setIsEditChecklistOpen(false);
      await loadChecklists();
    } catch (e) {
      toast.error("Failed to update checklist");
    } finally {
      setIsSavingChecklist(false);
    }
  };

  const handleDeleteChecklist = async (id: string) => {
    try {
      setIsDeleting(true);
      await apiClient.deleteAuditChecklist(orgId, id);
      toast.success("Checklist deleted");
      setDeleteChecklistId(null);
      if (selectedChecklistId === id) {
        setSelectedChecklistId(null);
      }
      await loadChecklists();
    } catch (e) {
      toast.error("Failed to delete checklist");
    } finally {
      setIsDeleting(false);
    }
  };

  const openAddQuestion = () => {
    setEditingQuestion(null);
    setQuestionForm({ clause: "", subclause: "", requirement: "", question: "", evidenceExample: "" });
    setIsQuestionDialogOpen(true);
  };

  const openEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setQuestionForm({
      clause: q.clause,
      subclause: q.subclause,
      requirement: q.requirement,
      question: q.question,
      evidenceExample: q.evidenceExample,
    });
    setIsQuestionDialogOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!selectedChecklistId) return;
    try {
      setIsSavingQuestion(true);
      if (editingQuestion) {
        await apiClient.updateChecklistQuestion(orgId, selectedChecklistId, editingQuestion.id, questionForm);
        toast.success("Question updated");
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === editingQuestion.id
              ? { ...q, ...questionForm }
              : q
          )
        );
      } else {
        const res = await apiClient.createChecklistQuestion(orgId, selectedChecklistId, questionForm);
        if (res.question) {
          toast.success("Question added");
          setQuestions((prev) => [...prev, { ...res.question, id: res.question.id }]);
        }
      }
      setIsQuestionDialogOpen(false);
      await loadChecklists();
    } catch (e) {
      toast.error(editingQuestion ? "Failed to update question" : "Failed to add question");
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!selectedChecklistId) return;
    try {
      setIsDeleting(true);
      await apiClient.deleteChecklistQuestion(orgId, selectedChecklistId, questionId);
      toast.success("Question deleted");
      setDeleteQuestionId(null);
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      await loadChecklists();
    } catch (e) {
      toast.error("Failed to delete question");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Audit Checklist</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create checklists (e.g. ISO 9001 Quality) and manage questions. These appear as audit criteria in the audit flow and drive checklist questions in Step 3.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Checklists</CardTitle>
              <Button size="sm" onClick={() => setIsCreateChecklistOpen(true)} className="gap-1">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            <CardDescription>Select a checklist to manage its questions.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingList ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">Loading…</div>
            ) : checklists.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                No checklists yet. Create one to get started.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {checklists.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedChecklistId(c.id)}
                      className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50 ${
                        selectedChecklistId === c.id ? "bg-green-50 text-green-800" : "text-gray-700"
                      }`}
                    >
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        <span className="text-gray-500">{c.questionCount} questions</span>
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            {selectedChecklistId ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-green-600" />
                    {selectedChecklistName || "Checklist"}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditChecklistName(selectedChecklistName);
                        setIsEditChecklistOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleteChecklistId(selectedChecklistId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={openAddQuestion} className="gap-1">
                      <Plus className="h-4 w-4" />
                      Add question
                    </Button>
                  </div>
                </div>
                <CardDescription>Clause, subclause, requirement, question, and evidence example for each item.</CardDescription>
              </>
            ) : (
              <CardTitle className="text-base text-gray-500">Select a checklist</CardTitle>
            )}
          </CardHeader>
          <CardContent>
            {!selectedChecklistId ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                Choose a checklist from the list or create a new one.
              </p>
            ) : isLoadingDetail ? (
              <div className="py-8 text-center text-sm text-gray-500">Loading questions…</div>
            ) : questions.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No questions yet. Add one to build your audit checklist.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Clause</TableHead>
                      <TableHead className="w-[80px]">Subclause</TableHead>
                      <TableHead>Requirement</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead>Evidence example</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-mono text-xs">{q.clause}</TableCell>
                        <TableCell className="font-mono text-xs">{q.subclause}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm" title={q.requirement}>{q.requirement}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-sm" title={q.question}>{q.question}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs text-gray-600" title={q.evidenceExample}>{q.evidenceExample}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => openEditQuestion(q)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            onClick={() => setDeleteQuestionId(q.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create checklist dialog */}
      <Dialog open={isCreateChecklistOpen} onOpenChange={setIsCreateChecklistOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New checklist</DialogTitle>
            <DialogDescription>e.g. ISO 9001 Quality, ISO 14001 Environment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-checklist-name">Name</Label>
              <Input
                id="new-checklist-name"
                value={newChecklistName}
                onChange={(e) => setNewChecklistName(e.target.value)}
                placeholder="e.g. ISO 9001 Quality"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateChecklistOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateChecklist} disabled={isCreatingChecklist}>
              {isCreatingChecklist ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit checklist name dialog */}
      <Dialog open={isEditChecklistOpen} onOpenChange={setIsEditChecklistOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit checklist name</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-checklist-name">Name</Label>
              <Input
                id="edit-checklist-name"
                value={editChecklistName}
                onChange={(e) => setEditChecklistName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditChecklistOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateChecklist} disabled={isSavingChecklist}>
              {isSavingChecklist ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit question dialog */}
      <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Edit question" : "Add question"}</DialogTitle>
            <DialogDescription>Clause, subclause, requirement, question text, and evidence example.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Clause</Label>
                <Input
                  value={questionForm.clause}
                  onChange={(e) => setQuestionForm((f) => ({ ...f, clause: e.target.value }))}
                  placeholder="e.g. 4.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Subclause</Label>
                <Input
                  value={questionForm.subclause}
                  onChange={(e) => setQuestionForm((f) => ({ ...f, subclause: e.target.value }))}
                  placeholder="e.g. 4.1.1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Requirement</Label>
              <Input
                value={questionForm.requirement}
                onChange={(e) => setQuestionForm((f) => ({ ...f, requirement: e.target.value }))}
                placeholder="Understanding the organization and its context"
              />
            </div>
            <div className="space-y-2">
              <Label>Question</Label>
              <Textarea
                value={questionForm.question}
                onChange={(e) => setQuestionForm((f) => ({ ...f, question: e.target.value }))}
                placeholder="Has the organization determined external and internal issues..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Evidence example</Label>
              <Input
                value={questionForm.evidenceExample}
                onChange={(e) => setQuestionForm((f) => ({ ...f, evidenceExample: e.target.value }))}
                placeholder="SWOT Analysis, PESTLE Analysis, Meeting Minutes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuestionDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveQuestion} disabled={isSavingQuestion}>
              {isSavingQuestion ? "Saving…" : editingQuestion ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete question confirmation */}
      <Dialog open={!!deleteQuestionId} onOpenChange={() => setDeleteQuestionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete question?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteQuestionId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteQuestionId && handleDeleteQuestion(deleteQuestionId)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete checklist confirmation */}
      <Dialog open={!!deleteChecklistId} onOpenChange={() => setDeleteChecklistId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete checklist?</DialogTitle>
            <DialogDescription>
              This will remove the checklist and all its questions. Audit plans that use this checklist will keep their saved findings but may show a different set of questions if you create new checklists.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteChecklistId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteChecklistId && handleDeleteChecklist(deleteChecklistId)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
