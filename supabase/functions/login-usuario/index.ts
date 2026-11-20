
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const respostaInvalida = () =>
  Response.json(
    { error: "Usuário ou senha inválidos." },
    { status: 401 }
  );

export default {
  fetch: withSupabase(
    { auth: "publishable" },
    async (req, ctx) => {
      if (req.method !== "POST") {
        return Response.json(
          { error: "Método não permitido." },
          { status: 405 }
        );
      }

      let body;

      try {
        body = await req.json();
      } catch {
        return respostaInvalida();
      }

      const username = String(body.username ?? "")
        .trim()
        .toLowerCase();

      const password = String(body.password ?? "");

      if (
        !/^[a-z0-9._-]{3,40}$/.test(username) ||
        password.length < 8 ||
        password.length > 128
      ) {
        return respostaInvalida();
      }

      const { data: profile, error: profileError } =
        await ctx.supabaseAdmin
          .from("profiles")
          .select("id, username, display_name, full_name, login_email, active")
          .eq("username", username)
          .maybeSingle();

      if (profileError) {
        console.error("Erro ao consultar perfil:", profileError);
        return Response.json({ error: "Erro interno." }, { status: 500 });
      }

      if (!profile || !profile.active || !profile.login_email) {
        return respostaInvalida();
      }

      const { data: memberships, error: memberError } =
        await ctx.supabaseAdmin
          .from("org_members")
          .select("id, org_id, role, permissions, team_member_id")
          .eq("user_id", profile.id)
          .eq("active", true)
          .limit(1);

      if (memberError) {
        console.error("Erro ao consultar acesso:", memberError);
        return Response.json({ error: "Erro interno." }, { status: 500 });
      }

      const membership = memberships?.[0];

      if (!membership) {
        return respostaInvalida();
      }

      const { data, error } =
        await ctx.supabase.auth.signInWithPassword({
          email: profile.login_email,
          password
        });

      if (error || !data.session) {
        return respostaInvalida();
      }

      return Response.json({
        session: data.session,
        username,
        profile: {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          full_name: profile.full_name
        },
        membership: {
          id: membership.id,
          org_id: membership.org_id,
          role: membership.role,
          permissions: membership.permissions || [],
          team_member_id: membership.team_member_id
        }
      });
    }
  )
};
