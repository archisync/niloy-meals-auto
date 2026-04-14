"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type MealName = "breakfast" | "lunch" | "dinner";
type MealStatus = "pending" | "done" | "missed";

type MealRecord = {
  done?: boolean;
  customPrice?: number;
};

type DayRecord = Partial<Record<MealName, MealRecord>>;

type MonthState = {
  days: Record<string, DayRecord>;
  moneyEntries: Array<{ id: string; date: string; amount: number; note: string }>;
};

type AppState = {
  months: Record<string, MonthState>;
  settings: {
    breakfastPrice: number;
    lunchPrice: number;
    dinnerPrice: number;
    allowCustomMealPrice: boolean;
  };
  updatedAt: string;
};

const STORAGE_KEY = "meals-calculation-state-v1";
const TIME_ZONE = "Asia/Dhaka";
const SYNC_DEBOUNCE_MS = 300;
const LONG_PRESS_DURATION_MS = 550;

const mealLabels: Record<MealName, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

const defaultSettings: AppState["settings"] = {
  breakfastPrice: 50,
  lunchPrice: 100,
  dinnerPrice: 80,
  allowCustomMealPrice: false,
};

const defaultState: AppState = {
  months: {},
  settings: defaultSettings,
  updatedAt: new Date(0).toISOString(),
};

function loadLocalState() {
  if (typeof window === "undefined") {
    return null;
  }

  const local = localStorage.getItem(STORAGE_KEY);
  if (!local) {
    return null;
  }

  return JSON.parse(local) as AppState;
}

function hasMeaningfulLocalData(state: AppState) {
  const hasTrackedMealsOrMoney = Object.values(state.months).some(
    (month) => Object.keys(month.days).length > 0 || month.moneyEntries.length > 0,
  );

  if (hasTrackedMealsOrMoney) {
    return true;
  }

  return (
    state.settings.breakfastPrice !== defaultSettings.breakfastPrice ||
    state.settings.lunchPrice !== defaultSettings.lunchPrice ||
    state.settings.dinnerPrice !== defaultSettings.dinnerPrice ||
    state.settings.allowCustomMealPrice !== defaultSettings.allowCustomMealPrice
  );
}

function getCurrentMonthKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return `${year}-${month}`;
}

function toMonthDate(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1, 12));
}

function formatMonthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(toMonthDate(monthKey));
}

function nextMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1, 12));
  const nextYear = next.getUTCFullYear();
  const nextMonth = `${next.getUTCMonth() + 1}`.padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

function getDaysInMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

function getDayLabel(monthKey: string, day: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
  }).format(date);
}

function monthDateKey(monthKey: string, day: number) {
  return `${monthKey}-${`${day}`.padStart(2, "0")}`;
}

function getPrice(settings: AppState["settings"], meal: MealName, record?: MealRecord) {
  if (typeof record?.customPrice === "number") {
    return record.customPrice;
  }

  if (meal === "breakfast") {
    return settings.breakfastPrice;
  }

  if (meal === "lunch") {
    return settings.lunchPrice;
  }

  return settings.dinnerPrice;
}

function buildMonthMetrics(state: AppState, monthKey: string) {
  const month = state.months[monthKey] ?? { days: {}, moneyEntries: [] };
  const mealOrder: MealName[] = ["breakfast", "lunch", "dinner"];
  let latestDonePoint: { dateKey: string; meal: MealName } | null = null;

  Object.keys(month.days)
    .sort()
    .forEach((dateKey) => {
      mealOrder.forEach((meal) => {
        if (!month.days[dateKey]?.[meal]?.done) {
          return;
        }

        if (
          !latestDonePoint ||
          dateKey > latestDonePoint.dateKey ||
          (dateKey === latestDonePoint.dateKey && mealOrder.indexOf(meal) > mealOrder.indexOf(latestDonePoint.meal))
        ) {
          latestDonePoint = { dateKey, meal };
        }
      });
    });

  let monthlyCost = 0;
  const statuses: Record<string, Record<MealName, MealStatus>> = {};
  const dayTotal: Record<string, number> = {};

  const dayCount = getDaysInMonth(monthKey);
  for (let day = 1; day <= dayCount; day += 1) {
    const dateKey = monthDateKey(monthKey, day);
    const dayRecord = month.days[dateKey] ?? {};

    statuses[dateKey] = {
      breakfast: "pending",
      lunch: "pending",
      dinner: "pending",
    };

    (Object.keys(mealLabels) as MealName[]).forEach((meal) => {
      if (dayRecord[meal]?.done) {
        statuses[dateKey][meal] = "done";
      } else if (
        latestDonePoint &&
        (dateKey < latestDonePoint.dateKey ||
          (dateKey === latestDonePoint.dateKey &&
            mealOrder.indexOf(meal) < mealOrder.indexOf(latestDonePoint.meal)))
      ) {
        statuses[dateKey][meal] = "missed";
      }
    });

    if (statuses[dateKey].breakfast === "done" && statuses[dateKey].dinner === "done" && statuses[dateKey].lunch !== "done") {
      statuses[dateKey].lunch = "missed";
    }

    const currentDayTotal = (Object.keys(mealLabels) as MealName[]).reduce((sum, meal) => {
      if (statuses[dateKey][meal] !== "done") {
        return sum;
      }

      return sum + getPrice(state.settings, meal, dayRecord[meal]);
    }, 0);

    dayTotal[dateKey] = currentDayTotal;
    monthlyCost += currentDayTotal;
  }

  const moneyAdded = month.moneyEntries.reduce((sum, entry) => sum + entry.amount, 0);

  return {
    statuses,
    dayTotal,
    monthlyCost,
    moneyAdded,
  };
}

