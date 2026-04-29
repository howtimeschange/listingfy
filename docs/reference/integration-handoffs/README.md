# Integration Handoffs

本目录保存 MDM、深绘等外部系统对接交接资料的可提交版本。

## 目录规则

- `mdm-deepdraw-handoff.redacted.md`：可提交的脱敏交接说明。
- `private/`：本地私有原件归档目录，已在根 `.gitignore` 中忽略，不同步到 GitHub。

## 当前本地私有原件

以下文件已复制到 `private/`，仅保留在本机项目目录中：

- `MDM&深绘 (1).docx`
- `dop-jar.original.zip`

原始 DOCX 中包含深绘 `appKey`、`appSecret`、`dopKey`、`merchantId` 等账号配置，不能提交到 GitHub。

SDK zip 中的两个 jar 已清理 macOS 元数据后保存到 `vendor/deepdraw-sdk/` 并提交。
