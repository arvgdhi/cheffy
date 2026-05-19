import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { getDishDetails } from "@/lib/spoonacular.functions";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLORS = {
  Protein: "hsl(var(--primary))",
  Fat: "hsl(var(--destructive))",
  Carbohydrates: "hsl(var(--accent))",
};

export function DishDetailsDialog({
  dishId,
  open,
  onOpenChange,
}: {
  dishId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fetchDetails = useServerFn(getDishDetails);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["dish", dishId],
    queryFn: () => dishId ? fetchDetails({ data: { id: dishId } }) : null,
    enabled: !!dishId && open,
  });

  const macroData = data?.nutrients
    .filter((n) => ["Protein", "Fat", "Carbohydrates"].includes(n.name))
    .map((n) => ({
      name: n.name,
      value: n.amount,
      unit: n.unit,
    })) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Dish Details</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="flex-1 flex justify-center items-center py-32">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive font-medium">Failed to load dish details. Please try again.</div>
        ) : (
          <>
            <div className="relative h-48 sm:h-64 shrink-0 bg-muted">
              {data.image ? (
                <img src={data.image} alt={data.title} className="w-full h-full object-cover" />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6">
                <h2 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
                  {data.title}
                </h2>
                <div className="flex gap-4 mt-2 text-sm text-muted-foreground font-medium">
                  {data.readyInMinutes && <span>{data.readyInMinutes} mins</span>}
                  {data.servings && <span>{data.servings} servings</span>}
                  <span>{data.nutritionScore}/100 Health Score</span>
                </div>
              </div>
            </div>
            
            <ScrollArea className="flex-1 px-6 py-6 bg-card">
              <div className="grid md:grid-cols-5 gap-8">
                {/* Left Col: Macros & Ingredients (2/5 width) */}
                <div className="md:col-span-2 space-y-8">
                  {/* Macros Chart */}
                  {macroData.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg font-display tracking-tight border-b pb-2">Macros</h3>
                      <div className="h-48 w-full -ml-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={macroData}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={75}
                              paddingAngle={3}
                              dataKey="value"
                              stroke="none"
                            >
                              {macroData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] ?? "hsl(var(--muted))"} />
                              ))}
                            </Pie>
                            <RechartsTooltip 
                              formatter={(value: number, name: string, props: any) => [`${Math.round(value)}${props.payload.unit}`, name]}
                              contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm pt-2">
                        {macroData.map(m => (
                          <div key={m.name} className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                            <div className="size-2.5 rounded-full" style={{ backgroundColor: COLORS[m.name as keyof typeof COLORS] }} />
                            <span className="text-muted-foreground">{m.name} <span className="text-foreground font-medium ml-1">{Math.round(m.value)}{m.unit}</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ingredients */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg font-display tracking-tight border-b pb-2">Ingredients</h3>
                    <ul className="space-y-2.5 text-sm">
                      {data.ingredients.map((ing, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="size-1.5 mt-1.5 rounded-full bg-primary/60 shrink-0" />
                          <span className="text-muted-foreground leading-snug">{ing.original}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right Col: Instructions (3/5 width) */}
                <div className="md:col-span-3 space-y-4">
                  <h3 className="font-semibold text-lg font-display tracking-tight border-b pb-2">Instructions</h3>
                  {data.instructions.length > 0 ? (
                    <ol className="space-y-5">
                      {data.instructions.map((step, i) => (
                        <li key={i} className="flex items-start gap-4 text-sm">
                          <span className="flex items-center justify-center size-7 shrink-0 rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20 shadow-sm">
                            {step.number}
                          </span>
                          <span className="text-muted-foreground mt-1 leading-relaxed">{step.step}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground italic bg-muted/50 p-4 rounded-xl">No instructions available for this recipe.</p>
                  )}
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
