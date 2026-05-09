import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FILTER_SELECT_TRIGGER_CLASSES } from "@/lib/ui/filter-classes";

export type AgencyClientOption = { id: string; name: string };

export function AgencyClientSelect({
  clients,
  value,
  onValueChange,
  variant = "shadcn",
  triggerClassName,
  placeholder = "Cliente",
  allLabel = "Todos os clientes",
  allValue = "all",
}: {
  clients: AgencyClientOption[];
  value: string;
  onValueChange: (v: string) => void;
  variant?: "shadcn" | "native";
  triggerClassName?: string;
  placeholder?: string;
  allLabel?: string;
  /** Valor da opção “todos”. Nativo aceita `""`; shadcn deve usar `"all"`. */
  allValue?: string;
}) {
  if (variant === "native") {
    return (
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={
          triggerClassName ?? FILTER_SELECT_TRIGGER_CLASSES.nativeSidebar
        }
      >
        <option value={allValue}>{allLabel}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={allValue}>{allLabel}</SelectItem>
        {clients.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
