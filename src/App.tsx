import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AllocationProvider } from "@/contexts/AllocationContext";
import { DemoPeopleProvider } from "@/contexts/DemoPeopleContext";
import ScrollToTop from "@/components/ScrollToTop";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthenticatedLayout from "@/components/layout/AuthenticatedLayout";
import SiteTranslator from "@/components/i18n/SiteTranslator";
import PwaPrompts from "@/components/pwa/PwaPrompts";
import Index from "./pages/Index";
import { lazyPage } from "@/lib/lazyPage";
import AppErrorBoundary from "@/components/AppErrorBoundary";

// Route pages are code-split so visitors only download the screens they open.
const TeacherAllocations = lazyPage(() => import("./pages/portal/TeacherAllocations"));
const TeacherMyTimetable = lazyPage(() => import("./pages/portal/TeacherMyTimetable"));
const StudentMyTimetable = lazyPage(() => import("./pages/portal/StudentMyTimetable"));
const ParentChildTimetable = lazyPage(() => import("./pages/portal/ParentChildTimetable"));
const ParentSubscribe = lazyPage(() => import("./pages/portal/ParentSubscribe"));
const ParentPaymentHistory = lazyPage(() => import("./pages/portal/ParentPaymentHistory"));
const ParentBilling = lazyPage(() => import("./pages/portal/ParentBilling"));
const AdminPayments = lazyPage(() => import("./pages/portal/AdminPayments"));
const About = lazyPage(() => import("./pages/About"));
const Academics = lazyPage(() => import("./pages/Academics"));
const Admissions = lazyPage(() => import("./pages/Admissions"));
const SchoolLife = lazyPage(() => import("./pages/SchoolLife"));
const News = lazyPage(() => import("./pages/News"));
const Login = lazyPage(() => import("./pages/Login"));
const Register = lazyPage(() => import("./pages/Register"));
const StudentDashboard = lazyPage(() => import("./pages/portal/StudentDashboard"));
const ParentDashboard = lazyPage(() => import("./pages/portal/ParentDashboard"));
const TeacherDashboard = lazyPage(() => import("./pages/portal/TeacherDashboard"));
const AIShadowMarker = lazyPage(() => import("./pages/portal/AIShadowMarker"));
const AdminDashboard = lazyPage(() => import("./pages/portal/AdminDashboard"));
const FinanceDashboard = lazyPage(() => import("./pages/portal/FinanceDashboard"));
const PrincipalDashboard = lazyPage(() => import("./pages/portal/PrincipalDashboard"));
const DeputyPrincipalDashboard = lazyPage(() => import("./pages/portal/DeputyPrincipalDashboard"));
const HODDashboard = lazyPage(() => import("./pages/portal/HODDashboard"));
const AdminSupervisorDashboard = lazyPage(() => import("./pages/portal/AdminSupervisorDashboard"));
const RegistrationDashboard = lazyPage(() => import("./pages/portal/RegistrationDashboard"));
const TimetableManagement = lazyPage(() => import("./pages/portal/TimetableManagement"));
const Downloads = lazyPage(() => import("./pages/Downloads"));
const Staff = lazyPage(() => import("./pages/Staff"));
const Facilities = lazyPage(() => import("./pages/Facilities"));
const Fees = lazyPage(() => import("./pages/Fees"));
const Vacancies = lazyPage(() => import("./pages/Vacancies"));
const SchoolProjects = lazyPage(() => import("./pages/SchoolProjects"));
const Alumni = lazyPage(() => import("./pages/Alumni"));
const PayOnline = lazyPage(() => import("./pages/PayOnline"));
const Contact = lazyPage(() => import("./pages/Contact"));
const Boarding = lazyPage(() => import("./pages/Boarding"));
const SportsCulture = lazyPage(() => import("./pages/SportsCulture"));
const Awards = lazyPage(() => import("./pages/Awards"));
const NotFound = lazyPage(() => import("./pages/NotFound"));
const ForgotPassword = lazyPage(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyPage(() => import("./pages/ResetPassword"));
const ForceChangePassword = lazyPage(() => import("./pages/ForceChangePassword"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <AllocationProvider>
          <DemoPeopleProvider>
          <ScrollToTop />
          <SiteTranslator />
          <PwaPrompts />
          <AppErrorBoundary>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<About />} />
            <Route path="/academics" element={<Academics />} />
            <Route path="/admissions" element={<Admissions />} />
            <Route path="/school-life" element={<SchoolLife />} />
            <Route path="/facilities" element={<Facilities />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/fees" element={<Fees />} />
            <Route path="/pay-online" element={<PayOnline />} />
            <Route path="/vacancies" element={<Vacancies />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/school-projects" element={<SchoolProjects />} />
            <Route path="/news" element={<News />} />
            <Route path="/alumni" element={<Alumni />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/boarding" element={<Boarding />} />
            <Route path="/sports-culture" element={<SportsCulture />} />
            <Route path="/awards" element={<Awards />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/change-password" element={<ForceChangePassword />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/portal/student" element={
              <ProtectedRoute allowedRoles={["student"]}>
                <AuthenticatedLayout><StudentDashboard /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/teacher" element={
              <ProtectedRoute allowedRoles={["teacher"]}>
                <AuthenticatedLayout><TeacherDashboard /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/teacher/ai-marker" element={
              <ProtectedRoute allowedRoles={["teacher", "admin", "principal", "deputy_principal", "hod"]}>
                <AuthenticatedLayout><AIShadowMarker /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/parent-teacher" element={
              <ProtectedRoute allowedRoles={["parent"]}>
                <AuthenticatedLayout><ParentDashboard /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/parent" element={
              <ProtectedRoute allowedRoles={["parent"]}>
                <AuthenticatedLayout><ParentDashboard /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/parent/subscribe" element={
              <ProtectedRoute allowedRoles={["parent", "admin"]}>
                <AuthenticatedLayout topBar><ParentSubscribe /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/parent/payments" element={
              <ProtectedRoute allowedRoles={["parent", "admin"]}>
                <AuthenticatedLayout topBar><ParentPaymentHistory /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/parent/billing" element={
              <ProtectedRoute allowedRoles={["parent", "admin"]}>
                <AuthenticatedLayout topBar><ParentBilling /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/admin/payments" element={
              <ProtectedRoute allowedRoles={["admin", "principal", "deputy_principal", "finance", "bursar"]}>
                <AuthenticatedLayout topBar><AdminPayments /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/admin" element={
              <ProtectedRoute allowedRoles={["admin", "principal", "deputy_principal"]}>
                <AuthenticatedLayout><AdminDashboard /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/finance" element={
              <ProtectedRoute allowedRoles={["finance", "finance_clerk", "bursar", "admin", "principal", "deputy_principal"]}>
                <AuthenticatedLayout><FinanceDashboard /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/principal" element={
              <ProtectedRoute allowedRoles={["principal"]}>
                <AuthenticatedLayout><PrincipalDashboard /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/deputy-principal" element={
              <ProtectedRoute allowedRoles={["deputy_principal"]}>
                <AuthenticatedLayout><DeputyPrincipalDashboard /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/hod" element={
              <ProtectedRoute allowedRoles={["hod"]}>
                <AuthenticatedLayout><HODDashboard /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/admin-supervisor" element={
              <ProtectedRoute allowedRoles={["admin_supervisor"]}>
                <AuthenticatedLayout><AdminSupervisorDashboard /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/registration" element={
              <ProtectedRoute allowedRoles={["registration", "admin"]}>
                <RegistrationDashboard />
              </ProtectedRoute>
            } />
            <Route path="/portal/timetables" element={
              <ProtectedRoute allowedRoles={["admin", "principal", "deputy_principal", "hod", "teacher"]}>
                <AuthenticatedLayout topBar><TimetableManagement /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/allocations" element={
              <ProtectedRoute allowedRoles={["admin", "principal", "deputy_principal"]}>
                <AuthenticatedLayout topBar><TeacherAllocations /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/teacher/timetable" element={
              <ProtectedRoute allowedRoles={["teacher", "hod", "admin"]}>
                <AuthenticatedLayout topBar><TeacherMyTimetable /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/student/timetable" element={
              <ProtectedRoute allowedRoles={["student"]}>
                <AuthenticatedLayout topBar><StudentMyTimetable /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/parent/timetable" element={
              <ProtectedRoute allowedRoles={["parent"]}>
                <AuthenticatedLayout topBar><ParentChildTimetable /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </AppErrorBoundary>
          </DemoPeopleProvider>
          </AllocationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
