import { cn } from "@/lib/ds/cn";

export type TkNoteTone = "brand" | "positive" | "warning" | "danger";

const toneClass: Record<TkNoteTone, string> = {
  brand: "tk-note--brand",
  positive: "tk-note--positive",
  warning: "tk-note--warning",
  danger: "tk-note--danger",
};

export type TkNoteProps = {
  tone?: TkNoteTone;
  title?: string;
  message: string;
  className?: string;
  icon?: React.ReactNode;
};

export function TkNote({
  tone = "brand",
  title,
  message,
  className,
  icon,
}: TkNoteProps) {
  return (
    <div className={cn("tk-note", toneClass[tone], className)} role="status">
      {icon ? <span className="tk-note__icon">{icon}</span> : null}
      <div className="tk-note__body">
        {title ? <p className="tk-note__title">{title}</p> : null}
        <p className="tk-note__msg">{message}</p>
      </div>
    </div>
  );
}
