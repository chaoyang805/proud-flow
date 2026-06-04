// @ts-nocheck
export function createMockFetch(handler) {
  const calls = [];
  const mock = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const result = handler(String(url), init);
    return new Response(JSON.stringify(result.body ?? {}), {
      status: result.status ?? 200,
    });
  };
  mock.calls = calls;
  return mock;
}

export const requirementFixture = {
  id: "REQ-000123",
  title: "需求",
  description: "描述",
  status: "tech-design",
  priority: "high",
  version: 1,
  createdAt: "2026-06-04T00:00:00.000Z",
  updatedAt: "2026-06-04T00:00:00.000Z",
};
