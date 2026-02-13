import { supabase } from "@/integrations/supabase/client";

export type NotificationType = "handoff" | "status_change" | "assignment" | "comment" | "reminder";

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  referenceType?: string,
  referenceId?: string,
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    reference_type: referenceType ?? null,
    reference_id: referenceId ?? null,
  });

  if (error) {
    console.error("Failed to create notification:", error);
  }

  return { error };
}
