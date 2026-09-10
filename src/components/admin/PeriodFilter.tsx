import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, X } from "lucide-react";
import { dayRange, monthRange, yearRange, type PeriodMode, type PeriodRange } from "@/lib/dateFilter";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type Props = {
  dates: Date[];
  onChange: (range: PeriodRange) => void;
  label?: string;
};

const PeriodFilter = ({ dates, onChange, label = "Filtrar por período" }: Props) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PeriodMode>("all");
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [selectedYearOnly, setSelectedYearOnly] = useState<number | undefined>(undefined);

  const { availableDayKeys, availableYears, yearToMonths, minDate, maxDate } = useMemo(() => {
    const dayKeys = new Set<string>();
    const years = new Set<number>();
    const yearMonths = new Map<number, Set<number>>();
    let min: Date | undefined;
    let max: Date | undefined;

    dates.forEach((d) => {
      dayKeys.add(format(d, "yyyy-MM-dd"));
      const y = d.getFullYear();
      const m = d.getMonth();
      years.add(y);
      if (!yearMonths.has(y)) yearMonths.set(y, new Set());
      yearMonths.get(y)!.add(m);
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    });

    return {
      availableDayKeys: dayKeys,
      availableYears: Array.from(years).sort((a, b) => b - a),
      yearToMonths: yearMonths,
      minDate: min,
      maxDate: max,
    };
  }, [dates]);

  const monthsForSelectedYear = useMemo(() => {
    if (selectedYear === undefined) return [];
    return Array.from(yearToMonths.get(selectedYear) ?? []).sort((a, b) => a - b);
  }, [selectedYear, yearToMonths]);

  const applyChange = (
    newMode: PeriodMode,
    opts: { day?: Date; year?: number; month?: number } = {},
  ) => {
    setMode(newMode);
    if (newMode === "all") {
      onChange(null);
    } else if (newMode === "day" && opts.day) {
      onChange(dayRange(opts.day));
    } else if (newMode === "month" && opts.year !== undefined && opts.month !== undefined) {
      onChange(monthRange(opts.year, opts.month));
    } else if (newMode === "year" && opts.year !== undefined) {
      onChange(yearRange(opts.year));
    }
  };

  const handleClear = () => {
    setSelectedDay(undefined);
    setSelectedYear(undefined);
    setSelectedMonth(undefined);
    setSelectedYearOnly(undefined);
    applyChange("all");
    setOpen(false);
  };

  const summary = (() => {
    if (mode === "day" && selectedDay) return format(selectedDay, "d 'de' MMMM, yyyy", { locale: es });
    if (mode === "month" && selectedYear !== undefined && selectedMonth !== undefined)
      return `${MESES[selectedMonth]} ${selectedYear}`;
    if (mode === "year" && selectedYearOnly !== undefined) return `${selectedYearOnly}`;
    return "Todo el período";
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto justify-start gap-2 h-11">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span className="truncate">{summary}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-4 space-y-4" align="start">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          {mode !== "all" && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 px-2 text-xs">
              <X className="h-3 w-3 mr-1" />
              Limpiar
            </Button>
          )}
        </div>

        <Select
          value={mode}
          onValueChange={(v) => {
            const newMode = v as PeriodMode;
            if (newMode === "all") applyChange("all");
            else setMode(newMode);
          }}
        >
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo el período</SelectItem>
            <SelectItem value="day">Día específico</SelectItem>
            <SelectItem value="month">Mes específico</SelectItem>
            <SelectItem value="year">Año específico</SelectItem>
          </SelectContent>
        </Select>

        {mode === "day" && (
          <Calendar
            mode="single"
            locale={es}
            selected={selectedDay}
            onSelect={(day) => {
              if (!day) return;
              setSelectedDay(day);
              applyChange("day", { day });
            }}
            defaultMonth={maxDate}
            fromDate={minDate}
            toDate={maxDate}
            disabled={(day) => !availableDayKeys.has(format(day, "yyyy-MM-dd"))}
            className="rounded-md border p-0"
          />
        )}

        {mode === "month" && (
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={selectedYear?.toString() ?? ""}
              onValueChange={(v) => {
                const y = parseInt(v, 10);
                setSelectedYear(y);
                setSelectedMonth(undefined);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedMonth?.toString() ?? ""}
              onValueChange={(v) => {
                const m = parseInt(v, 10);
                setSelectedMonth(m);
                if (selectedYear !== undefined) applyChange("month", { year: selectedYear, month: m });
              }}
              disabled={selectedYear === undefined}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {monthsForSelectedYear.map((m) => (
                  <SelectItem key={m} value={m.toString()}>{MESES[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {mode === "year" && (
          <Select
            value={selectedYearOnly?.toString() ?? ""}
            onValueChange={(v) => {
              const y = parseInt(v, 10);
              setSelectedYearOnly(y);
              applyChange("year", { year: y });
            }}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {dates.length === 0 && (
          <p className="text-xs text-muted-foreground">Aún no hay datos para filtrar.</p>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default PeriodFilter;
