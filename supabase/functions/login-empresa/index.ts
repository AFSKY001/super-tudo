import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const invalid = () =>
  Response.json({ error: "Empresa, usuário ou senha inválidos." }, { status: 401 });

export default {
  fetch: withSupabase(
    { auth: "publishable" },
    async (req, ctx) => {
      if (req.method !== "POST") {
        return Response.json({ error: "Método não permitido." }, { status: 405 });
      }

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return invalid();
      }

      const slug = String(body.company ?? "").trim().toLowerCase();
      const username = String(body.username ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");

      if (
        !/^[a-z0-9-]{2,80}$/.test(slug) ||
        !/^[a-z0-9._-]{3,40}$/.test(username) ||
        password.length < 8 ||
        password.length > 128
      ) {
        return invalid();
      }

      const { data: org, error: orgError } = await ctx.supabaseAdmin
        .from("organizations")
        .select("id, slug, status")
        .eq("slug", slug)
        .maybeSingle();

      if (orgError) {
        console.error("Falha ao consultar empresa:", orgError);
        return Response.json({ error: "Erro interno." }, { status: 500 });
      }
      if (!org) return invalid();

      const { data: membership, error: memberError } = await ctx.supabaseAdmin
        .from("org_members")
        .select("id, org_id, user_id, role, permissions, team_member_id")
        .eq("org_id", org.id)
        .eq("username", username)
        .eq("active", true)
        .maybeSingle();

      if (memberError) {
        console.error("Falha ao consultar vínculo:", memberError);
        return Response.json({ error: "Erro interno." }, { status: 500 });
      }
      if (!membership) return invalid();

      const { data: platformAdmin, error: platformAdminError } = await ctx.supabaseAdmin
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", membership.user_id)
        .eq("active", true)
        .maybeSingle();

      if (platformAdminError) {
        console.error("Falha ao validar administrador Master:", platformAdminError);
        return Response.json({ error: "Erro interno." }, { status: 500 });
      }

      const isPlatformAdmin = !!platformAdmin;
      if (!isPlatformAdmin && !["active", "trial"].includes(org.status)) {
        return invalid();
      }

      const { data: activeMemberships, error: activeError } = await ctx.supabaseAdmin
        .from("org_members")
        .select("org_id")
        .eq("user_id", membership.user_id)
        .eq("active", true);

      if (activeError) {
        console.error("Falha ao validar vínculos ativos:", activeError);
        return Response.json({ error: "Erro interno." }, { status: 500 });
      }

      if (
        !isPlatformAdmin &&
        (!activeMemberships ||
          activeMemberships.length !== 1 ||
          activeMemberships[0].org_id !== org.id)
      ) {
        return Response.json(
          { error: "Esta conta possui vínculos em mais de uma empresa sem autorização Master." },
          { status: 409 }
        );
      }

      const { data: profile, error: profileError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id, username, display_name, full_name, login_email, active")
        .eq("id", membership.user_id)
        .maybeSingle();

      if (profileError) {
        console.error("Falha ao consultar perfil:", profileError);
        return Response.json({ error: "Erro interno." }, { status: 500 });
      }
      if (!profile || !profile.active || !profile.login_email) return invalid();

      const { data, error } = await ctx.supabase.auth.signInWithPassword({
        email: profile.login_email,
        password
      });
      if (error || !data.session) return invalid();

      return Response.json({
        session: data.session,
        company: { slug: org.slug },
        username,
        platform_admin: isPlatformAdmin,
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
