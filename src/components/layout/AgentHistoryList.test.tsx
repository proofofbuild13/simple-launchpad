import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
let role = "startup";
let loadError: { message: string } | null = null;
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "founder-1" }, role, roleLoading: false }) }));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenuSub: ({ children }: any) => <ul>{children}</ul>,
  SidebarMenuSubItem: ({ children }: any) => <li>{children}</li>,
  SidebarMenuSubButton: ({ children }: any) => <div>{children}</div>,
  useSidebar: () => ({ state: "expanded" }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
    channel: () => { const channel: any = { on: () => channel, subscribe: () => channel }; return channel; },
    removeChannel: vi.fn(),
  },
}));

import { AgentHistoryList } from "./AgentHistoryList";

describe("Agent chat history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    role = "startup";
    loadError = null;
    fromMock.mockImplementation((table: string) => {
      const query: any = {
        select: () => query, eq: () => query, order: () => query, limit: () => query, in: () => query,
        then: (resolve: any, reject: any) => Promise.resolve(table === "agent_threads"
          ? { data: [{ id: "thread-a", status: "active", created_at: "2026-10-03T00:00:00Z" }], error: loadError }
          : { data: [{ thread_id: "thread-a", content: "Build the startup dashboard" }], error: null }).then(resolve, reject),
      };
      return query;
    });
  });
  afterEach(cleanup);

  it("loads titles from the startup's first message", async () => {
    render(<MemoryRouter><AgentHistoryList /></MemoryRouter>);
    expect(await screen.findByRole("link", { name: "Build the startup dashboard" })).toBeTruthy();
  });

  it("exposes a failed history load and recovers with retry", async () => {
    loadError = { message: "Offline" };
    render(<MemoryRouter><AgentHistoryList /></MemoryRouter>);
    const retry = await screen.findByRole("button", { name: "Couldn't load chats. Retry" });
    expect(screen.queryByText("No chats yet")).toBeNull();
    loadError = null;
    fireEvent.click(retry);
    expect(await screen.findByRole("link", { name: "Build the startup dashboard" })).toBeTruthy();
  });

  it("does not load startup history for other roles", () => {
    role = "builder";
    render(<MemoryRouter><AgentHistoryList /></MemoryRouter>);
    expect(fromMock).not.toHaveBeenCalled();
    expect(screen.queryByText("New chat")).toBeNull();
  });
});
