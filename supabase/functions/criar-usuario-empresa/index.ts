import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};

const respond = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors });

const fail = (message: string, status = 400) => respond({ error: message }, status);

const validUsername = (value: unknown) =>
  /^[a-z0-9._-]{3,40}$/.test(String(value ?? "").trim().toLowerCase());

const validPermissions = (value: unknown) =>
  Array.isArray(value) &&
  value.length <= 200 &&
  value.every((item) => typeof item === "string" && item.length <= 100);

const validSlug = (value: unknown) =>
  /^[a-z0-9-]{2,80}$/.test(String(value ?? "").trim().toLowerCase());

export default {
  fetch: withSupabase(
    { auth: "user" },
    async (req, ctx) => {
      if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
      if (req.method !== "POST") return fail("Método não permitido.", 405);
      if (!ctx.userClaims?.id) return fail("Faça login novamente.", 401);

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return fail("Solicitação inválida.");
      }

      const slug = String(body.company ?? "").trim().toLowerCase();
      const username = String(body.username ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const displayName = String(body.display_name ?? "").trim().slice(0, 120);
      const jobTitle = String(body.job_title ?? "").trim().toLowerCase();
      const permissions = body.permissions;

      if (!validSlug(slug)) return fail("Empresa inválida.");
      if (!validUsername(username)) return fail("Usuário inválido. Use de 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.");
      if (password.length < 8 || password.length > 128) return fail("A senha precisa ter de 8 a 128 caracteres.");
      if (!displayName) return fail("Nome do funcionário não informado.");
      if (!validPermissions(permissions)) return fail("Permissões inválidas.");

      const isManager = ["gerente de loja", "subgerente", "supervisor"].includes(jobTitle);
      const isLeader = jobTitle === "encarregado";
      if (!isManager && !isLeader) return fail("Somente gerentes, subgerentes, supervisores e encarregados podem ter login.");
      const role = isLeader ? "encarregado" : "gerente";

      const { data: org, error: orgError } = await ctx.supabaseAdmin
        .from("organizations")
        .select("id, slug, status")
        .eq("slug", slug)
        .maybeSingle();

      if (orgError) {
        console.error("Falha ao consultar empresa:", orgError);
        return fail("Não foi possível validar a empresa.", 500);
      }
      if (!org || !["active", "trial"].includes(org.status)) {
        return fail("Empresa não encontrada ou indisponível.", 404);
      }

      // O slug recebido apenas seleciona a empresa; o vínculo admin do usuário autoriza a operação.
      const { data: admin, error: adminError } = await ctx.supabaseAdmin
        .from("org_members")
        .select("id")
        .eq("org_id", org.id)
        .eq("user_id", ctx.userClaims.id)
        .eq("role", "admin")
        .eq("active", true)
        .maybeSingle();

      if (adminError) {
        console.error("Falha ao validar administrador:", adminError);
        return fail("Não foi possível validar as permissões.", 500);
      }
      if (!admin) return fail("Você não tem permissão para cadastrar usuários nesta empresa.", 403);

      const { data: priorMember, error: priorMemberError } = await ctx.supabaseAdmin
        .from("org_members")
        .select("id, user_id, active")
        .eq("org_id", org.id)
        .eq("username", username)
        .maybeSingle();

      if (priorMemberError) {
        console.error("Falha ao consultar usuário anterior:", priorMemberError);
        return fail("Não foi possível verificar o usuário.", 500);
      }
      if (priorMember?.active) return fail("Este usuário já está cadastrado nesta empresa.", 409);

      if (priorMember) {
        const { data: priorProfile, error: priorProfileError } = await ctx.supabaseAdmin
          .from("profiles")
          .select("id, active")
          .eq("id", priorMember.user_id)
          .maybeSingle();

        if (priorProfileError || !priorProfile || priorProfile.active) {
          return fail("Não foi possível reativar este acesso com segurança.", 409);
        }

        const { error: authError } = await ctx.supabaseAdmin.auth.admin.updateUserById(priorProfile.id, {
          password,
          user_metadata: { display_name: displayName, username, internal_account: true }
        });
        if (authError) {
          console.error("Falha ao reativar autenticação:", authError);
          return fail("Não foi possível reativar a conta.", 400);
        }

        const { error: profileError } = await ctx.supabaseAdmin
          .from("profiles")
          .update({ active: true, display_name: displayName, full_name: displayName })
          .eq("id", priorProfile.id);
        if (profileError) return fail("Não foi possível reativar o perfil.", 400);

        const { error: memberError } = await ctx.supabaseAdmin
          .from("org_members")
          .update({ role, active: true, permissions })
          .eq("id", priorMember.id);
        if (memberError) return fail("Não foi possível reativar o vínculo com a empresa.", 400);

        return respond({ ok: true, user_id: priorProfile.id, username, role, reactivated: true });
      }

      // O identificador interno do perfil permanece globalmente único; o login visível é por empresa.
      const profileUsername = `${username}.${org.id.slice(0, 8)}`;
      const email = `${username}.${org.id.slice(0, 8)}@login.supertudo.app`;

      const { data: created, error: createError } = await ctx.supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName, username, internal_account: true }
      });

      if (createError || !created.user) {
        console.error("Falha ao criar autenticação:", createError);
        return fail("Não foi possível criar a conta. Verifique se o usuário já existe.", 400);
      }

      const userId = created.user.id;
      const { error: profileError } = await ctx.supabaseAdmin.from("profiles").insert({
        id: userId,
        username: profileUsername,
        login_email: email,
        display_name: displayName,
        full_name: displayName,
        active: true
      });

      if (profileError) {
        await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
        console.error("Falha ao criar perfil:", profileError);
        return fail("Não foi possível registrar o perfil do funcionário.", 400);
      }

      const { error: memberError } = await ctx.supabaseAdmin.from("org_members").insert({
        id: crypto.randomUUID(),
        org_id: org.id,
        user_id: userId,
        username,
        role,
        active: true,
        permissions,
        created_at: new Date().toISOString()
      });

      if (memberError) {
        await ctx.supabaseAdmin.from("profiles").delete().eq("id", userId);
        await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
        console.error("Falha ao vincular usuário à empresa:", memberError);
        return fail("Não foi possível vincular o acesso à empresa.", 400);
      }

      return respond({ ok: true, user_id: userId, username, role });
    }
  )
};