function getCarryBefore(state: AppState, monthKey: string) {
  const allMonths = Array.from(new Set([...Object.keys(state.months), monthKey])).sort();
  let carry = 0;

  for (const key of allMonths) {
    if (key >= monthKey) {
      break;
    }

    const metrics = buildMonthMetrics(state, key);
    carry += metrics.moneyAdded - metrics.monthlyCost;
  }

  return carry;
}

function mealButtonClass(status: MealStatus) {
  if (status === "done") {
    return "bg-green-500 text-white";
  }

  if (status === "missed") {
    return "bg-red-500 text-white";
  }

  return "bg-gray-300 text-gray-700";
}

export function MealsDashboard() {
  const router = useRouter();
  const [state, setState] = useState<AppState>(() => loadLocalState() ?? defaultState);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const local = loadLocalState();
    const existing = Object.keys(local?.months ?? {}).sort();
    if (existing.length === 0) {
      return getCurrentMonthKey();
    }

    const current = getCurrentMonthKey();
    return existing.includes(current) ? current : (existing.at(-1) as string);
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<AppState["settings"]>(() => (loadLocalState() ?? defaultState).settings);
  const [moneyDate, setMoneyDate] = useState("");
  const [moneyAmount, setMoneyAmount] = useState("");
  const [moneyNote, setMoneyNote] = useState("");
  const [customTarget, setCustomTarget] = useState<{ dateKey: string; meal: MealName } | null>(null);
  const [customPrice, setCustomPrice] = useState("");
  const longPressTimer = useRef<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/state")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data: string | null; updatedAt: string | null } | null) => {
        if (!payload?.data || !payload.updatedAt) {
          setHasLoaded(true);
          return;
        }

        const remote = JSON.parse(payload.data) as AppState;
        const updatedAt = payload.updatedAt;
        setState((current) => {
          const shouldUseRemoteForEmptyLocal = !hasMeaningfulLocalData(current) && current.updatedAt !== updatedAt;

          if (
            !current.updatedAt ||
            current.updatedAt < updatedAt ||
            shouldUseRemoteForEmptyLocal
          ) {
            localStorage.setItem(STORAGE_KEY, payload.data as string);
            setSettingsDraft(remote.settings);
            return remote;
          }
          return current;
        });

        setHasLoaded(true);
      })
      .catch(() => {
        setHasLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    const timeout = window.setTimeout(() => {
      fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: JSON.stringify(state),
          updatedAt: state.updatedAt,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Sync failed (${response.status}): ${await response.text()}`);
          }
        })
        .catch((error) => {
          console.error("Background sync failed", error);
        });
    }, SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [hasLoaded, state]);

  const monthOptions = useMemo(() => {
    const set = new Set([...Object.keys(state.months), getCurrentMonthKey(), selectedMonth]);
    return Array.from(set).sort();
  }, [selectedMonth, state.months]);

  const metrics = useMemo(() => buildMonthMetrics(state, selectedMonth), [selectedMonth, state]);
  const carryBefore = useMemo(() => getCarryBefore(state, selectedMonth), [selectedMonth, state]);
  const moneyEntries = useMemo(
    () =>
      [...(state.months[selectedMonth]?.moneyEntries ?? [])].sort((a, b) =>
        a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date),
      ),
    [selectedMonth, state.months],
  );
  const moneyLeft = carryBefore + metrics.moneyAdded - metrics.monthlyCost;
  const resolvedMoneyDate = moneyDate.startsWith(selectedMonth) ? moneyDate : `${selectedMonth}-01`;

  useEffect(() => {
    if (moneyLeft > 0) {
      return;
    }

    const key = `low-balance-notified-${selectedMonth}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "yes");
      window.alert("Your submitted money has run out, please recharge or please add money.");
    }
  }, [moneyLeft, selectedMonth]);

  const updateState = (updater: (current: AppState) => AppState) => {
    setState((current) => {
      const next = updater(current);
      return {
        ...next,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const ensureMonth = (current: AppState, monthKey: string) => {
    if (current.months[monthKey]) {
      return current;
    }

    return {
      ...current,
      months: {
        ...current.months,
        [monthKey]: {
          days: {},
          moneyEntries: [],
        },
      },
    };
  };

  const onToggleMeal = (dateKey: string, meal: MealName) => {
    updateState((current) => {
      const withMonth = ensureMonth(current, selectedMonth);
      const month = withMonth.months[selectedMonth];
      const day = month.days[dateKey] ?? {};
      const currentMeal = day[meal] ?? {};

      return {
        ...withMonth,
        months: {
          ...withMonth.months,
          [selectedMonth]: {
            ...month,
            days: {
              ...month.days,
              [dateKey]: {
                ...day,
                [meal]: {
                  ...currentMeal,
                  done: !currentMeal.done,
                },
              },
            },
          },
        },
      };
    });
  };

  const onSaveSettings = () => {
    updateState((current) => ({
      ...current,
      settings: settingsDraft,
    }));
    setSettingsOpen(false);
    setAdvancedOpen(false);
  };

  const onCancelSettings = () => {
    setSettingsDraft(state.settings);
    setSettingsOpen(false);
    setAdvancedOpen(false);
  };

  const onAddMoney = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(moneyAmount);

    if (!resolvedMoneyDate || Number.isNaN(amount) || amount <= 0) {
      return;
    }

    updateState((current) => {
      const withMonth = ensureMonth(current, selectedMonth);
      const month = withMonth.months[selectedMonth];

      return {
        ...withMonth,
        months: {
          ...withMonth.months,
          [selectedMonth]: {
            ...month,
            moneyEntries: [
              ...month.moneyEntries,
              {
                id: crypto.randomUUID(),
                date: resolvedMoneyDate,
                amount,
                note: moneyNote.trim(),
              },
            ],
          },
        },
      };
    });

    setMoneyAmount("");
    setMoneyNote("");
    setAddMoneyOpen(false);
  };

  const openCustomPrice = (dateKey: string, meal: MealName) => {
    if (!state.settings.allowCustomMealPrice) {
      return;
    }

    const currentPrice = state.months[selectedMonth]?.days[dateKey]?.[meal]?.customPrice;
    setCustomPrice(typeof currentPrice === "number" ? `${currentPrice}` : "");
    setCustomTarget({ dateKey, meal });
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onSaveCustomPrice = () => {
    if (!customTarget) {
      return;
    }

    const price = Number(customPrice);

    if (Number.isNaN(price) || price <= 0) {
      return;
    }

    updateState((current) => {
      const withMonth = ensureMonth(current, selectedMonth);
      const month = withMonth.months[selectedMonth];
      const day = month.days[customTarget.dateKey] ?? {};
      const meal = day[customTarget.meal] ?? {};

      return {
        ...withMonth,
        months: {
          ...withMonth.months,
          [selectedMonth]: {
            ...month,
            days: {
              ...month.days,
              [customTarget.dateKey]: {
                ...day,
                [customTarget.meal]: {
                  ...meal,
                  customPrice: price,
                },
              },
            },
          },
        },
      };
    });

    setCustomTarget(null);
    setCustomPrice("");
  };

  const onLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#161427] via-[#221b36] to-[#161427] p-4 text-violet-100 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold md:text-3xl">Meals Calculation</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAddMoneyOpen(true)}
              className="rounded-full border border-violet-400/60 bg-violet-600 px-4 py-2 font-semibold text-white"
            >
              Add Money
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-full border border-violet-300/40 bg-[#2a1b42] px-4 py-2 font-semibold text-violet-100"
            >
              ⚙️ Settings
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-full bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-500"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-violet-300/20 bg-[#332a4d] p-4 shadow-sm">
            <p className="text-sm text-violet-300">Monthly cost</p>
            <p className="text-2xl font-bold">{metrics.monthlyCost.toFixed(2)}</p>
          </div>
          <div className="rounded-3xl border border-violet-300/20 bg-[#332a4d] p-4 shadow-sm">
            <p className="text-sm text-violet-300">Money added this month</p>
            <p className="text-2xl font-bold">{metrics.moneyAdded.toFixed(2)}</p>
          </div>
          <div
            className={`rounded-3xl border p-4 shadow-sm ${moneyLeft <= 0 ? "border-red-400/80 bg-red-600 text-white" : "border-violet-300/20 bg-[#332a4d]"}`}
          >
            <p className={`text-sm ${moneyLeft <= 0 ? "text-red-100" : "text-violet-300"}`}>Money left</p>
            <p className="text-2xl font-bold">{moneyLeft.toFixed(2)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-violet-300/20 bg-[#2b2341] p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              className="rounded-xl border border-violet-300/30 bg-[#372b53] px-3 py-2 text-violet-100"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {formatMonthLabel(month)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-full border border-violet-300/40 bg-[#463366] px-3 py-2 text-sm font-semibold text-violet-100"
              onClick={() => {
                const month = nextMonthKey(selectedMonth);
                updateState((current) => ensureMonth(current, month));
                setSelectedMonth(month);
              }}
            >
              Add month
            </button>
          </div>

          <div>
            <table className="w-full border-collapse text-xs sm:text-sm md:table-fixed">
              <thead>
                <tr className="border-b border-violet-300/20 text-left">
                  <th className="py-2 pr-1 sm:pr-2 md:w-1/5">Date and Day</th>
                  <th className="py-2 text-center md:w-1/5">
                    <span className="md:hidden">B</span>
                    <span className="hidden md:inline">Breakfast</span>
                  </th>
                  <th className="py-2 text-center md:w-1/5">
                    <span className="md:hidden">L</span>
                    <span className="hidden md:inline">Lunch</span>
                  </th>
                  <th className="py-2 text-center md:w-1/5">
                    <span className="md:hidden">D</span>
                    <span className="hidden md:inline">Dinner</span>
                  </th>
                  <th className="py-2 text-center md:w-1/5">
                    <span className="md:hidden">T</span>
                    <span className="hidden md:inline">Total Cost</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: getDaysInMonth(selectedMonth) }, (_, index) => {
                  const day = index + 1;
                  const dateKey = monthDateKey(selectedMonth, day);
                  const dayData = state.months[selectedMonth]?.days[dateKey] ?? {};
                  const status = metrics.statuses[dateKey];

                  return (
                    <tr key={dateKey} className="border-b border-violet-300/10">
                      <td className="py-2 pr-1 font-medium sm:pr-2 md:w-1/5">{day} {getDayLabel(selectedMonth, day)}</td>
                      {(Object.keys(mealLabels) as MealName[]).map((meal) => (
                        <td key={meal} className="py-2 text-center md:w-1/5">
                          <button
                            type="button"
                            onClick={() => onToggleMeal(dateKey, meal)}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              openCustomPrice(dateKey, meal);
                            }}
                            onTouchStart={() => {
                              clearLongPress();
                              longPressTimer.current = window.setTimeout(
                                () => openCustomPrice(dateKey, meal),
                                LONG_PRESS_DURATION_MS,
                              );
                            }}
                            onTouchEnd={clearLongPress}
                            onTouchMove={clearLongPress}
                            className={`h-9 w-9 rounded-full text-sm font-semibold sm:h-10 sm:w-10 sm:text-base ${mealButtonClass(status[meal])}`}
                            title={`${mealLabels[meal]} (${getPrice(state.settings, meal, dayData[meal])})`}
                          >
                            {status[meal] === "done" ? "✓" : status[meal] === "missed" ? "✕" : ""}
                          </button>
                        </td>
                      ))}
                      <td className="py-2 text-center font-semibold md:w-1/5">{metrics.dayTotal[dateKey].toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-violet-300/20 bg-[#2b2341] p-4 shadow-sm">
          <h2 className="text-xl font-bold">Money added history</h2>
          {moneyEntries.length === 0 ? (
            <p className="mt-3 text-sm text-violet-300">No money entries yet for this month.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {moneyEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-300/20 bg-[#332a4d] px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold">{entry.amount.toFixed(2)}</p>
                    {entry.note ? <p className="text-xs text-violet-300">{entry.note}</p> : null}
                  </div>
                  <p className="text-xs text-violet-300">{entry.date}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {settingsOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
            className="w-full max-w-2xl rounded-3xl border border-violet-300/30 bg-[#2a2340] p-4 shadow-2xl"
          >
            <h2 id="settings-modal-title" className="sr-only">Settings</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm font-medium">
                Breakfast cost
                <input
                  type="number"
                  value={settingsDraft.breakfastPrice}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({ ...current, breakfastPrice: Number(event.target.value) || 0 }))
                  }
                  className="mt-1 w-full rounded-xl border border-violet-300/30 bg-[#332a4d] px-3 py-2"
                />
              </label>
              <label className="text-sm font-medium">
                Lunch cost
                <input
                  type="number"
                  value={settingsDraft.lunchPrice}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({ ...current, lunchPrice: Number(event.target.value) || 0 }))
                  }
                  className="mt-1 w-full rounded-xl border border-violet-300/30 bg-[#332a4d] px-3 py-2"
                />
              </label>
              <label className="text-sm font-medium">
                Dinner cost
                <input
                  type="number"
                  value={settingsDraft.dinnerPrice}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({ ...current, dinnerPrice: Number(event.target.value) || 0 }))
                  }
                  className="mt-1 w-full rounded-xl border border-violet-300/30 bg-[#332a4d] px-3 py-2"
                />
              </label>
            </div>

            <button
              type="button"
              className="mt-4 text-sm font-semibold text-violet-300"
              onClick={() => setAdvancedOpen((current) => !current)}
            >
              {advancedOpen ? "Hide advanced option" : "Show advanced option"}
            </button>

            {advancedOpen ? (
              <div className="mt-3 rounded-2xl border border-violet-300/30 bg-[#332a4d] p-3">
                <p className="text-sm font-medium">Set custom meal price</p>
                <div className="mt-2 flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={settingsDraft.allowCustomMealPrice}
                      onChange={() =>
                        setSettingsDraft((current) => ({
                          ...current,
                          allowCustomMealPrice: true,
                        }))
                      }
                    />
                    Yes
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={!settingsDraft.allowCustomMealPrice}
                      onChange={() =>
                        setSettingsDraft((current) => ({
                          ...current,
                          allowCustomMealPrice: false,
                        }))
                      }
                    />
                    No
                  </label>
                </div>
                <p className="mt-2 text-xs text-violet-300">Use right click on desktop or long press on mobile meal buttons.</p>
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onSaveSettings}
                className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white"
              >
                Save
              </button>
              <button
                type="button"
                onClick={onCancelSettings}
                className="rounded-xl border border-violet-300/30 bg-[#463366] px-4 py-2 text-sm font-semibold text-violet-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addMoneyOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-money-modal-title"
            className="w-full max-w-xl rounded-3xl border border-violet-300/30 bg-[#2a2340] p-4 shadow-2xl"
          >
            <h2 id="add-money-modal-title" className="text-xl font-bold">Add money</h2>
            <form onSubmit={onAddMoney} className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium">
                Date
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-violet-300/30 bg-[#332a4d] px-3 py-2"
                  value={resolvedMoneyDate}
                  onChange={(event) => setMoneyDate(event.target.value)}
                  required
                />
              </label>
              <label className="text-sm font-medium">
                Amount
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded-xl border border-violet-300/30 bg-[#332a4d] px-3 py-2"
                  value={moneyAmount}
                  onChange={(event) => setMoneyAmount(event.target.value)}
                  required
                />
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Note
                <input
                  className="mt-1 w-full rounded-xl border border-violet-300/30 bg-[#332a4d] px-3 py-2"
                  value={moneyNote}
                  onChange={(event) => setMoneyNote(event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <div className="flex gap-2 md:col-span-2">
                <button
                  type="submit"
                  className="rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setAddMoneyOpen(false)}
                  className="rounded-xl border border-violet-300/30 bg-[#463366] px-4 py-2 font-semibold text-violet-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {customTarget ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-price-modal-title"
            className="w-full max-w-sm rounded-2xl border border-violet-300/30 bg-[#2a2340] p-4"
          >
            <h3 id="custom-price-modal-title" className="text-lg font-bold">Set custom meal price</h3>
            <input
              type="number"
              value={customPrice}
              onChange={(event) => setCustomPrice(event.target.value)}
              className="mt-3 w-full rounded-xl border border-violet-300/30 bg-[#332a4d] px-3 py-2"
              placeholder="Enter amount"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white"
                onClick={onSaveCustomPrice}
              >
                Save
              </button>
              <button
                type="button"
                className="rounded-xl border border-violet-300/30 bg-[#463366] px-4 py-2 text-sm font-semibold text-violet-100"
                onClick={() => {
                  setCustomTarget(null);
                  setCustomPrice("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
