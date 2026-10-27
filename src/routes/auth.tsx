import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — MarketPreço" },
      { name: "description", content: "Entre ou crie sua conta no MarketPreço." },
      { property: "og:title", content: "Entrar — MarketPreço" },
      { property: "og:description", content: "Entre ou crie sua conta no MarketPreço." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/inicio", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error("E-mail ou senha inválidos."); return; }
    navigate({ to: "/inicio", replace: true });
    return;
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("A senha precisa ter ao menos 8 caracteres."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/inicio", data: { display_name: name } },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    return;
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error("Não foi possível entrar com Google."); return; }
    if (r.redirected) return;
    navigate({ to: "/inicio", replace: true });
    return;
  }

  return (
    <div className="min-h-screen bg-hero px-4 py-10">
      <div className="mx-auto max-w-sm">
        <h1 className="text-center text-3xl font-extrabold text-primary-foreground">MarketPreço</h1>
        <p className="mt-1 text-center text-sm text-primary-foreground/80">Preços reais, registrados por quem compra.</p>
        <div className="mt-8 rounded-2xl bg-card p-5 shadow-card">
          {sent ? (
            <div className="text-center">
              <h2 className="text-lg font-semibold">Confirme seu e-mail</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Enviamos um link para <strong>{email}</strong>. Depois de confirmar, volte e entre.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => setSent(false)}>Voltar</Button>
            </div>
          ) : (
            <Tabs defaultValue="entrar">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="entrar">Entrar</TabsTrigger>
                <TabsTrigger value="criar">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="entrar">
                <form onSubmit={signIn} className="mt-4 space-y-3">
                  <Field label="E-mail"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
                  <Field label="Senha"><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
                  <Button type="submit" className="w-full" disabled={busy}>Entrar</Button>
                </form>
              </TabsContent>
              <TabsContent value="criar">
                <form onSubmit={signUp} className="mt-4 space-y-3">
                  <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
                  <Field label="E-mail"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
                  <Field label="Senha (mín. 8)"><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field>
                  <Button type="submit" className="w-full" disabled={busy}>Criar conta</Button>
                </form>
              </TabsContent>
              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
              <Button variant="outline" className="w-full" onClick={google}>Continuar com Google</Button>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
