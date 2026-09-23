import { lazy, Suspense } from "react";
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
import Index from "./pages/Index";

// Route pages are code-split so visitors only download the screens they open.
const TeacherAllocations = lazy(() => import("./pages/portal/TeacherAllocations"));
const TeacherMyTimetable = lazy(() => import("./pages/portal/TeacherMyTimetable"));
const StudentMyTimetable = lazy(() => import("./pages/portal/StudentMyTimetable"));
const ParentChildTimetable = lazy(() => import("./pages/portal/ParentChildTimetable"));
const ParentSubscribe = lazy(() => import("./pages/portal/ParentSubscribe"));
const ParentPaymentHistory = lazy(() => import("./pages/portal/ParentPaymentHistory"));
const ParentBilling = lazy(() => import("./pages/portal/ParentBilling"));
const AdminPayments = lazy(() => import("./pages/portal/AdminPayments"));
const About = lazy(() => import("./pages/About"));
const Academics = lazy(() => import("./pages/Academics"));
const Admissions = lazy(() => import("./pages/Admissions"));
const SchoolLife = lazy(() => import("./pages/SchoolLife"));
const News = lazy(() => import("./pages/News"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const StudentDashboard = lazy(() => import("./pages/portal/StudentDashboard"));
const ParentDashboard = lazy(() => import("./pages/portal/ParentDashboard"));
const TeacherDashboard = lazy(() => import("./pages/portal/TeacherDashboard"));
const AIShadowMarker = lazy(() => import("./pages/portal/AIShadowMarker"));
const AdminDashboard = lazy(() => import("./pages/portal/AdminDashboard"));
const FinanceDashboard = lazy(() => import("./pages/portal/FinanceDashboard"));
const PrincipalDashboard = lazy(() => import("./pages/portal/PrincipalDashboard"));
const DeputyPrincipalDashboard = lazy(() => import("./pages/portal/DeputyPrincipalDashboard"));
const HODDashboard = lazy(() => import("./pages/portal/HODDashboard"));
const AdminSupervisorDashboard = lazy(() => import("./pages/portal/AdminSupervisorDashboard"));
const RegistrationDashboard = lazy(() => import("./pages/portal/RegistrationDashboard"));
const TimetableManagement = lazy(() => import("./pages/portal/TimetableManagement"));
const Downloads = lazy(() => import("./pages/Downloads"));
const Staff = lazy(() => import("./pages/Staff"));
const Facilities = lazy(() => import("./pages/Facilities"));
const Fees = lazy(() => import("./pages/Fees"));
const Vacancies = lazy(() => import("./pages/Vacancies"));
const SchoolProjects = lazy(() => import("./pages/SchoolProjects"));
const Alumni = lazy(() => import("./pages/Alumni"));
const PayOnline = lazy(() => import("./pages/PayOnline"));
const Contact = lazy(() => import("./pages/Contact"));
const Boarding = lazy(() => import("./pages/Boarding"));
const SportsCulture = lazy(() => import("./pages/SportsCulture"));
const Awards = lazy(() => import("./pages/Awards"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForceChangePassword = lazy(() => import("./pages/ForceChangePassword"));

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
                <AuthenticatedLayout><ParentSubscribe /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/parent/payments" element={
              <ProtectedRoute allowedRoles={["parent", "admin"]}>
                <AuthenticatedLayout><ParentPaymentHistory /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/parent/billing" element={
              <ProtectedRoute allowedRoles={["parent", "admin"]}>
                <AuthenticatedLayout><ParentBilling /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/admin/payments" element={
              <ProtectedRoute allowedRoles={["admin", "principal", "deputy_principal", "finance", "bursar"]}>
                <AuthenticatedLayout><AdminPayments /></AuthenticatedLayout>
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
                <AuthenticatedLayout><TimetableManagement /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/allocations" element={
              <ProtectedRoute allowedRoles={["admin", "principal", "deputy_principal"]}>
                <AuthenticatedLayout><TeacherAllocations /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/teacher/timetable" element={
              <ProtectedRoute allowedRoles={["teacher", "hod", "admin"]}>
                <AuthenticatedLayout><TeacherMyTimetable /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/student/timetable" element={
              <ProtectedRoute allowedRoles={["student"]}>
                <AuthenticatedLayout><StudentMyTimetable /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="/portal/parent/timetable" element={
              <ProtectedRoute allowedRoles={["parent"]}>
                <AuthenticatedLayout><ParentChildTimetable /></AuthenticatedLayout>
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </DemoPeopleProvider>
          </AllocationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
