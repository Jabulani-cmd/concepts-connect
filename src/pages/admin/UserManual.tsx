import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookOpen,
  Shield,
  GraduationCap,
  Users,
  Briefcase,
  DollarSign,
  Printer,
  Search,
  Home,
  UserCheck,
  Package,
  MessageSquare,
  BedDouble,
  ClipboardList,
  Lock,
  Monitor,
} from "lucide-react";
import { Input } from "@/components/ui/input";

type Section = {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: string;
  content: React.ReactNode;
};

const ManualSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <h4 className="font-heading font-semibold text-base">{title}</h4>
    {children}
  </div>
);

const Step = ({ n, text }: { n: number; text: string }) => (
  <div className="flex items-start gap-3 py-1">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{n}</span>
    <p className="text-sm leading-relaxed">{text}</p>
  </div>
);

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
    <span className="font-semibold text-accent">💡 Tip: </span>{children}
  </div>
);

const Warning = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
    <span className="font-semibold text-destructive">⚠️ Important: </span>{children}
  </div>
);

export default function UserManual() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("overview");

  const sections: Section[] = [
    {
      id: "overview",
      title: "System Overview",
      icon: Home,
      content: (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            Concepts Learning Academy Management System is a comprehensive web-based platform designed to manage all aspects of school operations. The system serves five types of users: <strong>Administrators</strong>, <strong>Bursars/Finance Staff</strong>, <strong>Teachers</strong>, <strong>Students</strong>, and <strong>Parents</strong>.
          </p>
          <ManualSection title="Accessing the System">
            <Step n={1} text="Open your web browser (Chrome, Firefox, Safari, or Edge recommended)." />
            <Step n={2} text="Navigate to the school portal URL (e.g., portal.mavingtech.com)." />
            <Step n={3} text="Click 'Login' from the navigation menu or go directly to /login." />
            <Step n={4} text="Enter your email address and password provided by the school administrator." />
            <Step n={5} text="You will be automatically redirected to your role-specific dashboard." />
          </ManualSection>
          <ManualSection title="User Roles">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { role: "Admin", desc: "Full system access: manage users, content, finance, academics, and settings." },
                { role: "Teacher", desc: "Manage classes, upload materials, record attendance, grade assessments, publish results." },
                { role: "Student", desc: "View timetable, access materials, submit assessments, check results and fees." },
                { role: "Parent", desc: "Monitor child's attendance, results, fees, and communicate with teachers." },
              ].map(r => (
                <div key={r.role} className="rounded-lg border p-3">
                  <p className="font-semibold text-sm">{r.role}</p>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                </div>
              ))}
            </div>
          </ManualSection>
          <ManualSection title="Changing Your Password">
            <Step n={1} text="Navigate to your Profile tab within your dashboard." />
            <Step n={2} text="Click 'Change Password'." />
            <Step n={3} text="Enter your new password (minimum 6 characters) and confirm it." />
            <Step n={4} text="Click 'Update Password' to save." />
          </ManualSection>
          <Tip>For security, change your password after your first login and avoid sharing it with anyone.</Tip>
        </div>
      ),
    },
    {
      id: "admin-users",
      title: "User Management",
      icon: Shield,
      badge: "Admin",
      content: (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            Administrators manage all user accounts from the <strong>User Management</strong> tab in the Admin Dashboard.
          </p>
          <ManualSection title="Creating a New User Account">
            <Step n={1} text="Go to Admin Dashboard → User Management tab." />
            <Step n={2} text="Click 'Register New User'." />
            <Step n={3} text="Enter the user's full name, email address, and phone number." />
            <Step n={4} text="Select the appropriate role: Admin, Teacher, Student, or Parent." />
            <Step n={5} text="Set a temporary password (the user should change it on first login)." />
            <Step n={6} text="Click 'Register User' to create the account." />
          </ManualSection>
          <ManualSection title="Resetting a User's Password">
            <Step n={1} text="Navigate to User Management tab." />
            <Step n={2} text="Find the user in the list (use the search box or filters)." />
            <Step n={3} text="Click the key/reset icon next to their name." />
            <Step n={4} text="Enter a new temporary password and confirm." />
            <Step n={5} text="Communicate the new password securely to the user." />
          </ManualSection>
          <ManualSection title="Bulk User Import">
            <Step n={1} text="Prepare an Excel or CSV file with columns: Full Name, Email, Role." />
            <Step n={2} text="Click 'Bulk Import' in the User Management tab." />
            <Step n={3} text="Upload your file and review the preview." />
            <Step n={4} text="Confirm to create all accounts at once." />
          </ManualSection>
          <Warning>Only create staff accounts through the <strong>Staff Directory</strong> tab to ensure proper HR records and login credentials are issued together.</Warning>
        </div>
      ),
    },
    {
      id: "admin-students",
      title: "Student Management",
      icon: GraduationCap,
      badge: "Admin",
      content: (
        <div className="space-y-4">
          <ManualSection title="Adding a New Student">
            <Step n={1} text="Go to Admin Dashboard → Students tab." />
            <Step n={2} text="Click '+ Add Student'." />
            <Step n={3} text="Fill in the required fields: Admission Number, Full Name, Form, and Stream." />
            <Step n={4} text="Upload a profile photo using 'Upload Photo' or 'Take Photo' (for webcam/USB camera)." />
            <Step n={5} text="Fill in optional fields: Date of Birth, Gender, Guardian details, Medical conditions." />
            <Step n={6} text="Click 'Save' to add the student to the system." />
          </ManualSection>
          <ManualSection title="Taking a Photo with Camera">
            <Step n={1} text="Click 'Take Photo' next to the Upload Photo button." />
            <Step n={2} text="If multiple cameras are connected, select the desired camera from the dropdown." />
            <Step n={3} text="Position the subject in front of the camera." />
            <Step n={4} text="Click 'Capture' to take the photo." />
            <Step n={5} text="Review the photo. Click 'Retake' if needed or 'Use Photo' to accept." />
            <Step n={6} text="The image cropper will open. Adjust the crop area and click 'Save Crop'." />
          </ManualSection>
          <ManualSection title="Searching & Filtering Students">
            <Step n={1} text="Use the search bar to find students by name or admission number." />
            <Step n={2} text="Filter by Form, Stream, or Status using the dropdown filters." />
            <Step n={3} text="Click 'View' on any student to see their full profile with tabs for academics, attendance, and boarding." />
          </ManualSection>
          <ManualSection title="Parent Child Linking">
            <Step n={1} text="Give the parent the student's admission number." />
            <Step n={2} text="The parent can use that admission number to link the child from the Parent Dashboard." />
          </ManualSection>
          <ManualSection title="Bulk Student Import">
            <Step n={1} text="Go to Admin Dashboard → Data Migration tab." />
            <Step n={2} text="Select 'Students' as the data type." />
            <Step n={3} text="Upload an Excel/CSV file with columns matching the template." />
            <Step n={4} text="Review validation results (phone numbers must be Zimbabwe format: 07XXXXXXXX or +2637XXXXXXXX)." />
            <Step n={5} text="Confirm to import all valid records." />
          </ManualSection>
          <Tip>Medical alerts are highlighted with a red warning banner on the student's profile for quick identification.</Tip>
        </div>
      ),
    },
    {
      id: "admin-staff",
      title: "Staff Directory & HR",
      icon: Briefcase,
      badge: "Admin",
      content: (
        <div className="space-y-4">
          <ManualSection title="Adding a New Staff Member">
            <Step n={1} text="Go to Admin Dashboard → Staff Directory tab." />
            <Step n={2} text="Click '+ Add Staff'." />
            <Step n={3} text="Fill in: Staff Number, Full Name, Role (teacher, admin, bursar, etc.), Department." />
            <Step n={4} text="Upload a photo using 'Upload Photo' or 'Take Photo' for webcam capture." />
            <Step n={5} text="If the staff member is a teacher, select the subjects they teach." />
            <Step n={6} text="Enter National ID, NSSA Number and ZIMRA PAYE / TIN Number as applicable." />
            <Step n={7} text="Click 'Save'. The staff member will now appear in the system and on the public Staff page." />
          </ManualSection>
          <Warning>Staff members should ONLY be added through the Staff Directory tab, not the Staff (Website) tab. The Staff Directory issues proper user credentials and HR records.</Warning>
          <ManualSection title="Managing the Public Staff Page">
            <Step n={1} text="Go to Admin Dashboard → Staff (Website) tab." />
            <Step n={2} text="Upload or update the Staff Group Photo (appears at the top of the public staff page)." />
            <Step n={3} text="Update individual staff photos by clicking the edit icon on their avatar." />
            <Step n={4} text="Change staff categories (Leadership, Teaching, Admin, General) to control how they appear on the website." />
          </ManualSection>
          <ManualSection title="Leave Management">
            <Step n={1} text="Staff submit leave requests from their portal (type, dates, reason)." />
            <Step n={2} text="Administrators review requests in Staff Directory → Leave Requests." />
            <Step n={3} text="Approve or reject requests. The staff member is notified of the decision." />
          </ManualSection>
          <ManualSection title="Contracts">
            <Step n={1} text="Open a staff member's profile in Staff Directory." />
            <Step n={2} text="Navigate to the Contracts section." />
            <Step n={3} text="Add contract details: type (permanent/temporary), start date, end date, salary." />
          </ManualSection>
        </div>
      ),
    },
    {
      id: "admin-finance",
      title: "Finance Management",
      icon: DollarSign,
      badge: "Admin",
      content: (
        <div className="space-y-4">
          <ManualSection title="Setting Up Fee Structures">
            <Step n={1} text="Go to Admin Dashboard → Finance tab → Fee Structures." />
            <Step n={2} text="Click 'Add Fee Structure'." />
            <Step n={3} text="Select the Academic Year, Term, Form Level, and Boarding Status (Day/Boarding)." />
            <Step n={4} text="Enter amounts in both USD and ZiG currencies." />
            <Step n={5} text="Add a description and save." />
          </ManualSection>
          <ManualSection title="Creating Invoices">
            <Step n={1} text="Navigate to Finance → Invoices section." />
            <Step n={2} text="Click 'Generate Invoices' or create individually." />
            <Step n={3} text="Select students, term, and academic year." />
            <Step n={4} text="Invoice items are auto-populated from fee structures." />
            <Step n={5} text="Review and confirm to generate invoices." />
          </ManualSection>
          <ManualSection title="Recording Payments">
            <Step n={1} text="Go to Finance → Payments." />
            <Step n={2} text="Click 'Record Payment'." />
            <Step n={3} text="Select the student and their outstanding invoice." />
            <Step n={4} text="Enter payment amount (USD and/or ZiG), method (cash, bank transfer, EcoCash), and reference number." />
            <Step n={5} text="A receipt number is auto-generated. Click 'Save' to record." />
          </ManualSection>
          <ManualSection title="Fee Restrictions">
            <p className="text-sm text-muted-foreground">Students with unpaid fees can be flagged with restrictions that limit access to certain portal features (e.g., viewing results). Restrictions are managed in the Student Management section.</p>
          </ManualSection>
          <ManualSection title="Expense Tracking">
            <Step n={1} text="Navigate to Finance → Expenses." />
            <Step n={2} text="Click 'Add Expense' and fill in: category, description, amount, payment method." />
            <Step n={3} text="Upload receipt if available." />
          </ManualSection>
          <Tip>The Finance dashboard shows real-time summaries of total fees collected, outstanding balances, and expense breakdowns.</Tip>
        </div>
      ),
    },
    {
      id: "admin-academics",
      title: "Academic Management",
      icon: GraduationCap,
      badge: "Admin",
      content: (
        <div className="space-y-4">
          <ManualSection title="Managing Classes">
            <Step n={1} text="Go to Admin Dashboard → Academics tab → Classes." />
            <Step n={2} text="Add classes with: Name, Form Level, Stream, Room, Capacity, Class Teacher." />
            <Step n={3} text="Assign subjects to each class in the Class Subjects section." />
            <Step n={4} text="Assign teachers to each class-subject combination." />
          </ManualSection>
          <ManualSection title="Managing Subjects">
            <Step n={1} text="Navigate to Academics → Subjects." />
            <Step n={2} text="Add subjects with name and optional department grouping." />
          </ManualSection>
          <ManualSection title="Exam Management">
            <Step n={1} text="Go to Academics → Exams." />
            <Step n={2} text="Create an exam: Name, Type (Mid-term/End of Term), Form Level, Term, Academic Year." />
            <Step n={3} text="Teachers enter marks for their subjects (see Teacher section)." />
            <Step n={4} text="When all marks are entered, toggle 'Published' to make results visible to students and parents." />
          </ManualSection>
          <ManualSection title="Timetable Management">
            <Step n={1} text="Navigate to Timetables tab." />
            <Step n={2} text="Select a class to manage its timetable." />
            <Step n={3} text="Add entries for each day and time slot with subject, teacher, and room." />
          </ManualSection>
          <Warning>Publishing exam results sends automatic notifications to all affected students. Ensure all marks are finalized before publishing.</Warning>
        </div>
      ),
    },
    {
      id: "admin-site",
      title: "Website Content Management",
      icon: Monitor,
      badge: "Admin",
      content: (
        <div className="space-y-4">
          <ManualSection title="Homepage Carousel">
            <Step n={1} text="Go to Admin Dashboard → Carousel tab." />
            <Step n={2} text="Click 'Add Image' to upload a new slide." />
            <Step n={3} text="Images are automatically cropped to 16:9 aspect ratio." />
            <Step n={4} text="Drag to reorder slides. Toggle active/inactive for each." />
          </ManualSection>
          <ManualSection title="Gallery Management">
            <Step n={1} text="Navigate to Gallery tab." />
            <Step n={2} text="Upload images with captions and category tags (Academic, Sports, Events, etc.)." />
            <Step n={3} text="Images are cropped to 4:3 for consistent display." />
          </ManualSection>
          <ManualSection title="Site Images (Principal Photo, Achievement, Tradition)">
            <Step n={1} text="Go to Site Images tab." />
            <Step n={2} text="Upload the Principal's photo (3:4 portrait crop)." />
            <Step n={3} text="Upload the 'Celebrating Achievement' section image (16:9 crop)." />
            <Step n={4} text="Upload the 'Tradition of Excellence' section image (16:9 crop)." />
          </ManualSection>
          <ManualSection title="Announcements">
            <Step n={1} text="Navigate to Announcements tab." />
            <Step n={2} text="Click 'New Announcement'. Set title, content, and optional expiry date." />
            <Step n={3} text="Toggle 'Public' to show on the homepage, or target specific groups." />
          </ManualSection>
          <ManualSection title="Downloads">
            <Step n={1} text="Go to Downloads tab to manage downloadable files (forms, policies, calendars)." />
            <Step n={2} text="Upload files with title, description, and category." />
          </ManualSection>
          <ManualSection title="Facilities & School Projects">
            <p className="text-sm text-muted-foreground">Manage facility images and school project showcases from their respective tabs. Images follow the 16:9 crop standard.</p>
          </ManualSection>
        </div>
      ),
    },
    {
      id: "admin-boarding",
      title: "Boarding Management",
      icon: BedDouble,
      badge: "Admin",
      content: (
        <div className="space-y-4">
          <ManualSection title="Managing Hostels">
            <Step n={1} text="Go to Admin Dashboard → Boarding tab." />
            <Step n={2} text="Add hostels with: Name, Location, Total Capacity, Housemaster." />
            <Step n={3} text="Add rooms within each hostel with room numbers, type, floor, and capacity." />
          </ManualSection>
          <ManualSection title="Allocating Beds">
            <Step n={1} text="Select a hostel and room." />
            <Step n={2} text="Click 'Allocate Bed' and select a student." />
            <Step n={3} text="Set bed number and allocation dates." />
            <Step n={4} text="Occupancy counts update automatically." />
          </ManualSection>
        </div>
      ),
    },
    {
      id: "admin-inventory",
      title: "Inventory Management",
      icon: Package,
      badge: "Admin",
      content: (
        <div className="space-y-4">
          <ManualSection title="Adding Inventory Items">
            <Step n={1} text="Go to Admin Dashboard → Inventory tab." />
            <Step n={2} text="Click 'Add Item'. Enter item code, name, category, unit, quantity, reorder level." />
            <Step n={3} text="Enter purchase prices in USD and ZiG." />
            <Step n={4} text="Optionally generate a barcode for the item." />
          </ManualSection>
          <ManualSection title="Recording Transactions">
            <Step n={1} text="Select an item and click 'Record Transaction'." />
            <Step n={2} text="Choose transaction type: Received, Issued, Returned, or Written Off." />
            <Step n={3} text="Enter quantity and notes. Stock levels update automatically." />
          </ManualSection>
          <ManualSection title="Barcode Scanning">
            <p className="text-sm text-muted-foreground">Use a USB barcode scanner or the built-in camera scanner to quickly look up items by their barcode.</p>
          </ManualSection>
          <Tip>Items below their reorder level are highlighted in the dashboard for easy restock identification.</Tip>
        </div>
      ),
    },
    {
      id: "admin-communication",
      title: "Communication Module",
      icon: MessageSquare,
      badge: "Admin",
      content: (
        <div className="space-y-4">
          <ManualSection title="Sending Messages">
            <Step n={1} text="Go to Admin Dashboard → Communication tab." />
            <Step n={2} text="Select channel: SMS or Email." />
            <Step n={3} text="Choose recipients: All Parents, Specific Form, Individual, or Custom Group." />
            <Step n={4} text="Compose your message or select from saved templates." />
            <Step n={5} text="Preview and send. Communication logs are saved automatically." />
          </ManualSection>
          <ManualSection title="SMS Templates">
            <Step n={1} text="Navigate to Templates section within Communication." />
            <Step n={2} text="Create templates with variables like {student_name}, {amount}, {date}." />
            <Step n={3} text="Templates save time for recurring messages (fee reminders, event notices)." />
          </ManualSection>
        </div>
      ),
    },
    {
      id: "admin-reports",
      title: "EMIS Reports & Audit",
      icon: ClipboardList,
      badge: "Admin",
      content: (
        <div className="space-y-4">
          <ManualSection title="Generating EMIS Reports">
            <Step n={1} text="Go to Admin Dashboard → EMIS Reports tab." />
            <Step n={2} text="Select report type: Enrollment Summary, Staff Returns, Infrastructure, etc." />
            <Step n={3} text="Choose the reporting period and click 'Generate'." />
            <Step n={4} text="Download as Excel or PDF for submission to the Ministry." />
          </ManualSection>
          <ManualSection title="Audit Logs">
            <Step n={1} text="Navigate to Audit Logs tab." />
            <Step n={2} text="View a chronological log of all system actions: who did what and when." />
            <Step n={3} text="Filter by user, action type, or date range." />
          </ManualSection>
          <Tip>Audit logs are essential for accountability. Review them regularly to ensure data integrity.</Tip>
        </div>
      ),
    },
    {
      id: "teacher-dashboard",
      title: "Teacher Dashboard",
      icon: UserCheck,
      badge: "Teacher",
      content: (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            Teachers access their personalized dashboard at <strong>/portal/teacher</strong> after login. The dashboard shows assigned classes, subjects, and quick access to all teaching tools.
          </p>
          <ManualSection title="Uploading Study Materials">
            <Step n={1} text="Click the 'Materials' tab in your dashboard." />
            <Step n={2} text="Click 'Upload Material'." />
            <Step n={3} text="Select the class and subject." />
            <Step n={4} text="Choose material type: Document, Video, Link, or Presentation." />
            <Step n={5} text="Upload the file or paste a URL. Add title, description, and tags." />
            <Step n={6} text="Optionally set an expiry date." />
            <Step n={7} text="Click 'Publish'. Students in that class will receive a notification." />
          </ManualSection>
          <ManualSection title="Creating Assessments">
            <Step n={1} text="Navigate to the 'Assessments' tab." />
            <Step n={2} text="Click 'Create Assessment'." />
            <Step n={3} text="Fill in: Title, Type (Test/Assignment/Project), Class, Subject, Max Marks, Due Date." />
            <Step n={4} text="Add instructions and optionally upload an attachment." />
            <Step n={5} text="Click 'Publish' to make it visible to students." />
          </ManualSection>
          <ManualSection title="Grading Submissions">
            <Step n={1} text="Open an assessment and click 'View Submissions'." />
            <Step n={2} text="Download or preview each student's submission." />
            <Step n={3} text="Enter marks obtained and optional feedback." />
            <Step n={4} text="Grades are auto-calculated from the ZIMSEC grade boundaries (A–E, U)." />
            <Step n={5} text="Toggle 'Publish Results' when grading is complete." />
          </ManualSection>
          <ManualSection title="Recording Attendance">
            <Step n={1} text="Go to the 'Attendance' tab." />
            <Step n={2} text="Select the class and date." />
            <Step n={3} text="Mark each student as Present, Absent, or Late." />
            <Step n={4} text="Use 'Mark All Present' for quick bulk action, then adjust individuals." />
            <Step n={5} text="Add notes for absent students if applicable." />
            <Step n={6} text="Click 'Save Attendance'." />
          </ManualSection>
          <ManualSection title="Entering Exam Marks">
            <Step n={1} text="Navigate to the Exam Results section." />
            <Step n={2} text="Select the exam and subject." />
            <Step n={3} text="Enter marks for each student in the grid." />
            <Step n={4} text="Alternatively, use 'Bulk Upload' with a CSV template." />
            <Step n={5} text="Click 'Save' when done." />
          </ManualSection>
          <ManualSection title="Bulk Marks Upload (CSV)">
            <Step n={1} text="Click 'Download Template' to get a pre-populated CSV with student names." />
            <Step n={2} text="Fill in the marks column in the spreadsheet." />
            <Step n={3} text="Upload the completed CSV. Preview and confirm." />
          </ManualSection>
          <ManualSection title="Sending Announcements">
            <Step n={1} text="Click the 'Announcements' tab." />
            <Step n={2} text="Click 'New Announcement'." />
            <Step n={3} text="Select target: specific class, form level, or parents." />
            <Step n={4} text="Write your message and optionally attach files." />
            <Step n={5} text="Click 'Post'. Targeted users receive notifications." />
          </ManualSection>
          <Tip>Use the personal schedule/timetable feature to organize your teaching week.</Tip>
        </div>
      ),
    },
    {
      id: "student-dashboard",
      title: "Student Dashboard",
      icon: GraduationCap,
      badge: "Student",
      content: (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            Students access their mobile-friendly dashboard at <strong>/portal/student</strong>. The bottom navigation bar provides quick access to all sections.
          </p>
          <ManualSection title="Dashboard Home">
            <p className="text-sm text-muted-foreground">The home screen shows metric cards for attendance rate, upcoming assessments, fee balance, and quick announcements. Scroll horizontally to see all metrics.</p>
          </ManualSection>
          <ManualSection title="Viewing Your Timetable">
            <Step n={1} text="Tap the 'Timetable' tab from the bottom navigation." />
            <Step n={2} text="View your weekly class schedule organized by day." />
            <Step n={3} text="Each entry shows subject, teacher, time, and room." />
          </ManualSection>
          <ManualSection title="Accessing Study Materials">
            <Step n={1} text="Navigate to the 'Materials' tab." />
            <Step n={2} text="Browse materials organized by subject." />
            <Step n={3} text="Click to download or view online." />
          </ManualSection>
          <ManualSection title="Submitting Assessments">
            <Step n={1} text="Go to the 'Assessments' tab." />
            <Step n={2} text="Find the active assessment and click 'Submit'." />
            <Step n={3} text="Upload your file (document, image, or PDF)." />
            <Step n={4} text="Add any comments and click 'Submit Assessment'." />
            <Step n={5} text="Track your submission status: Pending, Graded." />
          </ManualSection>
          <ManualSection title="Viewing Exam Results">
            <Step n={1} text="Navigate to the 'Results' tab." />
            <Step n={2} text="Select the exam period to view your marks." />
            <Step n={3} text="Results show mark, ZIMSEC grade, and class ranking." />
            <Step n={4} text="Click 'Download Report Card' for a PDF version." />
          </ManualSection>
          <ManualSection title="Checking Fee Balance">
            <Step n={1} text="Tap the 'Fees' tab." />
            <Step n={2} text="View your current invoices, amounts paid, and outstanding balance." />
            <Step n={3} text="Payment history shows all recorded transactions." />
          </ManualSection>
          <ManualSection title="Attendance Record">
            <Step n={1} text="Navigate to the 'Attendance' tab." />
            <Step n={2} text="View your attendance percentage and detailed daily records." />
            <Step n={3} text="Days marked as Present, Absent, or Late are colour-coded." />
          </ManualSection>
          <ManualSection title="Personal Planner">
            <Step n={1} text="Access the personal timetable/planner from the dashboard." />
            <Step n={2} text="Add personal study sessions, extra-curricular activities, or reminders." />
            <Step n={3} text="Your planner is private and only visible to you." />
          </ManualSection>
          <ManualSection title="Profile & Notifications">
            <Step n={1} text="Tap the bell icon to view notifications (new materials, results, announcements)." />
            <Step n={2} text="Go to 'Profile' to view your personal information and change your password." />
          </ManualSection>
        </div>
      ),
    },
    {
      id: "parent-dashboard",
      title: "Parent Dashboard",
      icon: Users,
      badge: "Parent",
      content: (
        <div className="space-y-4">
          <ManualSection title="Registering as a Parent">
            <Step n={1} text="Go to the school portal and click 'Register'." />
            <Step n={2} text="Select 'Parent' as your role." />
            <Step n={3} text="Enter your full name, email, phone, and create a password." />
            <Step n={4} text="Verify your email address by clicking the link sent to your inbox." />
            <Step n={5} text="Log in to your Parent Dashboard." />
          </ManualSection>
          <ManualSection title="Linking Your Child's Account">
            <Step n={1} text="After logging in, you'll see a 'Link Child' option." />
            <Step n={2} text="Enter your child's Admission Number (provided by the school)." />
            <Step n={3} text="Click 'Link'. Your child's information will now appear on your dashboard." />
            <Step n={4} text="Repeat for additional children if applicable." />
          </ManualSection>
          <ManualSection title="Monitoring Your Child">
            <p className="text-sm text-muted-foreground">Once linked, you can view:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li><strong>Attendance</strong>: daily records and overall percentage</li>
              <li><strong>Exam Results</strong>: marks, grades, and rankings per exam</li>
              <li><strong>Fee Balance</strong>: invoices, payments, and outstanding amounts</li>
              <li><strong>Announcements</strong>: school and class-specific notices</li>
              <li><strong>Health Visits</strong>: if your child visited the school nurse</li>
            </ul>
          </ManualSection>
          <ManualSection title="Report Cards">
            <Step n={1} text="Navigate to your child's Results section." />
            <Step n={2} text="Select the exam period." />
            <Step n={3} text="Click 'Download Report Card' for the official report card PDF." />
          </ManualSection>
          <Tip>Check your notifications regularly for attendance alerts and important school communications.</Tip>
        </div>
      ),
    },
    {
      id: "public-website",
      title: "Public Website Pages",
      icon: Home,
      content: (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            The public website is accessible to everyone without login. It serves as the school's online presence.
          </p>
          <ManualSection title="Available Public Pages">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { page: "Home", desc: "Hero carousel, principal's message, achievement highlights, events." },
                { page: "About", desc: "School history, mission, vision, and values." },
                { page: "Academics", desc: "Curriculum information and academic programs." },
                { page: "Admissions", desc: "Online application form with multi-step wizard." },
                { page: "Fees", desc: "Current fee structures by form and boarding status." },
                { page: "Staff", desc: "Staff directory with photos, organized by category." },
                { page: "Facilities", desc: "Photo gallery of school facilities." },
                { page: "News", desc: "School news articles and updates." },
                { page: "Downloads", desc: "Downloadable forms, policies, and documents." },
                { page: "Boarding", desc: "Boarding house information and facilities." },
                { page: "Sports & Culture", desc: "Sports and cultural activities offered." },
                { page: "Contact", desc: "Contact form, map, and school contact details." },
              ].map(p => (
                <div key={p.page} className="rounded-lg border p-2">
                  <p className="font-semibold text-xs">{p.page}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              ))}
            </div>
          </ManualSection>
          <ManualSection title="Making an Appointment">
            <Step n={1} text="Visit the Contact page." />
            <Step n={2} text="Fill in the appointment form: name, email, authority to meet, preferred date/time, reason." />
            <Step n={3} text="Submit. The school administration will review and confirm." />
          </ManualSection>
        </div>
      ),
    },
    {
      id: "troubleshooting",
      title: "Troubleshooting & FAQ",
      icon: Lock,
      content: (
        <div className="space-y-4">
          <ManualSection title="Common Issues">
            <div className="space-y-3">
              {[
                { q: "I forgot my password", a: "Contact the school administrator to reset your password. They can do this from User Management." },
                { q: "I can't see my child's data", a: "Ensure you've linked your child using their Admission Number from the school." },
                { q: "My exam results are not showing", a: "Results are only visible after the teacher/admin publishes them. Contact your class teacher if they should be available." },
                { q: "The camera isn't working for photos", a: "Ensure you've granted browser permission to access the camera. Try refreshing the page. If using a USB camera, check that it's properly connected." },
                { q: "I'm getting a 'Row Level Security' error", a: "This means you don't have permission for that action. Ensure you're logged in with the correct role." },
                { q: "Pages are loading slowly", a: "Try clearing your browser cache or using a different browser. Check your internet connection." },
                { q: "I can't upload files", a: "Check that the file is under 50MB. Supported formats: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX, CSV." },
                { q: "My fee balance seems incorrect", a: "Contact the bursar/finance office. They can review your invoices and payment records." },
              ].map((item, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <p className="font-semibold text-sm">Q: {item.q}</p>
                  <p className="text-sm text-muted-foreground mt-1">A: {item.a}</p>
                </div>
              ))}
            </div>
          </ManualSection>
          <ManualSection title="Browser Requirements">
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>Google Chrome 90+ (recommended)</li>
              <li>Mozilla Firefox 88+</li>
              <li>Microsoft Edge 90+</li>
              <li>Safari 14+</li>
              <li>Mobile: Chrome or Safari on Android/iOS</li>
            </ul>
          </ManualSection>
          <ManualSection title="Getting Help">
            <p className="text-sm text-muted-foreground">
              For technical support, contact the school IT administrator. For account-related issues (password resets, role changes), contact the school administration office.
            </p>
          </ManualSection>
        </div>
      ),
    },
  ];

  const filteredSections = searchQuery
    ? sections.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (typeof s.content === "object" && JSON.stringify(s.content).toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : sections;

  const activeData = sections.find(s => s.id === activeSection);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> User Manual
          </h2>
          <p className="text-sm text-muted-foreground">Complete guide for the Concepts Learning Academy Management System</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print Manual
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search the manual..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar navigation */}
        <Card className="h-fit print:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Contents</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[500px]">
              <div className="space-y-0.5">
                {filteredSections.map(s => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { setActiveSection(s.id); setSearchQuery(""); }}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        activeSection === s.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{s.title}</span>
                      {s.badge && (
                        <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">
                          {s.badge}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Content area */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {activeData && <activeData.icon className="h-5 w-5 text-primary" />}
              <div>
                <CardTitle className="font-heading">{activeData?.title}</CardTitle>
                {activeData?.badge && (
                  <Badge variant="secondary" className="mt-1 text-xs">{activeData.badge} Role</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>{activeData?.content}</CardContent>
        </Card>
      </div>

      {/* Print-only: render all sections */}
      <div className="hidden print:block space-y-8">
        {sections.map(s => (
          <div key={s.id} className="break-inside-avoid">
            <h2 className="font-heading text-xl font-bold mb-2 flex items-center gap-2">
              {s.title}
              {s.badge && <span className="text-sm font-normal text-muted-foreground">({s.badge})</span>}
            </h2>
            <Separator className="mb-4" />
            {s.content}
          </div>
        ))}
      </div>
    </div>
  );
}
