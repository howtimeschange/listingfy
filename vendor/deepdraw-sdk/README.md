# DeepDraw SDK

本目录保存深绘交接包 `dop-jar.zip` 中可提交的 Java SDK jar。

## 文件

| 文件 | 版本 | SHA-256 |
| --- | --- | --- |
| `dop-sdk-1.6.0.jar` | `1.6.0` | `81d1265762062e90363cffd8c4a865571c373e46f8a41471ab37fbedd0e2a627` |
| `sdk-core-java-1.1.0.jar` | `1.1.0` | `a9eb423b2522c9be4c632d75bd763a4dee7a6d4c1c982772ab3cf4309f37f3d3` |

## 来源

文件来自本地交接包：

```text
/Users/xingyicheng/Downloads/dop-jar.zip
```

原 zip 中包含 `.DS_Store` 和 `__MACOSX` 元数据；本目录只保留实际 jar 文件。

## 安全说明

提交前已扫描 jar 字符串，未发现交接文档中的 `appKey`、`appSecret`、`dopKey` 或账号映射明文。深绘凭据必须通过环境变量或密钥管理注入，不能写入仓库。
