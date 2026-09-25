import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import schoolLogo from "@/assets/concepts-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setSent(true);
      }
    } catch (err) {
      toast({ title: "Error", description: errorMessage(err, "An unexpected error occurred"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Layout>
        <section className="flex min-h-[70vh] items-center justify-center bg-section-warm py-16">
          <Card className="w-full max-w-md mx-4 shadow-maroon">
            <CardContent className="pt-6 text-center space-y-4">
              <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
              <h2 className="font-heading text-xl text-primary">Check Your Email</h2>
              <p className="text-sm text-muted-foreground">
                If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
              </p>
              <Link to="/login">
                <Button variant="outline" className="mt-4 gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Login
                </Button>
              </Link>
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
              <img src={schoolLogo} alt="Concepts Learning Academy" className="mx-auto mb-2 h-auto w-24 object-contain sm:w-28" />
              <CardTitle className="font-heading text-2xl text-primary">Forgot Password</CardTitle>
              <p className="text-sm text-muted-foreground">Enter your email to receive a reset link</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mavingtech.com" required />
                    <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Sending…" : "Send Reset Link"}
                </Button>
                <div className="text-center">
                  <Link to="/login" className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" /> Back to Login
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </section>
    </Layout>
  );
}
