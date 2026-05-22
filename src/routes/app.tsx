import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  CalendarPlus,
  ImagePlus,
  Loader2,
  Plus,
  Trophy,
  Utensils,
  ListChecks,
  Settings,
  LogOut,
  DoorOpen,
  Copy,
  RefreshCw,
  UserPlus,
  CheckCircle2,
  Circle
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useEnsureHousehold } from "@/components/app-shell";
import { DishDetailsDialog } from "@/components/dish-details-dialog";
import { addDishToWishlist, NUTRITION_FIELDS, type DishNutrition, type NutritionKey } from "@/lib/dish.functions";
import { scheduleDish } from "@/lib/schedule.functions";
import { getMySelections, saveSelections, getDailyLeaderboard, getHouseholdDishlist } from "@/lib/selections.functions";
import { regenerateInviteCode, leaveHousehold } from "@/lib/household.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app")({
  component: AppPage,
});

type Tab = "selections" | "dishlist" | "leaderboard" | "settings";

function getLocalDateString(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function AppPage() {
  const { data, ready } = useEnsureHousehold();
  const [activeTab, setActiveTab] = useState<Tab>("selections");
  const [addOpen, setAddOpen] = useState(false);
  const [bypassForceToSettings, setBypassForceToSettings] = useState(false);

  const fetchSelections = useServerFn(getMySelections);
  
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getLocalDateString(d);
  }, []);

  const { data: tomorrowSelections, isLoading } = useQuery({ 
    queryKey: ["selections", tomorrowStr], 
    queryFn: () => fetchSelections({ data: { date: tomorrowStr } }),
    enabled: ready
  });

  if (!ready || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isForced = (!tomorrowSelections || tomorrowSelections.selections.length < 5) && !bypassForceToSettings;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col relative overflow-hidden">
      {(!tomorrowSelections || tomorrowSelections.selections.length < 5) && !bypassForceToSettings && <FloatingIconsBackground />}

      {!isForced && (
        <header className="px-5 md:px-8 py-2 border-b bg-background/80 backdrop-blur-md sticky top-0 z-40 transition-colors flex items-center justify-between">
          <div className="max-w-3xl mx-auto flex items-center justify-between w-full">
            <div className="flex items-center gap-2 group">
              <div className="size-7 rounded-xl bg-primary/10 flex items-center justify-center">
                <Utensils className="size-4 text-primary" />
              </div>
              <span className="font-display font-semibold tracking-tight text-base">Cheffy</span>
            </div>
            {bypassForceToSettings && (
               <Button variant="ghost" size="sm" onClick={() => setBypassForceToSettings(false)}>Back to Selections</Button>
            )}
          </div>
        </header>
      )}

      <main className={`flex-1 overflow-y-auto ${!isForced ? 'pb-20' : ''}`}>
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 h-full relative">
          {isForced ? (
            <SelectionForceScreen 
              date={tomorrowStr} 
              initialSelections={tomorrowSelections?.selections?.map(s => s.dish_id) ?? []} 
              onSettingsClick={() => setBypassForceToSettings(true)}
              onAddClick={() => setAddOpen(true)}
            />
          ) : (
            <div className="page-transition-enter">
              {activeTab === "selections" && <SelectionsTab />}
              {activeTab === "dishlist" && <DishlistTab />}
              {activeTab === "leaderboard" && <LeaderboardTab isCook={data.profile?.role === "cook" || data.profile?.role === "both"} />}
              {activeTab === "settings" && <SettingsTab data={data} />}
            </div>
          )}
        </div>
      </main>

      {!isForced && (
        <BottomBar activeTab={activeTab} onChange={setActiveTab} onAddClick={() => setAddOpen(true)} />
      )}

      <AddDishDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={() => setActiveTab("dishlist")} />
    </div>
  );
}

function FloatingIconsBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-40">
      <div className="absolute bottom-[-20%] left-[10%] animate-float-1"><Utensils className="size-12 text-primary/30" /></div>
      <div className="absolute bottom-[-20%] left-[30%] animate-float-2"><ImagePlus className="size-8 text-accent/40" /></div>
      <div className="absolute bottom-[-20%] left-[50%] animate-float-3" style={{ animationDelay: '2s' }}><ListChecks className="size-16 text-primary/20" /></div>
      <div className="absolute bottom-[-20%] left-[70%] animate-float-1" style={{ animationDelay: '1s' }}><Trophy className="size-10 text-secondary-foreground/20" /></div>
      <div className="absolute bottom-[-20%] left-[90%] animate-float-2" style={{ animationDelay: '3s' }}><Camera className="size-14 text-accent/30" /></div>
    </div>
  );
}

