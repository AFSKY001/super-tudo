import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Sessão inválida ou expirada." }, 401);
    const user = authData.user;

    const { data: orgId, error: orgError } = await userClient.rpc("current_org_id");
    if (orgError || !orgId) return json({ error: "Organização ativa não encontrada." }, 403);

    const { data: membership, error: memberError } = await admin
      .from("org_members")
      .select("role, team_member_id, active")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    if (memberError || !membership) return json({ error: "Usuário não pertence à organização ativa." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    async function getVapidConfig() {
      let { data: config, error } = await admin
        .from("app_push_config")
        .select("public_key, private_key, subject")
        .eq("org_id", orgId)
        .maybeSingle();
      if (error) throw error;
      if (!config) {
        const keys = webpush.generateVAPIDKeys();
        const created = await admin.from("app_push_config").insert({
          org_id: orgId,
          public_key: keys.publicKey,
          private_key: keys.privateKey,
          subject: "https://super-tudo.josealissondos.workers.dev",
        });
        if (created.error && created.error.code !== "23505") throw created.error;
        const loaded = await admin
          .from("app_push_config")
          .select("public_key, private_key, subject")
          .eq("org_id", orgId)
          .single();
        if (loaded.error) throw loaded.error;
        config = loaded.data;
      }
      webpush.setVapidDetails(config.subject, config.public_key, config.private_key);
      return config;
    }

    async function sendPush(rows: Array<Record<string, any>>) {
      if (!rows.length) return { sent: 0, stale: 0 };
      const userIds = [...new Set(rows.map((r) => r.recipient_user_id))];
      const { data: subscriptions, error } = await admin
        .from("app_push_subscriptions")
        .select("user_id, endpoint, subscription")
        .eq("org_id", orgId)
        .in("user_id", userIds);
      if (error) throw error;
      if (!subscriptions?.length) return { sent: 0, stale: 0 };

      await getVapidConfig();
      let sent = 0;
      let stale = 0;
      await Promise.all(subscriptions.map(async (item) => {
        const notice = rows.find((r) => r.recipient_user_id === item.user_id);
        if (!notice) return;
        const payload = JSON.stringify({
          title: notice.title || "Super Tudo",
          body: notice.body || "Você tem uma nova notificação.",
          tag: "super-tudo-" + notice.id,
          data: { url: "/", notificationId: notice.id, ref: notice.ref || null },
        });
        try {
          await webpush.sendNotification(item.subscription, payload, { TTL: 3600 });
          sent++;
        } catch (err) {
          const status = Number((err as any)?.statusCode || 0);
          if (status === 404 || status === 410) {
            await admin.from("app_push_subscriptions")
              .delete().eq("org_id", orgId).eq("endpoint", item.endpoint);
            stale++;
          } else {
            console.error("Falha ao enviar Web Push:", err);
          }
        }
      }));
      return { sent, stale };
    }

    if (action === "notification-settings-get") {
      if (membership.role !== "admin") return json({ error: "Somente o administrador pode consultar as configurações." }, 403);
      const { data, error } = await admin.from("app_notification_settings").select("distribution_mode, updated_at").eq("org_id", orgId).maybeSingle();
      if (error) throw error;
      return json({ distributionMode: data?.distribution_mode || "all", updatedAt: data?.updated_at || null, routingEnabled: false });
    }
    if (action === "notification-settings-set") {
      if (membership.role !== "admin") return json({ error: "Somente o administrador pode alterar a distribuição." }, 403);
      if (String(body.distributionMode || "") !== "all") return json({ error: "O modo por função ainda não está disponível." }, 409);
      const { error } = await admin.from("app_notification_settings").upsert({ org_id: orgId, distribution_mode: "all", updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
      if (error) throw error;
      return json({ ok: true, distributionMode: "all", routingEnabled: false });
    }
    if (action === "public-key") {
      const config = await getVapidConfig();
      return json({ publicKey: config.public_key });
    }

    if (action === "subscribe") {
      const sub = body.subscription;
      if (!sub?.endpoint || !String(sub.endpoint).startsWith("https://") ||
          !sub?.keys?.p256dh || !sub?.keys?.auth) {
        return json({ error: "Assinatura do dispositivo inválida." }, 400);
      }
      const { error } = await admin.from("app_push_subscriptions").upsert({
        org_id: orgId,
        user_id: user.id,
        endpoint: sub.endpoint,
        subscription: sub,
        updated_at: new Date().toISOString(),
      }, { onConflict: "org_id,user_id,endpoint" });
      if (error) throw error;
      await getVapidConfig();
      return json({ ok: true });
    }

    if (action === "unsubscribe") {
      const endpoint = String(body.endpoint || "");
      if (endpoint) {
        const { error } = await admin.from("app_push_subscriptions")
          .delete().eq("org_id", orgId).eq("user_id", user.id).eq("endpoint", endpoint);
        if (error) throw error;
      }
      return json({ ok: true });
    }

    if (action === "notify" || action === "notify-self" || action === "notify-broadcast") {
      const message = String(body.message || "").trim().slice(0, 1000);
      if (!message) return json({ error: "Mensagem vazia." }, 400);
      const key = String(body.key || "").trim().slice(0, 240) || null;
      const cat = String(body.cat || "avi").slice(0, 20);
      const ref = body.ref && typeof body.ref === "object" ? body.ref : null;
      let recipients: Array<{ user_id: string; team_member_id: string | null }> = [];

      if (action === "notify-self") {
        recipients = [{ user_id: user.id, team_member_id: membership.team_member_id || null }];
      } else if (action === "notify-broadcast") {
        // Avisos gerais são um privilégio de gestão; nunca confiar nos destinatários do navegador.
        if (!["admin", "gerente"].includes(membership.role)) {
          return json({ error: "Somente administrador ou gerente pode enviar aviso para toda a organização." }, 403);
        }
        const { data: members, error } = await admin
          .from("org_members")
          .select("user_id, team_member_id")
          .eq("org_id", orgId)
          .eq("active", true);
        if (error) throw error;
        recipients = (members || []).map((m) => ({
          user_id: m.user_id,
          team_member_id: m.team_member_id || null,
        }));
      } else {
        const targets = [...new Set((Array.isArray(body.to) ? body.to : [])
          .map((x: unknown) => String(x || "").trim()).filter(Boolean))].slice(0, 200);
        if (!targets.length) return json({ ok: true, inserted: 0, pushSent: 0 });
        const { data: members, error } = await admin
          .from("org_members")
          .select("user_id, team_member_id, role")
          .eq("org_id", orgId)
          .eq("active", true);
        if (error) throw error;
        recipients = (members || []).filter((m) =>
          (m.team_member_id && targets.includes(m.team_member_id)) ||
          (targets.includes("adm") && ["admin", "gerente"].includes(m.role))
        ).map((m) => ({ user_id: m.user_id, team_member_id: m.team_member_id || null }));
      }

      const unique = [...new Map(recipients.map((r) => [r.user_id, r])).values()];
      if (!unique.length) return json({ ok: true, inserted: 0, pushSent: 0 });
      const rows = unique.map((r) => ({
        org_id: orgId,
        recipient_user_id: r.user_id,
        recipient_team_member_id: r.team_member_id,
        title: String(body.title || "Super Tudo").slice(0, 120),
        body: message,
        ref,
        cat,
        dedupe_key: key,
        created_by: user.id,
      }));
      const { data: created, error } = await admin
        .from("app_notifications")
        .upsert(rows, {
          onConflict: "org_id,recipient_user_id,dedupe_key",
          ignoreDuplicates: true,
        })
        .select("id, org_id, recipient_user_id, recipient_team_member_id, title, body, ref, cat, dedupe_key, created_at, read_at");
      if (error) throw error;
      const delivery = await sendPush(created || []);
      return json({ ok: true, inserted: created?.length || 0, pushSent: delivery.sent, staleSubscriptions: delivery.stale });
    }

    if (action === "list") {
      const { data, error } = await admin
        .from("app_notifications")
        .select("id, title, body, ref, cat, dedupe_key, created_at, read_at")
        .eq("org_id", orgId)
        .eq("recipient_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return json({ notifications: data || [] });
    }

    if (action === "mark-read" || action === "mark-all-read") {
      let q = admin.from("app_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("org_id", orgId)
        .eq("recipient_user_id", user.id)
        .is("read_at", null);
      if (action === "mark-read") {
        if (body.id) q = q.eq("id", String(body.id));
        else if (body.dedupe_key) q = q.eq("dedupe_key", String(body.dedupe_key));
        else return json({ error: "Informe o identificador da notificação." }, 400);
      }
      const { error } = await q;
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete-all") {
      const { error } = await admin.from("app_notifications")
        .delete().eq("org_id", orgId).eq("recipient_user_id", user.id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (err) {
    console.error("push-notifications:", err);
    return json({ error: String((err as any)?.message || err || "Erro interno.") }, 500);
  }
});
