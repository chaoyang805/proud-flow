export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "packages/api-contract/generated/**",
    ],
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.ts"],
    rules: {
      "no-unused-vars": "error",
      "no-undef": "off",
    },
  },
];
