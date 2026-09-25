import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import AcademicManagement from "@/pages/admin/AcademicManagement";
import AdminAttendanceViewer from "@/components/admin/AdminAttendanceViewer";
import ImageCropper from "@/components/ImageCropper";
import StaffManagement from "@/components/admin/StaffManagement";
import ProjectsManagement from "@/components/admin/ProjectsManagement";
import AwardsManagement from "@/components/admin/AwardsManagement";
import FacilitiesManagement from "@/components/admin/FacilitiesManagement";
import StudentManagement from "@/pages/admin/StudentManagement";
import StaffManagementFull from "@/pages/admin/StaffManagementFull";
import BoardingManagement from "@/pages/admin/BoardingManagement";
import InventoryManagement from "@/pages/admin/InventoryManagement";
import CommunicationModule from "@/pages/admin/CommunicationModule";
import PublishedTimetableWidget from "@/components/timetable/PublishedTimetableWidget";
import AISmartTimetable from "@/components/timetable/AISmartTimetable";
import AITimetableBuilderAgent from "@/components/timetable/AITimetableBuilderAgent";
import DemoDataSeederPanel from "@/components/admin/DemoDataSeederPanel";
import EMISReports from "@/pages/admin/EMISReports";
import AuditLogs from "@/pages/admin/AuditLogs";
import FinanceManagement from "@/pages/admin/FinanceManagement";
import DataMigration from "@/pages/admin/DataMigration";
import GoLiveChecklist from "@/pages/admin/GoLiveChecklist";
import UserManualPage from "@/pages/admin/UserManual";
import UserManagement from "@/components/admin/UserManagement";
import PasswordManagement from "@/components/admin/PasswordManagement";
import StaffAvailabilityOverview from "@/components/admin/StaffAvailabilityOverview";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell, Image, Calendar, LogOut, Plus, Trash2, Upload, Layers, GraduationCap, Download, FileText, HandshakeIcon, Settings, UserCheck, Building, FolderKanban, BookOpen, Briefcase, DollarSign, Shield, BedDouble, Package, MessageSquare, ClipboardList, ShieldCheck, Database, Rocket, Megaphone, Trophy, ShieldAlert, CheckCircle2, CalendarOff, Bot } from "lucide-react";
import schoolLogo from "@/assets/mavingtech-logo.png";
import LanguageSelect from "@/components/LanguageSelect";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/lib/errors";
import AgentConsole from "@/components/agent/AgentConsole";

const downloadCategories = ["fees", "forms", "policies", "vacancies", "general"];
const meetingTypes = ["sdc", "parent-teacher", "general"];

interface AdminDashboardProps {
  portalTitle?: string;
  portalRole?: string;
}

