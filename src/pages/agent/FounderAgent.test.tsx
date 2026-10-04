import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";

const { invokeMock, fromMock, toastError, channels } = vi.hoisted(() => ({
  invokeMock: vi.fn(), fromMock: vi.fn(), toastError: vi.fn(), channels: [] as any[],
}));

let role: string | null = "startup";
let roleLoading = false;
let threadError: { message: string } | null = null;
let messageError: { message: string } | null = null;
let threads: Record<string, any>;
let messages: Record<string, any[]>;

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "founder-1" }, role, roleLoading }),
}));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
    functions: { invoke: invokeMock },
    channel: (name: string) => {
      const channel: any = { name, handlers: [] };
      channel.on = (_event: string, filter: any, callback: any) => { channel.handlers.push({ filter, callback }); return channel; };
      channel.subscribe = () => channel;
      channels.push(channel);
      return channel;
    },
    removeChannel: vi.fn().mockResolvedValue(null),
  },
}));

import FounderAgent from "./FounderAgent";
import { getFounderAgentError } from "@/lib/founderAgentClient";

function row(id: string, content: string) {
  return { id: `${id}-message`, thread_id: id, role: "assistant", content, parts: [{ type: "text", text: content }], created_at: "2026-10-03T00:00:00Z" };
}

function defer<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function AgentWithNavigation() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate("/agent/thread-b")}>Open second chat</button><FounderAgent /></>;
}

function showAgent(path = "/agent/thread-a") {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/agent" element={<AgentWithNavigation />} />
    <Route path="/agent/:threadId" element={<AgentWithNavigation />} />
  </Routes></MemoryRouter>);
}

