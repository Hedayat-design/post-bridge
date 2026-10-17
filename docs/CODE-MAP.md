# Code map

Where everything lives, for whoever maintains this next. The app is three
sites in one Next.js project, plus the API. Each site has its own folder of
routes, its own folder of components, and (where it computes anything) its
own folder in `lib/`.

| Site | URLs | Routes | Components | Logic |
|---|---|---|---|---|
| **Public** (marketing) | `/`, `/pricing`, `/login`, `/signup` | `app/(marketing)/` | `components/landing/`, `components/site/` | `lib/landing/` |
| **User** | `/dashboard`, `/compose`, `/styles`, `/connect` | `app/(user)/` | `components/user/` | `lib/user/` |
| **Admin** | `/admin`, `/admin/team`, `/admin/publishing`, `/admin/accounts`, `/admin/usage` | `app/(admin)/` | `components/admin/` | `lib/admin/` |
| Team picker | `/who` | `app/who/` | `components/team/who/` | `lib/team/` |

Folders in `(brackets)` are Next.js route groups: they organise code without
appearing in the URL. Each group's `layout.tsx` is that site's shell — its
nav, footer and access rules.

## Where do I change…

| I want to change… | Edit |
|---|---|
| Any wording or number on the landing page | `components/landing/content.ts` |
| One landing section's layout | `components/landing/sections/<Name>Section.tsx` |
| The order of landing sections | `app/(marketing)/page.tsx` |
| The star animation (speed, depth, colours) | `components/landing/scene/config.ts` |
| Stars, flight, lens | `components/landing/scene/sky.ts` |
| The gold post star and the constellation | `components/landing/scene/story.ts` |
| Shooting stars | `components/landing/scene/meteors.ts` |
| Mouse / tilt / click behaviour | `components/landing/scene/input.ts` |
| The user nav (links, Admin button) | `components/user/nav/UserNav.tsx` |
| The user dashboard | `components/user/dashboard/*`, data in `lib/user/dashboard.ts` |
| The composer's order of sections | `app/(user)/compose/page.tsx` |
| The composer's state, upload, generate and submit | `components/user/compose/useComposeForm.ts` |
| Caption inheritance, per-account counters, X replies, the `/api/posts` body | `lib/user/compose.ts` |
| Media box / "Post to" account pills | `components/user/compose/MediaPicker.tsx` / `AccountPicker.tsx` |
| AI caption generation (brief, button, side-by-side cards) | `components/user/compose/CaptionGenerator.tsx`, `GeneratedCaptionCard.tsx` |
| Caption tabs and per-platform / per-account overrides | `components/user/compose/CaptionEditor.tsx`, `PlatformCaptionField.tsx`, `AccountCaptionFields.tsx` |
| Character counts under the caption | `components/user/compose/TargetCounters.tsx` |
| X first comment and thread | `components/user/compose/XReplies.tsx` |
| Schedule picker / submit button and errors | `components/user/compose/SchedulePicker.tsx` / `SubmitBar.tsx` |
| Caption styles page sections | `components/user/styles/*` (`PlatformTabs`, `GenerateToggle`, `InstructionsField`, `ExamplePosts`, `ModelField`, `SaveBar`) |
| Caption styles loading and saving | `components/user/styles/useStylesForm.ts`, logic in `lib/user/styles.ts` |
| The admin top bar / sidebar | `components/admin/shell/` |
| An admin page's numbers | `lib/admin/<page>.ts` (`overview`, `publishing`, `usage`, `team`) |
| An admin page's sections | `components/admin/<page>/` |
| Admin building blocks (panel, tile, table, meter) | `components/admin/ui/` |
| Admin charts | `components/admin/charts/` |
| Chart colours | `components/admin/ui/viz.ts` — validated, see the comment there |
| What a role may do | `lib/team/roles.ts` (one table: `LOWEST_ROLE`) |
| Where each role lands after picking | `homeFor` in `lib/team/roles.ts` |
| Activity log wording | `lib/admin/activity.ts` |
| Brand colours, light/dark | `app/globals.css` (tokens) → `tailwind.config.js` |

