import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, Send, Plus, Users, User, Search, ArrowLeft,
  Megaphone, AlertCircle, X, Loader2, ShieldAlert, Ban, Flag, MoreVertical, BookUser
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { errorMessage } from "@/lib/errors";

interface Conversation {
  id: string;
  type: string;
  name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  participants?: { conversation_id: string | null; user_id: string }[];
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  created_at: string;
  sender_name?: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  role?: string;
}

export default function MessagingPanel() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [search, setSearch] = useState("");
  const [totalUnread, setTotalUnread] = useState(0);

  // Panel tab: "chats" or "contacts"
  const [panelTab, setPanelTab] = useState<"chats" | "contacts">("chats");

  // Contact directory state
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactRoleFilter, setContactRoleFilter] = useState<string>("all");
  const [contactsLoading, setContactsLoading] = useState(false);

  // New conversation dialog
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [newConvType, setNewConvType] = useState<"direct" | "group" | "broadcast">("direct");
  const [newConvName, setNewConvName] = useState("");
  const [newConvMessage, setNewConvMessage] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [creating, setCreating] = useState(false);
  const [searchRoleFilter, setSearchRoleFilter] = useState<string>("all");

  // Block & report
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportTargetName, setReportTargetName] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const profileCache = useRef<Record<string, string>>({});
  const channelTopicRef = useRef(`user-messages-${Math.random().toString(36).slice(2)}`);

  const clearUnreadForConversation = useCallback((convId: string) => {
    setConversations(prev => {
      const next = prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c);
      setTotalUnread(next.reduce((sum, c) => sum + (c.unread_count || 0), 0));
      return next;
    });
    window.dispatchEvent(new CustomEvent("messages:conversation-read", { detail: { conversationId: convId } }));
  }, []);

  const markConversationRead = useCallback(async (convId: string, readAt?: string) => {
    if (!user) return;
    const timestamp = readAt || new Date(Date.now() + 1000).toISOString();
    const { error } = await supabase
      .from("conversation_participants")
      .update({ last_read_at: timestamp })
      .eq("conversation_id", convId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to update message read receipt", error);
      return;
    }

    clearUnreadForConversation(convId);

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .in("type", ["message", "messages", "chat", "conversation"])
      .or(`link.ilike.%${convId}%,message.ilike.%${convId}%`);
  }, [user, clearUnreadForConversation]);

  // Fetch blocked users
  const fetchBlocked = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_blocks")
      .select("blocked_user_id")
      .eq("blocked_by", user.id);
    if (data) setBlockedIds(data.map(b => b.blocked_user_id));
  }, [user]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", user.id);

    if (!participations || participations.length === 0) {
      setConversations([]);
      setTotalUnread(0);
      setLoading(false);
      return;
    }

    const convIds = participations.map(p => p.conversation_id);
    const lastReadMap: Record<string, string> = {};
    participations.forEach(p => { lastReadMap[p.conversation_id] = p.last_read_at || ""; });

    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .in("id", convIds)
      .order("updated_at", { ascending: false });

    if (!convs) { setLoading(false); return; }

    const { data: allParticipants } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convIds);

    let unreadTotal = 0;
    const enriched: Conversation[] = [];

    for (const conv of convs) {
      const { data: lastMsgs } = await supabase
        .from("messages")
        .select("content, created_at, sender_id")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const lastMsg = lastMsgs?.[0];

      const lastRead = lastReadMap[conv.id] || conv.created_at;
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conv.id)
        .gt("created_at", lastRead)
        .neq("sender_id", user.id);

      const unread = count || 0;
      unreadTotal += unread;

      const convParticipants = (allParticipants || []).filter(p => p.conversation_id === conv.id);
      const otherUserIds = convParticipants.filter(p => p.user_id !== user.id).map(p => p.user_id);

      let displayName = conv.name;
      if (!displayName && conv.type === "direct" && otherUserIds.length > 0) {
        const otherId = otherUserIds[0];
        if (!profileCache.current[otherId]) {
          const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", otherId).single();
          profileCache.current[otherId] = profile?.full_name || "Unknown";
        }
        displayName = profileCache.current[otherId];
      }

      enriched.push({
        ...conv,
        name: displayName || (conv.type === "group" ? "Group Chat" : conv.type === "broadcast" ? "Broadcast" : "Chat"),
        last_message: lastMsg?.content || "",
        last_message_at: lastMsg?.created_at || conv.created_at,
        unread_count: unread,
        participants: convParticipants,
      });
    }

    setConversations(enriched);
    setTotalUnread(unreadTotal);
    setLoading(false);
  }, [user]);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (data) {
      const enriched: Message[] = [];
      for (const msg of data) {
        // Filter out messages from blocked users
        if (blockedIds.includes(msg.sender_id)) continue;
        if (!profileCache.current[msg.sender_id]) {
          const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", msg.sender_id).single();
          profileCache.current[msg.sender_id] = profile?.full_name || "Unknown";
        }
        enriched.push({ ...msg, sender_name: profileCache.current[msg.sender_id] });
      }
      setMessages(enriched);
    }

    if (user) {
      const latestMessageTime = data?.[data.length - 1]?.created_at;
      const readAt = latestMessageTime
        ? new Date(new Date(latestMessageTime).getTime() + 1000).toISOString()
        : new Date(Date.now() + 1000).toISOString();
      await markConversationRead(convId, readAt);
    }
  }, [user, blockedIds, markConversationRead]);

  // Refs to avoid stale closures in realtime callback
  const activeConvRef = useRef(activeConv);
  activeConvRef.current = activeConv;
  const blockedIdsRef = useRef(blockedIds);
  blockedIdsRef.current = blockedIds;

  // Initial data fetch
  useEffect(() => {
    if (!user) return;
    fetchConversations();
    fetchBlocked();
  }, [fetchBlocked, fetchConversations, user]);

  // Real-time subscription (stable, no dependency on callbacks)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(channelTopicRef.current)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, async (payload) => {
        const newMsg = payload.new as Message;
        if (blockedIdsRef.current.includes(newMsg.sender_id)) return;
        const currentConv = activeConvRef.current;
        if (currentConv && newMsg.conversation_id === currentConv.id) {
          const senderName = profileCache.current[newMsg.sender_id] || "Unknown";
          setMessages(prev => [...prev, { ...newMsg, sender_name: senderName }]);
          // Await the read-receipt update so the subsequent unread recount
          // sees the fresh last_read_at and does not resurface a stale badge.
          await markConversationRead(newMsg.conversation_id, new Date(new Date(newMsg.created_at).getTime() + 1000).toISOString());
        }
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchConversations, markConversationRead, user]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    // Optimistically clear the unread badge for this conversation
    clearUnreadForConversation(conv.id);
    await fetchMessages(conv.id);
    fetchConversations();
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConv || !user) return;
    setSendingMessage(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: activeConv.id,
      sender_id: user.id,
      content: newMessage.trim(),
      message_type: "text",
    });
    if (error) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    } else {
      setNewMessage("");
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConv.id);
      toast({ title: "Message sent" });
    }
    setSendingMessage(false);
  };

  // Search users with role info
  // Fetch contact directory
  const fetchContacts = useCallback(async () => {
    if (!user) return;
    setContactsLoading(true);

    // First get all user_ids that have a role (i.e. not deleted)
    const { data: activeRoles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (!activeRoles) { setContacts([]); setContactsLoading(false); return; }

    const roleMap: Record<string, string> = {};
    activeRoles.forEach(r => { roleMap[r.user_id] = r.role; });
    const activeUserIds = activeRoles.map(r => r.user_id).filter(id => id !== user.id);

    let query = supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", activeUserIds)
      .order("full_name", { ascending: true })
      .limit(100);

    if (contactSearch.length >= 2) {
      query = query.ilike("full_name", `%${contactSearch}%`);
    }

    const { data: profiles } = await query;
    if (!profiles) { setContacts([]); setContactsLoading(false); return; }

    let results: UserProfile[] = profiles
      .filter(p => !blockedIds.includes(p.id))
      .map(p => ({ ...p, role: roleMap[p.id] || "user" }));

    if (contactRoleFilter !== "all") {
      results = results.filter(p => p.role === contactRoleFilter);
    }

    setContacts(results);
    setContactsLoading(false);
  }, [user, contactSearch, contactRoleFilter, blockedIds]);

  // Fetch contacts when tab switches or filters change
  useEffect(() => {
    if (panelTab === "contacts") fetchContacts();
  }, [panelTab, fetchContacts]);

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) { setUserResults([]); return; }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .ilike("full_name", `%${query}%`)
      .neq("id", user?.id || "")
      .limit(15);

    if (!profiles) { setUserResults([]); return; }

    // Fetch roles for these users
    const userIds = profiles.map(p => p.id);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const roleMap: Record<string, string> = {};
    roles?.forEach(r => { roleMap[r.user_id] = r.role; });

    // Filter out blocked users and apply role filter
    let results: UserProfile[] = profiles
      .filter(p => !blockedIds.includes(p.id))
      .map(p => ({
        id: p.id,
        full_name: p.full_name ?? "",
        email: p.email,
        avatar_url: null,
        role: roleMap[p.id] || "user",
      }));

    if (searchRoleFilter !== "all") {
      results = results.filter(p => p.role === searchRoleFilter);
    }

    setUserResults(results);
  }, [blockedIds, searchRoleFilter, user?.id]);

  useEffect(() => {
    searchUsers(userSearch);
  }, [searchUsers, userSearch]);

  const addUserToSelection = (u: UserProfile) => {
    if (!selectedUsers.find(s => s.id === u.id)) {
      setSelectedUsers(prev => [...prev, u]);
    }
    setUserSearch("");
    setUserResults([]);
  };

  const removeUserFromSelection = (id: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== id));
  };

  // Create new conversation
  const createConversation = async () => {
    if (!user || selectedUsers.length === 0 || !newConvMessage.trim()) return;
    setCreating(true);

    try {
      // For direct messages, check existing
      if (newConvType === "direct" && selectedUsers.length === 1) {
        const targetId = selectedUsers[0].id;
        const { data: myConvs } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", user.id);

        if (myConvs) {
          for (const mc of myConvs) {
            const { data: conv } = await supabase
              .from("conversations")
              .select("*")
              .eq("id", mc.conversation_id)
              .eq("type", "direct")
              .single();

            if (conv) {
              const { data: otherPart } = await supabase
                .from("conversation_participants")
                .select("user_id")
                .eq("conversation_id", conv.id)
                .eq("user_id", targetId);

              if (otherPart && otherPart.length > 0) {
                await supabase.from("messages").insert({
                  conversation_id: conv.id,
                  sender_id: user.id,
                  content: newConvMessage.trim(),
                  message_type: "text",
                });
                await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conv.id);
                toast({ title: "Message sent" });
                resetNewConv();
                fetchConversations();
                setCreating(false);
                return;
              }
            }
          }
        }
      }

      // Create new conversation
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .insert({
          type: newConvType,
          name: newConvType !== "direct" ? (newConvName || null) : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (convErr || !conv) throw convErr || new Error("Failed to create conversation");

      const participants = [
        { conversation_id: conv.id, user_id: user.id },
        ...selectedUsers.map(u => ({ conversation_id: conv.id, user_id: u.id })),
      ];

      const { error: partErr } = await supabase.from("conversation_participants").insert(participants);
      if (partErr) throw partErr;

      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: conv.id,
        sender_id: user.id,
        content: newConvMessage.trim(),
        message_type: newConvType === "broadcast" ? "alert" : "text",
      });
      if (msgErr) throw msgErr;

      toast({ title: newConvType === "broadcast" ? "Broadcast sent" : "Conversation created" });
      resetNewConv();
      fetchConversations();
    } catch (err) {
      toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
    }
    setCreating(false);
  };

  const resetNewConv = () => {
    setNewConvOpen(false);
    setNewConvType("direct");
    setNewConvName("");
    setNewConvMessage("");
    setSelectedUsers([]);
    setUserSearch("");
    setUserResults([]);
    setSearchRoleFilter("all");
  };

  // Quick message from contact directory
  const startDirectFromContact = (contact: UserProfile) => {
    setSelectedUsers([contact]);
    setNewConvType("direct");
    setNewConvOpen(true);
  };

  const roleFilterOptions = [
    { value: "all", label: "All Roles" },
    { value: "admin", label: "Admin" },
    { value: "teacher", label: "Teacher" },
    { value: "student", label: "Student" },
    { value: "parent", label: "Parent" },
    { value: "finance", label: "Finance" },
    { value: "principal", label: "Principal" },
    { value: "hod", label: "HOD" },
  ];

  // Block a user
  const blockUser = async (targetId: string, targetName: string) => {
    if (!user) return;
    if (blockedIds.includes(targetId)) {
      toast({ title: "Already blocked", description: `${targetName} is already blocked.` });
      return;
    }
    const { error } = await supabase.from("user_blocks").insert({
      blocked_by: user.id,
      blocked_user_id: targetId,
    });
    if (error) {
      toast({ title: "Error blocking user", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "User blocked", description: `${targetName} has been blocked. You will no longer see their messages.` });
      setBlockedIds(prev => [...prev, targetId]);
      // Re-filter messages
      if (activeConv) fetchMessages(activeConv.id);
    }
  };

  const unblockUser = async (targetId: string, targetName: string) => {
    if (!user) return;
    const { error } = await supabase.from("user_blocks").delete()
      .eq("blocked_by", user.id)
      .eq("blocked_user_id", targetId);
    if (!error) {
      toast({ title: "User unblocked", description: `${targetName} has been unblocked.` });
      setBlockedIds(prev => prev.filter(id => id !== targetId));
      if (activeConv) fetchMessages(activeConv.id);
    }
  };

  // Report a user
  const openReportDialog = (targetId: string, targetName: string) => {
    setReportTargetId(targetId);
    setReportTargetName(targetName);
    setReportReason("");
    setReportDetails("");
    setReportDialogOpen(true);
  };

  const submitReport = async () => {
    if (!user || !reportTargetId || !reportReason) return;
    setSubmittingReport(true);
    const { error } = await supabase.from("user_reports").insert({
      reporter_id: user.id,
      reported_user_id: reportTargetId,
      reason: reportDetails ? `${reportReason}: ${reportDetails}` : reportReason,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Report submitted", description: "An administrator will review this report." });
      setReportDialogOpen(false);
    }
    setSubmittingReport(false);
  };

  const filteredConversations = conversations.filter(c => {
    if (!search) return true;
    return c.name?.toLowerCase().includes(search.toLowerCase());
  });

  const typeIcon = (type: string) => {
    if (type === "direct") return <User className="h-4 w-4 text-muted-foreground" />;
    if (type === "group") return <Users className="h-4 w-4 text-muted-foreground" />;
    return <Megaphone className="h-4 w-4 text-muted-foreground" />;
  };

  const canCreateBroadcast = role === "admin" || role === "teacher";
  // Only teachers (and admins) can create group chats
  const canCreateGroup = role === "teacher" || role === "admin";

  const roleBadgeColor = (r: string) => {
    switch (r) {
      case "admin": return "bg-destructive/10 text-destructive border-destructive/20";
      case "teacher": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "parent": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "student": return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Get other participant info from active conversation for block/report
  const getOtherParticipants = () => {
    if (!activeConv?.participants || !user) return [];
    return activeConv.participants
      .filter(p => p.user_id !== user.id)
      .map(p => ({
        user_id: p.user_id,
        name: profileCache.current[p.user_id] || "Unknown",
      }));
  };

  return (
    <>
      {/* Floating button */}
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-40 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground md:bottom-6"
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
        {totalUnread > 0 && (
          <Badge className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full p-0 text-[10px]">
            {totalUnread > 99 ? "99+" : totalUnread}
          </Badge>
        )}
      </Button>

      {/* Messaging panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl sm:w-[420px] md:bottom-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b bg-primary px-4 py-3">
              <div className="flex items-center gap-2">
                {activeConv && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => { setActiveConv(null); setMessages([]); fetchConversations(); }}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <MessageSquare className="h-5 w-5 text-primary-foreground" />
                <h3 className="text-sm font-semibold text-primary-foreground">
                  {activeConv ? activeConv.name : "Messages"}
                </h3>
                {activeConv && (
                  <Badge variant="outline" className="text-[10px] border-primary-foreground/30 text-primary-foreground/80">
                    {activeConv.type}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* Actions menu in conversation view */}
                {activeConv && activeConv.type === "direct" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {getOtherParticipants().map(p => (
                        <div key={p.user_id}>
                          {blockedIds.includes(p.user_id) ? (
                            <DropdownMenuItem onClick={() => unblockUser(p.user_id, p.name)}>
                              <Ban className="mr-2 h-4 w-4" /> Unblock {p.name}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => blockUser(p.user_id, p.name)}>
                              <Ban className="mr-2 h-4 w-4" /> Block {p.name}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openReportDialog(p.user_id, p.name)}>
                            <Flag className="mr-2 h-4 w-4 text-destructive" /> Report {p.name}
                          </DropdownMenuItem>
                        </div>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {/* Group chat actions */}
                {activeConv && activeConv.type === "group" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {getOtherParticipants().map(p => (
                        <div key={p.user_id}>
                          {blockedIds.includes(p.user_id) ? (
                            <DropdownMenuItem onClick={() => unblockUser(p.user_id, p.name)}>
                              <Ban className="mr-2 h-4 w-4" /> Unblock {p.name}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => blockUser(p.user_id, p.name)}>
                              <Ban className="mr-2 h-4 w-4" /> Block {p.name}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openReportDialog(p.user_id, p.name)}>
                            <Flag className="mr-2 h-4 w-4 text-destructive" /> Report {p.name}
                          </DropdownMenuItem>
                        </div>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {!activeConv && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => setNewConvOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Body */}
            {!activeConv ? (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Tabs: Chats / Contacts */}
                <div className="flex border-b">
                  <button
                    onClick={() => setPanelTab("chats")}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${panelTab === "chats" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <MessageSquare className="inline h-3.5 w-3.5 mr-1" />
                    Chats
                    {totalUnread > 0 && (
                      <Badge className="ml-1.5 h-4 min-w-4 inline-flex items-center justify-center rounded-full p-0 text-[9px]">
                        {totalUnread > 99 ? "99+" : totalUnread}
                      </Badge>
                    )}
                  </button>
                  <button
                    onClick={() => setPanelTab("contacts")}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${panelTab === "contacts" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <BookUser className="inline h-3.5 w-3.5 mr-1" />
                    Contacts
                  </button>
                </div>

                {panelTab === "chats" ? (
                  <>
                    <div className="border-b px-3 py-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search conversations..."
                          className="h-8 pl-8 text-xs"
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <ScrollArea className="flex-1">
                      {loading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : filteredConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                          <p className="text-sm text-muted-foreground">No conversations yet</p>
                          <Button variant="outline" size="sm" className="mt-3" onClick={() => setNewConvOpen(true)}>
                            <Plus className="mr-1 h-3.5 w-3.5" /> Start a conversation
                          </Button>
                        </div>
                      ) : (
                        filteredConversations.map(conv => (
                          <button
                            key={conv.id}
                            onClick={() => openConversation(conv)}
                            className="w-full flex items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50"
                          >
                            <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                              {typeIcon(conv.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium truncate">{conv.name}</p>
                                {conv.last_message_at && (
                                  <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                                    {format(new Date(conv.last_message_at), "MMM d")}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground truncate">{conv.last_message || "No messages yet"}</p>
                                {(conv.unread_count || 0) > 0 && (
                                  <Badge className="h-5 min-w-5 flex-shrink-0 flex items-center justify-center rounded-full p-0 text-[10px]">
                                    {conv.unread_count}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </ScrollArea>
                  </>
                ) : (
                  /* Contact Directory */
                  <>
                    <div className="border-b px-3 py-2 space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search contacts..."
                          className="h-8 pl-8 text-xs"
                          value={contactSearch}
                          onChange={e => setContactSearch(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {roleFilterOptions.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setContactRoleFilter(opt.value)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                              contactRoleFilter === opt.value
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-muted-foreground border-transparent hover:border-border"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <ScrollArea className="flex-1">
                      {contactsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : contacts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                          <BookUser className="h-10 w-10 text-muted-foreground/30 mb-3" />
                          <p className="text-sm text-muted-foreground">No contacts found</p>
                        </div>
                      ) : (
                        contacts.map(c => (
                          <button
                            key={c.id}
                            onClick={() => startDirectFromContact(c)}
                            className="w-full flex items-center gap-3 border-b px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
                          >
                            {c.avatar_url ? (
                              <img src={c.avatar_url} alt={c.full_name} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                                <span className="text-xs font-bold text-muted-foreground">{c.full_name?.[0]?.toUpperCase() || "?"}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.full_name}</p>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${roleBadgeColor(c.role || "")}`}>
                              {c.role || "user"}
                            </span>
                            <Send className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          </button>
                        ))
                      )}
                    </ScrollArea>
                  </>
                )}
              </div>
            ) : (
              /* Chat View */
              <div className="flex flex-1 flex-col overflow-hidden">
                <ScrollArea className="flex-1 px-4 py-3">
                  <div className="space-y-3">
                    {messages.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-8">No messages yet. Say hello!</p>
                    )}
                    {messages.map(msg => {
                      const isMe = msg.sender_id === user?.id;
                      const isSystem = msg.message_type === "system" || msg.message_type === "alert";
                      if (isSystem) {
                        return (
                          <div key={msg.id} className="flex justify-center">
                            <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                              <AlertCircle className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{msg.content}</span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"}`}>
                            {!isMe && (
                              <p className="text-[10px] font-semibold mb-0.5 opacity-70">{msg.sender_name}</p>
                            )}
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            <p className={`text-[9px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                              {format(new Date(msg.created_at), "h:mm a")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message input */}
                <div className="border-t px-3 py-2">
                  <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2">
                    <Input
                      placeholder="Type a message..."
                      className="h-9 text-sm"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      disabled={sendingMessage}
                    />
                    <Button type="submit" size="icon" className="h-9 w-9 flex-shrink-0" disabled={!newMessage.trim() || sendingMessage}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Conversation Dialog */}
      <Dialog open={newConvOpen} onOpenChange={v => { if (!v) resetNewConv(); else setNewConvOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>Send a direct message or start a group chat.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newConvType} onValueChange={v => setNewConvType(v as typeof newConvType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct Message</SelectItem>
                  {canCreateGroup && <SelectItem value="group">Group Chat</SelectItem>}
                  {canCreateBroadcast && <SelectItem value="broadcast">Broadcast Announcement</SelectItem>}
                </SelectContent>
              </Select>
              {!canCreateGroup && newConvType === "direct" && (
                <p className="text-xs text-muted-foreground">Only teachers can create group chats.</p>
              )}
            </div>

            {newConvType !== "direct" && (
              <div className="space-y-2">
                <Label>{newConvType === "broadcast" ? "Subject" : "Group Name"}</Label>
                <Input value={newConvName} onChange={e => setNewConvName(e.target.value)} placeholder={newConvType === "broadcast" ? "e.g. Fee Reminder" : "e.g. Form 4 Science"} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Recipients</Label>
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedUsers.map(u => (
                    <Badge key={u.id} variant="secondary" className="gap-1 pr-1">
                      {u.full_name}
                      <span className={`text-[9px] ml-1 px-1 py-0 rounded border ${roleBadgeColor(u.role || "")}`}>
                        {u.role || "user"}
                      </span>
                      <button onClick={() => removeUserFromSelection(u.id)} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name..."
                    className="pl-8"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                  />
                </div>
                <Select value={searchRoleFilter} onValueChange={setSearchRoleFilter}>
                  <SelectTrigger className="w-[110px] h-9 text-xs">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleFilterOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {userResults.length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
                  {userResults.map(u => (
                    <button
                      key={u.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex items-center justify-between gap-2"
                      onClick={() => addUserToSelection(u)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{u.full_name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${roleBadgeColor(u.role || "")}`}>
                          {u.role || "user"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {userSearch.length >= 2 && userResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No users found</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={newConvMessage}
                onChange={e => setNewConvMessage(e.target.value)}
                placeholder="Type your message..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetNewConv}>Cancel</Button>
            <Button onClick={createConversation} disabled={creating || selectedUsers.length === 0 || !newConvMessage.trim()}>
              {creating && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {newConvType === "broadcast" ? "Send Broadcast" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report User Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Report {reportTargetName}
            </DialogTitle>
            <DialogDescription>
              Report this user for abusive or inappropriate behaviour in messaging.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger><SelectValue placeholder="Select a reason..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="inappropriate_content">Inappropriate Content</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="bullying">Bullying</SelectItem>
                  <SelectItem value="threats">Threats</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Additional details (optional)</Label>
              <Textarea
                value={reportDetails}
                onChange={e => setReportDetails(e.target.value)}
                placeholder="Provide any additional context..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitReport} disabled={!reportReason || submittingReport}>
              {submittingReport && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
