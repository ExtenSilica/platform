import {
  AlertTriangle,
  BookOpen,
  Building2,
  CheckCircle2,
  Code2,
  Info,
  Layers,
  Package,
  Shield,
  Terminal,
  Vote,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  package: Package,
  shield: Shield,
  code: Code2,
  check: CheckCircle2,
  book: BookOpen,
  terminal: Terminal,
  building: Building2,
  alert: AlertTriangle,
  layers: Layers,
  vote: Vote,
  info: Info,
};

export function TokenIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Info;
  return <Icon className={className ?? "h-5 w-5 text-riscv-accent"} aria-hidden />;
}
