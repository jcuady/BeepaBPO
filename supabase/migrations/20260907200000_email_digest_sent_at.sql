-- Track last email digest send so cron can throttle roughly once per day.
alter table public.notification_preferences
  add column if not exists email_digest_sent_at timestamptz;

comment on column public.notification_preferences.email_digest_sent_at is
  'Last time an unread-notification email digest was sent for this user.';
