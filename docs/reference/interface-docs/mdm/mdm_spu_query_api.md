---
title: MDM SPU 查询接口
doc_type: query_api
object_type: spu
generated_at: 2026-04-21
source_files:
  - /Users/xingyicheng/Downloads/查询接口.docx
endpoint: https://mdm.semirapp.com/demdm-api/open/api/v2/selectApi/SAP_SPU
method: POST
---

# MDM SPU 查询接口

## 元信息

- 对象类型: `spu`
- 接口类型: `query_api`
- 接口地址: `https://mdm.semirapp.com/demdm-api/open/api/v2/selectApi/SAP_SPU`
- 请求方式: `POST`
- 原始文件: `/Users/xingyicheng/Downloads/查询接口.docx`

## 文档正文

### 自定义查询条件使用说明

查询接口支持使用系统字段和表单组件查询数据，在请求参数中传入组件的格式即可，不同组件对应的传参格式详情见请求参数及说明

### 接口报文示例

#### 请求报文示例

- 可见键集合: `FORM_CODE, UUID, PAGE, PAGE_SIZE, DATA`

#### 响应报文示例

- 可见键集合: `UUID, RESULT, MESSAGE, ERROR_CODE, LAST_PAGE, DATA`

### 请求头

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| demdmtoken | String | 用于请求的token | 是 | 否 |

### 请求参数

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| UUID | String | 请求的唯一标识 | 是 | 否 |
| PAGE | String | 分页参数，默认为1 | 是 | 否 |
| PAGE_SIZE | String | 分页参数，默认为10,每页查询多少条 | 是 | 否 |
| FORM_CODE | String | PRODUCT_SPU | 是 | 否 |
| DATA | PRODUCT_SPU | PRODUCT_SPU | 是 | 否 |

