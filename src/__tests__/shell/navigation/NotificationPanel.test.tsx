import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationPanel } from "@/widgets/app/header";

const query = vi.hoisted(() => ({
  data: undefined as
    | undefined
    | {
        upcomingFeedback: {
          error?: string;
          upcoming: {
            id: string;
            title: string;
            subtitle: string;
            tag: string;
            type: string;
            href?: string;
          }[];
          recentFeedback: {
            id: string;
            title: string;
            subtitle: string;
            daysAgo: string;
            type: string;
            href?: string;
          }[];
        };
      },
  error: null as null | Error,
  isLoading: false,
  isFetching: false,
  refetch: vi.fn(),
}));
vi.mock("@/entities/dashboard", () => ({ useDashboardData: () => query }));
const show = (close = vi.fn()) =>
  render(
    <MemoryRouter>
      <NotificationPanel id="notifications" onClose={close} />
    </MemoryRouter>,
  );

describe("NotificationPanel", () => {
  beforeEach(() => {
    query.data = undefined;
    query.error = null;
    query.isLoading = false;
    query.isFetching = false;
    query.refetch.mockReset();
  });
  it("shows an empty state when there are no updates", () => {
    show();
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveFocus();
  });
  it("renders real review links and closes on selection", () => {
    const close = vi.fn();
    query.data = {
      upcomingFeedback: {
        upcoming: [],
        recentFeedback: [
          {
            id: "review-1",
            title: "Feedback ready",
            subtitle: "API project",
            daysAgo: "Today",
            type: "staff-review",
            href: "/my-courses/level-1/modules/2",
          },
        ],
      },
    };
    show(close);
    const link = screen.getByRole("link", { name: /Feedback ready/ });
    expect(link).toHaveAttribute("href", "/my-courses/level-1/modules/2");
    fireEvent.click(link);
    expect(close).toHaveBeenCalledOnce();
  });
  it("shows content skeletons while loading", () => {
    query.isLoading = true;
    show();
    expect(screen.getByLabelText("Loading notifications")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("No notifications yet")).not.toBeInTheDocument();
  });
  it("offers retry on a feedback failure and prevents duplicate retries", () => {
    query.data = { upcomingFeedback: { error: "Unavailable", upcoming: [], recentFeedback: [] } };
    const view = show();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Notifications are temporarily unavailable.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(query.refetch).toHaveBeenCalledOnce();
    query.isFetching = true;
    view.rerender(
      <MemoryRouter>
        <NotificationPanel id="notifications" onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeDisabled();
  });
});
