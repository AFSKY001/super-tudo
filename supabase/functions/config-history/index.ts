import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Sessão não informada." }, 401);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const token = authorization.slice("Bearer ".length).trim();
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Sessão inválida ou expirada." }, 401);
    const user = authData.user;
    const { data: orgId, error: orgError } = await userClient.rpc("current_org_id");
    if (orgError || !orgId) return json({ error: "Organização ativa não encontrada." }, 403);
    const { data: member, error: memberError } = await admin.from("org_members")
      .select("role,active").eq("org_id", orgId).eq("user_id", user.id).eq("active", true).maybeSingle();
    if (memberError || !member) return json({ error: "Membro ativo não encontrado." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // Qualquer membro ativo pode solicitar aplicação de itens que já venceram.
    // Somente admin/gerente podem consultar, criar ou cancelar agendamentos.
    if (action === "apply-due") {
      const { data, error } = await admin.rpc("apply_due_app_config_schedules", {
        p_org_id: orgId,
        p_requested_by: user.id,
      });
      if (error) throw error;
      return json({ ok: true, ...(data || { processed: 0, results: [] }) });
    }

    if (!["admin", "gerente"].includes(member.role)) return json({ error: "Somente administrador ou gerente pode gerenciar agendamentos." }, 403);

    if (action === "history") {
      const module = typeof body.module === "string" ? body.module.trim() : "";
      const recordId = typeof body.record_id === "string" ? body.record_id.trim() : "";
      let query = admin.from("app_config_history")
        .select("id,module,record_id,kind,revision,deleted_at,recorded_at,effective_at,recorded_by,source,data")
        .eq("org_id", orgId)
        .order("effective_at", { ascending: false })
        .order("revision", { ascending: false })
        .limit(200);
      if (module) query = query.eq("module", module);
      if (recordId) query = query.eq("record_id", recordId);
      const { data, error } = await query;
      if (error) throw error;
      return json({ ok: true, history: data || [] });
    }

    if (action === "list") {
      const { data, error } = await admin.from("app_config_schedules").select("id,module,record_id,kind,base_revision,data,effective_at,status,created_at,applied_at,result")
        .eq("org_id", orgId).order("effective_at", { ascending: true }).limit(100);
      if (error) throw error;
      return json({ ok: true, schedules: data || [] });
    }

    if (action === "create") {
      const module = String(body.module || "").trim();
      const recordId = String(body.record_id || "").trim();
      const kind = String(body.kind || "").trim();
      const effectiveAt = new Date(body.effective_at);
      const data = body.data;
      const baseRevision = Number(body.base_revision);
      if (!module || !recordId || !kind.startsWith("cfg:") || !Number.isSafeInteger(baseRevision) ||
          !data || typeof data !== "object" || Array.isArray(data) || !Number.isFinite(effectiveAt.getTime()) ||
          effectiveAt.getTime() <= Date.now()) return json({ error: "Dados inválidos ou data efetiva não futura." }, 400);
      const current = await admin.from("app_records").select("revision,kind")
        .eq("org_id", orgId).eq("module", module).eq("record_id", recordId).maybeSingle();
      if (current.error) throw current.error;
      if (!current.data || current.data.kind !== kind || current.data.revision !== baseRevision) {
        return json({ error: "A configuração foi alterada. Atualize os dados antes de agendar." }, 409);
      }
      const pending = await admin.from("app_config_schedules").select("id")
        .eq("org_id", orgId).eq("module", module).eq("record_id", recordId).eq("status", "pending").maybeSingle();
      if (pending.error) throw pending.error;
      if (pending.data) return json({ error: "Este registro já possui uma mudança pendente." }, 409);
      const created = await admin.from("app_config_schedules").insert({
        org_id: orgId, module, record_id: recordId, kind, base_revision: baseRevision,
        data, effective_at: effectiveAt.toISOString(), scheduled_by: user.id,
      }).select("id,module,record_id,kind,base_revision,effective_at,status,created_at").single();
      if (created.error) throw created.error;
      return json({ ok: true, schedule: created.data });
    }

    if (action === "cancel") {
      const id = String(body.id || "");
      if (!id) return json({ error: "Identificador obrigatório." }, 400);
      const cancelled = await admin.from("app_config_schedules").update({ status: "cancelled" })
        .eq("org_id", orgId).eq("id", id).eq("status", "pending")
        .select("id").maybeSingle();
      if (cancelled.error) throw cancelled.error;
      if (!cancelled.data) return json({ error: "Agendamento não encontrado ou já processado." }, 409);
      return json({ ok: true, id });
    }
    return json({ error: "Ação desconhecida." }, 400);
  } catch (error) {
    console.error("config-history:", error);
    return json({ error: "Falha interna ao processar a solicitação. Tente novamente." }, 500);
  }
});
