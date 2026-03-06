import { createClient } from "npm:@supabase/supabase-js@2";

const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/f6yc1gb6cm7w4t39j2tbohweu3v6otkl";

Deno.serve(async (req: Request) => {
  try {
    const { campaign_id, region_id, name, start_date } = await req.json();

    if (!region_id) {
      return new Response(JSON.stringify({ error: "Missing region_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: buildings, error } = await supabase
      .from("buildings")
      .select("property_name, property_manager_name, property_manager_email, property_manager_phone")
      .eq("region_id", region_id)
      .not("property_manager_email", "is", null);

    if (error) {
      console.error("Buildings query failed:", error);
      return new Response(JSON.stringify({ error: "Buildings query failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Deduplicate by email — group property names under each unique PM
    const contactMap = new Map<string, { name: string; email: string; phone: string | null; buildings: string[] }>();
    for (const b of buildings ?? []) {
      const key = b.property_manager_email.toLowerCase().trim();
      if (contactMap.has(key)) {
        contactMap.get(key)!.buildings.push(b.property_name);
      } else {
        contactMap.set(key, {
          name: b.property_manager_name ?? "",
          email: b.property_manager_email,
          phone: b.property_manager_phone ?? null,
          buildings: [b.property_name],
        });
      }
    }

    const contacts = Array.from(contactMap.values());

    // Send to Make webhook
    await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id,
        campaign_name: name,
        start_date,
        contacts,
      }),
    });

    console.log(`Campaign kickoff notify: ${contacts.length} contacts for campaign ${campaign_id}`);

    return new Response(
      JSON.stringify({ success: true, contacts_notified: contacts.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("campaign-kickoff-notify error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
