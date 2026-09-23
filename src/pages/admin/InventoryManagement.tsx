import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { QueryData } from "@supabase/supabase-js";
import {
  Package, Plus, Search, AlertTriangle, BookOpen, ArrowDownUp,
  BarChart3, Edit, Trash2, QrCode, Camera, X, ScanLine, Undo2
} from "lucide-react";
import { errorMessage } from "@/lib/errors";

const itemsQuery = () => supabase.from("inventory_items").select("*, inventory_categories(*)").order("name");
const issuesQuery = () =>
  supabase.from("textbook_issues")
    .select("*, students(full_name, admission_number), inventory_items(name, item_code)")
    .order("created_at", { ascending: false });
const transactionsQuery = () =>
  supabase.from("inventory_transactions")
    .select("*, inventory_items(name, item_code)")
    .order("created_at", { ascending: false });

type Category = Tables<"inventory_categories">;
type Item = QueryData<ReturnType<typeof itemsQuery>>[number];
type TextbookIssue = QueryData<ReturnType<typeof issuesQuery>>[number];
type Transaction = QueryData<ReturnType<typeof transactionsQuery>>[number];

const unitOptions = ["piece", "set", "box", "kg", "liter"];
const conditionOptions = ["new", "good", "fair", "poor", "damaged"];