### PRODUCT_SPU说明

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| AGE_GROUP_DESC | String | 年龄段名称 | 否 | 否 |
| ARTICLE_PROP_DESC | String | 款属性名称 | 否 | 否 |
| BATCH_DESC | String | 批次名称 | 否 | 否 |
| BRAND_DESC | String | 品牌名称 | 否 | 否 |
| CHANNEL_LEVEL | String | 渠道层级 | 否 | 否 |
| CHANNEL_RD_PROP_DESC | String | 渠道研发属性名称 | 否 | 否 |
| COLLAR_SHAPE_DESC | String | 领型名称 | 否 | 否 |
| COMPOSITION | String | 成分 | 否 | 否 |
| DESIGNER | String | 设计师 | 否 | 否 |
| DETAILS_DESC | String | 细节名称 | 否 | 否 |
| ELECTRONIC_COMPONENTS | String | 电子原件 | 否 | 否 |
| FAB | String | FAB | 否 | 否 |
| FABRIC | String | 面料 | 否 | 否 |
| FABRIC_TYPE_DESC | String | 面种名称 | 否 | 否 |
| FILLER | String | 填充物 | 否 | 否 |
| FOOT_OPENING_DESC | String | 脚口名称 | 否 | 否 |
| IP_CARTOON_DESC | String | IP-卡通人物名称 | 否 | 否 |
| IP_TYPE_DESC | String | IP类型名称 | 否 | 否 |
| IS_CONTINUE_DESC | String | 是否延续款名称 | 否 | 否 |
| IS_IP_DESC | String | 是否IP名称 | 否 | 否 |
| IS_MENTAL_PRODUCTS_DESC | String | 是否心智产品名称 | 否 | 否 |
| IS_UNI_SIZE_DESC | String | 是否通码名称 | 否 | 否 |
| LENGTH_DESC | String | 长度名称 | 否 | 否 |
| LINING_MATERIAL | String | 里料 | 否 | 否 |
| LIVE_PROP_DESC | String | 股份直播款属性名称 | 否 | 否 |
| MAIN_SIZE_GROUP_DESC | String | 主尺码段名称 | 否 | 否 |
| MDM_CODE | String | 款号 | 否 | 否 |
| MDM_NAME | String | 款名称 | 否 | 否 |
| MENTAL_PRODUCTS | String | 心智产品 | 否 | 否 |
| MIDDLE_CLASS_DESC | String | 中类名称 | 否 | 否 |
| MODEL_DESC | String | 版型/鞋型名称 | 否 | 否 |
| OLD_ARTICLE_NUMBER | String | 旧物料号/原厂款号 | 否 | 否 |
| ORDER_PROP_DESC | String | 订货属性名称 | 否 | 否 |
| ORDER_SIZE_GROUP_DESC | String | 下单尺码段名称 | 否 | 否 |
| PIC_URL | String | 商品图片 | 否 | 否 |
| PLANE_DESC | String | 平面名称 | 否 | 否 |
| PRICE_RANGE_DESC | String | 价格档名称 | 否 | 否 |
| PRICE_TAG | String | 挂牌单价 | 否 | 否 |
| PRODUCT_CHAIN_DESC | String | 产品链（大类）名称 | 否 | 否 |
| PRODUCT_CORE_VALUE | String | 商品群 | 否 | 否 |
| PRODUCT_GROUP_DESC | String | 产品分组名称 | 否 | 否 |
| PRODUCT_LINE_DESC | String | 产品线名称 | 否 | 否 |
| PRODUCT_TYPE_DESC | String | 物料类型名称 | 否 | 否 |
| PROMOTION_GROUP | String | 推广群组 | 否 | 否 |
| PURC_GROUP_DESC | String | 采购组名称 | 否 | 否 |
| PURC_PATT_DESC | String | 采购模式名称 | 否 | 否 |
| RD_SERIES_LABELS | String | 研发系列标签 | 否 | 否 |
| RODUCT_POSITIONING_DESC | String | 商品定位名称 | 否 | 否 |
| SCENE_DESC | String | 场景名称 | 否 | 否 |
| SEASON_DESC | String | 季节名称 | 否 | 否 |
| SEX_DESC | String | 性别名称 | 否 | 否 |
| SILHOUETTE_DESC | String | 廓形名称 | 否 | 否 |
| SLEEVE_SHAPE_DESC | String | 袖型名称 | 否 | 否 |
| SPEC_RANGE | String | 规格范围 | 否 | 否 |
| SPU_GROUP | String | 组别 | 否 | 否 |
| STATUS_DESC | String | 物料状态名称 | 否 | 否 |
| STITCHES_NUMBER_DESC | String | 针数名称 | 否 | 否 |
| STORY_LINE | String | 故事线 | 否 | 否 |
| STYLE_LINE_DESC | String | 风格线名称 | 否 | 否 |
| SUBCLASS_DESC | String | 小类名称 | 否 | 否 |
| SUPPLY_TYPE_DESC | String | 轻供类型名称 | 否 | 否 |
| TEMP_ZONE | String | 温度带 | 否 | 否 |
| THEME | String | 主题 | 否 | 否 |
| THICKNESS | String | 厚度 | 否 | 否 |
| UNIT_DESC | String | 单位名称 | 否 | 否 |
| VERSION_NUMBER | String | 版单号/楦号 | 否 | 否 |
| WAIST_HEIGHT_DESC | String | 腰高名称 | 否 | 否 |
| WAIST_SHAPE_DESC | String | 腰型名称 | 否 | 否 |
| WASH_LABEL_INGR | String | 洗唛成分 | 否 | 否 |
| WASH_WATER_DESC | String | 洗水名称 | 否 | 否 |
| YEAR | String | 年份 | 否 | 否 |
| MDM_NAME_US | String | MDM_NAME_US | 否 | 否 |
| AGE_GROUP_CODE | String | 年龄段编码 | 否 | 否 |
| ARTICLE_PROP_CODE | String | 款属性编码 | 否 | 否 |
| BATCH_CODE | String | 批次编码 | 否 | 否 |
| BRAND_CODE | String | 品牌编码 | 否 | 否 |
| CHANNEL_RD_PROP_CODE | String | 渠道研发属性编码 | 否 | 否 |
| COLLAR_SHAPE_CODE | String | 领型编码 | 否 | 否 |
| DETAILS_CODE | String | 细节编码 | 否 | 否 |
| EAN_CODE | String | 国际码 | 否 | 否 |
| FABRIC_TYPE_CODE | String | 面种编码 | 否 | 否 |
| FOOT_OPENING_CODE | String | 脚口编码 | 否 | 否 |
| IP_CARTOON_CODE | String | IP-卡通人物编码 | 否 | 否 |
| IP_TYPE_CODE | String | IP类型编码 | 否 | 否 |
| IS_CONTINUE_CODE | String | 是否延续款编码 | 否 | 否 |
| IS_IP_CODE | String | 是否IP编码 | 否 | 否 |
| IS_MENTAL_PRODUCTS_CODE | String | 是否心智产品编码 | 否 | 否 |
| IS_UNI_SIZE_CODE | String | 是否通码编码 | 否 | 否 |
| LENGTH_CODE | String | 长度编码 | 否 | 否 |
| LIVE_PROP_CODE | String | 股份直播款属性编码 | 否 | 否 |
| MAIN_SIZE_GROUP_CODE | String | 主尺码段编码 | 否 | 否 |
| MIDDLE_CLASS_CODE | String | 中类编码 | 否 | 否 |
| MODEL_CODE | String | 版型/鞋型编码 | 否 | 否 |
| ORDER_PROP_CODE | String | 订货属性编码 | 否 | 否 |
| ORDER_SIZE_GROUP_CODE | String | 下单尺码段编码 | 否 | 否 |
| ORIGINAL_PRODUCT_CODE | String | 原商品编码 | 否 | 否 |
| PLANE_CODE | String | 平面编码 | 否 | 否 |
| PRICE_RANGE_CODE | String | 价格档编码 | 否 | 否 |
| PRODUCT_CHAIN_CODE | String | 产品链（大类）编码 | 否 | 否 |
| PRODUCT_GROUP_CODE | String | 产品分组编码 | 否 | 否 |
| PRODUCT_LINE_CODE | String | 产品线编码 | 否 | 否 |
| PRODUCT_POSITIONING_CODE | String | 商品定位编码 | 否 | 否 |
| PRODUCT_TYPE_CODE | String | 物料类型编码 | 否 | 否 |
| PURC_GROUP_CODE | String | 采购组编码 | 否 | 否 |
| PURC_PATT_CODE | String | 采购模式编码 | 否 | 否 |
| SCENE_CODE | String | 场景编码 | 否 | 否 |
| SEASON_CODE | String | 季节编码 | 否 | 否 |
| SEX_CODE | String | 性别编码 | 否 | 否 |
| SILHOUETTE_CODE | String | 廓形编码 | 否 | 否 |
| SLEEVE_SHAPE_CODE | String | 袖型编码 | 否 | 否 |
| STATUS_CODE | String | 物料状态编码 | 否 | 否 |
| STITCHES_NUMBER_CODE | String | 针数编码 | 否 | 否 |
| STYLE_LINE_CODE | String | 风格线编码 | 否 | 否 |
| SUBCLASS_CODE | String | 小类编码 | 否 | 否 |
| SUPPLY_TYPE_CODE | String | 轻供类型编码 | 否 | 否 |
| UNIT_CODE | String | 单位编码 | 否 | 否 |
| WAIST_HEIGHT_CODE | String | 腰高编码 | 否 | 否 |
| WAIST_SHAPE_CODE | String | 腰型编码 | 否 | 否 |
| WASH_WATER_CODE | String | 洗水编码 | 否 | 否 |
| CREATED_BY | String | 创建人 | 否 | 否 |
| LAST_UPDATED_BY | String | 最后更新人 | 否 | 否 |
| CREATION_DATE | String | 创建日期 | 否 | 否 |
| CREATION_DATE_START | String | 创建日期_开始时间 | 否 | 否 |
| CREATION_DATE_END | String | 创建日期_结束时间 | 否 | 否 |
| LAST_UPDATE_DATE | String | 最后更新日期 | 否 | 否 |
| LAST_UPDATE_DATE_START | String | 最后更新日期_开始时间 | 否 | 否 |
| LAST_UPDATE_DATE_END | String | 最后更新日期_结束时间 | 否 | 否 |
| ENABLED_DATE | String | 启用时间 | 否 | 否 |
| ENABLED_DATE_START | String | 启用时间_开始时间 | 否 | 否 |
| ENABLED_DATE_END | String | 启用时间_结束时间 | 否 | 否 |
| DISABLED_DATE | String | 禁用时间 | 否 | 否 |
| DISABLED_DATE_START | String | 禁用时间_开始时间 | 否 | 否 |
| DISABLED_DATE_END | String | 禁用时间_结束时间 | 否 | 否 |
| ENABLE_STATUS | String | 启用禁用 | 否 | 否 |

