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
    const { data: authData, error: authError } = await userClient.auth.getUser();
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
      const { data: due, error } = await admin.from("app_config_schedules")
        .select("*").eq("org_id", orgId).eq("status", "pending")
        .lte("effective_at", new Date().toISOString()).order("effective_at").limit(50);
      if (error) throw error;
      const results = [];
      for (const item of due || []) {
        const claimed = await admin.from("app_config_schedules")
          .update({ status: "applying" }).eq("id", item.id).eq("status", "pending").select("id").maybeSingle();
        if (claimed.error) throw claimed.error;
        if (!claimed.data) continue;
        const current = await admin.from("app_records").select("id,revision,kind,module,record_id")
          .eq("org_id", orgId).eq("module", item.module).eq("record_id", item.record_id).maybeSingle();
        if (current.error) throw current.error;
        if (!current.data || current.data.kind !== item.kind || current.data.revision !== item.base_revision) {
          const reason = !current.data ? "Registro não encontrado" : "Configuração mudou após o agendamento";
          await admin.from("app_config_schedules").update({
            status: "conflict", result: { reason, expected_revision: item.base_revision, actual_revision: current.data?.revision ?? null },
          }).eq("id", item.id);
          results.push({ id: item.id, status: "conflict", reason });
          continue;
        }
        const changed = await admin.from("app_records").update({ data: item.data, updated_by: item.scheduled_by })
          .eq("id", current.data.id).eq("revision", item.base_revision).select("revision").maybeSingle();
        if (changed.error || !changed.data) {
          const reason = changed.error?.message || "Conflito de revisão durante a aplicação";
          await admin.from("app_config_schedules").update({ status: "conflict", result: { reason } }).eq("id", item.id);
          results.push({ id: item.id, status: "conflict", reason });
          continue;
        }
        await admin.from("app_config_schedules").update({
          status: "applied", applied_at: new Date().toISOString(),
          result: { applied_revision: changed.data.revision },
        }).eq("id", item.id);
        results.push({ id: item.id, status: "applied", revision: changed.data.revision });
      }
      return json({ ok: true, processed: results.length, results });
    }

    if (!["admin", "gerente"].includes(member.role)) return json({ error: "Somente administrador ou gerente pode gerenciar agendamentos." }, 403);

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
    return json({ error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});
