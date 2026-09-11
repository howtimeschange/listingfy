# test10 最新鞋品规则验收（2026-09-11）

款号 `204426140121-test10`，草稿1067，深绘商品6537362。

使用最新本地规则的生产隔离运行目录完成来源重建、API 创建、完整补写及独立资源回读。三份规则文件的本地/服务器 SHA256 一致。主服务未部署；没有网页提交。

## 请求及回读

- 服务最终状态 `readback_verified`；独立验收14项全部通过。
- 30 SKU，主表、唯品会、天猫、抖音4张表各15行。
- 唯品首列26码至40码，与销售尺码一致；表内数据列欧洲码、脚长、鞋内长，没有额外尺码数据列。
- 15个选中尺码备注均为脚长(区间/内长数值)，例如脚长(15.8-16.2/内长17)，已在新打开页面只读核对。
- 原产国142（中国）、鞋垫材质其他、件重尺按规格设置：API与页面均正确。
- 唯品重量、包装长宽高：创建业务报文、创建SDK报文、补写SDK报文均无这四个字段；创建后资源及最终资源也无这四项。未发送0、1或空字符串，未做测试值回填。
- 新打开页面仍默认显示四个0。这是本次不传字段后的页面实际表现，不将其描述为页面空白；用户最新要求“创建起不构建”已满足。

重建后沿用已有来源中的商品详情和材质(AKC)补齐两项必填值。

证据：`/tmp/listingify-test10-20260911/evidence/`，包括create-business-payload.json、create-sdk-product.json、create-response.json、after-create-resource.json、update-sdk-product.json、update-response.json、create-result.json、final-resource.json、final-draft.json和verification.json。服务器目录 `/opt/listingfy/tmp/test10-20260911/`。