function SelectionForceScreen({ 
  date, 
  initialSelections, 
  onSettingsClick, 
  onAddClick 
}: { 
  date: string, 
  initialSelections: string[], 
  onSettingsClick: () => void,
  onAddClick: () => void
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="h-full flex flex-col items-center justify-center relative z-10 page-transition-enter">
      <div className="text-center mb-8">
        <h1 className="font-display text-4xl font-bold mb-2 tracking-tight">Tomorrow's Menu</h1>
        <p className="text-muted-foreground max-w-xs mx-auto">
          Please select at least 5 dishes you'd like to eat tomorrow to continue.
        </p>
      </div>
      
      <button 
        onClick={() => setOpen(true)}
        className="size-48 rounded-full bg-primary text-primary-foreground shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-3 animate-pulse"
        style={{ animationDuration: '3s' }}
      >
        <ListChecks className="size-12" />
        <span className="font-semibold text-lg">Select Dishes</span>
      </button>

      <div className="absolute bottom-4 left-4 flex gap-2">
        <Button onClick={onAddClick} variant="outline" className="rounded-full shadow-md bg-background/80 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground transition-colors">
          <Plus className="size-5 mr-2" /> Add Dish
        </Button>
      </div>

      <div className="absolute bottom-4 right-4">
        <Button onClick={onSettingsClick} variant="ghost" size="icon" className="rounded-full bg-background/50 backdrop-blur-sm" aria-label="Settings">
          <Settings className="size-5 text-muted-foreground" />
        </Button>
      </div>

      <SelectionDialog open={open} onOpenChange={setOpen} date={date} initialSelections={initialSelections} />
    </div>
  );
}

