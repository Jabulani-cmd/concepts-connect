import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const waitFor = async (fn: () => void | Promise<void>, timeout = 1000) => {
  const start = Date.now();
  let lastErr: unknown;
  while (Date.now() - start < timeout) {
    try { await fn(); return; } catch (e) { lastErr = e; }
    await new Promise((r) => setTimeout(r, 10));
  }
  throw lastErr;
};

/**
 * Realtime refresh test for useSubscription.
 *
 * Verifies that the hook subscribes to postgres_changes on all four tables
 * (subscriptions, payments, access_grants, parent_students) and that an event
 * on each one triggers a re-fetch — which is what unlocks both the parent
 * and student portals the moment any of those rows change.
 */

type ChangeHandler = (payload: unknown) => void;
const handlers: Record<string, ChangeHandler> = {};
let queryCallCount = 0;

type QueryResult = { data: unknown[]; error: null };
type QueryChain = Record<string, unknown>;

const buildQuery = (_table: string) => {
  const result: QueryResult = { data: [], error: null };
  const chain: QueryChain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (resolve: (r: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  };
  return chain;
};

type ChannelMock = {
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
};

const channelMock: ChannelMock = {
  on: vi.fn((_event: string, cfg: { table: string }, cb: ChangeHandler) => {
    handlers[cfg.table] = cb;
    return channelMock;
  }),
  subscribe: vi.fn(() => channelMock),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      queryCallCount++;
      return buildQuery(table);
    }),
    channel: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "parent-user-id" },
    role: "parent",
  }),
}));

import { useSubscription } from "../useSubscription";

describe("useSubscription realtime", () => {
  beforeEach(() => {
    queryCallCount = 0;
    for (const k of Object.keys(handlers)) delete handlers[k];
    channelMock.on.mockClear();
    channelMock.subscribe.mockClear();
  });

  it("subscribes to all four realtime tables", async () => {
    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const subscribedTables = channelMock.on.mock.calls.map((c) => (c[1] as { table: string }).table);
    expect(subscribedTables).toEqual(
      expect.arrayContaining([
        "subscriptions",
        "payments",
        "access_grants",
        "parent_students",
      ]),
    );
    expect(channelMock.subscribe).toHaveBeenCalledTimes(1);
  });

  it("re-fetches subscription state when each realtime table emits", async () => {
    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const baseline = queryCallCount;
    expect(baseline).toBeGreaterThan(0);

    for (const table of ["subscriptions", "payments", "access_grants", "parent_students"]) {
      const before = queryCallCount;
      await act(async () => {
        handlers[table]?.({ eventType: "INSERT", new: {}, old: {} });
        await Promise.resolve();
      });
      expect(queryCallCount).toBeGreaterThan(before);
    }
  });
});
