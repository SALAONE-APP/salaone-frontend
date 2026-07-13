import { useEffect, useState } from "react";
import type { TouchEvent, UIEvent, WheelEvent } from "react";
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AppCalendarProps {
  mode?: "single" | "range";
  value?: Date;
  onChange?: (date?: Date) => void;
  rangeValue?: DateRange;
  onRangeChange?: (range?: DateRange) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  fromYear?: number;
  toYear?: number;
  disableFuture?: boolean;
  rangeStart?: Date;
  rangeEnd?: Date;
  popoverPortal?: boolean;
}

const months = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function stopScrollPropagation(
  event: TouchEvent<HTMLDivElement> | UIEvent<HTMLDivElement> | WheelEvent<HTMLDivElement>
) {
  event.stopPropagation();
}

export function AppCalendar({
  mode = "single",
  value,
  onChange,
  rangeValue,
  onRangeChange,
  placeholder = "Selecionar data",
  disabled = false,
  className,
  fromYear = new Date().getFullYear() - 100,
  toYear = new Date().getFullYear(),
  disableFuture = false,
  rangeStart,
  rangeEnd,
  popoverPortal = true,
}: AppCalendarProps) {
  const today = new Date();

  const [month, setMonth] = useState<Date>(today);
  const [open, setOpen] = useState(false);
  const [openMonth, setOpenMonth] = useState(false);
  const [openYear, setOpenYear] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined);
  const isRangeMode = mode === "range";
  const selectedRange = rangeValue ?? { from: rangeStart, to: rangeEnd };
  const displayValue =
    isRangeMode && selectedRange.from
      ? selectedRange.to
        ? `${format(selectedRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(
            selectedRange.to,
            "dd/MM/yyyy",
            { locale: ptBR }
          )}`
        : format(selectedRange.from, "dd/MM/yyyy", { locale: ptBR })
      : value
        ? format(value, "dd/MM/yyyy", { locale: ptBR })
        : "";

  const years = Array.from(
    { length: toYear - fromYear + 1 },
    (_, index) => fromYear + index
  );

  useEffect(() => {
    if (value) setMonth(value);
  }, [value]);

  function handleMonthChange(monthIndex: number) {
    const newDate = new Date(month);
    newDate.setMonth(monthIndex);
    setMonth(newDate);
    setOpenMonth(false);
  }

  function handleYearChange(year: number) {
    const newDate = new Date(month);
    newDate.setFullYear(year);
    setMonth(newDate);
    setOpenYear(false);
  }

  function handlePrevMonth() {
    const newDate = new Date(month);
    newDate.setMonth(newDate.getMonth() - 1);
    setMonth(newDate);
  }

  function handleNextMonth() {
    const newDate = new Date(month);
    newDate.setMonth(newDate.getMonth() + 1);
    setMonth(newDate);
  }

  const isNextMonthDisabled = disableFuture && (
    month.getFullYear() > today.getFullYear() ||
    (month.getFullYear() === today.getFullYear() && month.getMonth() >= today.getMonth())
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    setOpenMonth(false);
    setOpenYear(false);
    if (nextOpen) {
      const from = selectedRange.from;
      setDraftRange(from ? { from, to: undefined } : undefined);
      setMonth(from ?? today);
    }
  }

  function handleSelect(date?: Date) {
    onChange?.(date);
    if (date) {
      setMonth(date);
      setOpen(false);
    }
  }

  function handleRangeSelect(range?: DateRange) {
    setDraftRange(range);
    if (range?.from) setMonth(range.from);
    if (range?.from && range?.to) {
      onRangeChange?.(range);
      setOpen(false);
    }
  }

  function isSameLocalDay(a?: Date, b?: Date) {
    if (!a || !b) return false;

    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function isInsideLocalRange(date: Date) {
    if (!rangeStart || !rangeEnd) return false;
    if (isSameLocalDay(date, rangeStart) || isSameLocalDay(date, rangeEnd)) {
      return false;
    }

    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const start = new Date(
      rangeStart.getFullYear(),
      rangeStart.getMonth(),
      rangeStart.getDate()
    ).getTime();
    const end = new Date(
      rangeEnd.getFullYear(),
      rangeEnd.getMonth(),
      rangeEnd.getDate()
    ).getTime();
    const min = Math.min(start, end);
    const max = Math.max(start, end);

    return current > min && current < max;
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-12 w-full justify-start rounded-xl border border-border bg-background px-4 text-left text-sm font-normal text-foreground hover:bg-secondary",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-3 h-4 w-4 text-primary" />

          {displayValue ? (
            displayValue
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        avoidCollisions={true}
        collisionPadding={12}
        portal={popoverPortal}
        className="z-[100] w-[min(346px,calc(100vw-1rem))] rounded-2xl border border-border bg-card p-3 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between gap-1.5 rounded-xl bg-background p-1.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground outline-none transition-colors hover:bg-secondary focus:border-primary focus:ring-2 focus:ring-primary/30"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="flex flex-1 items-center gap-1.5 min-w-0">
            <div className="relative flex-1 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setOpenMonth((prev) => !prev);
                  setOpenYear(false);
                }}
                className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-card px-2.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-secondary focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <span className="truncate">{months[month.getMonth()]}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>

              {openMonth && (
                <div
                  className="absolute left-0 top-11 z-50 max-h-[min(15rem,45vh)] w-full touch-pan-y overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-1 shadow-xl [-webkit-overflow-scrolling:touch]"
                  onScroll={stopScrollPropagation}
                  onTouchMove={stopScrollPropagation}
                  onWheel={stopScrollPropagation}
                >
                  {months.map((item, index) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleMonthChange(index)}
                      className={cn(
                        "flex h-9 w-full items-center rounded-lg px-3 text-left text-sm text-foreground transition-colors hover:bg-secondary",
                        month.getMonth() === index && "bg-primary text-primary-foreground hover:bg-primary"
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative w-[100px] shrink-0">
              <button
                type="button"
                onClick={() => {
                  setOpenYear((prev) => !prev);
                  setOpenMonth(false);
                }}
                className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-card px-2.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-secondary focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <span className="truncate">{month.getFullYear()}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>

              {openYear && (
                <div
                  className="absolute right-0 top-11 z-50 max-h-[min(15rem,45vh)] w-full touch-pan-y overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-1 shadow-xl [-webkit-overflow-scrolling:touch]"
                  onScroll={stopScrollPropagation}
                  onTouchMove={stopScrollPropagation}
                  onWheel={stopScrollPropagation}
                >
                  {years.map((year) => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => handleYearChange(year)}
                      className={cn(
                        "flex h-9 w-full items-center rounded-lg px-3 text-left text-sm text-foreground transition-colors hover:bg-secondary",
                        month.getFullYear() === year &&
                          "bg-primary text-primary-foreground hover:bg-primary"
                      )}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            disabled={isNextMonthDisabled}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground outline-none transition-colors hover:bg-secondary focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {isRangeMode ? (
          <Calendar
            mode="range"
            selected={draftRange}
            onSelect={handleRangeSelect}
            locale={ptBR}
            month={month}
            onMonthChange={setMonth}
            disabled={disableFuture ? { after: today } : undefined}
            initialFocus
            className="w-full bg-card text-foreground"
            classNames={{
              months: "flex w-full flex-col",
              month: "w-full space-y-5",
              caption: "hidden",
              caption_label: "hidden",
              nav: "hidden",

              table: "w-full border-collapse",
              head_row: "grid grid-cols-7 gap-2",
              head_cell:
                "flex h-9 items-center justify-center rounded-lg text-xs font-semibold text-muted-foreground",

              row: "mt-2 grid grid-cols-7 gap-2",
              cell:
                "relative flex h-9 w-9 items-center justify-center text-center text-sm",

              day:
                "flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium text-foreground transition-colors hover:bg-secondary focus:bg-secondary focus:outline-none",

              day_selected:
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",

              range_start:
                "rounded-l-xl bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              range_end:
                "rounded-r-xl bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              range_middle:
                "rounded-none bg-primary/15 text-foreground hover:bg-primary/20",

              day_today: "border border-primary/50 text-primary",
              day_outside: "text-muted-foreground/40 opacity-50",
              day_disabled:
                "cursor-not-allowed text-muted-foreground/30 opacity-40",
              day_hidden: "invisible",
            }}
          />
        ) : (
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleSelect}
            locale={ptBR}
            month={month}
            onMonthChange={setMonth}
            disabled={disableFuture ? { after: today } : undefined}
            modifiers={{
              range_start: rangeStart
                ? (date) => isSameLocalDay(date, rangeStart)
                : undefined,
              range_end: rangeEnd
                ? (date) => isSameLocalDay(date, rangeEnd)
                : undefined,
              range_middle:
                rangeStart && rangeEnd ? (date) => isInsideLocalRange(date) : undefined,
            }}
            initialFocus
            className="w-full bg-card text-foreground"
            classNames={{
            months: "flex w-full flex-col",
            month: "w-full space-y-5",
            caption: "hidden",
            caption_label: "hidden",
            nav: "hidden",

            table: "w-full border-collapse",
            head_row: "grid grid-cols-7 gap-2",
            head_cell:
              "flex h-9 items-center justify-center rounded-lg text-xs font-semibold text-muted-foreground",

            row: "mt-2 grid grid-cols-7 gap-2",
            cell:
              "relative flex h-9 w-9 items-center justify-center text-center text-sm",

            day:
              "flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium text-foreground transition-colors hover:bg-secondary focus:bg-secondary focus:outline-none",

            day_selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",

            range_start:
              "rounded-l-xl bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            range_end:
              "rounded-r-xl bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            range_middle:
              "rounded-none bg-primary/15 text-foreground hover:bg-primary/20",

            day_today: "border border-primary/50 text-primary",
            day_outside: "text-muted-foreground/40 opacity-50",
            day_disabled:
              "cursor-not-allowed text-muted-foreground/30 opacity-40",
            day_hidden: "invisible",
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
