# Listingify Web

这是 Listingify 的本地 Web 工作台原型，用于多平台刊登中台的页面验证、规则维护和平台元数据浏览。当前 MVP 以 SHEIN 全托管作为第一个落地适配平台，后续预留 TEMU 等平台扩展。

## 当前状态

- 前端使用 React 19、TypeScript、Vite、React Router、TanStack Query 和 TanStack Table。
- UI 采用 shadcn/radix 风格组件和 lucide 图标。
- API 服务使用 Hono + PostgreSQL，通过 `pg` 连接池和兼容 facade 访问数据库。
- 已实现登录鉴权、RBAC 权限、用户管理、平台对接配置、同步任务和操作日志。
- 已实现首个平台元数据浏览页，当前数据源为 SHEIN，可查看类目、发布字段、图片规则、必填属性、销售属性和枚举值。
- 已实现 SHEIN 类目映射、SHEIN 尺码转换、SHEIN 包装规则、SHEIN 价格规则和 SKU 毛重等业务规则维护；低倍率清单已整合进 SHEIN 价格规则。
- 已实现 SHEIN 商品分桶、发布草稿箱、单款草稿详情、图片素材库选图、本地上传、批量校验、批量发布、发布任务和上新批次。

## 页面范围

- 上新工作：工作台、上新批次、SHEIN 商品分桶、SHEIN 发布草稿箱、发布任务。
- 规则中心：SHEIN 类目映射、SHEIN 尺码转换、SHEIN 包装规则、SHEIN 价格规则。
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
系统不再自动创建默认弱口令管理员。首次运行迁移后，请在项目根目录使用 `DATABASE_URL=postgres://listingify:listingify@localhost:5432/listingify npm run admin:create -- --username admin --display-name 系统管理员 --password '<强密码>'` 创建或重置管理员账号。

## 数据依赖

本地页面默认依赖 PostgreSQL：

```bash
cd ..
docker compose -f docker-compose.postgres.yml up -d

DATABASE_PROVIDER=postgres \
DATABASE_URL=postgres://listingify:listingify@localhost:5432/listingify \
npm run db:migrate

DATABASE_PROVIDER=postgres \
DATABASE_URL=postgres://listingify:listingify@localhost:5432/listingify \
npm run shein:metadata:import
```
