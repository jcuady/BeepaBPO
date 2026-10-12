import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type PageHeaderProps = {
  /** The signed-in user's name. Rendered inside a greeting. */
  name: string;
  /**
   * Page subject, for pages whose subject is *not* the signed-in user — a job
   * posting, a ticket, a document.
   *
   * Without this, every page renders `Good afternoon, {name}.` as its H1, so a
   * job detail page reads "Good afternoon, Customer Support Specialist." The
   * H1 has to identify the page for a screen-reader user arriving by search or
   * link, and a greeting does not.
   *
   * When set, the greeting is not rendered at all.
   */
  title?: string;
  subtitle?: string;
  quote?: string;
  className?: string;
  children?: React.ReactNode;
};

export function PageHeader({
  name,
  title,
  subtitle,
  quote,
  className,
  children,
}: PageHeaderProps) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          {title ? (
            title
          ) : (
            <>
              {greeting},{" "}
              <span className="text-green">{name.split(" ")[0]}.</span>
            </>
          )}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-base text-slate">{subtitle}</p>
        ) : null}
        {children}
      </div>
      {quote ? (
        <Card className="max-w-xs shrink-0 rounded-none border-line bg-white shadow-sm">
          <CardContent className="px-4 py-3 text-sm italic text-slate">
            &ldquo;{quote}&rdquo;
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