### 响应结果

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| UUID | String | 请求的唯一标识 | 是 | 否 |
| DATA | List<PRODUCT_SPU> | PRODUCT_SPU | 是 | 否 |
| RESULT | String | 响应结果编码；S代表的是接口调用成功,E代表的是接口调用失败 | 是 | 否 |
| MESSAGE | String | 响应结果集描述 | 否 | 否 |
| ERROR_CODE | String | 失败编码 | 否 | 否 |

### DATA说明

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| AGE_GROUP_DESC | String | 年龄段名称 | 否 | 否 |
| ARTICLE_PROP_DESC | String | 款属性名称 | 否 | 否 |
| ASSOCIATED_MDM_ID | String | 记录关联主数据的ID | 否 | 否 |
| BATCH_DESC | String | 批次名称 | 否 | 否 |
| BRAND_DESC | String | 品牌名称 | 否 | 否 |
| CHANNEL_LEVEL | String | 渠道层级 | 否 | 否 |
| CHANNEL_RD_PROP_DESC | String | 渠道研发属性名称 | 否 | 否 |
| COLLAR_SHAPE_DESC | String | 领型名称 | 否 | 否 |
| COMPOSITION | String | 成分 | 否 | 否 |
| CUSTOMS_DECL_PRD_NAME | String | 报关品名 | 否 | 否 |
| DESIGNER | String | 设计师 | 否 | 否 |
| DETAILS_DESC | String | 细节名称 | 否 | 否 |
| DOMAIN_ID | String | 记录主数据域的ID | 否 | 否 |
| ELECTRONIC_COMPONENTS | String | 电子原件 | 否 | 否 |
| FAB | String | FAB | 否 | 否 |
| FABRIC | String | 面料 | 否 | 否 |
| FABRIC_TYPE_DESC | String | 面种名称 | 否 | 否 |
| FILLER | String | 填充物 | 否 | 否 |
| FOOT_OPENING_DESC | String | 脚口名称 | 否 | 否 |
| FORM_CODE | String | 记录主数据的表单编码 | 否 | 否 |
| ID | String | 记录主数据的ID | 否 | 否 |
| IP_CARTOON | String | IP-卡通人物 | 否 | 否 |
| IP_CARTOON_DESC | String | IP-卡通人物名称 | 否 | 否 |
| IP_TYPE_DESC | String | IP类型名称 | 否 | 否 |
| IS_CONTINUE_DESC | String | 是否延续款名称 | 否 | 否 |
| IS_IP_DESC | String | 是否IP名称 | 否 | 否 |
| IS_MENTAL_PRODUCTS_DESC | String | 是否心智产品名称 | 否 | 否 |
| IS_UNI_SIZE_DESC | String | 是否通码名称 | 否 | 否 |
| LENGTH_DESC | String | 长度名称 | 否 | 否 |
| LINING_MATERIAL | String | 里料 | 否 | 否 |
| LIVE_PROP_DESC | String | 股份直播款属性名称 | 否 | 否 |
| MAIN_SIZE_GROUP_DESC | String | 主尺码段名称 | 否 | 否 |
| MDM_CODE | String | 款号 | 否 | 否 |
| MDM_NAME | String | 款名称 | 否 | 否 |
| MENTAL_PRODUCTS | String | 心智产品 | 否 | 否 |
| MERGE_MDM_ID | String | 记录合并主数据的ID | 否 | 否 |
| MIDDLE_CLASS_DESC | String | 中类名称 | 否 | 否 |
| MODEL_DESC | String | 版型/鞋型名称 | 否 | 否 |
| OLD_ARTICLE_NUMBER | String | 旧物料号/原厂款号 | 否 | 否 |
| ORDER_PROP_DESC | String | 订货属性名称 | 否 | 否 |
| ORDER_SIZE_GROUP_DESC | String | 下单尺码段名称 | 否 | 否 |
| PIC_URL | String | 商品图片 | 否 | 否 |
| PLANE_DESC | String | 平面名称 | 否 | 否 |
| PRICE_RANGE_DESC | String | 价格档名称 | 否 | 否 |
| PRICE_TAG | String | 挂牌单价 | 否 | 否 |
| PRODUCT_CHAIN_DESC | String | 产品链（大类）名称 | 否 | 否 |
| PRODUCT_CORE_VALUE | String | 商品群 | 否 | 否 |
| PRODUCT_GROUP_DESC | String | 产品分组名称 | 否 | 否 |
| PRODUCT_LINE_DESC | String | 产品线名称 | 否 | 否 |
| PRODUCT_TYPE_DESC | String | 物料类型名称 | 否 | 否 |
| PROMOTION_GROUP | String | 推广群组 | 否 | 否 |
| PURC_GROUP_DESC | String | 采购组名称 | 否 | 否 |
| PURC_PATT_DESC | String | 采购模式名称 | 否 | 否 |
| RD_SERIES_LABELS | String | 研发系列标签 | 否 | 否 |
| RODUCT_POSITIONING_DESC | String | 商品定位名称 | 否 | 否 |
| SCENE_DESC | String | 场景名称 | 否 | 否 |
| SEASON_DESC | String | 季节名称 | 否 | 否 |
| SEX_DESC | String | 性别名称 | 否 | 否 |
| SILHOUETTE_DESC | String | 廓形名称 | 否 | 否 |
| SLEEVE_SHAPE_DESC | String | 袖型名称 | 否 | 否 |
| SOURCE_DOMAIN_ID | String | 记录来源主数据域的ID | 否 | 否 |
| SOURCE_MDM_ID | String | 记录来源主数据的ID | 否 | 否 |
| SPEC_RANGE | String | 规格范围 | 否 | 否 |
| SPU_GROUP | String | 组别 | 否 | 否 |
| STATUS_DESC | String | 物料状态名称 | 否 | 否 |
| STITCHES_NUMBER_DESC | String | 针数名称 | 否 | 否 |
| STORY_LINE | String | 故事线 | 否 | 否 |
| STYLE_LINE_DESC | String | 风格线名称 | 否 | 否 |
| SUBCLASS_DESC | String | 小类名称 | 否 | 否 |
| SUPPLY_TYPE_DESC | String | 轻供类型名称 | 否 | 否 |
| TEMP_ZONE | String | 温度带 | 否 | 否 |
| THEME | String | 主题 | 否 | 否 |
| THICKNESS | String | 厚度 | 否 | 否 |
| UNIT_DESC | String | 单位名称 | 否 | 否 |
| VERSION_NUMBER | String | 版单号/楦号 | 否 | 否 |
| WAIST_HEIGHT_DESC | String | 腰高名称 | 否 | 否 |
| WAIST_SHAPE_DESC | String | 腰型名称 | 否 | 否 |
| WASH_LABEL_INGR | String | 洗唛成分 | 否 | 否 |
| WASH_WATER_DESC | String | 洗水名称 | 否 | 否 |
| YEAR | String | 年份 | 否 | 否 |
| MDM_NAME_US | String | MDM_NAME_US | 否 | 否 |
| AGE_GROUP_CODE | String | 年龄段编码 | 否 | 否 |
| ARTICLE_PROP_CODE | String | 款属性编码 | 否 | 否 |
| BATCH_CODE | String | 批次编码 | 否 | 否 |
| BRAND_CODE | String | 品牌编码 | 否 | 否 |
| CHANNEL_RD_PROP_CODE | String | 渠道研发属性编码 | 否 | 否 |
| COLLAR_SHAPE_CODE | String | 领型编码 | 否 | 否 |
| DETAILS_CODE | String | 细节编码 | 否 | 否 |
| EAN_CODE | String | 国际码 | 否 | 否 |
| FABRIC_TYPE_CODE | String | 面种编码 | 否 | 否 |
| FOOT_OPENING_CODE | String | 脚口编码 | 否 | 否 |
| HS_CODE | String | HS.CODE | 否 | 否 |
| IP_CARTOON_CODE | String | IP-卡通人物编码 | 否 | 否 |
| IP_TYPE_CODE | String | IP类型编码 | 否 | 否 |
| IS_CONTINUE_CODE | String | 是否延续款编码 | 否 | 否 |
| IS_IP_CODE | String | 是否IP编码 | 否 | 否 |
| IS_MENTAL_PRODUCTS_CODE | String | 是否心智产品编码 | 否 | 否 |
| IS_UNI_SIZE_CODE | String | 是否通码编码 | 否 | 否 |
| LENGTH_CODE | String | 长度编码 | 否 | 否 |
| LIVE_PROP_CODE | String | 股份直播款属性编码 | 否 | 否 |
| MAIN_SIZE_GROUP_CODE | String | 主尺码段编码 | 否 | 否 |
| MIDDLE_CLASS_CODE | String | 中类编码 | 否 | 否 |
| MODEL_CODE | String | 版型/鞋型编码 | 否 | 否 |
| ORDER_PROP_CODE | String | 订货属性编码 | 否 | 否 |
| ORDER_SIZE_GROUP_CODE | String | 下单尺码段编码 | 否 | 否 |
| ORIGINAL_PRODUCT_CODE | String | 原商品编码 | 否 | 否 |
| PLANE_CODE | String | 平面编码 | 否 | 否 |
| PRICE_RANGE_CODE | String | 价格档编码 | 否 | 否 |
| PRODUCT_CHAIN_CODE | String | 产品链（大类）编码 | 否 | 否 |
| PRODUCT_GROUP_CODE | String | 产品分组编码 | 否 | 否 |
| PRODUCT_LINE_CODE | String | 产品线编码 | 否 | 否 |
| PRODUCT_POSITIONING_CODE | String | 商品定位编码 | 否 | 否 |
| PRODUCT_TYPE_CODE | String | 物料类型编码 | 否 | 否 |
| PURC_GROUP_CODE | String | 采购组编码 | 否 | 否 |
| PURC_PATT_CODE | String | 采购模式编码 | 否 | 否 |
| SCENE_CODE | String | 场景编码 | 否 | 否 |
| SEASON_CODE | String | 季节编码 | 否 | 否 |
| SEX_CODE | String | 性别编码 | 否 | 否 |
| SILHOUETTE_CODE | String | 廓形编码 | 否 | 否 |
| SLEEVE_SHAPE_CODE | String | 袖型编码 | 否 | 否 |
| STATUS_CODE | String | 物料状态编码 | 否 | 否 |
| STITCHES_NUMBER_CODE | String | 针数编码 | 否 | 否 |
| STYLE_LINE_CODE | String | 风格线编码 | 否 | 否 |
| SUBCLASS_CODE | String | 小类编码 | 否 | 否 |
| SUPPLY_TYPE_CODE | String | 轻供类型编码 | 否 | 否 |
| UNIT_CODE | String | 单位编码 | 否 | 否 |
| WAIST_HEIGHT_CODE | String | 腰高编码 | 否 | 否 |
| WAIST_SHAPE_CODE | String | 腰型编码 | 否 | 否 |
| WASH_WATER_CODE | String | 洗水编码 | 否 | 否 |
| CREATED_BY | String | 创建人 | 否 | 否 |
| LAST_UPDATED_BY | String | 最后更新人 | 否 | 否 |
| CREATION_DATE | String | 创建日期 | 否 | 否 |
| CREATION_DATE_START | String | 创建日期_开始时间 | 否 | 否 |
| CREATION_DATE_END | String | 创建日期_结束时间 | 否 | 否 |
| LAST_UPDATE_DATE | String | 最后更新日期 | 否 | 否 |
| LAST_UPDATE_DATE_START | String | 最后更新日期_开始时间 | 否 | 否 |
| LAST_UPDATE_DATE_END | String | 最后更新日期_结束时间 | 否 | 否 |
| ENABLED_DATE | String | 启用时间 | 否 | 否 |
| ENABLED_DATE_START | String | 启用时间_开始时间 | 否 | 否 |
| ENABLED_DATE_END | String | 启用时间_结束时间 | 否 | 否 |
| DISABLED_DATE | String | 禁用时间 | 否 | 否 |
| DISABLED_DATE_START | String | 禁用时间_开始时间 | 否 | 否 |
| DISABLED_DATE_END | String | 禁用时间_结束时间 | 否 | 否 |
| ENABLE_STATUS | String | 启用禁用 | 否 | 否 |
