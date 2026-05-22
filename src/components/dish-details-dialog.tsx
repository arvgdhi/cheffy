import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { getDishDetails, NUTRITION_FIELDS, type DishNutrition } from "@/lib/dish.functions";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Utensils } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";

function nutritionEntries(nutrition: DishNutrition | null | undefined) {
  return NUTRITION_FIELDS.map((field) => ({
    ...field,
    value: nutrition?.[field.key] ?? 0,
  })).filter((entry) => entry.value > 0);
}

export function DishDetailsDialog({
  dishId,
  open,
  onOpenChange,
}: {
  dishId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fetchDetails = useServerFn(getDishDetails);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dish", dishId],
    queryFn: () => (dishId ? fetchDetails({ data: { id: dishId } }) : null),
    enabled: !!dishId && open,
  });

  const nutrients = nutritionEntries(data?.nutrition);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Dish Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex justify-center items-center py-32">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive font-medium">
            Failed to load dish details. Please try again.
          </div>
        ) : data ? (
          <>
            <div className="relative h-48 sm:h-64 shrink-0 bg-muted">
              {data.image ? (
                <img src={data.image} alt={data.title} className="w-full h-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Utensils className="size-14 text-muted-foreground/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6">
                <h2 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
                  {data.title}
                </h2>
              </div>
            </div>

            <ScrollArea className="flex-1 px-6 py-6 bg-card">
              <div className="grid md:grid-cols-5 gap-8">
                <div className="md:col-span-2 space-y-8">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg font-display tracking-tight border-b pb-2">
                      Nutrition
                    </h3>
                    {nutrients.length > 0 ? (
                      <>
                        <div className="h-48 w-full -ml-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={nutrients}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={75}
                                paddingAngle={3}
                                dataKey="value"
                                stroke="none"
                              >
                                {nutrients.map((entry) => (
                                  <Cell key={entry.key} fill={entry.color} />
                                ))}
                              </Pie>
                              <RechartsTooltip
                                formatter={(value, _name, props) => {
                                  const payload = props.payload as {
                                    unit?: string;
                                    label?: string;
                                  };
                                  const numericValue = Number(value);
                                  return [
                                    `${Math.round(numericValue * 10) / 10}${payload.unit ?? ""}`,
                                    payload.label ?? "Nutrition",
                                  ];
                                }}
                                contentStyle={{
                                  borderRadius: "8px",
                                  border: "1px solid var(--color-border)",
                                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm pt-2">
                          {nutrients.map((entry) => (
                            <div
                              key={entry.key}
                              className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md"
                            >
                              <div
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-muted-foreground">
                                {entry.label}
                                <span className="text-foreground font-medium ml-1">
                                  {Math.round(entry.value * 10) / 10}
                                  {entry.unit}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-xl">
                        No nutrition data has been added for this dish.
                      </p>
                    )}
                  </div>
                </div>

                <div className="md:col-span-3 space-y-4">
                  <h3 className="font-semibold text-lg font-display tracking-tight border-b pb-2">
                    Recipe
                  </h3>
                  {data.recipe ? (
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {data.recipe}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-xl">
                      No recipe has been added for this dish.
                    </p>
                  )}
                </div>
              </div>
            </ScrollArea>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
