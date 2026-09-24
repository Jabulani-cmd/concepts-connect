import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, UserPlus, Plus, X } from "lucide-react";
import schoolLogo from "@/assets/mavingtech-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";

interface ChildEntry {
  admissionNumber: string;
}

export default function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [children, setChildren] = useState<ChildEntry[]>([]);

  const addChild = () => {
    setChildren((prev) => [...prev, { admissionNumber: "" }]);
  };

  const removeChild = (index: number) => {
    setChildren((prev) => prev.filter((_, i) => i !== index));
  };

  const updateChild = (index: number, field: keyof ChildEntry, value: string) => {
    setChildren((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await signUp(email, password, fullName);
      
      if (error) {
        // Handle specific Supabase auth errors
        if (error.message?.includes("already registered") || error.message?.includes("already been registered")) {
          throw new Error("An account with this email already exists. Please sign in on the Login page instead.");
        }
        throw error;
      }

      const userId = data?.user?.id;
      if (!userId) throw new Error("Registration failed. Please try again.");

      // Detect repeated signup (Supabase returns fake user with empty identities)
      const identities = data?.user?.identities;
      if (!identities || identities.length === 0) {
        throw new Error("An account with this email already exists. Please sign in on the Login page instead, or check your inbox for a confirmation email if you registered recently.");
      }

      // Use edge function to assign role + link children (service role, no session needed)
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: "register-parent",
            user_id: userId,
            phone,
            children: children.filter(c => c.admissionNumber),
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      const linkResults: string[] = result.linkResults || [];

      // Sign out so the stale session (with no role) is cleared,
      // then redirect to login for a clean sign-in that will pick up the role.
      await supabase.auth.signOut();

      const description = linkResults.length > 0
        ? `Linked: ${linkResults.join(", ")}. Please sign in.`
        : "Please sign in with your new account.";

      toast({ title: "Registration successful!", description });
      navigate("/login");
    } catch (err) {
      toast({ title: "Registration failed", description: errorMessage(err), variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <Layout>
      <section className="flex min-h-[70vh] items-center justify-center bg-section-warm py-16">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg px-4">
          <Card className="shadow-maroon">
            <CardHeader className="text-center">
              <img src={schoolLogo} alt="MavingTech High School" className="mx-auto mb-2 h-[9rem] w-[9rem] object-contain" />
              <CardTitle className="font-heading text-2xl text-primary">Parent Registration</CardTitle>
              <p className="text-xs italic text-muted-foreground">Empowering Your Business Through Technology</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+263 7X XXX XXXX" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                    <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
                </div>

                {/* Link Children by Admission Number */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Link Your Children (Optional)</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addChild}>
                      <Plus className="mr-1 h-3 w-3" /> Add Child
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter the admission number provided by the school for each child.
                  </p>
                  {children.map((child, index) => (
                    <div key={index} className="flex items-start gap-2 rounded-md border p-3">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Admission Number"
                          value={child.admissionNumber}
                          onChange={(e) => updateChild(index, "admissionNumber", e.target.value)}
                        />
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeChild(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {children.length > 0 && (
                    <p className="text-xs text-primary font-medium">{children.length} child(ren) to link</p>
                  )}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {loading ? "Registering..." : "Register"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <a href="/login" className="text-primary hover:underline">Sign in</a>
                </p>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </section>
    </Layout>
  );
}
