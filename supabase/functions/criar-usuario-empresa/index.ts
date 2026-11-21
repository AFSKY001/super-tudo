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
const validSlug = (value: unknown) =>
  /^[a-z0-9-]{2,80}$/.test(String(value ?? "").trim().toLowerCase());
const validPermissions = (value: unknown) =>
  Array.isArray(value) &&
  value.length <= 200 &&
  value.every((item) => typeof item === "string" && item.length <= 100);

const managementTitles = ["gerente de loja", "subgerente", "supervisor", "encarregado"];

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return fail("Método não permitido.", 405);
    const actorId = ctx.userClaims?.id;
    if (!actorId) return fail("Faça login novamente.", 401);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return fail("Solicitação inválida.");
    }

    const slug = String(body.company ?? "").trim().toLowerCase();
    const action = String(body.action ?? "create").trim().toLowerCase();
    if (!validSlug(slug)) return fail("Empresa inválida.");
    if (!["create", "update", "revoke"].includes(action)) return fail("Ação inválida.");

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

    // O slug apenas seleciona a empresa. O vínculo de administrador autoriza a operação.
    const { data: actorMembership, error: actorError } = await ctx.supabaseAdmin
      .from("org_members")
      .select("id")
      .eq("org_id", org.id)
      .eq("user_id", actorId)
      .eq("role", "admin")
      .eq("active", true)
      .maybeSingle();

    if (actorError) {
      console.error("Falha ao validar administrador:", actorError);
      return fail("Não foi possível validar as permissões.", 500);
    }
    if (!actorMembership) return fail("Você não tem permissão para administrar esta empresa.", 403);

    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const displayName = String(body.display_name ?? "").trim().slice(0, 120);
    const jobTitle = String(body.job_title ?? "").trim().toLowerCase();
    const teamMemberId = String(body.team_member_id ?? "").trim();
    const permissions = body.permissions;
    const accountRole = String(body.account_role ?? "employee").trim().toLowerCase();

    if (action === "revoke" || action === "update") {
      const targetUserId = String(body.target_user_id ?? "").trim();
      if (!targetUserId) return fail("Usuário não identificado.");

      const { data: member, error: memberError } = await ctx.supabaseAdmin
        .from("org_members")
        .select("id, user_id, username, role, team_member_id")
        .eq("org_id", org.id)
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (memberError) {
        console.error("Falha ao consultar vínculo:", memberError);
        return fail("Não foi possível localizar o acesso.", 500);
      }
      if (!member) return fail("Acesso não encontrado nesta empresa.", 404);

      const { data: protectedMaster, error: protectedMasterError } = await ctx.supabaseAdmin
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", targetUserId)
        .eq("active", true)
        .maybeSingle();

      if (protectedMasterError) return fail("Não foi possível validar o acesso protegido.", 500);
      if (protectedMaster) return fail("O acesso Master da plataforma não pode ser alterado por uma empresa.", 403);

      if (action === "revoke") {
        if (targetUserId === actorId) return fail("Você não pode desativar seu próprio acesso administrativo.", 403);

        const { error: revokeError } = await ctx.supabaseAdmin
          .from("org_members")
          .update({ active: false })
          .eq("id", member.id);

        if (revokeError) {
          console.error("Falha ao desativar vínculo:", revokeError);
          return fail("Não foi possível desativar o acesso.", 500);
        }

        const { count, error: countError } = await ctx.supabaseAdmin
          .from("org_members")
          .select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId)
          .eq("active", true);

        if (countError) {
          await ctx.supabaseAdmin.from("org_members").update({ active: true }).eq("id", member.id);
          return fail("Não foi possível concluir a desativação com segurança.", 500);
        }

        if (!count) {
          const { error: profileError } = await ctx.supabaseAdmin
            .from("profiles")
            .update({ active: false })
            .eq("id", targetUserId);

          if (profileError) {
            await ctx.supabaseAdmin.from("org_members").update({ active: true }).eq("id", member.id);
            return fail("Não foi possível concluir a desativação.", 500);
          }
        }

        return respond({ ok: true, user_id: targetUserId, revoked: true });
      }

      if (targetUserId === actorId && accountRole !== "admin") {
        return fail("Você não pode retirar seu próprio acesso administrativo.", 403);
      }
      if (!validUsername(username) || !displayName || !teamMemberId) {
        return fail("Dados do acesso inválidos.");
      }
      if (!["admin", "employee"].includes(accountRole) || !validPermissions(permissions)) {
        return fail("Nível de acesso ou permissões inválidos.");
      }
      if (accountRole === "employee" && !managementTitles.includes(jobTitle)) {
        return fail("A função selecionada não pode receber login neste modelo.");
      }
      if (member.username && member.username.toLowerCase() !== username) {
        return fail("Para preservar o vínculo, não altere o nome de usuário de um acesso existente.");
      }
      if (password && (password.length < 8 || password.length > 128)) {
        return fail("A senha precisa ter de 8 a 128 caracteres.");
      }

      if (password) {
        const { error: authError } = await ctx.supabaseAdmin.auth.admin.updateUserById(targetUserId, { password });
        if (authError) {
          console.error("Falha ao atualizar senha:", authError);
          return fail("Não foi possível atualizar a senha.", 400);
        }
      }

      const { error: profileError } = await ctx.supabaseAdmin
        .from("profiles")
        .update({ display_name: displayName, full_name: displayName, active: true })
        .eq("id", targetUserId);

      if (profileError) return fail("Não foi possível atualizar o perfil.", 500);

      const nextRole = accountRole === "admin" ? "admin" : jobTitle === "encarregado" ? "encarregado" : "gerente";
      const { error: updateError } = await ctx.supabaseAdmin
        .from("org_members")
        .update({
          role: nextRole,
          permissions,
          team_member_id: teamMemberId,
          active: true
        })
        .eq("id", member.id);

      if (updateError) return fail("Não foi possível atualizar o vínculo do funcionário.", 500);
      return respond({ ok: true, user_id: targetUserId, username, role: nextRole, updated: true });
    }

    if (!validUsername(username)) {
      return fail("Usuário inválido. Use de 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.");
    }
    if (password.length < 8 || password.length > 128) {
      return fail("A senha precisa ter de 8 a 128 caracteres.");
    }
    if (!displayName) return fail("Nome do funcionário não informado.");
    if (!teamMemberId) return fail("O identificador do funcionário não foi enviado.");
    if (!["admin", "employee"].includes(accountRole) || !validPermissions(permissions)) {
      return fail("Nível de acesso ou permissões inválidos.");
    }
    if (accountRole === "employee" && !managementTitles.includes(jobTitle)) {
      return fail("Somente funções de liderança podem receber login neste modelo.");
    }

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

    const role = accountRole === "admin" ? "admin" : jobTitle === "encarregado" ? "encarregado" : "gerente";

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

      const { error: memberError } = await ctx.supabaseAdmin
        .from("org_members")
        .update({
          role,
          active: true,
          permissions,
          team_member_id: teamMemberId
        })
        .eq("id", priorMember.id);

      if (memberError) return fail("Não foi possível reativar o vínculo com a empresa.", 400);

      const { error: profileError } = await ctx.supabaseAdmin
        .from("profiles")
        .update({ active: true, display_name: displayName, full_name: displayName })
        .eq("id", priorProfile.id);

      if (profileError) {
        await ctx.supabaseAdmin.from("org_members").update({ active: false }).eq("id", priorMember.id);
        console.error("Falha ao reativar perfil:", profileError);
        return fail("Não foi possível reativar o perfil.", 500);
      }

      return respond({ ok: true, user_id: priorProfile.id, username, role, reactivated: true });
    }

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
      team_member_id: teamMemberId,
      created_at: new Date().toISOString()
    });

    if (memberError) {
      await ctx.supabaseAdmin.from("profiles").delete().eq("id", userId);
      await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
      console.error("Falha ao vincular usuário à empresa:", memberError);
      return fail("Não foi possível vincular o acesso à empresa.", 400);
    }

    return respond({ ok: true, user_id: userId, username, role });
  })
};
