import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleEnum = z.enum(["cook", "member", "both"]);

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, display_name, household_id, role")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    let household = null as null | { id: string; name: string; invite_code: string };
    if (profile?.household_id) {
      const { data: h } = await supabase
        .from("households")
        .select("id, name, invite_code")
        .eq("id", profile.household_id)
        .maybeSingle();
      household = h ?? null;
    }
    return { profile, household };
  });

export const createHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(60),
        displayName: z.string().min(1).max(40),
        role: RoleEnum,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // try a few times for unique invite code
    let inviteCode = generateInviteCode();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase
        .from("households")
        .select("id")
        .eq("invite_code", inviteCode)
        .maybeSingle();
      if (!existing) break;
      inviteCode = generateInviteCode();
    }

    const { data: household, error: hErr } = await supabase
      .from("households")
      .insert({ name: data.name, invite_code: inviteCode, created_by: userId })
      .select("id, name, invite_code")
      .single();
    if (hErr) throw new Error(hErr.message);

    const { error: pErr } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        display_name: data.displayName,
        household_id: household.id,
        role: data.role,
      });
    if (pErr) throw new Error(pErr.message);

    return { household };
  });

export const joinHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        inviteCode: z.string().trim().toUpperCase().length(6),
        displayName: z.string().min(1).max(40),
        role: RoleEnum,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: h, error: hErr } = await supabase
      .from("households")
      .select("id, name, invite_code")
      .eq("invite_code", data.inviteCode)
      .maybeSingle();
    if (hErr) throw new Error(hErr.message);
    if (!h) throw new Error("Invite code not found");

    const { error: pErr } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        display_name: data.displayName,
        household_id: h.id,
        role: data.role,
      });
    if (pErr) throw new Error(pErr.message);

    return { household: h };
  });

export const getHouseholdMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, role")
      .not("household_id", "is", null)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { members: data ?? [] };
  });
