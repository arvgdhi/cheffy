# Panarchy — Build Plan

## Product

A household meal-wishlist app. Family members and cooks add dishes via Spoonacular search. A weekly leaderboard surfaces the most-wanted dishes. Cooks schedule winning dishes for specific meals. Resets every Saturday midnight.

## Data Model (Lovable Cloud / Supabase)

**Tables**

- `households` — id, name, invite_code (unique, 6-char), created_by, created_at
- `profiles` — id (FK auth.users), display_name, household_id, role (`cook` | `member` | `both`), created_at. Auto-created on signup via trigger.
- `wishlist_items` — id, household_id, user_id, spoonacular_id, dish_name, dish_image, nutrition_score, week_start (date of the Saturday that began this week), created_at
- `scheduled_dishes` — id, household_id, spoonacular_id, dish_name, dish_image, scheduled_date, meal_type (`breakfast` | `lunch` | `dinner`), created_by, created_at, completed (bool)

**RLS**

- All tables: household-scoped (`household_id` matches the user's household). No cross-household leakage.
- Profiles: users can read household peers, update only their own.

## Auth Flow

- Email/password sign-up via Lovable Cloud.
- On first login, user is redirected to `/onboarding` to either:
  - **Create a household** (becomes creator, assigns self a role).
  - **Join a household** via 6-character invite code.
- Post-onboarding, redirect to `/app`.

## Routes

| Route                  | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `/`                    | Landing page → redirect to `/app` if authenticated                       |
| `/login`               | Email/password login                                                     |
| `/signup`              | Email/password signup                                                    |
| `/onboarding`          | Create or join household (post-auth gate)                                |
| `/_authenticated/app`  | Main app shell. Two tabs: **Leaderboard** (default) and **Wishlist**     |
| `/_authenticated/cook` | Cook dashboard: scheduled dishes sorted by soonest. Shows recipe button. |

## Server Functions

1. **Household**
   - `createHousehold(name, role)` → creates household + invite code, sets creator's role
   - `joinHousehold(inviteCode, role)` → links profile to household
   - `getHouseholdMembers()` → list of peers in same household

2. **Spoonacular proxy**
   - `searchDishes(query)` → `GET /recipes/complexSearch?query=...&number=12&addRecipeNutrition=true`
   - `getDishDetails(id)` → `GET /recipes/{id}/information?includeNutrition=true`
     > Requires `SPOONACULAR_API_KEY` secret.

3. **Wishlist**
   - `addToWishlist(dish)` — upsert by `(household_id, spoonacular_id, current_week_start)` to prevent duplicates per week
   - `getWishlist()` — current week's items for user's household, ordered newest first
   - `removeFromWishlist(id)`

4. **Leaderboard**
   - `getLeaderboard()` — aggregated wishlist counts for current week, sorted desc

5. **Scheduling (cook only)**
   - `scheduleDish({ spoonacularId, dishName, dishImage, date, mealType })`
   - `getScheduledDishes()` — user's household, ordered by `scheduled_date ASC, meal_type ASC`
   - `toggleCompleted(id)`

6. **Reset**
   - `archiveOldWishlist()` — sets `is_archived=true` (or deletes) for items from past weeks. Called automatically on first load after Saturday midnight, plus a cron-like check.

## UI Components

### Wishlist Tab

- Title left-aligned, small muted subtitle below: "Tap + to wishlist a dish from Spoonacular."
- **Empty state:** Large low-opacity plate + fork + spoon icons centered. Text: "No wishlists yet"
- **Grid:** 2-column grid of square cards. Card: dish image, bold name below, small pie-chart nutrition rating (Recharts).
- Floating-action `+` button → opens search dialog.

### Search Dialog

- Input field with debounce.
- Results as scrollable list: image thumbnail, dish name, small description.
- Tap to select → fetches full details → adds to wishlist → toast confirmation.

### Leaderboard Tab

- Title left-aligned, subtitle: "The most wanted dishes this week."
- Ranked list (or top 3 podium + list). Each row: rank number, dish image, name, vote count (number of wishlists), cook-action button to schedule.
- Cooks can tap any dish → schedule dialog with date picker + meal type dropdown.

### Cook Dashboard (`/_authenticated/cook`)

- Title: "Cooking Schedule"
- List of scheduled dishes ordered by soonest date/meal.
- Card: dish image, name, date badge, meal type badge.
- Button: "Show Recipe" → opens recipe details (from Spoonacular) in a dialog/sheet.
- Checkbox to mark completed.

### Weekly Reset

- Wishlist items are scoped to `week_start`. The current week is computed from the most recent Saturday midnight.
- UI automatically shows only current-week items. No manual reset needed.
- A server function `resetWishlist()` is exposed for explicit reset if desired.

## Design Direction

- Warm, food-friendly palette (suggested: Terracotta & Sage or Warm Sand). Ask user to confirm palette before build if they have no preference.
- Friendly rounded cards, soft shadows.
- Clear hierarchy with left-aligned section headers and muted helper text.

## External Dependencies

- **Spoonacular API**: User signs up at spoonacular.com/food-api, gets free-tier key, adds via Lovable secrets as `SPOONACULAR_API_KEY`.

## Implementation Order

1. Enable Lovable Cloud + configure email/password auth.
2. Write database migrations (households, profiles trigger, wishlist_items, scheduled_dishes).
3. Add `SPOONACULAR_API_KEY` secret (prompt user).
4. Build server functions (household, Spoonacular proxy, wishlist, leaderboard, scheduling).
5. Build routes + pages: onboarding, app (leaderboard + wishlist tabs), cook dashboard.
6. Polish empty states, nutrition charts, recipe viewer, weekly reset logic.
7. QA: test wishlist flow, leaderboard aggregation, cook scheduling, and reset behavior.

## Security Notes

- Spoonacular key stays server-side only (server functions).
- All data queries scoped to `household_id` via RLS.
- Cook scheduling UI shown to all, but server validates role on `scheduleDish`.
