import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Staff HR details (ID, NSSA/PAYE, bank, address, emergency contact) are stored in
// staff_private, which only administrators and the staff member can read.
const STAFF_PRIVATE_KEYS = ["national_id", "nssa_number", "paye_number", "bank_details", "address", "emergency_contact"];

function takeStaffPrivate(row: Record<string, unknown>): Record<string, unknown> {
  const hr: Record<string, unknown> = {};
  for (const key of STAFF_PRIVATE_KEYS) {
    if (key in row) {
      hr[key] = row[key];
      delete row[key];
    }
  }
  return hr;
}

async function saveStaffPrivate(admin: SupabaseClient, staffId: string | undefined, hr: Record<string, unknown>) {
  if (!staffId || !Object.keys(hr).length) return;
  const { error } = await admin
    .from("staff_private")
    .upsert({ staff_id: staffId, ...hr, updated_at: new Date().toISOString() }, { onConflict: "staff_id" });
  if (error) throw error;
}

Deno.serve(async (req) => {
  // Set when the very first admin account is being bootstrapped without a signed-in user.
  let bootstrapSeed = false;
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resolvePortalRole = (portalRole?: string, staffRole?: string) => {
      const normalizedStaffRole = (staffRole || "").toLowerCase();
      if (normalizedStaffRole === "bursar") return "bursar";
      if (normalizedStaffRole === "finance_clerk") return "finance_clerk";
      return portalRole;
    };

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, ...payload } = await req.json();

    // Bootstrap exception: seed-admin can run without a logged-in user, but ONLY
    // when there is no admin in the system yet (first-run setup from /login).
    const authHeader = req.headers.get("Authorization");
    const hasUserJwt = !!(authHeader && authHeader.startsWith("Bearer ") && authHeader.replace("Bearer ", "") !== Deno.env.get("SUPABASE_ANON_KEY"));

    if (action === "seed-admin" && !hasUserJwt) {
      // Allow unauthenticated bootstrap only while the system has no administrator.
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) > 0) {
        return new Response(JSON.stringify({ error: "Admin already exists. Sign in as admin to manage users." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      bootstrapSeed = true;
    }


    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      if (!bootstrapSeed) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const token = authHeader ? authHeader.replace("Bearer ", "") : "";

    let userId = "";
    if (!bootstrapSeed) {
      // Use getClaims for faster validation
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader! } } }
      );
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub;
    }


    // For register-parent: caller must be registering themselves
    if (action === "register-parent") {
      if (payload.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Forbidden: can only register yourself as parent" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (!bootstrapSeed) {
      // Admin-level actions require admin/principal/admin_supervisor role
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });

      const { data: isPrincipal } = await supabaseAdmin.rpc("has_role", {
        _user_id: userId,
        _role: "principal",
      });
      const { data: isAdminSupervisor } = await supabaseAdmin.rpc("has_role", {
        _user_id: userId,
        _role: "admin_supervisor",
      });
      // get-students: allow teachers and HODs in addition to admins
      const { data: isTeacher } = await supabaseAdmin.rpc("has_role", {
        _user_id: userId,
        _role: "teacher",
      });
      const { data: isHod } = await supabaseAdmin.rpc("has_role", {
        _user_id: userId,
        _role: "hod",
      });
      if (action === "get-students") {
        if (!isAdmin && !isPrincipal && !isAdminSupervisor && !isTeacher && !isHod) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (!isAdmin && !isPrincipal && !isAdminSupervisor) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ==================== SEED ADMIN ====================
    if (action === "seed-admin") {
      const { data: existingUsers } =
        await supabaseAdmin.auth.admin.listUsers();

      // Seed (or repair) a set of admin accounts. Each entry is created if missing,
      // and its password is reset if it already exists.
      // The first administrator comes from the function's secrets; credentials are
      // never stored in the code. Existing accounts keep their passwords.
      const seedEmail = Deno.env.get("ADMIN_SEED_EMAIL");
      const seedPassword = Deno.env.get("ADMIN_SEED_PASSWORD");
      if (!seedEmail || !seedPassword) {
        return new Response(JSON.stringify({ error: "Set the ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD secrets to create the first administrator." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const adminsToSeed = [{ email: seedEmail, password: seedPassword, full_name: "System Administrator" }];

      const results: Array<{ email: string; status: string }> = [];

      for (const a of adminsToSeed) {
        const existing = existingUsers?.users?.find((u) => u.email === a.email);
        let userId: string | undefined = existing?.id;

        if (existing) {
          results.push({ email: a.email, status: "already exists" });
        } else {
          const { data: newUser, error: createError } =
            await supabaseAdmin.auth.admin.createUser({
              email: a.email,
              password: a.password,
              email_confirm: true,
              user_metadata: { full_name: a.full_name },
            });
          if (createError) throw createError;
          userId = newUser.user.id;
          results.push({ email: a.email, status: "created" });
        }

        if (userId) {
          // Ensure admin role exists (ignore conflicts)
          await supabaseAdmin
            .from("user_roles")
            .upsert(
              { user_id: userId, role: "admin" },
              { onConflict: "user_id,role" }
            );
        }
      }

      return new Response(
        JSON.stringify({ message: "Admins seeded", results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // ==================== SEED TEACHER ====================
    if (action === "seed-teacher") {
      const { email, password, full_name, department } = payload;
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const exists = existingUsers?.users?.some((u) => u.email === email);
      if (exists) {
        const existingUser = existingUsers?.users?.find((u) => u.email === email);
        if (existingUser && password) {
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password });
        }
        return new Response(JSON.stringify({ message: "Teacher already exists, password updated" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: full_name || "Teacher" },
      });
      if (createError) throw createError;
      await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role: "teacher" });
      await supabaseAdmin.from("staff").insert({
        full_name: full_name || "Teacher", email, department, user_id: newUser.user.id, category: "teaching",
      });
      return new Response(JSON.stringify({ message: "Teacher seeded", user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== CREATE USER (unified) ====================
    if (action === "create-user") {
      const { email, password, full_name, portal_role, staff_role, department, phone, grade, class_name, assigned_class_id } = payload;
      const effectivePortalRole = resolvePortalRole(portal_role, staff_role);

      if (!email || !password || !full_name || !effectivePortalRole) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const exists = existingUsers?.users?.some((u) => u.email === email);
      if (exists) {
        return new Response(JSON.stringify({ error: "A user with this email already exists" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, must_change_password: true },
        app_metadata: { must_change_password: true },
      });
      if (createError) throw createError;

      const userId = newUser.user.id;

      // Assign portal role (admin, teacher, student, parent)
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: effectivePortalRole });

      // Ensure a profile row exists so the user appears in the admin Users list
      await supabaseAdmin.from("profiles").upsert({
        id: userId,
        user_id: userId,
        full_name,
        email,
        phone: phone || null,
        role: effectivePortalRole,
      }, { onConflict: "id" });
      if (effectivePortalRole === "student") {
        // Create student record linked to auth user
        await supabaseAdmin.from("students").insert({
          full_name,
          user_id: userId,
          form: grade || null,
          stream: class_name || null,
          guardian_phone: phone || null,
          status: "active",
        });
      } else if (effectivePortalRole !== "parent") {
        // Determine proper category
        let staffCategory = "teaching";
        if (["principal", "deputy_principal"].includes(staff_role || "")) staffCategory = "leadership";
        else if (["bursar", "finance_clerk", "secretary"].includes(staff_role || "")) staffCategory = "administrative";
        else if (["groundsman", "matron"].includes(staff_role || "")) staffCategory = "general";

        const staffInsert: Record<string, unknown> = {
          full_name,
          email,
          phone: phone || null,
          department: department || null,
          user_id: userId,
          category: staffCategory,
          role: staff_role || "teacher",
        };
        // Pass through optional fields from the frontend
        if (payload.photo_url) staffInsert.photo_url = payload.photo_url;
        if (payload.title) staffInsert.title = payload.title;
        if (payload.bio) staffInsert.bio = payload.bio;
        if (payload.address) staffInsert.address = payload.address;
        if (payload.emergency_contact) staffInsert.emergency_contact = payload.emergency_contact;
        if (payload.qualifications) staffInsert.qualifications = payload.qualifications;
        if (payload.national_id) staffInsert.national_id = payload.national_id;
        if (payload.employment_date) staffInsert.employment_date = payload.employment_date;
        if (payload.subjects_taught) staffInsert.subjects_taught = payload.subjects_taught;

        const staffHr = takeStaffPrivate(staffInsert);
        const { data: staffRecord } = await supabaseAdmin.from("staff").insert(staffInsert).select("id, staff_number").single();
        await saveStaffPrivate(supabaseAdmin, staffRecord?.id, staffHr);

        // Assign as class teacher if a class was selected
        if (assigned_class_id && staffRecord) {
          await supabaseAdmin.from("classes").update({ class_teacher_id: staffRecord.id }).eq("id", assigned_class_id);
        }

        // Auto-create class_subjects entries for teaching assignments
        if (staffRecord && payload.teaching_class_ids && payload.subjects_taught) {
          const teachingClassIds = payload.teaching_class_ids as string[];
          const subjectNames = payload.subjects_taught as string[];
          
          // Look up subject IDs by name
          const { data: subjectRecords } = await supabaseAdmin
            .from("subjects")
            .select("id, name")
            .in("name", subjectNames);
          
          if (subjectRecords && subjectRecords.length > 0) {
            const classSubjectInserts: { class_id: string; subject_id: string; teacher_id: string }[] = [];
            for (const classId of teachingClassIds) {
              for (const subject of subjectRecords) {
                classSubjectInserts.push({
                  class_id: classId,
                  subject_id: subject.id,
                  teacher_id: staffRecord.id,
                });
              }
            }
            if (classSubjectInserts.length > 0) {
              await supabaseAdmin.from("class_subjects").upsert(classSubjectInserts, { onConflict: "class_id,subject_id" });
            }
          }

          // Seed the teacher's personal timetable from the timetable of the classes they teach.
          // personal_timetables keeps one row per user with the entries as a JSON list
          // (the same shape the Personal Timetable screen reads and writes).
          const { data: timetableEntries } = await supabaseAdmin
            .from("timetable_entries")
            .select("day_of_week, start_time, end_time, room, subject_id, subjects(name)")
            .in("class_id", teachingClassIds);

          const subjectIds = new Set((subjectRecords || []).map((s) => s.id));
          const entries = (timetableEntries || [])
            .filter((te) => te.subject_id && subjectIds.has(te.subject_id))
            .map((te) => ({
              id: crypto.randomUUID(),
              day_of_week: te.day_of_week,
              time_slot: te.start_time,
              end_time: te.end_time,
              activity: (te.subjects as { name?: string } | null)?.name || "Class",
              activity_type: "class",
              description: null,
              location: te.room,
            }));
          if (entries.length > 0) {
            await supabaseAdmin.from("personal_timetables").insert({ user_id: userId, data: { entries } });
          }
        }

        return new Response(JSON.stringify({ message: "User created successfully", user_id: userId, staff_number: staffRecord?.staff_number }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ message: "User created successfully", user_id: userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== LIST USERS ====================
    if (action === "list-users") {
      // Read every page: the school has more than 1,000 users once the demo data is loaded.
      const PAGE = 1000;
      const allRows = async <T,>(table: string, columns: string): Promise<T[]> => {
        const rows: T[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabaseAdmin.from(table).select(columns).range(from, from + PAGE - 1);
          if (error) throw error;
          rows.push(...((data ?? []) as T[]));
          if (!data || data.length < PAGE) return rows;
        }
      };
      const allRoles = await allRows<{ user_id: string; role: string }>("user_roles", "user_id, role");
      const allProfiles = await allRows<{ id: string; user_id: string | null; full_name: string | null; email: string | null }>("profiles", "id, user_id, full_name, email");
      const allStaff = await allRows<{ id: string; user_id: string | null; email: string | null; role: string | null; department: string | null }>("staff", "id, user_id, email, role, department");
      const allStudents = await allRows<{ id: string; user_id: string | null; email: string | null; full_name: string; form: string | null; stream: string | null; class: string | null }>("students", "id, user_id, email, full_name, form, stream, class");
      const allLinks = await allRows<{ parent_id: string; student_id: string; relationship: string | null }>("parent_students", "parent_id, student_id, relationship");

      // Sign-in details and password flags live on the auth user.
      const authInfo = new Map<string, { last_sign_in_at: string | null; created_at: string; must_change_password: boolean; password_reset_at: string | null }>();
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PAGE });
        if (error) throw error;
        for (const u of data.users) {
          const meta = (u.app_metadata ?? {}) as Record<string, unknown>;
          authInfo.set(u.id, {
            last_sign_in_at: u.last_sign_in_at ?? null,
            created_at: u.created_at,
            must_change_password: meta.must_change_password === true,
            password_reset_at: typeof meta.password_reset_at === "string" ? meta.password_reset_at : null,
          });
        }
        if (data.users.length < PAGE) break;
      }

      const roleMap: Record<string, string> = {};
      allRoles.forEach((r) => { roleMap[r.user_id] = r.role; });

      const lower = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();
      const staffByUser = new Map(allStaff.filter((s) => s.user_id).map((s) => [s.user_id!, s]));
      const staffByEmail = new Map(allStaff.filter((s) => s.email).map((s) => [lower(s.email), s]));
      const studentByUser = new Map(allStudents.filter((s) => s.user_id).map((s) => [s.user_id!, s]));
      const studentByEmail = new Map(allStudents.filter((s) => s.email).map((s) => [lower(s.email), s]));
      const studentById = new Map(allStudents.map((s) => [s.id, s]));
      const className = (s: { form: string | null; stream: string | null; class: string | null }) =>
        s.class || [s.form, s.stream].filter(Boolean).join("") || null;
      const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
      const linksByParent = new Map<string, typeof allLinks>();
      for (const l of allLinks) linksByParent.set(l.parent_id, [...(linksByParent.get(l.parent_id) ?? []), l]);

      // Staff records not yet linked to their login (matched by email) are linked now.
      const toLink: { staffId: string; uid: string }[] = [];

      const users = allProfiles.map((p) => {
        const uid = p.user_id || p.id;
        const info = authInfo.get(uid);
        const role = roleMap[uid] || "unknown";
        let staff = staffByUser.get(uid);
        if (!staff && p.email) {
          const byEmail = staffByEmail.get(lower(p.email));
          if (byEmail && !byEmail.user_id && role !== "student" && role !== "parent") {
            staff = byEmail;
            toLink.push({ staffId: byEmail.id, uid });
          }
        }
        // Position and department (staff), class (students) or children (parents).
        let position: string | null = staff?.role || null;
        let unit: string | null = staff?.department || null;
        if (!staff && role === "student") {
          const st = studentByUser.get(uid) ?? studentByEmail.get(lower(p.email));
          position = "Student";
          unit = st ? className(st) : null;
        } else if (!staff && role === "parent") {
          const links = linksByParent.get(uid) ?? [];
          const rel = links.find((l) => l.relationship)?.relationship;
          position = rel ? cap(rel) : "Parent/Guardian";
          const kids = links
            .map((l) => studentById.get(l.student_id) ?? studentByUser.get(l.student_id))
            .filter((k): k is NonNullable<typeof k> => !!k)
            .map((k) => (className(k) ? `${k.full_name} (${className(k)})` : k.full_name));
          unit = kids.length ? kids.join(", ") : null;
        }
        return {
          id: uid,
          email: p.email || "",
          full_name: p.full_name || "",
          portal_role: role,
          staff_role: position,
          department: unit,
          created_at: info?.created_at ?? "",
          last_sign_in_at: info?.last_sign_in_at ?? null,
          must_change_password: info?.must_change_password ?? false,
          password_reset_at: info?.password_reset_at ?? null,
        };
      });

      for (const { staffId, uid } of toLink) {
        await supabaseAdmin.from("staff").update({ user_id: uid }).eq("id", staffId).is("user_id", null);
      }

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== RESET PASSWORD ====================
    // Passwords are stored only as one-way hashes, so they can be replaced but never read back.
    if (action === "reset-password") {
      const { user_id, password: newPassword, force_change } = payload;
      if (!user_id || !newPassword) {
        return new Response(JSON.stringify({ error: "user_id and password required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (String(newPassword).length < 8) {
        return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Only an administrator may reset another administrator's password.
      const { data: targetIsAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user_id, _role: "admin" });
      const { data: callerIsAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (targetIsAdmin && !callerIsAdmin) {
        return new Response(JSON.stringify({ error: "Only an administrator can reset an administrator's password" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const flags = { must_change_password: !!force_change, password_reset_at: new Date().toISOString() };
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: newPassword,
        app_metadata: flags,
        user_metadata: { must_change_password: !!force_change }, // legacy compat
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ message: "Password reset successfully", ...flags }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== DELETE USER ====================
    if (action === "delete-user") {
      const { user_id } = payload;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get staff record ID for this user (needed to clean up FK references)
      const { data: staffRecord } = await supabaseAdmin
        .from("staff")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (staffRecord) {
        // Nullify foreign key references pointing to this staff record
        await supabaseAdmin.from("classes").update({ class_teacher_id: null }).eq("class_teacher_id", staffRecord.id);
        await supabaseAdmin.from("class_subjects").update({ teacher_id: null }).eq("teacher_id", staffRecord.id);
        await supabaseAdmin.from("timetable_entries").update({ teacher_id: null }).eq("teacher_id", staffRecord.id);
        await supabaseAdmin.from("hostels").update({ housemaster_id: null }).eq("housemaster_id", staffRecord.id);
        await supabaseAdmin.from("hostels").update({ assistant_housemaster_id: null }).eq("assistant_housemaster_id", staffRecord.id);
        // Delete owned records
        await supabaseAdmin.from("contracts").delete().eq("staff_id", staffRecord.id);
        await supabaseAdmin.from("leave_requests").delete().eq("staff_id", staffRecord.id);
        // Now delete the staff record itself
        await supabaseAdmin.from("staff").delete().eq("id", staffRecord.id);
      }

      // Get student record for this user (needed to clean up FK references)
      const { data: studentRecord } = await supabaseAdmin
        .from("students")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (studentRecord) {
        // Use the cascade delete RPC
        await supabaseAdmin.rpc("delete_student_cascade", { _student_id: studentRecord.id });
      }

      // Delete related data referencing user_id directly
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      await supabaseAdmin.from("personal_timetables").delete().eq("user_id", user_id);
      await supabaseAdmin.from("notifications").delete().eq("user_id", user_id);
      // Remove teacher-owned academic records that FK to auth.users
      await supabaseAdmin.from("homework").delete().eq("teacher_id", user_id);
      await supabaseAdmin.from("marks").delete().eq("teacher_id", user_id);
      // Clean up messaging
      await supabaseAdmin.from("conversation_participants").delete().eq("user_id", user_id);
      // Nullify author references
      await supabaseAdmin.from("announcements").update({ author_id: null }).eq("author_id", user_id);
      // Clean up parent links
      await supabaseAdmin.from("parent_students").delete().eq("parent_id", user_id);

      // Delete auth user (cascades to profiles via trigger)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (error) throw error;
      return new Response(JSON.stringify({ message: "User deleted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== UPDATE USER ====================
    if (action === "update-user") {
      const { user_id, portal_role, staff_role, department, full_name, assigned_class_id,
        phone, email: staffEmail, address, emergency_contact, qualifications, bio, title,
        subjects_taught, national_id, nssa_number, paye_number, bank_details, employment_date } = payload;
      const effectivePortalRole = resolvePortalRole(portal_role, staff_role);
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update portal role if provided
      if (effectivePortalRole) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
        await supabaseAdmin.from("user_roles").insert({ user_id, role: effectivePortalRole });
      }

      // Update Auth email if provided
      const newAuthEmail = payload.new_email;
      if (newAuthEmail) {
        const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          email: newAuthEmail,
          email_confirm: true,
        });
        if (emailError) throw emailError;
        // Also update profile email
        await supabaseAdmin.from("profiles").update({ email: newAuthEmail }).eq("user_id", user_id);
      }

      // Update profile name if provided
      if (full_name) {
        await supabaseAdmin.from("profiles").update({ full_name }).eq("user_id", user_id);
        // Also update auth user metadata
        await supabaseAdmin.auth.admin.updateUserById(user_id, {
          user_metadata: { full_name },
        });
      }

      // Update staff record if staff_role or departmentuser_ provided
      if (staff_role || department !== undefined || phone !== undefined || staffEmail !== undefined ||
          address !== undefined || emergency_contact !== undefined || qualifications !== undefined ||
          bio !== undefined || title !== undefined || subjects_taught !== undefined ||
          national_id !== undefined || nssa_number !== undefined || paye_number !== undefined ||
          bank_details !== undefined || employment_date !== undefined) {
        const { data: existingStaff } = await supabaseAdmin.from("staff").select("id").eq("user_id", user_id).maybeSingle();
        
        if (existingStaff) {
          const updates: Record<string, unknown> = {};
          if (staff_role) {
            updates.role = staff_role;
            let staffCategory = "teaching";
            if (["principal", "deputy_principal"].includes(staff_role)) staffCategory = "leadership";
            else if (["bursar", "secretary"].includes(staff_role)) staffCategory = "administrative";
            else if (["groundsman", "matron"].includes(staff_role)) staffCategory = "general";
            updates.category = staffCategory;
          }
          if (department !== undefined) updates.department = department || null;
          if (full_name) updates.full_name = full_name;
          if (phone !== undefined) updates.phone = phone || null;
          if (staffEmail !== undefined) updates.email = staffEmail || null;
          if (address !== undefined) updates.address = address || null;
          if (emergency_contact !== undefined) updates.emergency_contact = emergency_contact || null;
          if (qualifications !== undefined) updates.qualifications = qualifications || null;
          if (bio !== undefined) updates.bio = bio || null;
          if (title !== undefined) updates.title = title || null;
          if (subjects_taught !== undefined) updates.subjects_taught = subjects_taught;
          if (national_id !== undefined) updates.national_id = national_id || null;
          if (nssa_number !== undefined) updates.nssa_number = nssa_number || null;
          if (paye_number !== undefined) updates.paye_number = paye_number || null;
          if (bank_details !== undefined) updates.bank_details = bank_details || null;
          if (employment_date !== undefined) updates.employment_date = employment_date || null;
          const updatesHr = takeStaffPrivate(updates);
          await supabaseAdmin.from("staff").update(updates).eq("user_id", user_id);
          await saveStaffPrivate(supabaseAdmin, existingStaff.id, updatesHr);

          // Update class teacher assignment
          if (assigned_class_id !== undefined) {
            await supabaseAdmin.from("classes").update({ class_teacher_id: null }).eq("class_teacher_id", existingStaff.id);
            if (assigned_class_id) {
              await supabaseAdmin.from("classes").update({ class_teacher_id: existingStaff.id }).eq("id", assigned_class_id);
            }
          }
        } else if (portal_role === "teacher" || portal_role === "admin") {
          const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, email").eq("user_id", user_id).maybeSingle();
          let staffCategory = "teaching";
          if (["principal", "deputy_principal"].includes(staff_role || "")) staffCategory = "leadership";
          else if (["bursar", "secretary"].includes(staff_role || "")) staffCategory = "administrative";
          else if (["groundsman", "matron"].includes(staff_role || "")) staffCategory = "general";
          const newStaffRow: Record<string, unknown> = {
            full_name: full_name || profile?.full_name || "",
            email: staffEmail || profile?.email || "",
            user_id,
            role: staff_role || "teacher",
            category: staffCategory,
            department: department || null,
            phone: phone || null,
            address: address || null,
            emergency_contact: emergency_contact || null,
            qualifications: qualifications || null,
            bio: bio || null,
            title: title || null,
            subjects_taught: subjects_taught || null,
            national_id: national_id || null,
            nssa_number: nssa_number || null,
            paye_number: paye_number || null,
            bank_details: bank_details || null,
            employment_date: employment_date || null,
          };
          const newStaffHr = takeStaffPrivate(newStaffRow);
          const { data: newStaff } = await supabaseAdmin.from("staff").insert(newStaffRow).select("id").single();
          await saveStaffPrivate(supabaseAdmin, newStaff?.id, newStaffHr);

          if (assigned_class_id && newStaff) {
            await supabaseAdmin.from("classes").update({ class_teacher_id: newStaff.id }).eq("id", assigned_class_id);
          }
        }
      }

      return new Response(JSON.stringify({ message: "User updated successfully" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== REGISTER PARENT (public, post-signup) ====================
    if (action === "register-parent") {
      const { user_id, phone, children } = payload;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user exists
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Invalid user" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update phone on profile (profiles.id = auth user id)
      if (phone) {
        await supabaseAdmin.from("profiles").update({ phone }).eq("id", user_id);
      }

      // Assign parent role (ignore if already exists)
      await supabaseAdmin.from("user_roles").upsert(
        { user_id, role: "parent" },
        { onConflict: "user_id,role" }
      );

      // Link children by admission number. A child is linked only when this account's
      // email matches the guardian email on the student's record; otherwise anyone could
      // claim any child and see their records. The school office links other cases.
      const parentEmail = (userData.user.email ?? "").trim().toLowerCase();
      const linkResults: string[] = [];
      if (children && Array.isArray(children)) {
        for (const child of children) {
          if (!child.admissionNumber) continue;
          try {
            const { data: student } = await supabaseAdmin
              .from("students")
              .select("id, full_name, form, guardian_email")
              .eq("admission_number", child.admissionNumber.trim())
              .eq("status", "active")
              .maybeSingle();

            const guardianEmail = (student?.guardian_email ?? "").trim().toLowerCase();
            if (!student || !parentEmail || guardianEmail !== parentEmail) {
              linkResults.push(`${child.admissionNumber}: not linked. The school must confirm you as this student's guardian`);
              continue;
            }

            const { data: existing } = await supabaseAdmin
              .from("parent_students")
              .select("id")
              .eq("parent_id", user_id)
              .eq("student_id", student.id)
              .maybeSingle();

            if (existing) { linkResults.push(`${student.full_name} already linked`); continue; }

            await supabaseAdmin.from("parent_students").insert({ parent_id: user_id, student_id: student.id });

            linkResults.push(student.full_name);
          } catch {
            linkResults.push(`Failed to link ${child.admissionNumber}`);
          }
        }
      }

      return new Response(JSON.stringify({ message: "Parent registered", linkResults }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== LEGACY: register-student ====================
    if (action === "register-student") {
      const { email, password, full_name, grade, class_name, phone } = payload;
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      });
      if (createError) throw createError;
      await supabaseAdmin.from("profiles").update({ grade, class_name, phone }).eq("id", newUser.user.id);
      await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role: "student" });
      return new Response(JSON.stringify({ message: "Student registered", user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== LEGACY: register-teacher ====================
    if (action === "register-teacher") {
      const { email, password, full_name, department, phone } = payload;
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      });
      if (createError) throw createError;
      await supabaseAdmin.from("profiles").update({ phone }).eq("id", newUser.user.id);
      await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role: "teacher" });
      await supabaseAdmin.from("staff").insert({ full_name, email, phone, department, user_id: newUser.user.id });
      return new Response(JSON.stringify({ message: "Teacher registered", user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== PROVISION STUDENT ====================
    if (action === "provision-student") {
      console.log("[provision-student] called", payload);
      const { student_id, full_name, admission_number, guardian_email } = payload;
      if (!student_id || !full_name || !admission_number) {
        return new Response(JSON.stringify({ error: "student_id, full_name, and admission_number are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if student already has a user_id
      const { data: existingStudent } = await supabaseAdmin
        .from("students")
        .select("user_id, email")
        .eq("id", student_id)
        .single();
      if (existingStudent?.user_id) {
        return new Response(JSON.stringify({ error: "Student already has an account" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Canonical school email (always derived from admission number)
      const studentEmail = `${admission_number.toLowerCase()}@mbsmavingtech.ac.zw`;
      const tempPassword = `${admission_number}@Mbs2026`;

      // List auth users once and reuse for both student + parent dedupe
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const findUserByEmail = (email?: string | null) =>
        email ? existingUsers?.users?.find((u) => (u.email || "").toLowerCase() === email.toLowerCase()) : undefined;

      // Safeguard: another student row already owns this canonical email -> refuse
      const { data: clashingStudent } = await supabaseAdmin
        .from("students")
        .select("id, admission_number")
        .eq("email", studentEmail)
        .neq("id", student_id)
        .maybeSingle();
      if (clashingStudent) {
        return new Response(JSON.stringify({
          error: `Email ${studentEmail} is already used by student ${clashingStudent.admission_number}`,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Idempotency: if an auth user with this email already exists, reuse it
      // (covers retries, partial failures, or a prior bulk import).
      let userId: string;
      const existingStudentAuth = findUserByEmail(studentEmail);
      if (existingStudentAuth) {
        userId = existingStudentAuth.id;
        console.log("[provision-student] reusing existing auth user for", studentEmail);
      } else {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: studentEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name, must_change_password: true },
          app_metadata: { must_change_password: true },
        });
        if (createError) throw createError;
        userId = newUser.user.id;
      }

      // Refuse if this auth user is already attached to a different student record
      const { data: otherStudent } = await supabaseAdmin
        .from("students")
        .select("id")
        .eq("user_id", userId)
        .neq("id", student_id)
        .maybeSingle();
      if (otherStudent) {
        return new Response(JSON.stringify({
          error: "This auth account is already linked to another student record",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Assign student role (idempotent)
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: "student" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

      // Link student record to auth user
      await supabaseAdmin.from("students").update({ user_id: userId, email: studentEmail }).eq("id", student_id);

      // Ensure profile row exists so student appears in admin Users list
      await supabaseAdmin.from("profiles").upsert({
        id: userId,
        user_id: userId,
        full_name,
        email: studentEmail,
        role: "student",
      }, { onConflict: "id" });

      // ===== Auto-provision PARENT portal account when guardian_email provided =====
      let parentInfo: {
        email: string;
        temp_password: string | null;
        existed: boolean;
        user_id: string;
      } | null = null;

      const isValidEmail = (e?: string | null) => !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

      // Guard: never reuse the student's own school email as a parent account
      const guardianEmailNormalized = (guardian_email || "").toLowerCase().trim();
      const guardianIsStudentEmail = guardianEmailNormalized === studentEmail.toLowerCase();

      if (isValidEmail(guardian_email) && !guardianIsStudentEmail) {
        try {
          // Fetch additional guardian info from the student record
          const { data: studentRecord } = await supabaseAdmin
            .from("students")
            .select("guardian_name, guardian_phone")
            .eq("id", student_id)
            .single();

          const guardianName = studentRecord?.guardian_name || `Guardian of ${full_name}`;
          const guardianPhone = studentRecord?.guardian_phone || null;

          // Check if an auth user already exists with the guardian email
          const existingParentUser = existingUsers?.users?.find((u) => u.email === guardian_email);

          let parentUserId: string;
          let parentTempPassword: string | null = null;
          let existed = false;

          if (existingParentUser) {
            parentUserId = existingParentUser.id;
            existed = true;
          } else {
            parentTempPassword = `Parent@${admission_number}`;
            const { data: parentUser, error: parentCreateErr } =
              await supabaseAdmin.auth.admin.createUser({
                email: guardian_email,
                password: parentTempPassword,
                email_confirm: true,
                user_metadata: { full_name: guardianName, must_change_password: true },
                app_metadata: { must_change_password: true },
              });
            if (parentCreateErr) throw parentCreateErr;
            parentUserId = parentUser.user.id;
          }

          // Ensure parent role
          await supabaseAdmin
            .from("user_roles")
            .upsert(
              { user_id: parentUserId, role: "parent" },
              { onConflict: "user_id,role", ignoreDuplicates: true },
            );

          // Ensure profile row
          await supabaseAdmin.from("profiles").upsert(
            {
              id: parentUserId,
              user_id: parentUserId,
              full_name: guardianName,
              email: guardian_email,
              phone: guardianPhone,
              role: "parent",
            },
            { onConflict: "id" },
          );

          // Link parent to student
          await supabaseAdmin
            .from("parent_students")
            .upsert(
              { parent_id: parentUserId, student_id, relationship: "parent" },
              { onConflict: "parent_id,student_id", ignoreDuplicates: true },
            );

          parentInfo = {
            email: guardian_email,
            temp_password: parentTempPassword,
            existed,
            user_id: parentUserId,
          };
        } catch (parentErr) {
          console.error("[provision-student] parent provisioning failed", parentErr);
        }
      }

      return new Response(JSON.stringify({
        message: "Student account provisioned",
        user_id: userId,
        email: studentEmail,
        temp_password: tempPassword,
        parent: parentInfo,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== PROVISION STAFF ====================
    if (action === "provision-staff") {
      const { staff_id, full_name, email: staffEmail, role: staffRole } = payload;
      if (!staff_id || !full_name) {
        return new Response(JSON.stringify({ error: "staff_id and full_name are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if staff already has a user_id
      const { data: existingStaff } = await supabaseAdmin
        .from("staff")
        .select("user_id, staff_number, email")
        .eq("id", staff_id)
        .single();
      if (existingStaff?.user_id) {
        return new Response(JSON.stringify({ error: "Staff member already has an account" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate email: use staff email if available, otherwise generate from name
      const useEmail = staffEmail || existingStaff?.email;
      let generatedEmail: string;
      if (useEmail) {
        generatedEmail = useEmail;
      } else {
        const nameParts = full_name.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/);
        generatedEmail = `${nameParts.join(".")}@mbsmavingtech.ac.zw`;
      }

      // Generate temporary password
      const staffNum = existingStaff?.staff_number || "Staff";
      const tempPassword = `${staffNum}@Ghs2026`;

      // Check if email already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const emailExists = existingUsers?.users?.some((u) => u.email === generatedEmail);
      if (emailExists) {
        return new Response(JSON.stringify({ error: `Email ${generatedEmail} already in use` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create auth user with must_change_password flag
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: generatedEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name, must_change_password: true },
        app_metadata: { must_change_password: true },
      });
      if (createError) throw createError;

      const userId = newUser.user.id;

      // Determine portal role based on staff role
      let portalRole = "teacher";
      if (["principal"].includes(staffRole || "")) portalRole = "principal";
      else if (["deputy_principal"].includes(staffRole || "")) portalRole = "deputy_principal";
      else if (["hod"].includes(staffRole || "")) portalRole = "hod";
      else if (["bursar"].includes(staffRole || "")) portalRole = "bursar";
      else if (["finance_clerk"].includes(staffRole || "")) portalRole = "finance_clerk";

      // Assign portal role
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: portalRole });

      // Link staff record to auth user
      await supabaseAdmin.from("staff").update({ user_id: userId }).eq("id", staff_id);

      // Ensure profile row exists so staff appears in admin Users list
      await supabaseAdmin.from("profiles").upsert({
        id: userId,
        user_id: userId,
        full_name,
        email: generatedEmail,
        role: portalRole,
      }, { onConflict: "id" });

      return new Response(JSON.stringify({
        message: "Staff account provisioned",
        user_id: userId,
        email: generatedEmail,
        temp_password: tempPassword,
        portal_role: portalRole,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== LEGACY: get-students ====================
    if (action === "get-students") {
      const { data: studentRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "student");
      if (!studentRoles || studentRoles.length === 0) {
        return new Response(JSON.stringify({ students: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const studentIds = studentRoles.map((r) => r.user_id);
      const { data: profiles } = await supabaseAdmin.from("profiles").select("*").in("id", studentIds);
      return new Response(JSON.stringify({ students: profiles || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