function SelectionDialog({ open, onOpenChange, date, initialSelections }: { open: boolean, onOpenChange: (open: boolean) => void, date: string, initialSelections: string[] }) {
  const fetchDishlist = useServerFn(getHouseholdDishlist);
  const saveFn = useServerFn(saveSelections);
  const qc = useQueryClient();
  
  const { data, isLoading } = useQuery({ queryKey: ["dishlist"], queryFn: () => fetchDishlist() });
  
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelections));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelections));
    }
  }, [open, initialSelections]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const submit = async () => {
    if (selected.size < 5) {
      toast.error("Please select at least 5 dishes.");
      return;
    }
    setBusy(true);
    try {
      await saveFn({ data: { date, dishIds: Array.from(selected) } });
      qc.invalidateQueries({ queryKey: ["selections"] });
      onOpenChange(false);
      toast.success("Selections saved!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Dishes for {date}</DialogTitle>
          <DialogDescription>Tap to select. Choose at least 5 ({selected.size} selected).</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-[40vh] py-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>
          ) : !data || data.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No dishes available. Ask your cook to add some!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {data.items.map(dish => {
                const isSel = selected.has(dish.dish_id);
                return (
                  <div 
                    key={dish.dish_id}
                    onClick={() => toggle(dish.dish_id)}
                    className={`relative rounded-xl border p-2 cursor-pointer transition-all ${isSel ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border/50 hover:border-primary/30'}`}
                  >
                    <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-2">
                      {dish.dish_image ? <img src={dish.dish_image} className="w-full h-full object-cover" /> : <Utensils className="size-8 m-auto opacity-20 h-full" />}
                    </div>
                    <p className="text-sm font-medium line-clamp-2 leading-tight">{dish.dish_name}</p>
                    <div className="absolute top-3 right-3 bg-background rounded-full shadow-sm">
                      {isSel ? <CheckCircle2 className="size-5 text-primary" /> : <Circle className="size-5 text-muted-foreground/30" />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <DialogFooter className="mt-auto pt-4 border-t">
          <Button onClick={submit} disabled={busy || selected.size < 5} className="w-full sm:w-auto">
            {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Save Selections
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelectionsTab() {
  const tomorrowStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return getLocalDateString(d);
  }, []);
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  
  const fetchSelections = useServerFn(getMySelections);
  const { data: tomData } = useQuery({ queryKey: ["selections", tomorrowStr], queryFn: () => fetchSelections({ data: { date: tomorrowStr } }) });
  const { data: todData } = useQuery({ queryKey: ["selections", todayStr], queryFn: () => fetchSelections({ data: { date: todayStr } }) });

  const [open, setOpen] = useState(false);
  const [activeDate, setActiveDate] = useState(tomorrowStr);
  const [initialSels, setInitialSels] = useState<string[]>([]);

  const openDialog = (date: string, sels: string[]) => {
    setActiveDate(date);
    setInitialSels(sels);
    setOpen(true);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold">Your Selections</h2>
        <p className="text-sm text-muted-foreground mt-1">Review and update your choices.</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 rounded-2xl border bg-card shadow-sm flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Tomorrow</h3>
            <p className="text-sm text-muted-foreground">{tomData?.selections.length || 0} dishes selected</p>
          </div>
          <Button variant="secondary" onClick={() => openDialog(tomorrowStr, tomData?.selections.map(s => s.dish_id) ?? [])}>Edit</Button>
        </div>

        <div className="p-4 rounded-2xl border bg-card shadow-sm flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Today</h3>
            <p className="text-sm text-muted-foreground">{todData?.selections.length || 0} dishes selected</p>
            <p className="text-xs text-muted-foreground mt-1">Locks at 7:00 AM</p>
          </div>
          <Button variant="secondary" onClick={() => openDialog(todayStr, todData?.selections.map(s => s.dish_id) ?? [])}>Edit</Button>
        </div>
      </div>

      <SelectionDialog open={open} onOpenChange={setOpen} date={activeDate} initialSelections={initialSels} />
    </div>
  );
}

function DishlistTab() {
  const fetchDishlist = useServerFn(getHouseholdDishlist);
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["dishlist"], queryFn: () => fetchDishlist() });
  const [detailsId, setDetailsId] = useState<string | null>(null);

  return (
    <section>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-semibold">Dishlist</h2>
        <p className="text-sm text-muted-foreground opacity-80 mt-1">All dishes available in your household.</p>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center pt-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <div className="text-center py-12 text-destructive">
          <p>Error loading dishlist: {(error as Error).message}</p>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Utensils className="size-12 mx-auto opacity-30 mb-3" />
          <p>No dishes added yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {data.items.map((item) => (
            <div key={item.id} onClick={() => setDetailsId(item.dish_id)} className="group relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden hover:shadow-md hover:border-primary/20 transition-all duration-300 cursor-pointer">
              <div className="aspect-square bg-muted overflow-hidden flex items-center justify-center">
                {item.dish_image ? <img src={item.dish_image} className="w-full h-full object-cover" /> : <Utensils className="size-10 text-muted-foreground/40" />}
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-sm line-clamp-2">{item.dish_name}</h3>
              </div>
            </div>
          ))}
        </div>
      )}
      <DishDetailsDialog dishId={detailsId} open={detailsId !== null} onOpenChange={(open) => !open && setDetailsId(null)} />
    </section>
  );
}

function LeaderboardTab({ isCook }: { isCook: boolean }) {
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const [date, setDate] = useState(todayStr);

  const fetchLb = useServerFn(getDailyLeaderboard);
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["leaderboard", date], queryFn: () => fetchLb({ data: { date } }) });
  
  const [scheduleFor, setScheduleFor] = useState<null | { dishId: string; dishName: string; dishImage: string | null }>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Leaderboard</h2>
          <p className="text-sm text-muted-foreground opacity-80 mt-1">Aggregated selections for {date === todayStr ? 'Today' : date}.</p>
        </div>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" />
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center pt-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : isError ? (
          <div className="text-center py-12 text-destructive">
            <p>Error loading leaderboard: {(error as Error).message}</p>
          </div>
        ) : !data || data.leaderboard.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Trophy className="size-12 mx-auto opacity-30 mb-3" />
            <p>No selections made for this date.</p>
          </div>
        ) : (
          <ol className="space-y-2">
            {data.leaderboard.map((dish, index) => (
              <li key={dish.dishId}>
                <div onClick={() => setDetailsId(dish.dishId)} className={`group w-full flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 text-left cursor-pointer ${dish.isScheduled ? 'border-primary bg-primary/5' : 'border-border/50 bg-card/50 hover:bg-muted/50'}`}>
                  <span className={`size-9 rounded-full flex items-center justify-center font-display font-semibold ${index === 0 ? "bg-primary text-primary-foreground" : index < 3 ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
                    {index + 1}
                  </span>
                  <div className="size-12 rounded-lg bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                    {dish.dishImage ? <img src={dish.dishImage} className="w-full h-full object-cover" /> : <Utensils className="size-6 text-muted-foreground/40" />}
                    {dish.isScheduled && <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"><CheckCircle2 className="size-6 text-primary drop-shadow-md" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold line-clamp-1 flex items-center gap-2">
                      {dish.dishName}
                      {dish.isScheduled && <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm">Scheduled</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dish.votes} {dish.votes === 1 ? "selection" : "selections"}
                    </p>
                  </div>
                  {isCook && !dish.isScheduled && (
                    <Button size="sm" variant="secondary" className="ml-auto shrink-0" onClick={(e) => { e.stopPropagation(); setScheduleFor(dish); }}>
                      <CalendarPlus className="size-4 mr-1.5 hidden sm:inline" />
                      <span className="hidden sm:inline">Prepare</span>
                      <CalendarPlus className="size-4 sm:hidden" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <ScheduleDialog dish={scheduleFor} date={date} onClose={() => setScheduleFor(null)} />
      <DishDetailsDialog dishId={detailsId} open={detailsId !== null} onOpenChange={(open) => !open && setDetailsId(null)} />
    </section>
  );
}

function ScheduleDialog({ dish, date, onClose }: { dish: null | { dishId: string; dishName: string; dishImage: string | null }, date: string, onClose: () => void }) {
  const scheduleFn = useServerFn(scheduleDish);
  const qc = useQueryClient();
  const [meal, setMeal] = useState<"breakfast" | "lunch" | "dinner">("dinner");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!dish) return;
    setBusy(true);
    try {
      await scheduleFn({ data: { dishId: dish.dishId, dishName: dish.dishName, dishImage: dish.dishImage, date, mealType: meal } });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success("Scheduled!");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!dish} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prepare {dish?.dishName}</DialogTitle>
          <DialogDescription>Schedule this dish for {date}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Meal</Label>
            <Select value={meal} onValueChange={(value) => setMeal(value as "breakfast" | "lunch" | "dinner")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving..." : "Confirm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsTab({ data }: { data: any }) {
  const router = useRouter();
  const leaveFn = useServerFn(leaveHousehold);
  const regenFn = useServerFn(regenerateInviteCode);
  const [localCode, setLocalCode] = useState(data.household?.invite_code);
  const [regenBusy, setRegenBusy] = useState(false);
  
  const isCreator = data.profile?.id === data.household?.created_by;

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }

  return (
    <section className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your household and account.</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 rounded-2xl border bg-card">
          <h3 className="font-semibold mb-1">Household Invite Code</h3>
          <p className="text-xs text-muted-foreground mb-4">Share this code with family members.</p>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-12 flex items-center justify-center rounded-md border bg-muted/50 font-mono text-xl tracking-[0.3em] font-medium">
              {localCode}
            </div>
            <Button size="icon" className="size-12" onClick={() => { navigator.clipboard.writeText(localCode); toast.success("Copied!"); }}>
              <Copy className="size-5" />
            </Button>
          </div>
          {isCreator && (
            <Button variant="outline" size="sm" disabled={regenBusy} onClick={async () => {
              setRegenBusy(true);
              try {
                const res = await regenFn();
                if (res?.household?.invite_code) { setLocalCode(res.household.invite_code); toast.success("New code generated"); }
              } catch (e) { toast.error((e as Error).message); }
              finally { setRegenBusy(false); }
            }}>
              <RefreshCw className={`size-4 mr-2 ${regenBusy ? 'animate-spin' : ''}`} /> Generate new code
            </Button>
          )}
        </div>

        <div className="p-4 rounded-2xl border border-destructive/20 bg-destructive/5 space-y-3">
          <h3 className="font-semibold text-destructive">Danger Zone</h3>
          <Button variant="destructive" className="w-full justify-start" onClick={async () => {
            try { await leaveFn(); toast.success("Left household"); router.navigate({ to: "/onboarding" }); }
            catch (e) { toast.error((e as Error).message); }
          }}>
            <DoorOpen className="size-4 mr-2" /> Leave Household
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4 mr-2" /> Log out
          </Button>
        </div>
      </div>
    </section>
  );
}

function BottomBar({ activeTab, onChange, onAddClick }: { activeTab: Tab, onChange: (t: Tab) => void, onAddClick: () => void }) {
  const tabs = [
    { id: "selections", icon: ListChecks, label: "Selections" },
    { id: "dishlist", icon: Utensils, label: "Dishlist" },
    { id: "leaderboard", icon: Trophy, label: "Leaderboard" },
    { id: "settings", icon: Settings, label: "Settings" }
  ] as const;

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background/90 backdrop-blur-xl pb-safe z-50">
      <div className="max-w-md mx-auto flex items-center justify-around p-2">
        {tabs.slice(0, 3).map(tab => (
          <button key={tab.id} onClick={() => onChange(tab.id)} className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <tab.icon className={`size-6 ${activeTab === tab.id ? 'fill-primary/20' : ''}`} />
            <span className="text-[10px] font-medium mt-1">{tab.label}</span>
          </button>
        ))}
        
        <button onClick={onAddClick} className="flex flex-col items-center justify-center p-2 -mt-4">
          <div className="size-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">
            <Plus className="size-6" />
          </div>
          <span className="text-[10px] font-medium mt-1 text-primary">Add</span>
        </button>

        <button onClick={() => onChange("settings")} className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${activeTab === "settings" ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          <Settings className={`size-6 ${activeTab === "settings" ? 'fill-primary/20' : ''}`} />
          <span className="text-[10px] font-medium mt-1">Settings</span>
        </button>
      </div>
    </div>
  );
}

const EMPTY_NUTRITION: Record<NutritionKey, string> = { protein: "", fat: "", carbohydrates: "", fiber: "", vitamins: "", minerals: "" };

function AddDishDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) {
  const addDish = useServerFn(addDishToWishlist);
  const qc = useQueryClient();
  const [dishName, setDishName] = useState("");
  const [dishImage, setDishImage] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState<Record<NutritionKey, string>>({ ...EMPTY_NUTRITION });
  const [recipe, setRecipe] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

  useEffect(() => {
    if (!open) { setDishName(""); setDishImage(null); setNutrition({ ...EMPTY_NUTRITION }); setRecipe(""); setBusy(false); setImageBusy(false); }
  }, [open]);

  async function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageBusy(true);
    try { setDishImage(await resizeImage(file)); }
    catch (error) { toast.error((error as Error).message); }
    finally { setImageBusy(false); }
  }

  function buildNutrition() {
    const out: DishNutrition = {};
    for (const field of NUTRITION_FIELDS) {
      const raw = nutrition[field.key].trim();
      if (!raw) continue;
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) out[field.key] = value;
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = dishName.trim();
    if (!name) return;
    if (!dishImage) { toast.error("Add a photo of the dish first."); return; }
    setBusy(true);
    try {
      await addDish({ data: { dishName: name, dishImage, nutrition: buildNutrition(), recipe: recipe.trim() || null } });
      qc.invalidateQueries({ queryKey: ["dishlist"] });
      toast.success(`Added ${name}`);
      onOpenChange(false);
      onSuccess();
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a dish</DialogTitle>
          <DialogDescription>Take a photo, name the dish, and add nutrition or recipe details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Dish photo</Label>
            <div className="grid sm:grid-cols-[160px_1fr] gap-3">
              <div className="aspect-square rounded-xl bg-muted border overflow-hidden flex items-center justify-center relative">
                {dishImage ? <img src={dishImage} alt="Preview" className="h-full w-full object-cover" /> : imageBusy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-8 text-muted-foreground/50" />}
              </div>
              <div className="space-y-2 flex flex-col justify-center">
                <div className="relative">
                  <Input type="file" accept="image/*" capture="environment" onChange={onImageChange} disabled={busy || imageBusy} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <Button type="button" variant="outline" className="w-full pointer-events-none">
                    <Camera className="size-4 mr-2" /> Choose dish picture
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Photos are resized automatically.</p>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Dish name</Label>
            <Input required maxLength={200} value={dishName} onChange={(e) => setDishName(e.target.value)} placeholder="e.g. paneer tikka" />
          </div>
          <div className="space-y-3">
            <Label>Nutrition data (Optional)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {NUTRITION_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{field.label} ({field.unit})</Label>
                  <Input type="number" min="0" step="0.1" inputMode="decimal" value={nutrition[field.key]} onChange={(e) => setNutrition((c) => ({ ...c, [field.key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Recipe (Optional)</Label>
            <Textarea value={recipe} maxLength={6000} onChange={(e) => setRecipe(e.target.value)} placeholder="Ingredients, instructions..." className="min-h-32" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy || imageBusy}>{busy ? <Loader2 className="size-4 animate-spin mr-2" /> : <Camera className="size-4 mr-2" />} Add dish</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function resizeImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("Choose an image file.")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Could not load the image."));
      image.onload = () => {
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Could not prepare the image.")); return; }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
