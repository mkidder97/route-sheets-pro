-- Enable pg_net for outbound HTTP from database triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function that fires when a campaign is activated
CREATE OR REPLACE FUNCTION public.notify_campaign_kickoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    PERFORM net.http_post(
      url := 'https://mayuememdgdyqpuqumii.supabase.co/functions/v1/campaign-kickoff-notify',
      body := jsonb_build_object(
        'campaign_id', NEW.id,
        'region_id', NEW.region_id,
        'name', NEW.name,
        'start_date', NEW.start_date
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on inspection_campaigns
CREATE TRIGGER campaign_kickoff_webhook
AFTER UPDATE ON public.inspection_campaigns
FOR EACH ROW EXECUTE FUNCTION public.notify_campaign_kickoff();