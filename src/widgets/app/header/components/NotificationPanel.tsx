import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useDashboardData } from "@/entities/dashboard";
import { ROUTES, UI_TEXT } from "@/shared/config";
import { Button, Skeleton } from "@/shared/ui";
import { BellIcon, CloseIcon } from "@/shared/ui/icons";

export interface NotificationPanelProps {
  id: string;
  onClose: () => void;
}

export function NotificationPanel({ id, onClose }: NotificationPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { data, error, isLoading, isFetching, refetch } = useDashboardData();
  const feedback = data?.upcomingFeedback;
  const unavailable = Boolean(error || feedback?.error);
  const groups = [
    { title: UI_TEXT.upcoming, items: feedback?.upcoming ?? [] },
    { title: UI_TEXT.recentFeedback, items: feedback?.recentFeedback ?? [] },
  ];
  const hasItems = groups.some((group) => group.items.length > 0);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-label={UI_TEXT.notifications}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-[min(32rem,70dvh)] overflow-y-auto rounded-2xl border border-line-default bg-surface-primary shadow-lg select-text"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3">
        <h2 className="text-sm font-bold text-content-primary">{UI_TEXT.notifications}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={UI_TEXT.closeNotifications}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-content-secondary hover:bg-surface-muted cursor-pointer"
        >
          <CloseIcon size={18} />
        </button>
      </div>
      <div className="p-4 space-y-4">
        {isLoading && !data ? (
          <div
            role="status"
            aria-label={UI_TEXT.loadingNotifications}
            aria-busy="true"
            className="space-y-3"
          >
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <>
            {unavailable && (
              <div role="alert" className="space-y-3 text-sm text-content-secondary">
                <p>{UI_TEXT.notificationsUnavailable}</p>
                <Button
                  size="sm"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                  aria-busy={isFetching}
                >
                  {UI_TEXT.retry}
                </Button>
              </div>
            )}
            {hasItems
              ? groups
                  .filter((group) => group.items.length)
                  .map((group) => (
                    <section key={group.title} aria-label={group.title}>
                      <h3 className="mb-2 text-xs font-bold text-content-secondary uppercase tracking-wider">
                        {group.title}
                      </h3>
                      <ul className="space-y-1">
                        {group.items.map((item) => (
                          <li key={item.id}>
                            <Link
                              to={item.href ?? ROUTES.MY_COURSES}
                              onClick={onClose}
                              className="block rounded-xl p-3 min-h-11 hover:bg-surface-secondary transition-colors"
                            >
                              <span className="block text-sm font-semibold text-content-primary break-words">
                                {item.title}
                              </span>
                              <span className="mt-1 block text-xs text-content-secondary break-words">
                                {item.subtitle}
                              </span>
                              {"daysAgo" in item && (
                                <span className="mt-1 block text-xs text-content-secondary">
                                  {item.daysAgo}
                                </span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))
              : !unavailable && (
                  <div className="py-5 text-center">
                    <BellIcon size={24} className="mx-auto mb-3 text-content-secondary" />
                    <p className="text-sm font-semibold text-content-primary">
                      {UI_TEXT.noNotifications}
                    </p>
                    <p className="mt-1 text-xs text-content-secondary">
                      {UI_TEXT.notificationDescription}
                    </p>
                  </div>
                )}
          </>
        )}
      </div>
    </div>
  );
}
