import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { demoPasswordFor, generatePassword } from "@/lib/passwords";
import { DEMO_PASSWORDS } from "@/lib/demoAccounts";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) } },
}));
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import PasswordManagement from "@/components/admin/PasswordManagement";

describe("password helpers", () => {
  it("shows the published password for demo accounts only", () => {
    expect(demoPasswordFor("tendai.moyo123@student.schooldemo.com", "student")).toBe(DEMO_PASSWORDS.student);
    expect(demoPasswordFor("mother@parent.schooldemo.com", "parent")).toBe(DEMO_PASSWORDS.parent);
    expect(demoPasswordFor("admin@schooldemo.com", "admin")).toBe(DEMO_PASSWORDS.admin);
    expect(demoPasswordFor("francis.moyo@mavingtech.com", "admin")).toBeNull();
    expect(demoPasswordFor("x@schooldemo.com.evil.com", "student")).toBeNull();
  });

  it("generates strong 12-character passwords", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(12);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[!@#$%&*?]/);
      seen.add(p);
    }
    expect(seen.size).toBe(50);
  });
});

describe("Password Management screen", () => {
  const users = [
    { id: "1", email: "admin@schooldemo.com", full_name: "Demo Administrator", portal_role: "admin", last_sign_in_at: null },
    { id: "2", email: "francis.moyo@mavingtech.com", full_name: "Francis Moyo", portal_role: "admin", last_sign_in_at: "2026-09-24T10:00:00Z" },
  ];
  const calls: Record<string, unknown>[] = [];

  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push(body);
      const data = body.action === "list-users" ? { users } : { message: "ok", must_change_password: body.force_change, password_reset_at: "2026-09-24T12:00:00Z" };
      return new Response(JSON.stringify(data), { status: 200 });
    }));
  });

  it("reveals demo passwords, keeps real ones private, and shows a new password once after a reset", async () => {
    render(<PasswordManagement />);
    await screen.findByText("Francis Moyo");

    expect(screen.getByText("Private")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByText(DEMO_PASSWORDS.admin)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /reset password/i })[1]);
    const input = screen.getByLabelText("New Password") as HTMLInputElement;
    expect(input.value).toHaveLength(12); // a strong password is suggested
    fireEvent.change(input, { target: { value: "Kariba#Sunset42" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));

    await waitFor(() => expect(screen.getByText("New password set")).toBeInTheDocument());
    expect(screen.getByText("Kariba#Sunset42")).toBeInTheDocument();
    expect(calls.at(-1)).toMatchObject({ action: "reset-password", user_id: "2", password: "Kariba#Sunset42", force_change: true });
    expect(screen.getByRole("link", { name: /whatsapp/i }).getAttribute("href")).toContain(encodeURIComponent("Kariba#Sunset42"));
  });
});
