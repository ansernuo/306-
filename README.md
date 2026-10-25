# 内科题库

## 手机访问

优先使用已部署的个人网页（手机和电脑都可打开）：

<https://neike-306-tiku.phamkhanhs87501.chatgpt.site>

这是私有站点，需要在浏览器中登录与当前 Codex 相同的 ChatGPT/OpenAI 账号；登录后可在任意网络访问。

电脑需要保持运行题库服务。若电脑 IP 变化，用下面命令查看新地址：

```bash
ipconfig getifaddr en0
```

## 启动

```bash
pnpm run dev --host 0.0.0.0 --port 4173
```

## 五科口诀库

在顶栏选择“口诀”，复用原搜索框查找口诀、疾病或知识点；首页按科目、系统／章节展示目录。搜索区分口诀名称与知识点，名称直接命中优先；卡片仅展示经过精简的对应关系及必要条件，支持当前浏览器收藏。
直接入口：`/?view=mnemonics`。可附加 `q` 和 `mnemonicSubject` 参数。

数据来自五科现有 Notion 口诀文档，原始 2557 条，经明确重复合并及无效边注清理后为 2363 条；跨科重复保留多个分类入口，搜索只呈现一条。来源标识、合并记录和各科条数保存在 `src/data/mnemonics-data.json`。更新时将五页正文导出为 `mnemonic-source-{subject}.md`，再运行 `python3 scripts/import_mnemonics.py <导出目录>`；去重及排除清单保存在 `src/data/mnemonic-consolidation.json`；逐条修订保存在 `src/data/mnemonic-curation.json`，导入会调用 `scripts/curate_mnemonics.py`。搜索和导入完整性校验：`node --test tests/mnemonics.test.mjs`。

如需在本地调试，仍可使用上面的局域网方式；本地服务必须保持电脑运行。