export default function InventoryManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [issues, setIssues] = useState<TextbookIssue[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [students, setStudents] = useState<{ id: string; full_name: string; admission_number: string }[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Dialogs
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [showScannerDialog, setShowScannerDialog] = useState(false);

  // Form states
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState({
    name: "", item_code: "", description: "", category_id: "", quantity: 0,
    unit: "piece", reorder_level: 10, location: "", supplier: "",
    supplier_contact: "", purchase_price_usd: 0, purchase_price_zig: 0
  });
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [issueForm, setIssueForm] = useState({
    student_id: "", inventory_item_id: "", due_date: "", condition_on_issue: "good"
  });
  const [returnIssue, setReturnIssue] = useState<TextbookIssue | null>(null);
  const [returnCondition, setReturnCondition] = useState("good");
  const [returnFineUsd, setReturnFineUsd] = useState(0);
  const [returnFineZig, setReturnFineZig] = useState(0);
  const [txForm, setTxForm] = useState({
    item_id: "", transaction_type: "received", quantity: 0, reference: "", notes: ""
  });
  const [barcodeItem, setBarcodeItem] = useState<Item | null>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Scanner
  const scannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = () => {
    fetchCategories();
    fetchItems();
    fetchIssues();
    fetchTransactions();
    fetchStudents();
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from("inventory_categories").select("*").order("name");
    if (data) setCategories(data);
  };

  const fetchItems = async () => {
    const { data } = await itemsQuery();
    if (data) setItems(data);
  };

  const fetchIssues = async () => {
    const { data } = await issuesQuery();
    if (data) setIssues(data);
  };

  const fetchTransactions = async () => {
    const { data } = await transactionsQuery();
    if (data) setTransactions(data);
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from("students").select("id, full_name, admission_number")
      .eq("status", "active").order("full_name");
    if (data) setStudents(data);
  };

  // Category CRUD
  const saveCategory = async () => {
    if (!categoryForm.name) return;
    const { error } = await supabase.from("inventory_categories").insert({
      name: categoryForm.name, description: categoryForm.description || null
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Category added!" });
    setCategoryForm({ name: "", description: "" });
    setShowCategoryDialog(false);
    fetchCategories();
  };

  const deleteCategory = async (id: string) => {
    await supabase.from("inventory_categories").delete().eq("id", id);
    toast({ title: "Category deleted" });
    fetchCategories();
  };

  // Item CRUD
  const openItemDialog = (item?: Item) => {
    if (item) {
      setEditingItem(item);
      setItemForm({
        name: item.name, item_code: item.item_code, description: item.description || "",
        category_id: item.category_id || "", quantity: item.quantity, unit: item.unit,
        reorder_level: item.reorder_level || 10, location: item.location || "",
        supplier: item.supplier || "", supplier_contact: item.supplier_contact || "",
        purchase_price_usd: item.purchase_price_usd || 0, purchase_price_zig: item.purchase_price_zig || 0
      });
    } else {
      setEditingItem(null);
      const code = `INV-${Date.now().toString(36).toUpperCase()}`;
      setItemForm({
        name: "", item_code: code, description: "", category_id: "", quantity: 0,
        unit: "piece", reorder_level: 10, location: "", supplier: "",
        supplier_contact: "", purchase_price_usd: 0, purchase_price_zig: 0
      });
    }
    setShowItemDialog(true);
  };

  const saveItem = async () => {
    if (!itemForm.name || !itemForm.item_code) return;
    const payload = {
      name: itemForm.name, item_code: itemForm.item_code,
      description: itemForm.description || null,
      category_id: itemForm.category_id || null,
      quantity: itemForm.quantity, unit: itemForm.unit,
      reorder_level: itemForm.reorder_level, location: itemForm.location || null,
      supplier: itemForm.supplier || null, supplier_contact: itemForm.supplier_contact || null,
      purchase_price_usd: itemForm.purchase_price_usd,
      purchase_price_zig: itemForm.purchase_price_zig,
      barcode: itemForm.item_code
    };
    const { error } = editingItem
      ? await supabase.from("inventory_items").update(payload).eq("id", editingItem.id)
      : await supabase.from("inventory_items").insert(payload);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingItem ? "Item updated!" : "Item added!" });
    setShowItemDialog(false);
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    await supabase.from("inventory_items").delete().eq("id", id);
    toast({ title: "Item deleted" });
    fetchItems();
  };

  // Barcode generation
  const showBarcode = useCallback(async (item: Item) => {
    setBarcodeItem(item);
    setShowBarcodeDialog(true);
    setTimeout(async () => {
      if (barcodeCanvasRef.current) {
        try {
          // @ts-ignore - dynamic import for barcode generation
          const bwipjs = await import(/* @vite-ignore */ "bwip-js") as any;
          const render = bwipjs.default?.toCanvas || bwipjs.toCanvas;
          render(barcodeCanvasRef.current, {
            bcid: "code128", text: item.item_code,
            scale: 3, height: 10, includetext: true,
            textxalign: "center"
          });
        } catch (e) {
          console.error("Barcode error:", e);
        }
      }
    }, 100);
  }, []);

  // Camera scanner
  const startScanner = async () => {
    setShowScannerDialog(true);
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode("barcode-scanner-container");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          async (decodedText: string) => {
            await scanner.stop();
            scannerRef.current = null;
            setShowScannerDialog(false);
            const found = items.find(i => i.item_code === decodedText || i.barcode === decodedText);
            if (found) {
              openItemDialog(found);
              toast({ title: `Found: ${found.name}` });
            } else {
              toast({ title: "Item not found", description: `Code: ${decodedText}`, variant: "destructive" });
            }
          },
          () => {}
        );
      } catch (e) {
        toast({ title: "Scanner error", description: errorMessage(e, "Camera not available"), variant: "destructive" });
        setShowScannerDialog(false);
      }
    }, 300);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setShowScannerDialog(false);
  };

  // Textbook issue
  const saveIssue = async () => {
    if (!issueForm.student_id || !issueForm.inventory_item_id || !issueForm.due_date) return;
    const book = items.find(i => i.id === issueForm.inventory_item_id);
    const { error } = await supabase.from("textbook_issues").insert({
      student_id: issueForm.student_id,
      inventory_item_id: issueForm.inventory_item_id,
      book_title: book?.name ?? "Textbook",
      issued_date: new Date().toISOString().split("T")[0],
      due_date: issueForm.due_date,
      condition: issueForm.condition_on_issue,
      status: "issued"
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    // Record transaction
    await supabase.from("inventory_transactions").insert({
      item_id: issueForm.inventory_item_id, transaction_type: "issued",
      quantity: 1, reference: `textbook_issue`
    });
    // Decrease stock
    if (book) {
      await supabase.from("inventory_items").update({ quantity: Math.max(0, book.quantity - 1) }).eq("id", book.id);
    }
    toast({ title: "Textbook issued!" });
    setShowIssueDialog(false);
    setIssueForm({ student_id: "", inventory_item_id: "", due_date: "", condition_on_issue: "good" });
    fetchAll();
  };

  // Return textbook
  const processReturn = async () => {
    if (!returnIssue) return;
    const { error } = await supabase.from("textbook_issues").update({
      returned_date: new Date().toISOString().split("T")[0],
      condition_on_return: returnCondition,
      fine_amount_usd: returnFineUsd,
      fine_amount_zig: returnFineZig,
      status: "returned"
    }).eq("id", returnIssue.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await supabase.from("inventory_transactions").insert({
      item_id: returnIssue.inventory_item_id, transaction_type: "returned",
      quantity: 1, reference: `return_${returnIssue.id}`
    });
    const item = items.find(i => i.id === returnIssue.inventory_item_id);
    if (item) {
      await supabase.from("inventory_items").update({ quantity: item.quantity + 1 }).eq("id", item.id);
    }
    toast({ title: "Textbook returned!" });
    setShowReturnDialog(false);
    setReturnIssue(null);
    fetchAll();
  };

  // Stock transaction
  const saveTransaction = async () => {
    if (!txForm.item_id || !txForm.quantity) return;
    const { error } = await supabase.from("inventory_transactions").insert({
      item_id: txForm.item_id, transaction_type: txForm.transaction_type,
      quantity: txForm.quantity, reference: txForm.reference || null,
      notes: txForm.notes || null
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    const item = items.find(i => i.id === txForm.item_id);
    if (item) {
      let newQty = item.quantity;
      if (txForm.transaction_type === "received" || txForm.transaction_type === "returned") {
        newQty += txForm.quantity;
      } else {
        newQty = Math.max(0, newQty - txForm.quantity);
      }
      await supabase.from("inventory_items").update({ quantity: newQty }).eq("id", item.id);
    }
    toast({ title: "Transaction recorded!" });
    setShowTransactionDialog(false);
    setTxForm({ item_id: "", transaction_type: "received", quantity: 0, reference: "", notes: "" });
    fetchAll();
  };

  // Computed
  const lowStockItems = items.filter(i => i.reorder_level && i.quantity <= i.reorder_level);
  const overdueIssues = issues.filter(i => i.status === "issued" && new Date(i.due_date) < new Date());
  const filteredItems = items.filter(i => {
    const matchesSearch = !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.item_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || i.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const stockLevel = (item: Item) => {
    if (!item.reorder_level) return "normal";
    if (item.quantity === 0) return "empty";
    if (item.quantity <= item.reorder_level) return "low";
    if (item.quantity <= item.reorder_level * 2) return "medium";
    return "normal";
  };

  const stockBadge = (level: string) => {
    switch (level) {
      case "empty": return <Badge variant="destructive">Out of Stock</Badge>;
      case "low": return <Badge variant="secondary" className="border-orange-500 text-orange-600">Low Stock</Badge>;
      case "medium": return <Badge variant="secondary">Medium</Badge>;
      default: return <Badge variant="outline" className="border-green-600 text-green-700">In Stock</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Items", value: items.length, icon: Package, color: "text-primary" },
          { label: "Low Stock Alerts", value: lowStockItems.length, icon: AlertTriangle, color: "text-orange-500" },
          { label: "Books Issued", value: issues.filter(i => i.status === "issued").length, icon: BookOpen, color: "text-blue-500" },
          { label: "Overdue Returns", value: overdueIssues.length, icon: AlertTriangle, color: "text-destructive" },
        ].map((s, i) => (
          <Card key={i} className="border-none shadow-maroon">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard"><BarChart3 className="mr-1 h-4 w-4" /> Items</TabsTrigger>
          <TabsTrigger value="textbooks"><BookOpen className="mr-1 h-4 w-4" /> Textbooks</TabsTrigger>
          <TabsTrigger value="transactions"><ArrowDownUp className="mr-1 h-4 w-4" /> Transactions</TabsTrigger>
          <TabsTrigger value="categories"><Package className="mr-1 h-4 w-4" /> Categories</TabsTrigger>
        </TabsList>

        {/* Items Tab */}
        <TabsContent value="dashboard">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Inventory Items</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={startScanner}>
                    <Camera className="mr-1 h-4 w-4" /> Scan
                  </Button>
                  <Button size="sm" onClick={() => openItemDialog()}>
                    <Plus className="mr-1 h-4 w-4" /> Add Item
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No items found</TableCell></TableRow>
                    ) : filteredItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.item_code}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.inventory_categories?.name || "—"}</TableCell>
                        <TableCell>{item.quantity} {item.unit}</TableCell>
                        <TableCell>{stockBadge(stockLevel(item))}</TableCell>
                        <TableCell>{item.location || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => showBarcode(item)} title="Barcode">
                              <QrCode className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => openItemDialog(item)} title="Edit">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteItem(item.id)} title="Delete">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Textbooks Tab */}
        <TabsContent value="textbooks">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Textbook Issues</CardTitle>
                <Button size="sm" onClick={() => setShowIssueDialog(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Issue Textbook
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Book</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issues.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No textbook issues</TableCell></TableRow>
                    ) : issues.map(issue => {
                      const isOverdue = issue.status === "issued" && new Date(issue.due_date) < new Date();
                      return (
                        <TableRow key={issue.id}>
                          <TableCell>
                            <div>
                              <span className="font-medium">{issue.students?.full_name}</span>
                              <span className="block text-xs text-muted-foreground">{issue.students?.admission_number}</span>
                            </div>
                          </TableCell>
                          <TableCell>{issue.inventory_items?.name}</TableCell>
                          <TableCell>{issue.issued_date ? new Date(issue.issued_date).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>{new Date(issue.due_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {issue.status === "returned" ? (
                              <Badge className="bg-green-600 text-white">Returned</Badge>
                            ) : isOverdue ? (
                              <Badge variant="destructive">Overdue</Badge>
                            ) : (
                              <Badge>Issued</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {issue.status === "issued" && (
                              <Button size="sm" variant="outline" onClick={() => {
                                setReturnIssue(issue);
                                setReturnCondition("good");
                                setReturnFineUsd(0);
                                setReturnFineZig(0);
                                setShowReturnDialog(true);
                              }}>
                                <Undo2 className="mr-1 h-3 w-3" /> Return
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Stock Transactions</CardTitle>
                <Button size="sm" onClick={() => setShowTransactionDialog(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Record Transaction
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No transactions</TableCell></TableRow>
                    ) : transactions.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell>{new Date(tx.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>{tx.inventory_items?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={tx.transaction_type === "received" || tx.transaction_type === "returned" ? "default" : "destructive"}>
                            {tx.transaction_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{tx.quantity}</TableCell>
                        <TableCell className="text-xs">{tx.reference || "—"}</TableCell>
                        <TableCell className="text-xs">{tx.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Categories</CardTitle>
                <Button size="sm" onClick={() => setShowCategoryDialog(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Add Category
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map(c => (
                  <Card key={c.id} className="relative">
                    <CardContent className="p-4">
                      <h3 className="font-semibold">{c.name}</h3>
                      <p className="text-sm text-muted-foreground">{c.description || "No description"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {items.filter(i => i.category_id === c.id).length} items
                      </p>
                      <Button size="icon" variant="ghost" className="absolute right-2 top-2" onClick={() => deleteCategory(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {categories.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">No categories yet</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingItem ? "Edit Item" : "Add Inventory Item"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Item Code</Label><Input value={itemForm.item_code} onChange={e => setItemForm(p => ({ ...p, item_code: e.target.value }))} /></div>
              <div><Label>Name *</Label><Input value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={itemForm.description} onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={itemForm.category_id} onValueChange={v => setItemForm(p => ({ ...p, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={itemForm.unit} onValueChange={v => setItemForm(p => ({ ...p, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{unitOptions.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity</Label><Input type="number" value={itemForm.quantity} onChange={e => setItemForm(p => ({ ...p, quantity: Number(e.target.value) }))} /></div>
              <div><Label>Reorder Level</Label><Input type="number" value={itemForm.reorder_level} onChange={e => setItemForm(p => ({ ...p, reorder_level: Number(e.target.value) }))} /></div>
            </div>
            <div><Label>Location</Label><Input value={itemForm.location} onChange={e => setItemForm(p => ({ ...p, location: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Supplier</Label><Input value={itemForm.supplier} onChange={e => setItemForm(p => ({ ...p, supplier: e.target.value }))} /></div>
              <div><Label>Supplier Contact</Label><Input value={itemForm.supplier_contact} onChange={e => setItemForm(p => ({ ...p, supplier_contact: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price (USD)</Label><Input type="number" step="0.01" value={itemForm.purchase_price_usd} onChange={e => setItemForm(p => ({ ...p, purchase_price_usd: Number(e.target.value) }))} /></div>
              <div><Label>Price (ZiG)</Label><Input type="number" step="0.01" value={itemForm.purchase_price_zig} onChange={e => setItemForm(p => ({ ...p, purchase_price_zig: Number(e.target.value) }))} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={saveItem}>{editingItem ? "Update" : "Add"} Item</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={categoryForm.name} onChange={e => setCategoryForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={categoryForm.description} onChange={e => setCategoryForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={saveCategory}>Add Category</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Textbook Dialog */}
      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Issue Textbook</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Student *</Label>
              <Select value={issueForm.student_id} onValueChange={v => setIssueForm(p => ({ ...p, student_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.admission_number})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Textbook *</Label>
              <Select value={issueForm.inventory_item_id} onValueChange={v => setIssueForm(p => ({ ...p, inventory_item_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>{items.filter(i => i.quantity > 0).map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.quantity} avail)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Due Date *</Label><Input type="date" value={issueForm.due_date} onChange={e => setIssueForm(p => ({ ...p, due_date: e.target.value }))} /></div>
            <div>
              <Label>Condition</Label>
              <Select value={issueForm.condition_on_issue} onValueChange={v => setIssueForm(p => ({ ...p, condition_on_issue: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{conditionOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={saveIssue}>Issue Textbook</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Return Textbook</DialogTitle></DialogHeader>
          {returnIssue && (
            <div className="space-y-3">
              <p className="text-sm"><strong>Student:</strong> {returnIssue.students?.full_name}</p>
              <p className="text-sm"><strong>Book:</strong> {returnIssue.inventory_items?.name}</p>
              <div>
                <Label>Condition on Return</Label>
                <Select value={returnCondition} onValueChange={setReturnCondition}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{conditionOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Fine (USD)</Label><Input type="number" step="0.01" value={returnFineUsd} onChange={e => setReturnFineUsd(Number(e.target.value))} /></div>
                <div><Label>Fine (ZiG)</Label><Input type="number" step="0.01" value={returnFineZig} onChange={e => setReturnFineZig(Number(e.target.value))} /></div>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={processReturn}>Process Return</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Transaction Dialog */}
      <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Stock Transaction</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Item *</Label>
              <Select value={txForm.item_id} onValueChange={v => setTxForm(p => ({ ...p, item_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.item_code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type *</Label>
              <Select value={txForm.transaction_type} onValueChange={v => setTxForm(p => ({ ...p, transaction_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Quantity *</Label><Input type="number" value={txForm.quantity} onChange={e => setTxForm(p => ({ ...p, quantity: Number(e.target.value) }))} /></div>
            <div><Label>Reference</Label><Input value={txForm.reference} onChange={e => setTxForm(p => ({ ...p, reference: e.target.value }))} /></div>
            <div><Label>Notes</Label><Textarea value={txForm.notes} onChange={e => setTxForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={saveTransaction}>Record Transaction</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Dialog */}
      <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Barcode: {barcodeItem?.name}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <canvas ref={barcodeCanvasRef} />
            <p className="font-mono text-sm">{barcodeItem?.item_code}</p>
            <Button variant="outline" onClick={() => {
              if (barcodeCanvasRef.current) {
                const link = document.createElement("a");
                link.download = `barcode-${barcodeItem?.item_code}.png`;
                link.href = barcodeCanvasRef.current.toDataURL();
                link.click();
              }
            }}>Download Barcode</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scanner Dialog */}
      <Dialog open={showScannerDialog} onOpenChange={(open) => { if (!open) stopScanner(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5" /> Barcode Scanner
            </DialogTitle>
          </DialogHeader>
          <div id="barcode-scanner-container" ref={scannerContainerRef} className="w-full min-h-[300px]" />
          <p className="text-center text-sm text-muted-foreground">Point camera at item barcode</p>
          <DialogFooter><Button variant="outline" onClick={stopScanner}><X className="mr-1 h-4 w-4" /> Cancel</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
