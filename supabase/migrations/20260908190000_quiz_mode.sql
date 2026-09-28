-- Sales quiz columns + plan gate
alter table public.profiles
  add column if not exists mode text not null default 'quiz',
  add column if not exists quiz jsonb not null default '{}'::jsonb;

create or replace function public.plan_allows(p_plan text, p_feature text)
returns boolean language sql immutable as $f$
  select case p_feature
    when 'page'          then p_plan in ('basic','premium','business')
    when 'welcome_video' then p_plan in ('premium','business')
    when 'quiz'          then p_plan in ('premium','business')
    when 'email_capture' then p_plan = 'business'
    else false
  end;
$f$;

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
