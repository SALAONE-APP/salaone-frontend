import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type AppSelectOption = {
  label: string;
  value: string;
};

interface AppSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function AppSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Selecione uma opção",
  disabled = false,
  error,
  className,
}: AppSelectProps) {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleSelect(optionValue: string) {
    if (disabled) return;

    onChange(optionValue);
    setOpen(false);
  }

  return (
    <div ref={selectRef} className={cn("relative w-full", className)}>
      {label && (
        <label className="mb-2 block text-sm font-semibold text-white">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-left text-sm text-white transition",
          "hover:border-primary/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
          disabled && "cursor-not-allowed opacity-60",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500"
        )}
      >
        <span className={selectedOption ? "text-white" : "text-zinc-500"}>
          {selectedOption?.label || placeholder}
        </span>

        <ChevronDown
          size={18}
          className={cn(
            "text-zinc-400 transition-transform",
            open && "rotate-180 text-primary"
          )}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 max-h-60 w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "flex w-full items-center px-4 py-3 text-left text-sm transition",
                  isSelected
                    ? "bg-primary text-white"
                    : "text-zinc-200 hover:bg-zinc-800"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}