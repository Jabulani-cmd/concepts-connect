import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Eye, EyeOff } from "lucide-react";
import schoolLogo from "@/assets/mavingtech-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";
import { DEMO_EMAIL_DOMAIN, DEMO_PASSWORDS } from "@/lib/demoAccounts";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signIn, role, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSeedDemoAdmin = async () => {
    setSeedingDemo(true);
    try {
      const { error } = await supabase.functions.invoke("seed-demo-accounts", { body: {} });
      if (error) throw error;
      setEmail(`admin@${DEMO_EMAIL_DOMAIN}`);
      setPassword(DEMO_PASSWORDS.admin);
      toast({ title: "Demo admin ready", description: "Credentials pre-filled. Click Sign In." });
    } catch (e) {
      toast({ title: "Could not provision demo admin", description: errorMessage(e, "Unknown error"), variant: "destructive" });
    } finally {
      setSeedingDemo(false);
    }
  };

  const [justLoggedIn, setJustLoggedIn] = useState(false);

  const redirectByRole = useCallback((r: string) => {
    if (r === "student") navigate("/portal/student");
    else if (r === "teacher") navigate("/portal/teacher");
    else if (r === "parent") navigate("/portal/parent-teacher");
    else if (r === "admin") navigate("/portal/admin");
    else if (r === "finance") navigate("/portal/finance");
    else if (r === "finance_clerk") navigate("/portal/finance");
    else if (r === "bursar") navigate("/portal/finance");
    else if (r === "principal") navigate("/portal/principal");
    else if (r === "deputy_principal") navigate("/portal/deputy-principal");
    else if (r === "hod") navigate("/portal/hod");
    else if (r === "admin_supervisor") navigate("/portal/admin-supervisor");
    else if (r === "registration") navigate("/portal/registration");
  }, [navigate]);

  useEffect(() => {
    if (!authLoading && user && role && justLoggedIn) {
      if (user.user_metadata?.must_change_password || user.app_metadata?.must_change_password) {
        navigate("/change-password");
        return;
      }
      toast({ title: t("login.loginSuccess") });
      redirectByRole(role);
    }
  }, [authLoading, user, role, justLoggedIn, toast, t, redirectByRole, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setJustLoggedIn(false);
    try {
      const { error } = await signIn(email, password);
      if (error) toast({ title: t("login.loginFailed"), description: error.message, variant: "destructive" });
      else setJustLoggedIn(true);
    } catch (err) {
      toast({ title: t("login.loginFailed"), description: errorMessage(err, "An unexpected error occurred"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <section className="flex min-h-[70vh] items-center justify-center bg-section-warm py-16">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md px-4">
          <Card className="shadow-maroon">
            <CardHeader className="text-center">
              <img src={schoolLogo} alt="MavingTech High School" className="mx-auto mb-2 h-auto w-52 object-contain sm:w-72" />
              <CardTitle className="font-heading text-2xl text-primary">{t("login.title")}</CardTitle>
              <p className="text-xs italic text-muted-foreground">{t("login.tagline")}</p>
              <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.emailLabel")}</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("login.emailPlaceholder")} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.passwordLabel")}</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? t("login.signingIn") : t("login.signIn")}
                </Button>

                <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-2">{t("login.demoNote")}</p>
                  <Button type="button" variant="outline" size="sm" onClick={handleSeedDemoAdmin} disabled={seedingDemo} className="h-auto w-full whitespace-normal py-2 leading-snug">
                    {seedingDemo ? t("login.provisioning") : t("login.provisionAdmin")}
                  </Button>
                </div>

                <div className="text-center space-y-1">
                  <Link to="/forgot-password" className="text-sm text-primary font-medium hover:underline">{t("login.forgot")}</Link>
                  <p className="text-sm text-muted-foreground">
                    {t("login.parentPrompt")}{" "}
                    <Link to="/register" className="text-primary font-medium hover:underline">{t("login.registerHere")}</Link>
                  </p>
                  <p className="text-xs text-muted-foreground">{t("login.studentTeacherNote")}</p>
                  <Link to="/">
                    <Button variant="outline" size="sm" className="mt-2 gap-2">
                      <Home className="h-4 w-4" /> {t("login.backHome")}
                    </Button>
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
