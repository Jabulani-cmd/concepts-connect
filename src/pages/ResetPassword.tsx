import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, CheckCircle } from "lucide-react";
import schoolLogo from "@/assets/concepts-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({ title: "Failed to reset password", description: error.message, variant: "destructive" });
      } else {
        setSuccess(true);
        toast({ title: "Password updated successfully" });
        setTimeout(() => navigate("/login"), 3000);
      }
    } catch (err) {
      toast({ title: "Error", description: errorMessage(err, "An unexpected error occurred"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <Layout>
        <section className="flex min-h-[70vh] items-center justify-center bg-section-warm py-16">
          <Card className="w-full max-w-md mx-4 shadow-maroon">
            <CardContent className="pt-6 text-center space-y-4">
              <p className="text-muted-foreground">Invalid or expired password reset link.</p>
              <Button onClick={() => navigate("/login")} variant="outline">Back to Login</Button>
            </CardContent>
          </Card>
        </section>
      </Layout>
    );
  }

  if (success) {
    return (
      <Layout>
        <section className="flex min-h-[70vh] items-center justify-center bg-section-warm py-16">
          <Card className="w-full max-w-md mx-4 shadow-maroon">
            <CardContent className="pt-6 text-center space-y-4">
              <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
              <h2 className="font-heading text-xl text-primary">Password Updated!</h2>
              <p className="text-sm text-muted-foreground">Redirecting you to login…</p>
            </CardContent>
          </Card>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="flex min-h-[70vh] items-center justify-center bg-section-warm py-16">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md px-4">
          <Card className="shadow-maroon">
            <CardHeader className="text-center">
              <img src={schoolLogo} alt="MavingTech High School" className="mx-auto mb-2 h-auto w-24 object-contain sm:w-28" />
              <CardTitle className="font-heading text-2xl text-primary">Set New Password</CardTitle>
              <p className="text-sm text-muted-foreground">Enter your new password below</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                    <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Updating…" : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </section>
    </Layout>
  );
}
