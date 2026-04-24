---
title: MDM 通用 Token 与表单组件说明
doc_type: token_guide
object_type: common
generated_at: 2026-04-21
source_files:
  - /Users/xingyicheng/Downloads/获取TOKEN和其他说明.docx
  - /Users/xingyicheng/Downloads/获取TOKEN和其他说明 (1).docx
endpoint: https://mdm.semirapp.com/demdm-api/open/api/getToken
method: GET
---

# MDM 通用 Token 与表单组件说明

## 元信息

- 对象类型: `common`
- 适用范围: `SPU / SKU / 其他 MDM 开放接口`
- Token 接口: `https://mdm.semirapp.com/demdm-api/open/api/getToken`
- 请求方式: `GET`
- 原始文件: `/Users/xingyicheng/Downloads/获取TOKEN和其他说明.docx`
- 原始文件: `/Users/xingyicheng/Downloads/获取TOKEN和其他说明 (1).docx`

## 文档正文

### 1、获取APP_ID和APP_KEY

1.1.登录主数据平台，进入后台管理系统，打开集成管理菜单，点击接口认证。

1.2.在接口认证的弹框中填写需要接入的系统信息，点击提交，提交后即可在页面中获取APP_ID和APP_KEY。

### 2、根据APP_ID和APP_KEY获取TOKEN

2.1.通过get请求，在请求参数中添加APP_ID和APP_KEY调用 https://mdm.semirapp.com/demdm-api/open/api/getToken 接口。再从请求结果中获取TOKEN。（TOKEN生效期为1个小时，超时后调用系统接口需要重新获取TOKEN）

2.2.根据TOKEN调用MDM系统提供的对外接口。

### 3、表单组件说明

### 表单组件说明表

| 组件类型 | 说明 |
| --- | --- |
| 单行输入 | ---- |
| 多行输入 | ---- |
| 数字输入 | ---- |
| 日期时间 | 格式包括：年月日（2020-01-01）；年月日时间（2020-01-01 12:00:00) |
| 手机号码 | ---- |
| 电子邮箱 | ---- |
| 证件号 | ---- |
| 单选框 | value只能为表单配置的数据字典中的选项编码； 格式为{"code":"code"}，示例：{"GENDER":"male"} |
| 多选框 | value只能为表单配置的数据字典中的选项编码； 格式为{"code":"code1,code2"}，示例：{"GENDER":"male,female"} |
| 下拉框 | value只能为表单配置的数据字典中的选项编码；单选时，格式为{"code":"code"}，示例：{"GENDER":"male"}；多选时， 格式为{"code":"code1,code2"}，示例：{"GENDER":"male,female"} |
| 金额 | ---- |
| 地区地址 | 地区地址组件对应的字段的value为JSON.该json包含的格式为{"province":"","city":"","district":"","detail":""}，示例:{"province":"北京市","city":"北京市","district":"东城区","detail":"xx街道xx号"}或者{"province":"","city":"","district":"","detail":"北京市北京市东城区xx街道xx号"} |
| 超链接 | ---- |
| 单据号 | ---- |
| 数据选择-自定义存储 | value只能为表单配置的数据选择-自定义存储组件中“指定存储字段的值”；单选时，格式为{"code":"code"}，示例：{"ORGNAME":"D1000"}；多选时， 格式为{"code":"code1,code2"}，示例：{"ORGNAME":"D1000,D1001"} |
