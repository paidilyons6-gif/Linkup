-- LinkUp backend hardening (applied to project ldaajbuumgjujfwmlcwm)
-- Safe to re-run.

alter table public.profiles drop constraint if exists profiles_mode_check;
alter table public.profiles
  add constraint profiles_mode_check check (mode in ('quiz', 'hub'));

alter table public.profiles drop constraint if exists profiles_quiz_size;
alter table public.profiles
  add constraint profiles_quiz_size check (pg_column_size(quiz) <= 204800);

alter table public.profiles drop constraint if exists profiles_links_is_array;
alter table public.profiles
  add constraint profiles_links_is_array check (jsonb_typeof(links) = 'array');

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check check (status in (
    'inactive','incomplete','incomplete_expired','trialing','active',
    'past_due','canceled','unpaid','paused'
  ));

insert into public.reserved_slugs (slug) values
  ('services'),('unsubscribe'),('signin'),('logout'),
  ('build'),('fonts'),('config'),('demo-admin'),
  ('netlify'),('supabase'),('stripe'),('webhook'),('health')
on conflict do nothing;

create or replace function public.plan_allows(p_plan text, p_feature text)
returns boolean language sql immutable security invoker set search_path to 'public' as $f$
  select case p_feature
    when 'page'          then p_plan in ('basic','premium','business')
    when 'welcome_video' then p_plan in ('premium','business')
    when 'quiz'          then p_plan in ('premium','business')
    when 'email_capture' then p_plan = 'business'
    else false
  end;
$f$;

create or replace function public.guard_publish()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.published is true
     and not plan_allows(effective_plan(new.user_id), 'page') then
    raise exception 'Publish requires an active Launch, Guide, or Scale plan'
      using errcode = 'P0001';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_guard_publish on public.profiles;
create trigger profiles_guard_publish
  before insert or update on public.profiles
  for each row execute function public.guard_publish();

create or replace function public.slug_not_reserved()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from public.reserved_slugs r where r.slug = new.slug) then
    raise exception 'That address is not available' using errcode = '23505';
  end if;
  return new;
end;
$$;

create or replace function public.public_profile(p_slug text)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select case when p.id is null then null else jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name, 'handle', p.handle, 'tagline', p.tagline,
    'avatar', p.avatar_url, 'theme', p.theme, 'bubbleStyle', p.bubble_style, 'links', p.links,
    'backgroundVideo', p.background_video_url, 'backgroundImage', p.background_image_url,
    'welcomeVideo', case when plan_allows(effective_plan(p.user_id), 'welcome_video') then p.welcome_video_url end,
    'captureEnabled', p.capture_enabled and plan_allows(effective_plan(p.user_id), 'email_capture'),
    'captureHeading', p.capture_heading,
    'badge', effective_plan(p.user_id) = 'basic',
    'mode', case when plan_allows(effective_plan(p.user_id), 'quiz') then p.mode else 'hub' end,
    'quiz', case when plan_allows(effective_plan(p.user_id), 'quiz') then coalesce(p.quiz, '{}'::jsonb) else '{}'::jsonb end
  ) end
  from public.profiles p
  where p.slug = p_slug and p.published and plan_allows(effective_plan(p.user_id), 'page');
$function$;

create or replace function public.profile_is_live(p_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_id and p.published
      and plan_allows(effective_plan(p.user_id), 'page')
  );
$$;

create or replace function public.profile_accepts_subscribers(p_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_id and p.published and p.capture_enabled
      and plan_allows(effective_plan(p.user_id), 'email_capture')
  );
$$;

create or replace function public.join_list(p_profile_id uuid, p_email text)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if p_email is null or char_length(trim(p_email)) < 3 or char_length(trim(p_email)) > 320
     or trim(p_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;
  if not public.profile_accepts_subscribers(p_profile_id) then return false; end if;
  insert into public.subscribers(profile_id, email, consent_at, unsubscribed_at)
  values (p_profile_id, lower(trim(p_email)), now(), null)
  on conflict (profile_id, email) do update
    set consent_at = now(), unsubscribed_at = null;
  return true;
end;
$$;

create or replace function public.record_tap(p_profile_id uuid, p_label text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_label is null or char_length(trim(p_label)) = 0 or char_length(p_label) > 120 then return; end if;
  if not public.profile_is_live(p_profile_id) then return; end if;
  insert into public.taps(profile_id, label) values (p_profile_id, left(trim(p_label), 120));
end;
$$;

-- Privileges
revoke all on table public.profiles from anon, authenticated, public;
revoke all on table public.subscriptions from anon, authenticated, public;
revoke all on table public.subscribers from anon, authenticated, public;
revoke all on table public.taps from anon, authenticated, public;
revoke all on table public.broadcasts from anon, authenticated, public;
revoke all on table public.reserved_slugs from anon, authenticated, public;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select on table public.subscriptions to authenticated;
grant select, insert, update, delete on table public.subscribers to authenticated;
grant select, insert on table public.taps to authenticated;
grant select on table public.broadcasts to authenticated;
grant select on table public.reserved_slugs to anon, authenticated;
grant all on all tables in schema public to service_role;

drop policy if exists taps_insert on public.taps;
create policy taps_insert on public.taps for insert to authenticated
  with check (public.profile_is_live(profile_id));

drop policy if exists subscribers_insert on public.subscribers;
create policy subscribers_insert on public.subscribers for insert to authenticated
  with check (public.profile_accepts_subscribers(profile_id));

drop policy if exists subscribers_update_consent on public.subscribers;
create policy subscribers_update_consent on public.subscribers for update to authenticated
  using (public.profile_accepts_subscribers(profile_id))
  with check (public.profile_accepts_subscribers(profile_id));

drop policy if exists subscribers_delete_own on public.subscribers;
create policy subscribers_delete_own on public.subscribers for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));

revoke all on function public.effective_plan(uuid) from public, anon, authenticated;
grant execute on function public.effective_plan(uuid) to service_role;
revoke all on function public.plan_allows(text, text) from public, anon, authenticated;
grant execute on function public.plan_allows(text, text) to service_role;
revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated, service_role;
revoke all on function public.tap_counts() from public, anon;
grant execute on function public.tap_counts() to authenticated, service_role;
revoke all on function public.sent_this_month() from public, anon;
grant execute on function public.sent_this_month() to authenticated, service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.public_profile(text) to anon, authenticated, service_role;
grant execute on function public.slug_available(text) to anon, authenticated, service_role;
grant execute on function public.unsubscribe(uuid) to anon, authenticated, service_role;
grant execute on function public.join_list(uuid, text) to anon, authenticated, service_role;
grant execute on function public.record_tap(uuid, text) to anon, authenticated, service_role;
grant execute on function public.profile_is_live(uuid) to anon, authenticated, service_role;
grant execute on function public.profile_accepts_subscribers(uuid) to anon, authenticated, service_role;