export default function AdminDashboard({ portalTitle, portalRole }: AdminDashboardProps = {}) {
  const { toast } = useToast();
  const { signOut, user, role } = useAuth();
  const isFinanceUser = role === 'finance' || role === 'admin_supervisor' || role === 'principal' || role === 'deputy_principal';
  const displayTitle = portalTitle || "Admin Portal";
  const displayRole = portalRole || "Admin";
  const navigate = useNavigate();

  // Announcements
  const [announcements, setAnnouncements] = useState<Tables<"announcements">[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);

  // Carousel images
  const [carouselImages, setCarouselImages] = useState<Tables<"carousel_images">[]>([]);
  const carouselFileRef = useRef<HTMLInputElement>(null);
  const [carouselCropSrc, setCarouselCropSrc] = useState<string | null>(null);
  const [carouselCropOpen, setCarouselCropOpen] = useState(false);

  // Gallery images
  const [galleryImages, setGalleryImages] = useState<Tables<"gallery_images">[]>([]);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const [galleryCaption, setGalleryCaption] = useState("");
  const [galleryCropSrc, setGalleryCropSrc] = useState<string | null>(null);
  const [galleryCropOpen, setGalleryCropOpen] = useState(false);

  // Downloads
  const [downloads, setDownloads] = useState<Tables<"downloads">[]>([]);
  const downloadFileRef = useRef<HTMLInputElement>(null);
  const [downloadTitle, setDownloadTitle] = useState("");
  const [downloadDesc, setDownloadDesc] = useState("");
  const [downloadCategory, setDownloadCategory] = useState("general");

  // Meetings
  const [meetings, setMeetings] = useState<Tables<"meetings">[]>([]);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDesc, setMeetingDesc] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingType, setMeetingType] = useState("general");
  const [meetingLocation, setMeetingLocation] = useState("");

  const [uploading, setUploading] = useState(false);

  // Site images (achievements etc.)
  const [achievementsImageUrl, setAchievementsImageUrl] = useState<string | null>(null);
  const achievementsFileRef = useRef<HTMLInputElement>(null);
  const [achievementsCropSrc, setAchievementsCropSrc] = useState<string | null>(null);
  const [achievementsCropOpen, setAchievementsCropOpen] = useState(false);

  // Tradition image
  const [traditionImageUrl, setTraditionImageUrl] = useState<string | null>(null);
  const traditionFileRef = useRef<HTMLInputElement>(null);
  const [traditionCropSrc, setTraditionCropSrc] = useState<string | null>(null);
  const [traditionCropOpen, setTraditionCropOpen] = useState(false);

  // CTA image
  const [ctaImageUrl, setCtaImageUrl] = useState<string | null>(null);
  const ctaFileRef = useRef<HTMLInputElement>(null);
  const [ctaCropSrc, setCtaCropSrc] = useState<string | null>(null);
  const [ctaCropOpen, setCtaCropOpen] = useState(false);

  // Principal photo
  const [principalPhotoUrl, setPrincipalPhotoUrl] = useState<string | null>(null);
  const principalFileRef = useRef<HTMLInputElement>(null);
  const [principalCropSrc, setPrincipalCropSrc] = useState<string | null>(null);
  const [principalCropOpen, setPrincipalCropOpen] = useState(false);

  const fetchSiteSettings = async () => {
    const { data } = await supabase.from("site_settings").select("*").in("setting_key", ["achievements_image", "principal_photo", "tradition_image", "cta_image"]);
    if (data) {
      data.forEach((s) => {
        if (s.setting_key === "achievements_image") setAchievementsImageUrl(s.setting_value);
        if (s.setting_key === "principal_photo") setPrincipalPhotoUrl(s.setting_value);
        if (s.setting_key === "tradition_image") setTraditionImageUrl(s.setting_value);
        if (s.setting_key === "cta_image") setCtaImageUrl(s.setting_value);
      });
    }
  };

  const handlePrincipalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPrincipalCropSrc(reader.result as string);
      setPrincipalCropOpen(true);
    };
    reader.readAsDataURL(file);
    if (principalFileRef.current) principalFileRef.current.value = "";
  };

  const handlePrincipalCropComplete = async (blob: Blob) => {
    setUploading(true);
    try {
      const file = new File([blob], `principal_${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = await uploadFile(file, "site-images");
      const { data: existing } = await supabase.from("site_settings").select("id").eq("setting_key", "principal_photo");
      if (existing && existing.length > 0) {
        await supabase.from("site_settings").update({ setting_value: url, updated_at: new Date().toISOString() }).eq("setting_key", "principal_photo");
      } else {
        await supabase.from("site_settings").insert({ setting_key: "principal_photo", setting_value: url });
      }
      setPrincipalPhotoUrl(url);
      toast({ title: "Principal photo updated!" });
    } catch (err) {
      toast({ title: "Upload failed", description: errorMessage(err), variant: "destructive" });
    }
    setUploading(false);
  };

  const handleAchievementsFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAchievementsCropSrc(reader.result as string);
      setAchievementsCropOpen(true);
    };
    reader.readAsDataURL(file);
    if (achievementsFileRef.current) achievementsFileRef.current.value = "";
  };

  const handleAchievementsCropComplete = async (blob: Blob) => {
    setUploading(true);
    try {
      const file = new File([blob], `achievements_${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = await uploadFile(file, "site-images");
      const { data: existing } = await supabase.from("site_settings").select("id").eq("setting_key", "achievements_image");
      if (existing && existing.length > 0) {
        await supabase.from("site_settings").update({ setting_value: url, updated_at: new Date().toISOString() }).eq("setting_key", "achievements_image");
      } else {
        await supabase.from("site_settings").insert({ setting_key: "achievements_image", setting_value: url });
      }
      setAchievementsImageUrl(url);
      toast({ title: "Achievements image updated!" });
    } catch (err) {
      toast({ title: "Upload failed", description: errorMessage(err), variant: "destructive" });
    }
    setUploading(false);
  };

  const handleTraditionFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setTraditionCropSrc(reader.result as string);
      setTraditionCropOpen(true);
    };
    reader.readAsDataURL(file);
    if (traditionFileRef.current) traditionFileRef.current.value = "";
  };

  const handleTraditionCropComplete = async (blob: Blob) => {
    setUploading(true);
    try {
      const file = new File([blob], `tradition_${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = await uploadFile(file, "site-images");
      const { data: existing } = await supabase.from("site_settings").select("id").eq("setting_key", "tradition_image");
      if (existing && existing.length > 0) {
        await supabase.from("site_settings").update({ setting_value: url, updated_at: new Date().toISOString() }).eq("setting_key", "tradition_image");
      } else {
        await supabase.from("site_settings").insert({ setting_key: "tradition_image", setting_value: url });
      }
      setTraditionImageUrl(url);
      toast({ title: "Tradition image updated!" });
    } catch (err) {
      toast({ title: "Upload failed", description: errorMessage(err), variant: "destructive" });
    }
    setUploading(false);
  };

  const handleCtaFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCtaCropSrc(reader.result as string);
      setCtaCropOpen(true);
    };
    reader.readAsDataURL(file);
    if (ctaFileRef.current) ctaFileRef.current.value = "";
  };

  const handleCtaCropComplete = async (blob: Blob) => {
    setUploading(true);
    try {
      const file = new File([blob], `cta_${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = await uploadFile(file, "site-images");
      const { data: existing } = await supabase.from("site_settings").select("id").eq("setting_key", "cta_image");
      if (existing && existing.length > 0) {
        await supabase.from("site_settings").update({ setting_value: url, updated_at: new Date().toISOString() }).eq("setting_key", "cta_image");
      } else {
        await supabase.from("site_settings").insert({ setting_key: "cta_image", setting_value: url });
      }
      setCtaImageUrl(url);
      toast({ title: "CTA image updated!" });
    } catch (err) {
      toast({ title: "Upload failed", description: errorMessage(err), variant: "destructive" });
    }
    setUploading(false);
  };

  const handleDeleteSiteImage = async (settingKey: string, setter: (v: string | null) => void) => {
    if (!confirm("Are you sure you want to delete this image?")) return;
    setUploading(true);
    try {
      await supabase.from("site_settings").delete().eq("setting_key", settingKey);
      setter(null);
      toast({ title: "Image deleted successfully" });
    } catch (err) {
      toast({ title: "Delete failed", description: errorMessage(err), variant: "destructive" });
    }
    setUploading(false);
  };

  const fetchAnnouncements = async () => {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    if (data) setAnnouncements(data);
  };
  const fetchCarouselImages = async () => {
    const { data } = await supabase.from("carousel_images").select("*").order("display_order");
    if (data) setCarouselImages(data);
  };
  const fetchGalleryImages = async () => {
    const { data } = await supabase.from("gallery_images").select("*").order("created_at", { ascending: false });
    if (data) setGalleryImages(data);
  };
  const fetchDownloads = async () => {
    const { data } = await supabase.from("downloads").select("*").order("created_at", { ascending: false });
    if (data) setDownloads(data);
  };
  const fetchMeetings = async () => {
    const { data } = await supabase.from("meetings").select("*").order("meeting_date", { ascending: true });
    if (data) setMeetings(data);
  };

  useEffect(() => {
    fetchAnnouncements();
    fetchCarouselImages();
    fetchGalleryImages();
    fetchDownloads();
    fetchMeetings();
    fetchSiteSettings();
  }, []);

  const addAnnouncement = async () => {
    if (!newTitle) return;
    const { error } = await supabase.from("announcements").insert({ title: newTitle, content: newText, is_public: true, author_id: user?.id });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setNewTitle(""); setNewText("");
    setShowAnnouncementDialog(false);
    toast({ title: "Announcement posted!" });
    fetchAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    await supabase.from("announcements").delete().eq("id", id);
    toast({ title: "Announcement deleted" });
    fetchAnnouncements();
  };

  const uploadFile = async (file: File | Blob, folder: string) => {
    const fileExtFromName = file instanceof File ? file.name.split(".").pop() : undefined;
    const mimeExt = file.type?.split("/")?.[1];
    const ext = fileExtFromName || mimeExt || "jpg";
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("school-media").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("school-media").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleCarouselFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCarouselCropSrc(reader.result as string);
      setCarouselCropOpen(true);
    };
    reader.readAsDataURL(file);
    if (carouselFileRef.current) carouselFileRef.current.value = "";
  };

  const handleCarouselCropComplete = async (blob: Blob) => {
    setUploading(true);
    try {
      const file = new File([blob], `carousel_${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = await uploadFile(file, "carousel");
      const { error } = await supabase.from("carousel_images").insert({ image_url: url, display_order: carouselImages.length });
      if (error) throw error;
      toast({ title: "Carousel image added!" });
      fetchCarouselImages();
    } catch (err) {
      toast({ title: "Upload failed", description: errorMessage(err), variant: "destructive" });
    }
    setUploading(false);
  };

  const deleteCarouselImage = async (id: string) => {
    await supabase.from("carousel_images").delete().eq("id", id);
    toast({ title: "Carousel image removed" });
    fetchCarouselImages();
  };

  const handleGalleryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setGalleryCropSrc(reader.result as string);
      setGalleryCropOpen(true);
    };
    reader.readAsDataURL(file);
    if (galleryFileRef.current) galleryFileRef.current.value = "";
  };

  const handleGalleryCropComplete = async (blob: Blob) => {
    setUploading(true);
    try {
      const file = new File([blob], `gallery_${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = await uploadFile(file, "gallery");
      const { error } = await supabase.from("gallery_images").insert({ image_url: url, caption: galleryCaption || null });
      if (error) throw error;
      toast({ title: "Gallery image added!" });
      setGalleryCaption("");
      fetchGalleryImages();
    } catch (err) {
      toast({ title: "Upload failed", description: errorMessage(err), variant: "destructive" });
    }
    setUploading(false);
  };

  const deleteGalleryImage = async (id: string) => {
    await supabase.from("gallery_images").delete().eq("id", id);
    toast({ title: "Gallery image removed" });
    fetchGalleryImages();
  };

  const handleDownloadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !downloadTitle) {
      toast({ title: "Please enter a title first", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFile(file, "downloads");
      const { error } = await supabase.from("downloads").insert({ title: downloadTitle, description: downloadDesc || null, file_url: url, category: downloadCategory });
      if (error) throw error;
      toast({ title: "Document uploaded!" });
      setDownloadTitle(""); setDownloadDesc(""); setDownloadCategory("general");
      fetchDownloads();
    } catch (err) {
      toast({ title: "Upload failed", description: errorMessage(err), variant: "destructive" });
    }
    setUploading(false);
    if (downloadFileRef.current) downloadFileRef.current.value = "";
  };

  const deleteDownload = async (id: string) => {
    await supabase.from("downloads").delete().eq("id", id);
    toast({ title: "Document removed" });
    fetchDownloads();
  };

  const addMeeting = async () => {
    if (!meetingTitle || !meetingDate) { toast({ title: "Title and date required", variant: "destructive" }); return; }
    const { error } = await supabase.from("meetings").insert({ title: meetingTitle, description: meetingDesc || null, meeting_date: meetingDate, meeting_type: meetingType, location: meetingLocation || null });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setMeetingTitle(""); setMeetingDesc(""); setMeetingDate(""); setMeetingLocation("");
    toast({ title: "Meeting scheduled!" });
    fetchMeetings();
  };

  const deleteMeeting = async (id: string) => {
    await supabase.from("meetings").delete().eq("id", id);
    toast({ title: "Meeting removed" });
    fetchMeetings();
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const meetingTypeLabels: Record<string, string> = { sdc: "SDC Meeting", "parent-teacher": "Parent-Teacher Meeting", general: "General" };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 sm:h-20 items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <img src={schoolLogo} alt="MavingTech High School" className="h-auto w-24 object-contain sm:w-40" />
            <span className="font-heading text-sm sm:text-lg font-bold text-primary">{displayTitle}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline text-sm text-muted-foreground">{displayRole}</span>
            <LanguageSelect />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:flex"><LogOut className="mr-1 h-4 w-4" /> Logout</Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="sm:hidden h-8 w-8"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container px-3 sm:px-4 py-4 sm:py-8">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 sm:mb-6 font-heading text-lg sm:text-2xl font-bold text-primary">
          {displayRole} Dashboard
        </motion.h1>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Announcements", value: String(announcements.length), icon: Bell, color: "bg-primary/10" },
            { label: "Carousel Slides", value: String(carouselImages.length), icon: Layers, color: "bg-accent/10" },
            { label: "Downloads", value: String(downloads.length), icon: Download, color: "bg-primary/10" },
            { label: "Meetings", value: String(meetings.length), icon: HandshakeIcon, color: "bg-accent/10" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.color}`}>
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* All image croppers rendered outside Tabs so they're always mounted */}
        {carouselCropSrc && (
          <ImageCropper
            imageSrc={carouselCropSrc}
            open={carouselCropOpen}
            onClose={() => { setCarouselCropOpen(false); setCarouselCropSrc(null); }}
            onCropComplete={handleCarouselCropComplete}
            aspectRatio={16 / 9}
            cropShape="rect"
            title="Crop Carousel Image"
          />
        )}
        {galleryCropSrc && (
          <ImageCropper
            imageSrc={galleryCropSrc}
            open={galleryCropOpen}
            onClose={() => { setGalleryCropOpen(false); setGalleryCropSrc(null); }}
            onCropComplete={handleGalleryCropComplete}
            aspectRatio={4 / 3}
            cropShape="rect"
            title="Crop Gallery Image"
          />
        )}
        {principalCropSrc && (
          <ImageCropper
            imageSrc={principalCropSrc}
            open={principalCropOpen}
            onClose={() => { setPrincipalCropOpen(false); setPrincipalCropSrc(null); }}
            onCropComplete={handlePrincipalCropComplete}
            aspectRatio={3 / 4}
            cropShape="rect"
            title="Crop Principal Photo"
          />
        )}
        {achievementsCropSrc && (
          <ImageCropper
            imageSrc={achievementsCropSrc}
            open={achievementsCropOpen}
            onClose={() => { setAchievementsCropOpen(false); setAchievementsCropSrc(null); }}
            onCropComplete={handleAchievementsCropComplete}
            aspectRatio={16 / 9}
            cropShape="rect"
            title="Crop Achievements Image"
          />
        )}
        {traditionCropSrc && (
          <ImageCropper
            imageSrc={traditionCropSrc}
            open={traditionCropOpen}
            onClose={() => { setTraditionCropOpen(false); setTraditionCropSrc(null); }}
            onCropComplete={handleTraditionCropComplete}
            aspectRatio={16 / 9}
            cropShape="rect"
            title="Crop Tradition Image"
          />
        )}
        {ctaCropSrc && (
          <ImageCropper
            imageSrc={ctaCropSrc}
            open={ctaCropOpen}
            onClose={() => { setCtaCropOpen(false); setCtaCropSrc(null); }}
            onCropComplete={handleCtaCropComplete}
            aspectRatio={1}
            cropShape="rect"
            title="Crop CTA Image"
          />
        )}

        <div className="mb-4 sm:mb-6"><DemoDataSeederPanel /></div>

        <Tabs defaultValue="announcements" className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide rounded-xl border bg-card p-1.5">
            <TabsList className="flex-wrap gap-1 bg-transparent h-auto p-0 w-max sm:w-auto">
              <TabsTrigger value="announcements" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Bell className="mr-1 h-3.5 w-3.5" /> Notices</TabsTrigger>
              <TabsTrigger value="carousel" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Layers className="mr-1 h-3.5 w-3.5" /> Carousel</TabsTrigger>
              <TabsTrigger value="gallery" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Image className="mr-1 h-3.5 w-3.5" /> Gallery</TabsTrigger>
              <TabsTrigger value="downloads" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Download className="mr-1 h-3.5 w-3.5" /> Downloads</TabsTrigger>
              <TabsTrigger value="site-images" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Settings className="mr-1 h-3.5 w-3.5" /> Images</TabsTrigger>
              <TabsTrigger value="student-mgmt" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><BookOpen className="mr-1 h-3.5 w-3.5" /> Students</TabsTrigger>
              <TabsTrigger value="staff-mgmt" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><UserCheck className="mr-1 h-3.5 w-3.5" /> Staff</TabsTrigger>
              <TabsTrigger value="staff-full" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Briefcase className="mr-1 h-3.5 w-3.5" /> Directory</TabsTrigger>
              <TabsTrigger value="user-mgmt" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Shield className="mr-1 h-3.5 w-3.5" /> Users</TabsTrigger>
              <TabsTrigger value="password-mgmt" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><ShieldAlert className="mr-1 h-3.5 w-3.5" /> Passwords</TabsTrigger>
              <TabsTrigger value="academics" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><GraduationCap className="mr-1 h-3.5 w-3.5" /> Academics</TabsTrigger>
              <TabsTrigger value="timetable" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Calendar className="mr-1 h-3.5 w-3.5" /> Timetables</TabsTrigger>
              <TabsTrigger value="boarding" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><BedDouble className="mr-1 h-3.5 w-3.5" /> Boarding</TabsTrigger>
              <TabsTrigger value="inventory" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Package className="mr-1 h-3.5 w-3.5" /> Inventory</TabsTrigger>
              <TabsTrigger value="facilities" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Building className="mr-1 h-3.5 w-3.5" /> Facilities</TabsTrigger>
              <TabsTrigger value="projects" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><FolderKanban className="mr-1 h-3.5 w-3.5" /> Projects</TabsTrigger>
              <TabsTrigger value="awards" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Trophy className="mr-1 h-3.5 w-3.5" /> Awards</TabsTrigger>
              <TabsTrigger value="attendance" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Attendance</TabsTrigger>
              {isFinanceUser && (
                <>
                  <TabsTrigger value="finance" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><DollarSign className="mr-1 h-3.5 w-3.5" /> Finance</TabsTrigger>
                </>
              )}
              <TabsTrigger value="meetings" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><HandshakeIcon className="mr-1 h-3.5 w-3.5" /> Meetings</TabsTrigger>
              <TabsTrigger value="communication" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><MessageSquare className="mr-1 h-3.5 w-3.5" /> Comms</TabsTrigger>
              <TabsTrigger value="reports" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><ClipboardList className="mr-1 h-3.5 w-3.5" /> Reports</TabsTrigger>
              <TabsTrigger value="audit" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Audit</TabsTrigger>
              <TabsTrigger value="migration" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Database className="mr-1 h-3.5 w-3.5" /> Migration</TabsTrigger>
              <TabsTrigger value="golive" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Rocket className="mr-1 h-3.5 w-3.5" /> Go-Live</TabsTrigger>
              <TabsTrigger value="staff-leave" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><CalendarOff className="mr-1 h-3.5 w-3.5" /> Staff Leave</TabsTrigger>
              <TabsTrigger value="agent" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Bot className="mr-1 h-3.5 w-3.5" /> AI Agent</TabsTrigger>
              <TabsTrigger value="manual" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><BookOpen className="mr-1 h-3.5 w-3.5" /> Manual</TabsTrigger>
            </TabsList>
          </div>

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold text-foreground">Announcements</h2>
                <Button onClick={() => setShowAnnouncementDialog(true)}>
                  <Plus className="mr-1 h-4 w-4" /> New Announcement
                </Button>
              </div>

              {/* Create Announcement Dialog */}
              <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle className="font-heading">Post Announcement</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2"><Label>Title *</Label><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Announcement title" /></div>
                    <div className="space-y-2"><Label>Content</Label><Textarea value={newText} onChange={e => setNewText(e.target.value)} rows={4} placeholder="Write your announcement..." /></div>
                    <Button onClick={addAnnouncement} disabled={!newTitle} className="w-full"><Plus className="mr-1 h-4 w-4" /> Post Announcement</Button>
                  </div>
                </DialogContent>
              </Dialog>

              {announcements.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                  <Megaphone className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  No announcements yet. Click "New Announcement" to get started.
                </CardContent></Card>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {announcements.map(a => (
                    <Card key={a.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="flex items-start justify-between gap-3 p-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Megaphone className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm">{a.title}</h3>
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{a.content}</p>
                            <span className="text-[11px] text-muted-foreground/70 mt-1 block">{new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => deleteAnnouncement(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Carousel Tab */}
          <TabsContent value="carousel">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="font-heading">Upload Carousel Image</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Recommended: 1920×1080px.</p>
                  <input type="file" accept="image/*" ref={carouselFileRef} onChange={handleCarouselFileSelect} className="hidden" />
                  <Button onClick={() => carouselFileRef.current?.click()} disabled={uploading}>
                    <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading…" : "Choose Image"}
                  </Button>
                </CardContent>
              </Card>
              <div className="space-y-3">
                <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Current Slides ({carouselImages.length})</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {carouselImages.map((img) => (
                    <div key={img.id} className="group relative overflow-hidden rounded-lg border">
                      <img src={img.image_url} alt="Carousel slide" className="h-32 w-full object-cover" />
                      <Button variant="destructive" size="icon" className="absolute right-2 top-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteCarouselImage(img.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Gallery Tab */}
          <TabsContent value="gallery">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="font-heading">Upload Gallery Image</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Caption (optional)</Label>
                    <Input value={galleryCaption} onChange={e => setGalleryCaption(e.target.value)} placeholder="e.g. Inter-house Athletics 2026" />
                  </div>
                  <input type="file" accept="image/*" ref={galleryFileRef} onChange={handleGalleryFileSelect} className="hidden" />
                  <Button onClick={() => galleryFileRef.current?.click()} disabled={uploading}>
                    <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading…" : "Choose Image"}
                  </Button>
                </CardContent>
              </Card>
              <div className="space-y-3">
                <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Gallery ({galleryImages.length})</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {galleryImages.map((img) => (
                    <div key={img.id} className="group relative overflow-hidden rounded-lg border">
                      <img src={img.image_url} alt={img.caption || "Gallery"} className="h-28 w-full object-cover" />
                      {img.caption && <p className="px-2 py-1 text-xs text-muted-foreground truncate">{img.caption}</p>}
                      <Button variant="destructive" size="icon" className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteGalleryImage(img.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Downloads Tab */}
          <TabsContent value="downloads">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="font-heading">Upload Document</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Title *</Label><Input value={downloadTitle} onChange={e => setDownloadTitle(e.target.value)} placeholder="e.g. Fee Structure 2026" /></div>
                  <div className="space-y-2"><Label>Description</Label><Input value={downloadDesc} onChange={e => setDownloadDesc(e.target.value)} placeholder="Brief description" /></div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={downloadCategory} onValueChange={setDownloadCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {downloadCategories.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <input type="file" ref={downloadFileRef} onChange={handleDownloadUpload} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" />
                  <Button onClick={() => { if (!downloadTitle) { toast({ title: "Enter a title first", variant: "destructive" }); return; } downloadFileRef.current?.click(); }} disabled={uploading}>
                    <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading…" : "Choose File"}
                  </Button>
                </CardContent>
              </Card>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Documents ({downloads.length})</h3>
                {downloads.map(d => (
                  <Card key={d.id}>
                    <CardContent className="flex items-start justify-between p-4">
                      <div className="flex items-start gap-3">
                        <FileText className="mt-1 h-5 w-5 text-primary shrink-0" />
                        <div>
                          <h3 className="font-semibold">{d.title}</h3>
                          {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
                          <span className="text-xs text-accent">{d.category}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteDownload(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* SDC / Meetings Tab */}
          <TabsContent value="meetings">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="font-heading">Schedule Meeting</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Title *</Label><Input value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} placeholder="e.g. SDC Quarter 1 Meeting" /></div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={meetingType} onValueChange={setMeetingType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {meetingTypes.map(t => <SelectItem key={t} value={t}>{meetingTypeLabels[t]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Date & Time *</Label><Input type="datetime-local" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Location</Label><Input value={meetingLocation} onChange={e => setMeetingLocation(e.target.value)} placeholder="e.g. School Hall" /></div>
                  <div className="space-y-2"><Label>Description</Label><Textarea value={meetingDesc} onChange={e => setMeetingDesc(e.target.value)} rows={2} /></div>
                  <Button onClick={addMeeting} disabled={!meetingTitle || !meetingDate}><Plus className="mr-1 h-4 w-4" /> Schedule Meeting</Button>
                </CardContent>
              </Card>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Scheduled Meetings ({meetings.length})</h3>
                {meetings.map(m => (
                  <Card key={m.id}>
                    <CardContent className="flex items-start justify-between p-4">
                      <div>
                        <span className="inline-block rounded-full bg-maroon-light px-2 py-0.5 text-xs font-semibold text-primary">{meetingTypeLabels[m.meeting_type] || m.meeting_type}</span>
                        <h3 className="mt-1 font-semibold">{m.title}</h3>
                        <p className="text-sm text-muted-foreground">{new Date(m.meeting_date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
                        {m.location && <p className="text-xs text-accent">📍 {m.location}</p>}
                        {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteMeeting(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="user-mgmt">
            <UserManagement />
          </TabsContent>

          {/* Password Management Tab */}
          <TabsContent value="password-mgmt">
            <PasswordManagement />
          </TabsContent>

          {/* Timetable Tab */}
          <TabsContent value="timetable" className="space-y-4">
            <AITimetableBuilderAgent />
            <AISmartTimetable />
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-heading">Advanced Tools</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => window.location.assign("/portal/allocations")} variant="secondary">
                    <Calendar className="mr-2 h-4 w-4" /> Teacher Allocations
                  </Button>
                  <Button onClick={() => window.location.assign("/portal/timetables")}>
                    <Calendar className="mr-2 h-4 w-4" /> Timetable Management
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <PublishedTimetableWidget title="Published Class Timetable" mode="class" />
              </CardContent>
            </Card>
          </TabsContent>


          {/* Site Images Tab */}
          <TabsContent value="site-images">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Principal Photo */}
              <Card>
                <CardHeader><CardTitle className="font-heading">Principal Photo</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">This photo appears on the homepage in the "From the Principal's Desk" section.</p>
                  <input type="file" accept="image/*" ref={principalFileRef} onChange={handlePrincipalFileSelect} className="hidden" />
                  <Button onClick={() => principalFileRef.current?.click()} disabled={uploading}>
                    <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading…" : "Upload Principal Photo"}
                  </Button>
                  {principalPhotoUrl && (
                    <div className="relative mt-2 inline-block">
                      <img src={principalPhotoUrl} alt="Principal" className="h-48 w-36 rounded-lg border object-cover object-top" />
                      <Button variant="destructive" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => handleDeleteSiteImage("principal_photo", setPrincipalPhotoUrl)} disabled={uploading}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Achievements Image */}
              <Card>
                <CardHeader><CardTitle className="font-heading">Achievements Section Image</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">This image appears on the homepage next to the "Celebrating Achievement" section.</p>
                  <input type="file" accept="image/*" ref={achievementsFileRef} onChange={handleAchievementsFileSelect} className="hidden" />
                  <Button onClick={() => achievementsFileRef.current?.click()} disabled={uploading}>
                    <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading…" : "Upload Image"}
                  </Button>
                  {achievementsImageUrl && (
                    <div className="relative mt-2">
                      <img src={achievementsImageUrl} alt="Achievements section" className="rounded-lg border max-h-64 w-full object-cover" />
                      <Button variant="destructive" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => handleDeleteSiteImage("achievements_image", setAchievementsImageUrl)} disabled={uploading}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tradition Image */}
              <Card>
                <CardHeader><CardTitle className="font-heading">Tradition of Excellence Image</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">This image appears on the homepage next to the "A Tradition of Excellence" section.</p>
                  <input type="file" accept="image/*" ref={traditionFileRef} onChange={handleTraditionFileSelect} className="hidden" />
                  <Button onClick={() => traditionFileRef.current?.click()} disabled={uploading}>
                    <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading…" : "Upload Image"}
                  </Button>
                  {traditionImageUrl && (
                    <div className="relative mt-2">
                      <img src={traditionImageUrl} alt="Tradition section" className="rounded-lg border max-h-64 w-full object-cover" />
                      <Button variant="destructive" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => handleDeleteSiteImage("tradition_image", setTraditionImageUrl)} disabled={uploading}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
               </Card>

              {/* CTA Section Image */}
              <Card>
                <CardHeader><CardTitle className="font-heading">CTA Section Image</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">This image appears on the homepage next to the "Ready to Join the MavingTech Family?" section.</p>
                  <input type="file" accept="image/*" ref={ctaFileRef} onChange={handleCtaFileSelect} className="hidden" />
                  <Button onClick={() => ctaFileRef.current?.click()} disabled={uploading}>
                    <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading…" : "Upload Image"}
                  </Button>
                  {ctaImageUrl && (
                    <div className="relative mt-2">
                      <img src={ctaImageUrl} alt="CTA section" className="rounded-lg border max-h-64 w-full object-cover" />
                      <Button variant="destructive" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => handleDeleteSiteImage("cta_image", setCtaImageUrl)} disabled={uploading}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Staff Management Tab */}
          <TabsContent value="staff-mgmt">
            <StaffManagement />
          </TabsContent>

          {/* Facilities Tab */}
          <TabsContent value="facilities">
            <FacilitiesManagement />
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <ProjectsManagement />
          </TabsContent>

          {/* Awards Tab */}
          <TabsContent value="awards">
            <AwardsManagement />
          </TabsContent>

          {/* Student Management Tab */}
          <TabsContent value="student-mgmt">
            <StudentManagement />
          </TabsContent>

          {/* Staff Directory Tab */}
          <TabsContent value="staff-full">
            <StaffManagementFull />
          </TabsContent>

          {/* Academics Tab */}
          <TabsContent value="academics">
            <AcademicManagement />
          </TabsContent>

          {/* Boarding Tab */}
          <TabsContent value="boarding">
            <BoardingManagement />
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory">
            <InventoryManagement />
          </TabsContent>

          {/* Communication Tab */}
          <TabsContent value="communication">
            <CommunicationModule />
          </TabsContent>

          {/* EMIS Reports Tab */}
          <TabsContent value="reports">
            <EMISReports />
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit">
            <AuditLogs />
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <AdminAttendanceViewer />
          </TabsContent>

          {/* Data Migration Tab */}
          <TabsContent value="migration">
            <DataMigration />
          </TabsContent>

          {/* Go-Live Checklist Tab */}
          <TabsContent value="golive">
            <GoLiveChecklist />
          </TabsContent>

          {/* Finance Tab - only for finance clerks and admin supervisors */}
          {isFinanceUser && (
            <TabsContent value="finance">
              <FinanceManagement />
            </TabsContent>
          )}

          {/* User Manual Tab */}
          <TabsContent value="agent">
            <AgentConsole />
          </TabsContent>

          <TabsContent value="manual">
            <UserManualPage />
          </TabsContent>

          {/* Staff Leave Tab */}
          <TabsContent value="staff-leave">
            <StaffAvailabilityOverview />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
