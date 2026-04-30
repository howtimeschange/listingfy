# Listingify Web

这是 Listingify 的本地 Web 工作台原型，用于多平台刊登中台的页面验证、规则维护和平台元数据浏览。当前 MVP 以 SHEIN 全托管作为第一个落地适配平台，后续预留 TEMU 等平台扩展。

## 当前状态

- 前端使用 React 19、TypeScript、Vite、React Router、TanStack Query 和 TanStack Table。
- UI 采用 shadcn/radix 风格组件和 lucide 图标。
- API 服务使用 Hono + better-sqlite3，读取根目录 `data/app.sqlite`。
- 已实现登录鉴权、RBAC 权限、用户管理、平台对接配置、同步任务和操作日志。
- 已实现首个平台元数据浏览页，当前数据源为 SHEIN，可查看类目、发布字段、图片规则、必填属性、销售属性和枚举值。
- 已实现类目映射、SHEIN 尺码转换、包装规则、价格规则、SKU 毛重和低倍率清单等业务规则维护。
- 已实现 SHEIN 商品分桶、发布草稿箱、单款草稿详情、图片素材库选图、本地上传、批量校验、批量发布、发布任务和上新批次。

## 页面范围

- 上新工作：工作台、上新批次、SHEIN 商品分桶、SHEIN 发布草稿箱、发布任务。
- 规则中心：类目映射、属性映射、尺码转换、包装规则、价格规则、低倍率清单。
- 数据中心：平台元数据、MDM 商品主数据、深绘内容包、图片素材库。
- 系统管理：平台对接、用户管理、同步任务、操作日志。

## 开发命令

```bash
npm install
npm run server:dev
npm run dev
npm run build
npm run lint
```

也可以在项目根目录运行：

```bash
npm run web:server
npm run web:dev
```

默认 API 服务端口为 `3001`。
开发环境首次启动会自动创建默认管理员账号，账号为 `admin`，默认密码为 `admin123456`。可通过 `LISTINGIFY_ADMIN_USERNAME`、`LISTINGIFY_ADMIN_PASSWORD`、`LISTINGIFY_ADMIN_DISPLAY_NAME` 覆盖。

## 数据依赖

页面依赖根目录的本地 SQLite 数据库：

```bash
cd ..
npm run db:migrate
npm run shein:metadata:import
```

`data/app.sqlite` 不提交 Git，生产化前需要替换为正式数据库和鉴权方案。
