// @ts-nocheck
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, it, vi } from "vitest";
import { TokenGuard } from "../../src/components/auth/token-guard";
import {
  clearStoredUserToken,
  getStoredUserToken,
  setStoredUserToken,
} from "../../src/lib/auth/token-store";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  clearStoredUserToken();
});

describe("TokenGuard", () => {
  it("shows the token prompt when no token is stored", async () => {
    render(
      <TokenGuard>
        <div data-testid="content">工作台内容</div>
      </TokenGuard>,
    );

    await screen.findByText("Proud Flow");
    assert.equal(screen.getByText(/请配置 User Token/).textContent, "请配置 User Token 以开始使用工作台。首次使用请通过 CLI 执行 proud-flow init 获取 token。");
    assert.equal(screen.queryByTestId("content"), null);
  });

  it("shows children when a token is already stored", async () => {
    setStoredUserToken("pf_user_test");

    render(
      <TokenGuard>
        <div data-testid="content">工作台内容</div>
      </TokenGuard>,
    );

    await screen.findByTestId("content");
    assert.equal(screen.getByTestId("content").textContent, "工作台内容");
  });

  it("saves token and triggers router refresh on save", async () => {
    render(
      <TokenGuard>
        <div data-testid="content">工作台内容</div>
      </TokenGuard>,
    );

    await screen.findByText("Proud Flow");

    const input = screen.getByPlaceholderText("粘贴你的 User Token");
    fireEvent.change(input, { target: { value: "pf_user_test" } });

    fireEvent.click(screen.getByRole("button", { name: /保存并进入/ }));

    assert.equal(getStoredUserToken(), "pf_user_test");
    assert.equal(mockRefresh.mock.calls.length, 1);
  });

  it("disables save button when input is empty", async () => {
    render(
      <TokenGuard>
        <div data-testid="content">工作台内容</div>
      </TokenGuard>,
    );

    await screen.findByText("Proud Flow");

    const button = screen.getByRole("button", { name: /保存并进入/ });
    assert.equal(button.disabled, true);
  });
});
