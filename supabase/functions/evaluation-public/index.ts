import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const fail = (message: string, status = 400) => reply({ error: message }, status);
const tokenOk = (value: string) => /^[a-f0-9]{64}$/i.test(value);

export default {
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return fail("Método não permitido.", 405);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return fail("Solicitação inválida."); }
    const action = String(body.action ?? "");
    const token = String(body.token ?? "").trim();
    if (!tokenOk(token)) return fail("Este link não é válido.", 404);

    const { data: link, error: linkError } = await ctx.supabaseAdmin
      .from("evaluation_public_links")
      .select("id,org_id,token,evaluation_type,evaluation_name,evaluator_group,target,questions,anonymous,active,expires_at")
      .eq("token", token).eq("active", true).maybeSingle();
    if (linkError) {
      console.error("Falha ao consultar link público:", linkError);
      return fail("Não foi possível abrir esta avaliação.", 500);
    }
    if (!link) return fail("Este link não existe ou foi desativado.", 404);
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
      return fail("Este link de avaliação expirou.", 410);
    }

    if (action === "get") {
      return reply({
        ok: true,
        evaluation: {
          name: link.evaluation_name,
          type: link.evaluation_type,
          group: link.evaluator_group,
          target: link.target ?? {},
          questions: Array.isArray(link.questions) ? link.questions : [],
          anonymous: link.anonymous === true,
        },
      });
    }
    if (action !== "submit") return fail("Ação inválida.");

    const questions = Array.isArray(link.questions) ? link.questions : [];
    const answers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? body.answers as Record<string, unknown> : {};
    if (!questions.length || questions.length > 80) return fail("Esta avaliação não possui perguntas válidas.", 409);
    const normalized: Record<string, number> = {};
    for (let index = 0; index < questions.length; index++) {
      const value = Number(answers[String(index)]);
      if (!Number.isInteger(value) || value < 1 || value > 4) {
        return fail("Responda todas as perguntas antes de enviar.");
      }
      normalized[String(index)] = value;
    }
    const observation = String(body.observation ?? "").trim().slice(0, 1500);
    const target = link.target && typeof link.target === "object" ? link.target as Record<string, unknown> : {};
    const recordId = crypto.randomUUID();
    const record = {
      id: recordId,
      t: link.evaluation_type,
      mn: link.evaluation_name,
      d: new Date().toISOString().slice(0, 10),
      qs: questions,
      r: normalized,
      o: observation,
      p: String(target.p ?? "") || undefined,
      z: String(target.z ?? "") || undefined,
      n: String(target.n ?? "") || undefined,
      evaluator_group: link.evaluator_group,
      public_link_id: link.id,
      anonymous: true,
      source: "public_link",
    };
    const now = new Date().toISOString();
    const { error: insertError } = await ctx.supabaseAdmin.from("app_records").insert({
      org_id: link.org_id,
      module: "ev",
      record_id: recordId,
      data: record,
      revision: 1,
      kind: "r:ava",
      version: 1,
      created_by: null,
      updated_by: null,
      created_at: now,
      updated_at: now,
    });
    if (insertError) {
      console.error("Falha ao registrar resposta externa:", insertError);
      return fail("Não foi possível registrar sua resposta. Tente novamente.", 500);
    }
    return reply({ ok: true, message: "Resposta enviada com sucesso." });
  }),
};