## Team mode and roles

`TEAM_MODE=1` in `.env.local` turns login off: the server signs into one
shared workspace account (`WORKSPACE_EMAIL` / `WORKSPACE_PASSWORD`) and each
person picks their name on `/who`. Owners and admins land on `/admin`,
editors and viewers on `/dashboard`. **Unset `TEAM_MODE` to bring login back
before launch.** It refuses to run in a production build unless
`ALLOW_TEAM_MODE_IN_PRODUCTION=1`.

| Piece | File |
|---|---|
| The switch and its production guard | `lib/team/mode.ts` |
| Signing into the workspace, sending people to `/who` | `middleware.ts` |
| Who is acting on this request, and may they | `lib/team/access.ts` (`getAccess`, `allows`, `forbidUnless`) |
| Bounce to `/who` when the picked member is gone | `lib/team/guards.ts` |
| Page-level role check | `components/team/RoleGate.tsx`, used from route `layout.tsx` files |
| API-level role check | `forbidUnless(...)` at the top of each API route |
| Members API | `app/api/team/members/`, `app/api/team/select/` |
| Tables | `supabase/migrations/0008_team_members.sql` |

Roles are checked twice on purpose: pages hide what a role can't use, and
the API refuses it anyway, because a page can be skipped and a request can't.

## How to…

**Add a landing section.** Create `components/landing/sections/FooSection.tsx`,
put its words in `content.ts`, and add `<FooSection />` to
`app/(marketing)/page.tsx`. Mark elements `data-reveal` to fade them in;
give the `<section>` `data-warp="1"` for a camera warp as it scrolls past.

**Add an admin page.** Create `app/(admin)/admin/foo/page.tsx`, compute its
numbers in `lib/admin/foo.ts` from `loadAdminData()`, put its sections in
`components/admin/foo/`, and add it to `SECTIONS` in
`components/admin/shell/AdminSidebar.tsx`. The admin layout already checks
the role.

**Log a new kind of activity.** Call `logActivity(supabase, 'thing.happened',
{ ...detail })` in the API route, then add its sentence to
`lib/admin/activity.ts` (and a line to `tests/admin-activity.test.ts`).

**Gate a new action by role.** Add it to `Action` and `LOWEST_ROLE` in
`lib/team/roles.ts`, call `forbidUnless('your_action')` in the API route, and
wrap the page in `<RoleGate need="your_action">` from its `layout.tsx`.

## Tests

`npm test` runs `tests/*.test.ts` (CI rejects nested test files). Pure logic is
tested; components are not. The ones that matter most for the code above:

- `tests/team-roles.test.ts` — who may do what, last-owner rule, `homeFor`
- `tests/admin-stats.test.ts` — every number on the admin dashboard
- `tests/admin-activity.test.ts` — activity sentences
- `tests/starfield.test.ts` — the landing animation's maths
- `tests/user-compose.test.ts` — composer caption inheritance, counters, X replies, request body; styles defaults

## Gotchas

- **Don't run `npx next build` while a dev server is running** in the same
  folder: they share `.next/` and the dev server's cache gets corrupted.
- Admin tables sit in `components/admin/ui/DataTable.tsx`, which is
  `relative` on purpose: without it, a screen-reader-only header escapes the
  scroll box and widens the whole page on a phone.
- The landing page must stay static (`○` in the build output). Nothing under
  `app/(marketing)/` may read cookies or the session — the signed-out nav
  (`components/site/MarketingNav.tsx`) exists for exactly this reason.
- The admin dashboard computes in memory from the last 60 days of rows
  (`lib/admin/data.ts`). Fine for a team; revisit if a workspace grows to
  thousands of posts a month.
