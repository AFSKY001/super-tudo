import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const fail = (message: string, status = 400) => reply({ error: message }, status);
const groups = new Set(["subordinados", "outros_encarregados", "equipe", "anonimo"]);
const safeText = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const validId = (value: string) => /^[a-z0-9_-]{1,48}$/i.test(value);

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return fail("Método não permitido.", 405);
    const actorId = ctx.userClaims?.id;
    if (!actorId) return fail("Faça login novamente.", 401);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return fail("Solicitação inválida."); }
    const action = safeText(body.action, 20);
    if (!["create", "list", "revoke"].includes(action)) return fail("Ação inválida.");

    const company = safeText(body.company, 80).toLowerCase();
    if (!/^[a-z0-9-]{2,80}$/.test(company)) return fail("Empresa não identificada.");

    const { data: org, error: orgError } = await ctx.supabaseAdmin
      .from("organizations").select("id,slug,status").eq("slug", company).maybeSingle();
    if (orgError) {
      console.error("Falha ao localizar empresa para links de avaliação:", orgError);
      return fail("Não foi possível validar a empresa.", 500);
    }
    if (!org || !["active", "trial"].includes(String(org.status))) return fail("Empresa não disponível.", 404);

    const { data: master, error: masterError } = await ctx.supabaseAdmin
      .from("platform_admins").select("user_id").eq("user_id", actorId).eq("active", true).maybeSingle();
    if (masterError) return fail("Não foi possível validar o acesso.", 500);
    const isMaster = !!master;

    const { data: membership, error: membershipError } = await ctx.supabaseAdmin
      .from("org_members").select("role,active").eq("org_id", org.id)
      .eq("user_id", actorId).eq("active", true).maybeSingle();
    if (membershipError) return fail("Não foi possível validar o vínculo com a empresa.", 500);
    if (!isMaster && (!membership || !["admin", "gerente"].includes(String(membership.role)))) {
      return fail("Somente administradores e gerentes podem gerenciar links de avaliação.", 403);
    }
    if (isMaster && !membership) {
      // Master is global; no company membership is required to administer link records.
    }

    if (action === "list") {
      const { data, error } = await ctx.supabaseAdmin.from("evaluation_public_links")
        .select("id,token,evaluation_type,evaluation_name,evaluator_group,target,active,expires_at,created_at")
        .eq("org_id", org.id).order("created_at", { ascending: false }).limit(100);
      if (error) {
        console.error("Falha ao listar links de avaliação:", error);
        return fail("Não foi possível carregar os links.", 500);
      }
      return reply({ ok: true, links: data ?? [] });
    }

    if (action === "revoke") {
      const id = safeText(body.id, 64);
      if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Link não identificado.");
      const { data, error } = await ctx.supabaseAdmin.from("evaluation_public_links")
        .update({ active: false }).eq("id", id).eq("org_id", org.id)
        .select("id,active").maybeSingle();
      if (error) {
        console.error("Falha ao desativar link de avaliação:", error);
        return fail("Não foi possível desativar o link.", 500);
      }
      if (!data) return fail("Link não encontrado.", 404);
      return reply({ ok: true, link: data });
    }

    const evaluationType = safeText(body.evaluation_type, 48);
    const evaluationName = safeText(body.evaluation_name, 120);
    const evaluatorGroup = safeText(body.evaluator_group, 32);
    const target = body.target && typeof body.target === "object" && !Array.isArray(body.target)
      ? body.target as Record<string, unknown> : {};
    const rawQuestions = Array.isArray(body.questions) ? body.questions : [];
    if (!validId(evaluationType) || !evaluationName || !groups.has(evaluatorGroup)) {
      return fail("Tipo, nome ou grupo de avaliadores inválido.");
    }
    if (rawQuestions.length < 1 || rawQuestions.length > 80) {
      return fail("A avaliação precisa ter entre 1 e 80 perguntas.");
    }
    const questions = rawQuestions.map((item) => {
      const question = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return { t: safeText(question.t, 300), c: safeText(question.c, 1000) };
    });
    if (questions.some((question) => !question.t)) return fail("Todas as perguntas precisam ter um enunciado.");

    const safeTarget = {
      p: safeText(target.p, 80),
      z: safeText(target.z, 100),
      n: safeText(target.n, 120),
    };
    if (!safeTarget.p && !safeTarget.z && !safeTarget.n) return fail("Informe quem ou qual setor será avaliado.");

    const days = Math.max(1, Math.min(365, Number(body.expires_in_days) || 30));
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    const random = new Uint8Array(32);
    crypto.getRandomValues(random);
    const token = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");

    const { data: created, error: createError } = await ctx.supabaseAdmin
      .from("evaluation_public_links").insert({
        org_id: org.id,
        token,
        evaluation_type: evaluationType,
        evaluation_name: evaluationName,
        evaluator_group: evaluatorGroup,
        target: safeTarget,
        questions,
        anonymous: true,
        active: true,
        expires_at: expiresAt,
        created_by: actorId,
      }).select("id,token,evaluation_type,evaluation_name,evaluator_group,target,active,expires_at,created_at").single();
    if (createError || !created) {
      console.error("Falha ao criar link público de avaliação:", createError);
      return fail("Não foi possível criar o link de avaliação.", 500);
    }
    return reply({ ok: true, link: created });
  }),
};
