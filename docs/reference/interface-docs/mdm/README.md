# MDM 接口参考索引

这组文件由下载的 `docx` 网页导出件清洗而来，已按 `SPU / SKU / 通用` 和接口类型重新命名，便于后续给 AI 或工程实现直接引用。

## 分类结论

- `查询接口.docx` -> `SPU 查询接口`
- `查询接口 (1).docx` -> `SKU 查询接口`
- `批量保存接口.docx` -> `SPU 批量保存接口`
- `批量保存接口 (1).docx` -> `SKU 批量保存接口`
- `获取TOKEN和其他说明.docx` 与 `获取TOKEN和其他说明 (1).docx` -> 同一份 `MDM 通用 Token 与表单组件说明`

## 规范化文件

| 新文件 | 类型 | 对象 | 说明 |
| --- | --- | --- | --- |
| `mdm_spu_query_api.md` | query_api | SPU | SPU 查询接口 |
| `mdm_sku_query_api.md` | query_api | SKU | SKU 查询接口 |
| `mdm_spu_batch_save_api.md` | batch_save_api | SPU | SPU 批量保存接口 |
| `mdm_sku_batch_save_api.md` | batch_save_api | SKU | SKU 批量保存接口 |
| `mdm_common_token_guide.md` | token_guide | common | Token 获取与表单组件说明，两个原始 docx 已去重合并 |

## 原始文件映射

| 原始文件 | 归档说明 |
| --- | --- |
| `/Users/xingyicheng/Downloads/查询接口.docx` | 已整理为 `mdm_spu_query_api.md` |
| `/Users/xingyicheng/Downloads/查询接口 (1).docx` | 已整理为 `mdm_sku_query_api.md` |
| `/Users/xingyicheng/Downloads/批量保存接口.docx` | 已整理为 `mdm_spu_batch_save_api.md` |
| `/Users/xingyicheng/Downloads/批量保存接口 (1).docx` | 已整理为 `mdm_sku_batch_save_api.md` |
| `/Users/xingyicheng/Downloads/获取TOKEN和其他说明.docx` | 与重复件合并整理为 `mdm_common_token_guide.md` |
| `/Users/xingyicheng/Downloads/获取TOKEN和其他说明 (1).docx` | 与重复件合并整理为 `mdm_common_token_guide.md` |
