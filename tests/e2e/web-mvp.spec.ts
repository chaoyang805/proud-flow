import { expect, test } from "@playwright/test";

test("web mvp renders requirement workspace and creation form", async ({ page }) => {
  await page.goto("/requirements");

  await expect(page.getByRole("heading", { name: "需求工作台" })).toBeVisible();
  await expect(page.getByRole("link", { name: "新建" })).toBeVisible();
  await expect(page.getByRole("combobox").first()).toBeVisible();
  await expect(page.getByPlaceholder("搜索编号或标题")).toBeVisible();

  await page.getByRole("button", { name: "用户 token" }).click();
  await expect(page.getByLabel("User token")).toBeVisible();
  await page.getByRole("button", { name: "用户 token" }).click();

  await page.getByRole("link", { name: "新建" }).click();

  await expect(page).toHaveURL(/\/requirements\/new$/);
  await expect(page.getByRole("heading", { name: "新建需求" })).toBeVisible();
  await expect(page.getByLabel("标题")).toBeVisible();
  await expect(page.getByLabel("描述")).toBeVisible();
  await expect(page.getByRole("button", { name: "创建" })).toBeDisabled();
});
