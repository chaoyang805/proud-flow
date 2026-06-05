// @ts-nocheck
import assert from "node:assert/strict";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, it, vi } from "vitest";
import { RequirementActionPanel } from "../../src/components/review/action-panel";
import { ArtifactList } from "../../src/components/artifacts/artifact-list";
import { RequirementsWorkspace } from "../../src/components/requirements/requirements-workspace";
import {
  clearStoredUserToken,
  getStoredUserToken,
  setStoredUserToken,
} from "../../src/lib/auth/token-store";
import { parseRealtimeEvent } from "../../src/lib/realtime/events";
import { reviewApproveLabel, stageForStatus } from "../../src/lib/requirements/labels";

const requirement = {
  id: "REQ-000123",
  title: "支付回调补偿",
  description: "补偿失败订单",
  status: "planning",
  priority: "high",
  version: 1,
  createdAt: "2026-06-05T00:00:00.000Z",
  updatedAt: "2026-06-05T01:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  clearStoredUserToken();
});

describe("P7 web workspace", () => {
  it("stores and clears the user token locally", () => {
    setStoredUserToken("pf_user_demo");
    assert.equal(getStoredUserToken(), "pf_user_demo");
    clearStoredUserToken();
    assert.equal(getStoredUserToken(), undefined);
  });

  it("parses realtime events for query invalidation", () => {
    const event = parseRealtimeEvent(
      JSON.stringify({
        type: "requirement.updated",
        eventId: "evt_1",
        requirementId: "REQ-000123",
        status: "tech-review",
      }),
    );
    assert.equal(event?.type, "requirement.updated");
    assert.equal(event?.requirementId, "REQ-000123");
    assert.equal(parseRealtimeEvent(JSON.stringify({ type: "noop" })), undefined);
    assert.equal(stageForStatus("planning"), "tech_design");
    assert.equal(stageForStatus("tech-review"), "case_rundown");
    assert.equal(stageForStatus("case-review"), "development");
    assert.equal(stageForStatus("archived"), undefined);
    assert.equal(reviewApproveLabel("case-review"), "通过用例");
    assert.equal(reviewApproveLabel("delivery"), "验收通过");
  });

  it("renders and filters requirements from the API", async () => {
    mockFetch(() => ({
      items: [
        requirement,
        {
          ...requirement,
          id: "REQ-000124",
          title: "低优先级需求",
          priority: "low",
        },
      ],
    }));

    renderWithQuery(<RequirementsWorkspace />);

    await screen.findByText("支付回调补偿");
    assert.equal(screen.getByText("低优先级需求").textContent, "低优先级需求");

    fireEvent.change(screen.getByPlaceholderText("搜索编号或标题"), {
      target: { value: "支付" },
    });

    await waitFor(() => {
      assert.equal(screen.queryByText("低优先级需求"), null);
    });

    fireEvent.change(screen.getByPlaceholderText("搜索编号或标题"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "low" },
    });

    await waitFor(() => {
      assert.equal(screen.queryByText("支付回调补偿"), null);
      assert.equal(screen.getByText("低优先级需求").textContent, "低优先级需求");
    });

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "tech-review" },
    });
    await waitFor(() => {
      assert.equal(screen.queryByText("低优先级需求"), null);
      assert.equal(screen.getByText("暂无需求").textContent, "暂无需求");
    });
  });

  it("shows DISPATCHER_OFFLINE clearly when dispatch fails", async () => {
    const calls = mockFetch((url) => {
      if (url.endsWith("/dispatch")) {
        return {
          error: {
            code: "DISPATCHER_OFFLINE",
            message: "DISPATCHER_OFFLINE",
          },
        };
      }
      return { requirement };
    }, 409);

    renderWithQuery(<RequirementActionPanel requirement={requirement} />);
    fireEvent.click(screen.getByRole("button", { name: /派发技术方案/ }));

    await screen.findByText("Dispatcher 不在线");
    assert.equal(calls[0].url.endsWith("/api/requirements/REQ-000123/dispatch"), true);
  });

  it("renders current and historical artifacts by requirement version", () => {
    render(
      <ArtifactList
        currentVersion={2}
        artifacts={[
          {
            id: "art_1",
            requirementId: "REQ-000123",
            requirementVersion: 2,
            type: "development_pr",
            title: "开发 PR",
            url: "https://pr.local",
            createdAt: "2026-06-05T00:00:00.000Z",
          },
          {
            id: "art_2",
            requirementId: "REQ-000123",
            requirementVersion: 1,
            type: "test_report",
            title: "历史测试报告",
            content: "passed",
            createdAt: "2026-06-05T00:00:00.000Z",
          },
        ]}
      />,
    );

    assert.equal(screen.getAllByText("开发 PR").length, 2);
    assert.equal(screen.getByText("历史测试报告").textContent, "历史测试报告");
  });

  it("submits approve, rollback, and archive actions through backend APIs", async () => {
    const calls = mockFetch((url) => {
      if (url.endsWith("/reviews/approve")) return { requirement };
      if (url.endsWith("/reviews/rollback")) return { requirement };
      if (url.endsWith("/archive")) return { archived: true };
      if (url.endsWith("/artifacts")) return { items: [] };
      return { requirement };
    });

    const { rerender } = renderWithQuery(
      <RequirementActionPanel
        requirement={{ ...requirement, status: "tech-review" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /通过技术方案/ }));
    await screen.findByText("已提交 review 操作");

    fireEvent.change(screen.getByPlaceholderText("回退原因"), {
      target: { value: "需要补充范围" },
    });
    fireEvent.click(screen.getByRole("button", { name: "回退" }));
    await screen.findByText("已提交回退");

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <RequirementActionPanel
          requirement={{ ...requirement, status: "delivery" }}
        />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "归档" }));
    await screen.findByText("已提交归档");

    assert.equal(calls.some((call) => call.url.endsWith("/reviews/approve")), true);
    assert.equal(calls.some((call) => call.url.endsWith("/reviews/rollback")), true);
    assert.equal(calls.some((call) => call.url.endsWith("/archive")), true);
  });
});

function renderWithQuery(element) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{element}</QueryClientProvider>,
  );
}

function mockFetch(handler, status = 200) {
  const calls = [];
  vi.stubGlobal("fetch", async (url, init) => {
    calls.push({ url: String(url), init });
    const body = handler(String(url), init);
    const payload = body.error ? { error: body.error } : body;
    return new Response(JSON.stringify(payload), {
      status: body.error ? status : 200,
    });
  });
  return calls;
}