describe("Founder agent chat recovery and request isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channels.length = 0;
    role = "startup";
    roleLoading = false;
    threadError = null;
    messageError = null;
    threads = Object.fromEntries(["thread-a", "thread-b"].map((id) => [id, {
      id, founder_id: "founder-1", status: "active", project_id: null, current_stage: 0, stats: {},
    }]));
    messages = { "thread-a": [row("thread-a", "First chat content")], "thread-b": [row("thread-b", "Second chat content")] };
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
    fromMock.mockImplementation((table: string) => {
      const filters: Record<string, unknown> = {};
      const result = (single = false) => {
        const id = String(filters.id ?? filters.thread_id ?? "thread-a");
        if (table === "agent_threads") return { data: single ? threads[id] ?? null : Object.values(threads), error: threadError };
        if (table === "agent_messages") return { data: messages[id] ?? [], error: messageError };
        return { data: single ? { walkthrough_dismissed: true } : [], error: null };
      };
      const query: any = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters[key] = value; return query; },
        order: () => query, limit: () => query,
        insert: vi.fn(() => query), upsert: () => query,
        single: () => Promise.resolve(result(true)), maybeSingle: () => Promise.resolve(result(true)),
        then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
      };
      return query;
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("does not load or create agent chats for builders", () => {
    role = "builder";
    showAgent("/agent");
    expect(screen.getByText("The agent is available to startups only.")).toBeTruthy();
    expect(fromMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("waits for the startup role before loading chats", () => {
    roleLoading = true;
    role = null;
    showAgent("/agent");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("reports an existing-chat load failure and retries without creating a replacement", async () => {
    threadError = { message: "Connection unavailable" };
    showAgent();
    expect(await screen.findByText("Connection unavailable")).toBeTruthy();
    expect(invokeMock).not.toHaveBeenCalled();
    threadError = null;
    fireEvent.click(screen.getByRole("button", { name: "Retry loading chat" }));
    expect(await screen.findByText("First chat content")).toBeTruthy();
    expect(screen.queryByText("Connection unavailable")).toBeNull();
  });

  it("does not create a replacement chat when the latest-chat lookup fails", async () => {
    threadError = { message: "Latest chat unavailable" };
    showAgent("/agent");
    await screen.findByText("Latest chat unavailable");
    for (const call of fromMock.mock.results) expect(call.value.insert).not.toHaveBeenCalled();
  });

  it("keeps a failed message load visible instead of showing an empty welcome", async () => {
    messageError = { message: "Messages could not load" };
    showAgent();
    expect(await screen.findByText("Messages could not load")).toBeTruthy();
    expect(screen.queryByText(/Tell me what you need to build/)).toBeNull();
    expect((screen.getByRole("button", { name: "Send message" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("uses the supported status intent in the mobile stages panel", async () => {
    threads["thread-a"].project_id = "project-a";
    showAgent();
    await screen.findByText("First chat content");
    fireEvent.click(screen.getByRole("button", { name: "Check status" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("founder-agent", {
      body: { thread_id: "thread-a", intent: "status" },
    }));
  });

  it("prevents posting and restarting while a chat request is in flight", async () => {
    threads["thread-a"].stats = { awaiting: "post_project" };
    messages["thread-a"] = [{ ...row("thread-a", "Review draft"), parts: [
      { type: "text", text: "Review draft" }, { type: "project_preview", project: { title: "Dashboard", skills: [] } },
    ] }];
    const pending = defer<any>();
    invokeMock.mockReturnValue(pending.promise);
    showAgent();
    await screen.findByText("Review draft");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Change the timeline" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByRole("button", { name: "Post this project" }));
    fireEvent.click(screen.getByRole("button", { name: "New session" }));
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "Post this project" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => pending.resolve({ data: { ok: true }, error: null }));
  });

  it("does not replace the next chat with a previous request's response", async () => {
    const pending = defer<any>();
    invokeMock.mockReturnValue(pending.promise);
    showAgent();
    await screen.findByText("First chat content");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Old request" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByRole("button", { name: "Open second chat" }));
    await screen.findByText("Second chat content");
    await act(async () => pending.resolve({ data: { ok: true }, error: null }));
    expect(screen.getByText("Second chat content")).toBeTruthy();
    expect(screen.queryByText("First chat content")).toBeNull();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });

  it("ignores a realtime callback from a chat after navigating away", async () => {
    showAgent();
    await screen.findByText("First chat content");
    const oldChannel = channels.find((channel) => channel.name === "agent_thread_thread-a");
    fireEvent.click(screen.getByRole("button", { name: "Open second chat" }));
    await screen.findByText("Second chat content");
    const callsBefore = fromMock.mock.calls.length;
    await act(async () => oldChannel.handlers[0].callback());
    expect(fromMock.mock.calls.length).toBe(callsBefore);
    expect(screen.getByText("Second chat content")).toBeTruthy();
  });

  it("surfaces the edge-function response explanation and restores a rejected message", async () => {
    invokeMock.mockResolvedValue({ data: null, error: {
      message: "Edge Function returned a non-2xx status code",
      context: new Response(JSON.stringify({ error: "provider_not_configured", message: "AI credentials are missing." }), { status: 503 }),
    } });
    showAgent();
    await screen.findByText("First chat content");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Build my dashboard" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("AI credentials are missing."));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Build my dashboard");
  });

  it("shows background evaluation failures with a retry action", async () => {
    threads["thread-a"].project_id = "project-a";
    invokeMock.mockResolvedValueOnce({ data: { error: "Evaluation service unavailable" }, error: null });
    showAgent();
    expect(await screen.findByText(/Evaluation update failed: Evaluation service unavailable/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Refresh evaluations" })[0]);
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(/Evaluation update failed/)).toBeNull());
  });

  it("catches up in at most three batches and shows remaining submissions", async () => {
    threads["thread-a"].project_id = "project-a";
    invokeMock.mockResolvedValueOnce({ data: { ok: true, evaluated: 5, failed: 0, remaining: 11 }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, evaluated: 5, failed: 0, remaining: 6 }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, evaluated: 5, failed: 0, remaining: 1 }, error: null });
    showAgent();
    await screen.findByText("1 submission(s) still need evaluation. Use Refresh evaluations to continue.");
    expect(invokeMock).toHaveBeenCalledTimes(3);
  });

  it("stops batch retries on evaluation errors and reports the useful reason", async () => {
    threads["thread-a"].project_id = "project-a";
    invokeMock.mockResolvedValueOnce({ data: { ok: true, evaluated: 1, failed: 1, remaining: 3,
      evaluation_errors: [{ submission_id: "submission-2", message: "AI credits exhausted." }] }, error: null });
    showAgent();
    await screen.findByText(/Some submissions couldn't be evaluated. AI credits exhausted./);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("does not loop when the evaluator reports remaining work without progress", async () => {
    threads["thread-a"].project_id = "project-a";
    invokeMock.mockResolvedValueOnce({ data: { ok: true, evaluated: 0, failed: 0, remaining: 2 }, error: null });
    showAgent();
    await screen.findByText("2 submission(s) still need evaluation. Use Refresh evaluations to continue.");
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("keeps archived sessions read-only while allowing a new session", async () => {
    threads["thread-a"].status = "archived";
    threads["thread-a"].project_id = "project-a";
    showAgent();
    await screen.findByText(/This session is archived/);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "New session" }) as HTMLButtonElement).disabled).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("reports failed resets and retains the current conversation", async () => {
    invokeMock.mockResolvedValue({ data: { error: "Unable to create session" }, error: null });
    showAgent();
    await screen.findByText("First chat content");
    fireEvent.click(screen.getByRole("button", { name: "New session" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Unable to create session"));
    expect(screen.getByText("First chat content")).toBeTruthy();
  });

  it("preserves structured error bodies without consuming the original response", async () => {
    const context = new Response(JSON.stringify({ message: "Project belongs to another startup." }), { status: 403 });
    const error = await getFounderAgentError({ message: "HTTP error", context });
    expect(error.message).toBe("Project belongs to another startup.");
    expect(await context.json()).toEqual({ message: "Project belongs to another startup." });
  });
});
