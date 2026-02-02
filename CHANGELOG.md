## 2025-03-28

[v1.8.5-all]

- 🔖 Release version 1.8.5-all

## 2025-03-27

[v1.8.4-all]

- 🐛 Fixed settings page scroll functionality with hidden scrollbar

## 2022-10-03

[v2.1.0](https://github.com/electron-vite/electron-vite-vue/pull/267)

- `vite-electron-plugin` is Fast, and WYSIWYG. 🌱
- last-commit: db2e830 v2.1.0: use `vite-electron-plugin` instead `vite-plugin-electron`

## 2022-06-04

[v2.0.0](https://github.com/electron-vite/electron-vite-vue/pull/156)

- 🖖 Based on the `vue-ts` template created by `npm create vite`, integrate `vite-plugin-electron`
- ⚡️ More simplify, is in line with Vite project structure
- last-commit: a15028a (HEAD -> main) feat: hoist `process.env`

## 2022-01-30

[v1.0.0](https://github.com/electron-vite/electron-vite-vue/releases/tag/v1.0.0)

- ⚡️ Main、Renderer、preload, all built with vite

## 2022-01-27
- Refactor the scripts part.
- Remove `configs` directory.

## 2021-11-11
- Refactor the project. Use vite.config.ts build `Main-process`, `Preload-script` and `Renderer-process` alternative rollup.
- Scenic `Vue>=3.2.13`, `@vue/compiler-sfc` is no longer necessary.
- If you prefer Rollup, Use rollup branch.

```bash
Error: @vitejs/plugin-vue requires vue (>=3.2.13) or @vue/compiler-sfc to be present in the dependency tree.
