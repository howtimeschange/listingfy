# Temu 自由文档摘录

- 抓取时间：2026-04-17T10:18:26.136880+08:00
- 文档数：45

## 文档中心 / API文档 / 【必读】PA网关 / PA网关调用说明

- 文档 ID：`161805618337`
- 更新时间：`2026-03-30T15:23:01.100000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=161805618337`

# 一、网关更换说明

部分接口已迁移至partner网关

1、需要将调用地址改为partner网关地址：https://openapi-b-partner.temu.com/openapi/router

2、更换接口type

3、重新授权获取新的token，获取授权路径：https://agentseller.temu.com/open/system-manage/client-manage
[image]  https://commimg.kwcdn.com/feed-public-tag/21a488e658/d1dec5e0-8026-4acb-8a91-84ae6b7f1b1c_1587x834.jpeg

# 二、已迁移的接口如下，未列出的接口仍使用原CN网关
（接口文档需要三方ERP入驻/自研应用绑定后查看，游客账号无法访问）

## 2025-6 迁移

接口组接口新接口type（PA网关）原接口type基础API组查询当前token对应授权信息bg.open.accesstoken.info.get.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=929722395417)bg.open.accesstoken.info.get 半托库存API组半托管新增路由绑定及库存填写接口bg.btg.goods.stock.route.add  (https://agentpartner.temu.com/document?cataId=875198836203&docId=931819715810)bg.goods.routestock.add半托管销售库存更新接口bg.btg.goods.stock.quantity.update (https://agentpartner.temu.com/document?cataId=875198836203&docId=929727846558)bg.goods.quantity.update查询半托管商品销售库存bg.btg.goods.stock.quantity.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=929728959750)bg.goods.quantity.get根据站点查询可绑定的发货仓库信息接口bg.btg.goods.stock.warehouse.list.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=929731654843)bg.goods.warehouse.list.get半托调价API组（仅自研应用）半托管批量确认/拒绝调价单bg.semi.adjust.price.batch.review.order (https://agentpartner.temu.com/document?cataId=875198836203&docId=931820964658)bg.semi.adjust.price.batch.review分页查询半托管调价单bg.semi.adjust.price.page.query.order (https://agentpartner.temu.com/document?cataId=875198836203&docId=931822060910)bg.semi.adjust.price.page.query半托核价API组（仅自研应用）分页查询半托管核价单bg.semi.price.review.page.query.order (https://agentpartner.temu.com/document?cataId=875198836203&docId=929730272138)bg.price.review.page.query
（注意全托仍使用原接口）半托管同意核价单建议价bg.semi.price.review.confirm.order (https://agentpartner.temu.com/document?cataId=875198836203&docId=929730556932)bg.price.review.confirm
（注意全托仍使用原接口）半托管不同意核价单建议价（并给出新的申报价）bg.semi.price.review.reject.order (https://agentpartner.temu.com/document?cataId=875198836203&docId=931823247765)bg.price.review.reject
（注意全托仍使用原接口）

## 2025-8 迁移

接口组接口新接口type（PA网关）原接口type视频API组查询视频上传sign接口bg.goods.video.upload.sign.get.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=922385371829)bg.goods.video.upload.sign.get查询视频转码结果接口bg.goods.big.video.upload.result.get.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=922387061211)bg.goods.big.video.upload.result.get图片API组bas64图片上传bg.goods.image.upload.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=929743122710)bg.goods.image.upload文字转图片bg.goods.texttopicture.add.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=922387453346)bg.goods.texttopicture.add高清图片压缩处理bg.glo.picturecompression.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=921337345322)bg.picturecompression.get色块图获取bg.glo.colorimageurl.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=929744601978)bg.colorimageurl.get图片中cm转inchbg.glo.fancy.image.cm2in (https://agentpartner.temu.com/document?cataId=875198836203&docId=929745291948)bg.fancy.image.cm2in类目属性API组外部商品图片映射temu类目bg.glo.goods.photorecommendationcategory.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=921339267612)bg.goods.photorecommendationcategory.get
## 2025-9 迁移

接口组接口新接口type（PA网关）（两个type都可以）原接口type货品API组上传货品bg.glo.goods.add (https://agentpartner.temu.com/document?cataId=875198836203&docId=925526695187)=temu.goods.addbg.goods.add商品列表查询bg.glo.goods.list.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=924479235154)=temu.goods.list.getbg.goods.list.get商品详情查询接口bg.glo.goods.detail.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=925528074151)=temu.goods.detail.getbg.goods.detail.get货品搬运接口bg.glo.goods.migrate (https://agentpartner.temu.com/document?cataId=875198836203&docId=924481089321)=temu.goods.migratebg.goods.migrate批量查询爆款售罄商品bg.glo (https://agentpartner.temu.com/document?cataId=875198836203&docId=924481378182).goods.topselling.soldout.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=924481378182)=temu.goods.topselling.soldout.getbg.goods.topselling.soldout.get商品条码API组定制品商品条码查询bg.glo.goods.custom.label.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=924483272975)=temu.goods.custom.label.getbg.goods.custom.label.get商品条码查询V2bg.glo.goods.labelv2.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=925530254496)=temu.goods.labelv2.getbg.goods.labelv2.get编辑API组提交货品修改单bg.glo.goods.edit.task.submit (https://agentpartner.temu.com/document?cataId=875198836203&docId=924483837164)=temu.goods.edit.task.submitbg.goods.edit.task.submit编辑货品敏感品属性bg.glo.goods.edit.sensitive.attr (https://agentpartner.temu.com/document?cataId=875198836203&docId=924485149181)=temu.goods.edit.sensitive.attrbg.goods.edit.sensitive.attr修改商品素材bg.glo.goods.edit.pictures.submit (https://agentpartner.temu.com/document?cataId=875198836203&docId=924486362213)bg.goods.edit.pictures.submit货品更新接口bg.glo.goods.update (https://agentpartner.temu.com/document?cataId=875198836203&docId=925532416793)bg.goods.update新增货品属性bg.glo.goods.add.property (https://agentpartner.temu.com/document?cataId=875198836203&docId=925533793591)bg.goods.add.property编辑货品属性bg.glo.goods.edit.property (https://agentpartner.temu.com/document?cataId=875198836203&docId=924487372748)bg.goods.edit.property编辑商品运费模板bg.glo.goodslogistics.template.edit (https://agentpartner.temu.com/document?cataId=875198836203&docId=925534357132)bg.goodslogistics.template.edit尺码表API组编辑货品尺码表bg.glo. (https://agentpartner.temu.com/document?cataId=875198836203&docId=925534357132)goods.size.template.edit (https://agentpartner.temu.com/document?cataId=875198836203&docId=925536879257)bg.goods.edit说明书API组编辑货品说明书bg.glo. (https://agentpartner.temu.com/document?cataId=875198836203&docId=925534357132)goods.edit.guide.file (https://agentpartner.temu.com/document?cataId=875198836203&docId=924487751531)bg.goods.edit.guide.file类目属性API组类目必填信息接口bg.glo. (https://agentpartner.temu.com/document?cataId=875198836203&docId=925534357132)goods.catsmandatory.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=924490387484)bg.goods.catsmandatory.get查询运费模板列表bg.glo.logistics.template.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=929751463671)bg.logistics.template.get价格API组（仅自研应用）货品申报价查询bg.glo. (https://agentpartner.temu.com/document?cataId=875198836203&docId=925534357132)goods.price.list.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=924491336796)bg.goods.price.list.get活动API组（仅自研应用）查询活动详情bg.marketing.activity.detail.get.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=924492762131)bg.marketing.activity.detail.get查询活动列表bg.marketing.activity.list.get.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=925541647527)bg.marketing.activity.list.get查询活动商品bg.marketing.activity.product.get.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=925542694225)bg.marketing.activity.product.get查询活动场次列表bg.marketing.activity.session.list.get.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=925544038104)bg.marketing.activity.session.list.get查询活动报名记录bg.marketing.activity.enroll.list.get.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=925545287212)bg.marketing.activity.enroll.list.get活动报名提交bg.marketing.activity.enroll.submit.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=925545774394)bg.marketing.activity.enroll.submitJIT组打开JITbg.glo. (https://agentpartner.temu.com/document?cataId=875198836203&docId=925534357132)jitmode.activate (https://agentpartner.temu.com/document?cataId=875198836203&docId=924495543423)bg.jitmode.activate

## 2025-10 迁移

接口组接口新接口type（PA网关）原接口type货品API组查询货品生命周期状态bg.glo.product.search (https://agentpartner.temu.com/document?cataId=875198836203&docId=931835549486)bg.product.search图片API组批量识别牛皮癣图片bg.compliancepicture.get.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=931836881413)bg.compliancepicture.get商品图片翻译bg.algo.image.translate.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=931837530976)bg.algo.image.translate商品图片翻译接口查询bg.algo.image.translate.result.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=931838146384)bg.algo.image.translate.result

## 2026-01 迁移

接口组接口新接口type（PA网关）原接口type（将于1.19下线）类目属性API组查询父规格列表bg.glo.goods.parentspec.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=929747769955)bg.goods.parentspec.get创建规格bg.glo.goods.spec.create (https://agentpartner.temu.com/document?cataId=875198836203&docId=931841951080)bg.goods.spec.create货品包装清单类型查询bg.glo.goods.accessories.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=929748813829)bg.goods.accessories.get全托库存API组虚拟库存查询bg.qtg.stock.virtualinventoryjit.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=929749856571)bg.virtualinventoryjit.get虚拟库存编辑bg.qtg.stock.virtualinventoryjit.edit (https://agentpartner.temu.com/document?cataId=875198836203&docId=931843405940)bg.virtualinventoryjit.edit

## 2026-03 迁移
接口组接口新接口type（PA网关）原接口type（将于4.10下线）类目API组内外属性映射bg.goods.attribute.mapping.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=933915727207)bg.goods.attribute.mapping货品API组货品品牌查询bg.glo.goods.brand.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=932867285290)bg.goods.brand.get发起货品修改单bg.glo.goods.edit.task.apply (https://agentpartner.temu.com/document?cataId=875198836203&docId=932868418031)bg.goods.edit.task.apply

# 三、FAQ

1、type not exists

1-1、检查type传值是否正确，
1-2、检查网关地址是否正确
1-3、检查type和网关是否对应，已经切换的type需要调PA网关，未切换的type需要调CN网关

2、access_token don't have this api access, please ask for seller to authorize this api in seller center first，and share the new access_token with you

2-1、新的type需要重新授权，授权地址：https://agentseller.temu.com/open/system-manage/client-manage
2-2、可以调用以下接口确认token是否带有对应的type，如没有需要重新获取授权
bg.open.accesstoken.info.get（CN网关）/  bg.open.accesstoken.info.get.global（PA网关）

## 文档中心 / API文档 / 货品API组 / 货品发布样例

- 文档 ID：`141857142324`
- 更新时间：`2026-03-27T14:44:50.053000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=141857142324`

## 全托非服饰1
## 全托非服饰2

## 全托服饰
## 半托服饰
## 半托非服饰
## 半托泛欧

## 文档中心 / API文档 / 视频上传API组 / 视频上传流程

- 文档 ID：`149198083286`
- 更新时间：`2025-08-04T14:19:33.807000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=149198083286`

# 接口调用流程

1、文件上传：
- 对于20MB以下的视频
- 通过接口1获取视频上传的Sign调用文件上传接口2上传文件，获取视频对应vid
- 对于20MB以上的大视频
- 通过接口1获取视频上传的Sign调用大视频文件上传初始化接口3获取分片文件上传Sign通过接口4分片上传文件调用接口5完成分片上传，获取视频对应vid
2、获取视频转码结果：
- 通过文件上传返回的vid查询发品所用的视频链接、视频尺寸等信息，视频处理需要时间，上传完成后延迟获取

# 关于视频质量说明
上传优质主图视频，商品可获得免费流量扶持，预估销量提升2%-30%+
1、使用宽高比1:1或3:4或16:9视频（建议优先采用1:1或3:4视频），大小500M内。最多不超过60s
2、上传视频内容需含商品主图，非PPT、无黑边、无水印，且内容及背景音乐需确认无IP侵权
3、上传视频内容建议前10s内突出商品的核心卖点，最好能有语音讲解或配英文字幕
4、画质清晰，整体不可过暗，不能有较大黑边; 2、播放流畅，画面不可抖动;
5、不可加入外域网址及私人联系方式;图片中避免出现其他品牌及水印;
6、主图视频格式：
[image]  https://pfs.file.temu.com/supply-service-order-private/supply-basic-open-private/20237f66ca/75766151-6875-42b4-8fd2-c16a2c82a2aa_624x450.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1754288198%3B1754289098%26q-key-time%3D1754288198%3B1754289098%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D856351893e6183380bab5f872ec86433dbf3b2bb

# 1、查询视频上传sign接口

bg.goods.video.upload.sign.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877338943334)
bg.goods.video.upload.sign.get.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=922385371829)

# 2、20MB以下视频上传

接口信息 内容 接口编号2是否需要授权 否，只需传入1中获取的sign即可调用地址https://openapi.kuajingmaihuo.com/api/galerie/v1/store_videohttps://openapi-b-partner.temu.com/api/galerie/v1/store_video
请求参数：
参数名称类型是否必须说明fileFile是视频文件create_mediaBoolean是固定值，truecontent_md5String否文件MD5值，用于校验实际收到的数据和发起方本地的数据是否一致signString是1中获取的文件上传Sig
返回参数：
参数名称类型是否必须说明vidString是上传视频文件对应vid，后续查询转码结果使用error_codeint成功时不返回error_msgString错误消息

# 3、20MB以上视频上传初始化
接口信息 内容 接口编号3是否需要授权 否，只需传入1中获取的sign即可调用地址https://openapi.kuajingmaihuo.com/api/galerie/large_file/v1/video/upload_inithttps://openapi-b-partner.temu.com/api/galerie/large_file/v1/video/upload_init
请求参数：
参数名称
类型
是否必须
说明
create_mediaBoolean是固定值，truecontent_typeString是文件对应的contentType,且必须为视频类型，eg：video/quicktime、video/mp4等signString是1中获取的文件上传Sign
返回参数：
参数名称类型是否必须说明signString是标记本次大文件上传的id
# 4、20MB以上视频分片上传

接口信息 内容 接口编号4是否需要授权 否，只需传入3中获取的sign即可调用地址https://openapi.kuajingmaihuo.com/api/galerie/large_file/v1/video/upload_parthttps://openapi-b-partner.temu.com/api/galerie/large_file/v1/video/upload_part
请求参数：
参数名称类型是否必须说明part_fileFile是视频分片文件content_md5String否文件MD5值，用于校验实际收到的数据和发起方本地的数据是否一致signString是3中获取的文件上传Signpart_numString是当前分片编号名，从1开始
返回参数：
参数名称类型是否必须说明uploaded_part_numint是
表示本次成功上传的part numbererror_codeint成功时不返回error_msgString错误消息
# 5、20MB以上视频分片上传完成接口
接口信息 内容 接口编号5是否需要授权 否，只需传入3中获取的sign即可调用地址https://openapi.kuajingmaihuo.com/api/galerie/large_file/v1/video/upload_completehttps://openapi-b-partner.temu.com/api/galerie/large_file/v1/video/upload_complete
请求参数：
参数名称类型是否必须说明content_md5String否当前大文件的md5，用于违规资源拦截检测signString是3中获取的文件上传Sign
返回参数：
参数名称类型是否必须说明vidString是上传视频文件对应vid，后续查询转码结果使用
# 6、查询视频转码结果接口

bg.goods.big.video.upload.result.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877339457222)
bg.goods.big.video.upload.result.get.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=922387061211)

## 文档中心 / API文档 / 运单标签&箱唛 / 箱唛打印说明

- 文档 ID：`142906383832`
- 更新时间：`2025-12-04T21:50:10.532000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=142906383832`

# 一、参数说明

以下接口可通过传入return_data_key=true直接打印
bg.logistics.boxmarkinfo.get (https://partner.kuajingmaihuo.com/document?cataId=875198836203&docId=910849146238)
bg.goods.custom.label.get (https://partner.kuajingmaihuo.com/document?cataId=875198836203&docId=913994876441)
bg.goods.labelv2.get (https://partner.kuajingmaihuo.com/document?cataId=875198836203&docId=913993931973)

参数名称 
类型 
是否必须 
说明 
return_data_key
boolean
否
是否以打印页面url返回，如果入参是，则不返回参数信息，返回dataKey，通过拼接https://openapi.kuajingmaihuo.com/tool/print?dataKey={返回的dataKey}，访问组装的url即可打印，打印的条码按照入参参数所得结果进行打印链接10min内单次有效，请求过立即失效
# 二、请求样例

# 三、返回样例

# 四、箱唛打印样例

[image] d10d078f4460b425c998ba4d28e3e967b1522b32.jpg https://oms.temu.team/supply-service-order-private/supply-basic-open-private/201365d7812/5be39939-fbde-45e9-b245-87fa66811668_2002x1298.jpeg?signOMSA=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1764856176%3B1764857076%26q-key-time%3D1764856176%3B1764857076%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D83139ff13922188048b186e4323c7b4b133d6572

# 五、链接单次有效，再次访问后失效

[image] 0fcf5dcb1ad32fa75f990b32c77ccc210b57421f_knock_capture_image.jpg https://oms.temu.team/supply-service-order-private/supply-basic-open-private/201365d7812/a0732834-3f69-4c24-bda4-1952de6befd4_1654x1092.jpeg?signOMSA=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1764856176%3B1764857076%26q-key-time%3D1764856176%3B1764857076%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D1755a34841c651b6866e30f2692396fc9ddcb25a

## 文档中心 / API文档 / 运单标签&箱唛 / 运单标签打印说明

- 文档 ID：`163885777959`
- 更新时间：`2026-01-08T21:10:34.498000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=163885777959`

# 一、查询发货单接口获取快递单

# 二、获取运单标签url

# 三、生成sign

排序：app-key 、access-token和timestamp三个参数，构建一个map，按ASCII码升序排序
拼接：按照key+value，拼接字符串，前后再拼接app_secret
签名：MD5加密32位大写

# 四、请求样例

[image] image.png https://oms.temu.team/supply-basic-open-private-glo/20195057b88/6df7ffaa-9264-4bdc-86f5-98fc5ceee972_2456x962.png?signOMSA=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1767877816%3B1767878716%26q-key-time%3D1767877816%3B1767878716%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D7f28cfa6588fdb4c89ab89522013e21bf06522af

## 文档中心 / API文档 / 商品条码API组-PA / 条码打印说明

- 文档 ID：`163884783129`
- 更新时间：`2025-12-10T21:49:17.006000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=163884783129`

# 一、参数说明

以下接口可通过传入return_data_key=true直接打印
bg.glo.goods.custom.label.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=924483272975)
bg.glo.goods.labelv2.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=925530254496)

参数名称 
类型 
是否必须 
说明 
return_data_key
boolean
否
是否以打印页面url返回，如果入参是，则不返回参数信息，返回dataKey，通过拼接https://openapi-b-partner.temu.com/tool/print?dataKey= (https://openapi-b-partner.temu.com/tool/print?dataKey=xxx){返回的dataKey}，访问组装的url即可打印，打印的条码按照入参参数所得结果进行打印链接10min内单次有效，请求过立即失效
# 二、请求样例

# 三、返回样例

# 四、条码打印样例

[image] image.png https://agentpartner.temu.com/supply-basic-open-private-glo/2019505a068/30a84d01-18e6-46d0-a594-30c680d8975d_1218x462.png

# 五、链接单次有效，再次访问后失效

[image] image.png https://agentpartner.temu.com/supply-basic-open-private-glo/2019505a068/e3f5ff00-65e1-45d8-b093-c2d4b4d70ae6_1798x1044.png

## 文档中心 / API文档 / 活动API组-PA / 仅自研应用特殊申请通过后使用

- 文档 ID：`161789751076`
- 更新时间：`2025-12-02T17:41:10.784000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=161789751076`

仅自研应用特殊申请通过后才能调用

## 文档中心 / API文档 / 申报价/核价/调价API组-PA / 仅自研应用单独申请后调用

- 文档 ID：`163883025113`
- 更新时间：`2025-12-02T17:41:39.531000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=163883025113`

仅自研应用单独申请后调用

## 文档中心 / 开发者文档 / 开发指南 / 签名规则

- 文档 ID：`129273750890`
- 更新时间：`2025-05-11T15:18:33.548000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=129273750890`

# 一、签名规则说明
为了防止API调用过程中被恶意篡改，调用任何一个API都需要携带请求签名，开放平台服务端会根据请求参数，对签名进行验证，对签名不合法的请求，将会拒绝访问。

# 二、签名步骤和样例

步骤规则说明样例1、参数请求入参（包含公共参数和业务参数）











2、排序用key按ASCII码升序排序，只需将外层json进行排序，内层json无需排序['access_token1zz6vlvwq1kulyyyybkdy0bfwnlrgfls8e4ssefhxpanh1mltyodjacc', 'app_key47bb4bb7769e12d9f7aa93cf029fe529', 'data_typeJSON', "joinInfoList[{'deliveryAddressType': 1, 'subPurchaseOrderSn': 'WB2411113267800'}]", 'timestamp1739688901', 'typebg.shiporder.staging.add']3、拼接按照key+value，拼接字符串，前后再拼接app_secretac0a3e952eaaa5b19c0e615c2ef497f50afa6e49access_token1zz6vlvwq1kulyyyybkdy0bfwnlrgfls8e4ssefhxpanh1mltyodjaccapp_key47bb4bb7769e12d9f7aa93cf029fe529data_typeJSONjoinInfoList[{"deliveryAddressType":1,"subPurchaseOrderSn":"WB2411113267800"}]timestamp1739688901typebg.shiporder.staging.addac0a3e952eaaa5b19c0e615c2ef497f50afa6e494、加密MD5加密32位大写BA49C39EFE53461582CC779CDA2ADB3E5、请求将MD5后的值作为sign字段加入请求参数中

# 三、签名常见错误
报错提示为： "sign is invalid, please check your sign calculation"，即为验签未通过
签名规则是统一的，请仔细按照以下步骤排查

1、只有最外层的参数需要参与排序，内层参数无需参与排序；
2、请求参数、参数值和排序串中保持一致，例如：请求参数中布尔值true/false，参与排序的字符串也必须为true/false，不可以是True/False、1/0，否则验签失败；
3、排序是按照key排序，并不是key+value后排序，
正确：imagedata:imagexxxx在前imageBizType0在后
错误：imageBizType0在前imagedata:imagexxxx在后
4、针对请求入参较多/复杂度高的接口，如货品发布接口（bg.goods.add），可以先放一部分外层参数调试签名，通过逐个加参数的方法精确定位出错字段；

如经过以上排查后仍验签失败，请将接口原始请求、原始返回、MD5前的排序字符串三个信息提供给技术支持排查。

## 文档中心 / 开发者文档 / 开发指南 / 鉴权信息

- 文档 ID：`129276807107`
- 更新时间：`2025-07-24T21:47:03.662000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=129276807107`

# 一、自研应用如何获取鉴权信息

自研应用适用场景获取路径app_key作为接口请求参数，应用维度唯一值，申请应用后不变GLO卖家中心-->自研应用管理（商品）：https://agentseller.temu.com/open/apply-app[image]  https://pfs.file.temu.com/supply-service-order-private/supply-basic-open-private/20237f2a68/a863fdac-f195-45b6-bd88-0967ba4efed3_1332x1140.jpeg?sign=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1753350727%3B1753351627%26q-key-time%3D1753350727%3B1753351627%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D4aa59daae378ee9b9a3d25d53fe0183ddc28c28aapp_secret参与签名，申请应用后不变，请谨慎保管，切勿透露给他人，accesss_token作为接口请求参数使用，店铺维度唯一值，请谨慎保管，切勿透露给他人，有效期365天，重新获取后旧accesss_token失效GLO卖家中心-->授权管理（商品）--> 选择自研应用名-勾选接口（建议勾选所有）-确认-复制tokenhttps://agentseller.temu.com/open/system-manage/client-manage[image]  https://pfs.file.temu.com/supply-service-order-private/supply-basic-open-private/20237f2a68/30678751-8d66-4cc8-bade-27fb32387f8d_2232x1462.jpeg?sign=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1753350727%3B1753351627%26q-key-time%3D1753350727%3B1753351627%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Dccbbedc858558c2097a8f9ba836dfc4a45bd258d
# 二、三方应用如何获取鉴权信息

三方应用适用场景获取路径app_key作为接口请求参数，应用维度唯一值，申请应用后不变https://agentpartner.temu.com/main/application-manage三方应用开发者登陆Partner Platform-应用管理app_secret参与签名，申请应用后不变，请谨慎保管，切勿透露给他人，accesss_token作为接口请求参数使用，店铺维度唯一值，请谨慎保管，切勿透露给他人，有效期90天，重新获取后旧accesss_token失效GLO卖家中心-->授权管理（商品）--> 选择自研应用名-勾选接口（建议勾选所有）-确认-复制tokenhttps://agentseller.temu.com/open/system-manage/client-manage[image]  https://pfs.file.temu.com/supply-service-order-private/supply-basic-open-private/20237f2a68/7461d79c-55a3-48fe-8ee5-97488b5698d8_2232x1462.jpeg?sign=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1753350727%3B1753351627%26q-key-time%3D1753350727%3B1753351627%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Ddd1ff4f9e00f532b535bc85f6c9dc4ed79ae3684

# 三、接口鉴权常见报错

鉴权报错优先检查接口地址、app_key、secret、access_token是否为同一区
调用CN区接口时，务必使用CN的接口地址、app_key、secret、access_token

errorCodeerrorMsg解决方案7000000there is no type in body.入参没传接口type7000002there is no app_key in body.入参没传app_key7000003there is no access_token in body.入参没传access_token7000005app_key don't have this api permission.检查app_key、接口地址是否为同一个区7000006access_token and app_key are not mapping.检查app_key、access_token是否正确，是否为同一个区7000007access_token is expired, please contact seller to reauthorize and share the new access_token with you.access_token已过期，在卖家中心重新获取授权后重新调用接口7000008there is no timestamp in body.入参没传timestamp7000010timestamp is expired.timestamp十位秒级时间戳，且current_time-300s<timestamp<current_time+300s7000011timestamp is invalid.timestamp十位秒级时间戳，且current_time-300s<timestamp<current_time+300s7000013data_type is invalid"data_type": "JSON",7000014there is no sign in body.入参没传接sign7000015sign is invalid, please check your sign calculation验签未通过，签名规则 (https://agentpartner.temu.com/document?cataId=875196199516&docId=896167235113)7000016type not exists.接口type传值错误，或不在本区7000018access_token not exists.本合作伙伴平台支持CN区接口的调用，access_token需要在CN区卖家中心获取；https://agentseller.temu.com/open/system-manage/client-manage7000019access_token don't have this api access, please ask for seller to authorize this api in seller center first，and share the new access_token with you.获取access_token时没有勾选对应的接口，建议全选；7000020access_token invalid.access_token错误7000022access_token don't have this api access.获取access_token时没有勾选对应的接口，建议全选；自研专属接口需要联系招商单独申请后调用；

## 文档中心 / 开发者文档 / 开发指南 / 自研专属接口

- 文档 ID：`132429173222`
- 更新时间：`2025-10-21T20:24:25.893000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=132429173222`

以下接口仅限自研应用单独申请通过后使用，
请将主体id、appkey、店铺id，提供给对接招商进行申请

# 一、申报价

接口名称接口描述bg.goods.price.list.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=901410718805)货品申报价查询

# 二、全托核价

接口名称接口描述bg.price.review.page.query (https://agentpartner.temu.com/document?cataId=875198836203&docId=899321422992)分页查询核价单bg.price.review.confirm (https://agentpartner.temu.com/document?cataId=875198836203&docId=901412462419)同意核价单建议价bg.price.review.reject (https://agentpartner.temu.com/document?cataId=875198836203&docId=901413494559)不同意核价单建议价（并给出新的申报价）

# 三、半托核价
网关地址：https://openapi-b-partner.temu.com/openapi/router

接口名称接口描述bg.semi.price.review.page.query.order (https://agentpartner.temu.com/document?cataId=875198836203&docId=915045449030)分页查询核价单bg.semi.price.review.confirm.order (https://agentpartner.temu.com/document?cataId=875198836203&docId=916094336249)同意核价单建议价bg.semi.price.review.reject.order (https://agentpartner.temu.com/document?cataId=875198836203&docId=915046805458)不同意核价单建议价（并给出新的申报价）

# 四、全托调价

接口名称接口描述bg.full.adjust.price.page.query (https://agentpartner.temu.com/document?cataId=875198836203&docId=908751475686)分页查询全托管调价单bg.full.adjust.price.batch.review (https://agentpartner.temu.com/document?cataId=875198836203&docId=908749899377)全托管批量确认调价单

# 五、半托调价
网关地址：https://openapi-b-partner.temu.com/openapi/router

接口名称接口描述bg.semi.adjust.price.page.query.order (https://agentpartner.temu.com/document?cataId=875198836203&docId=915044789964)分页查询半托管调价单bg.semi.adjust.price.batch.review.order (https://agentpartner.temu.com/document?cataId=875198836203&docId=916093321222)半托管批量确认/拒绝调价单

# 六、活动报名

接口名称接口描述bg.marketing.activity.list.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=895122902657)查询活动列表bg.marketing.activity.detail.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=895121252332)查询活动详情bg.marketing.activity.product.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=895119781318)查询活动商品bg.marketing.activity.session.list.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=895123255220)查询活动场次列表bg.marketing.activity.enroll.submit (https://agentpartner.temu.com/document?cataId=875198836203&docId=895120930798)活动报名提交bg.marketing.activity.enroll.list.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=902458032485)查询活动报名记录

# 常见问题

如接口报错提示“access_token don't have this api access”，说明没有申请或没有审批完成
请按一下步骤逐一检查

1、重新获取授权勾选对应接口，重试
2、调用bg.open.accesstoken.info.get接口查到店铺mallid
3、将mallid发送给运营，确认申请的审批流是否已全部完成

如以上步骤仍无法解决，请提供步骤1和2的接口参数文本和步骤3的截图反馈给技术支持排查

## 文档中心 / 开发者文档 / 开发指南 / 分区说明

- 文档 ID：`141858478483`
- 更新时间：`2026-01-05T21:08:53.060000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=141858478483`

开平的接口和卖家中心一样，分为四个区（CN/US/EU/GLOBAL），每个区覆盖的能力、接口地址均不相同
商家在调用接口时，务必保证接口地址、app_key、secrect、access_token来自同一个区域
例：如果使用US的app_key、access_token调用CN的接口地址，接口会报错拦截

# step1：场景

根据实际业务场景，选择对应的分区，每个区需要单独注册账号、申请应用、调用接口

店铺类型业务场景分区全托发品、库存，备货履约CN合规资质GLOBAL半托半托发品CN半托库存，半托调价核价PA美国半托履约US欧区半托履约EU全球（除美国站、欧区）半托履约合规资质GLOBAL本本美国商品、履约US欧区商品、履约EU其他GLOBAL
# step2：分区地址

开平地址接口地址卖家中心获取授权（access_token）CNhttps://partner.kuajingmaihuo.comhttps://agentpartner.temu.com/https://openapi.kuajingmaihuo.com/openapi/routerhttps://agentseller.temu.com/open/system-manage/client-managePAhttps://partner.kuajingmaihuo.com/https://agentpartner.temu.com/https://openapi-b-partner.temu.com/openapi/routerhttps://agentseller.temu.com/open/system-manage/client-manageUShttps://partner-us.temu.comhttps://openapi-b-us.temu.com/openapi/routerhttps://agentseller-us.temu.com/open-platform/system-manage/client-manageEUhttps://partner-eu.temu.comhttps://openapi-b-eu.temu.com/openapi/routerhttps://agentseller-eu.temu.com/open-platform/system-manage/client-manageGLOBALhttps://partner.temu.comhttps://openapi-b-global.temu.com/openapi/routerhttps://agentseller.temu.com/open-platform/system-manage/client-manage

## 文档中心 / 开发者文档 / 开发指南 / 接口列表

- 文档 ID：`132420401064`
- 更新时间：`2026-03-09T16:09:25.193000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=132420401064`

# 必读

接口网关调用说明 (https://agentpartner.temu.com/document?cataId=875198836203&docId=929750644349)

# 一、基础API组

接口名称网关接口描述接口能力bg.mall.info.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=881490244071)CN查询当前token对应店铺类型信息查询店铺类型：全托/半托bg.open.accesstoken.info.get.global (https://agentpartner.temu.com/document?cataId=875198836203&docId=929722395417)PA查询当前token对应授权信息查询店铺uniqueId和授权信息对应的接口权限
# 二、全托半托货品

点击跳转至货品发布流程 (https://agentpartner.temu.com/document?cataId=875196199516&docId=896172443264)

## 货品API组

接口名称网关接口描述接口能力bg.glo.goods.add (https://agentpartner.temu.com/document?cataId=875198836203&docId=925526695187)PA上传货品用于全托半托店铺发布货品bg.glo.goods.topselling.soldout.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=924481378182)PA批量查询爆款售罄商品bg.glo.product.search (https://agentpartner.temu.com/document?cataId=875198836203&docId=931835549486)PA查询货品生命周期状态用于管理货品生命周期bg.goods.brand.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877298892663)CN货品品牌查询bg.goods.suggest.supplyprice.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877300301642)CN查询建议申报参考价此接口主要支持erp查询脱敏后的建议申报价，提升平台核价通过率。此接口会进行调用频率控制：单个店铺id单天最多只能查询100次。接口目前仅支持自研应用bg.glo.goods.list.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=924479235154)PA商品列表查询查询货品及状态bg.glo.goods.detail.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=925528074151)PA商品详情查询接口查询货品的产地、商详信息bg.glo.goods.migrate (https://agentpartner.temu.com/document?cataId=875198836203&docId=924481089321)PA货品搬运接口全托管店铺的货品搬运至半托店铺bg.btg.goods.stock.warehouse.list.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=929731654843)PA根据站点列表查询仓库信息bg.glo. (https://agentpartner.temu.com/document?cataId=875198836203&docId=925534357132)logistics.template.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=925538690786)PA查询运费模板列表
## 类目属性API组

接口名称网关接口描述接口能力bg.goods.cats.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877327073796)CN货品类目查询通过父级类目id查询子级类目idbg.goods.attrs.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877328004022)CN货品模板查询属性模板接口，决定了发品的属性、规格bg.glo.goods.parentspec.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=929747769955)PA查询父规格列表用于自定义规格时，查询父规格bg.glo.goods.spec.create (https://agentpartner.temu.com/document?cataId=875198836203&docId=931841951080)PA创建规格用于自定义规格值时，获取specIdbg.goods.category.match (https://agentpartner.temu.com/document?cataId=875198836203&docId=877332258227)CN新增建品类目映射通过关键词模糊匹配类目bg.goods.category.mapping (https://agentpartner.temu.com/document?cataId=875198836203&docId=877333477871)CN查询中文类目映射接口中、英文商品标题映射为TEMU类目bg.glo.goods.photorecommendationcategory.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=921339267612)PA外部商品图片映射temu类目bg.goods.attribute.mapping (https://agentpartner.temu.com/document?cataId=875198836203&docId=877335725050)CN内外属性映射

## 尺码表API组
尺码表创建流程参考：货品发布流程 (https://partner.kuajingmaihuo.com/document?cataId=875196199516&docId=896172443264)中的「四、尺码表」

接口名称网关接口描述接口能力bg.goods.sizecharts.class.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877348824010)查询尺码分类接口通过catid查询classidbg.goods.sizecharts.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877347300105)查询尺码表模板查询已创建的尺码表模板bg.goods.sizecharts.template.create (https://agentpartner.temu.com/document?cataId=875198836203&docId=877348687822)创建尺码表货品模板用于把尺码表模板id（businessId）生成tempBusinessId作为发品入参使用bg.goods.sizecharts.create (https://agentpartner.temu.com/document?cataId=875198836203&docId=877350073467)新增尺码表接口其中：1、reusable=true创建的是尺码表模板，需要再调用bg.goods.sizecharts.template.create获取tempBusinessId2、reusable=false创建的是尺码表，可直接作为发品请求参数使用bg.goods.sizecharts.settings.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877350954517)查询尺码模板规则bg.goods.sizecharts.meta.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877353491299)查询尺码表元信息bg.goods.imagesizechart.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877352774367)图片提取尺码表
## 说明书API组

接口名称接口描述接口能力bg.goods.catsmandatory.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=900363340240)类目必填信息接口仅支持查询说明书是否必填类目和属性都需要入参bg.goods.instructions.upload (https://agentpartner.temu.com/document?cataId=875198836203&docId=877320754990)文件上传接口用于上传说明书文件bg.goods.instructionslanguages.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877322448059)说明书语种查询信息bg.goods.instructionstranslation.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877323323256)说明书翻译接口bg.goods.translationresult.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877324169548)查询说明书翻译结果
## 模特试穿API组

接口名称接口描述接口能力bg.modelinfo.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877341788052)模特信息查询bg.modelcats.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877343110579)可添加模特类目查询bg.modelinfo.add (https://agentpartner.temu.com/document?cataId=875198836203&docId=877344447432)新增模特信息bg.modelinfo.edit (https://agentpartner.temu.com/document?cataId=875198836203&docId=877344987565)编辑模特信息

## 货品编辑API组

货品发布后，开发者可以调用货品编辑API更新货品的部分信息。
调用部分接口前需要调用bg.product.search (https://agentpartner.temu.com/document?cataId=875198836203&docId=877297510235)判断货品的生命周期状态，货品选中后的修改都需经过审核才能生效。修改单状态、图片更新任务状态请前往卖家中心查看。

接口名称接口描述接口能力bg.goods.update (https://agentpartner.temu.com/document?cataId=875198836203&docId=898264107502)货品更新接口用于产地编辑bg.goods.edit (https://agentpartner.temu.com/document?cataId=875198836203&docId=898264747556)货品编辑接口用于编辑货品尺码表bg.goods.edit.sensitive.attr (https://agentpartner.temu.com/document?cataId=875198836203&docId=898265919235)编辑货品敏感品属性使用平台面单时，要求敏感属性必填，可以提前补充sku敏感属性。bg.goods.edit.pictures.submit (https://agentpartner.temu.com/document?cataId=875198836203&docId=899314893477)修改商品素材bg.goodslogistics.template.edit (https://agentpartner.temu.com/document?cataId=875198836203&docId=899315998808)用于编辑货品运费模版1、bg.goods.edit.property (https://agentpartner.temu.com/document?cataId=875198836203&docId=900361168169)2、bg.goods.edit.task.apply (https://agentpartner.temu.com/document?cataId=875198836203&docId=898267810581)3、bg.goods.edit.task.submit (https://agentpartner.temu.com/document?cataId=875198836203&docId=898268033395)修改货品属性商品选中前，使用接口1修改货品属性；商品选中后，使用接口2先提交修改申请无需等待审核，再使用接口3提交期望修改后的货品属性注意要传入当前类目模板下所有的必填属性；传入的属性会被覆盖，未传入的属性将会被清空bg.goods.edit.guide.file (https://agentpartner.temu.com/document?cataId=875198836203&docId=899319938658)编辑货品说明书

# 三、全托备货发货API组

点击跳转至全托履约流程图 (https://agentpartner.temu.com/document?cataId=875196199516&docId=896173561825)

## 备货单

接口名称接口描述接口能力接口规则bg.purchaseorder.apply (https://agentpartner.temu.com/document?cataId=875198836203&docId=877380983051)采购备货申请卖家申请备货单3qps/店铺bg.purchaseorderv2.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877379616150)采购单查询查询采购单（备货单）3qps/店铺
## 发货台

接口名称接口描述接口能力接口规则bg.shiporder.staging.add (https://agentpartner.temu.com/document?cataId=875198836203&docId=877365095165)加入发货台接口3qps/店铺bg.shiporder.staging.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877362437763)查询发货台接口5qps/店铺
## 发货和收货地址

接口名称接口描述接口能力接口规则bg.mall.address.add (https://agentpartner.temu.com/document?cataId=875198836203&docId=877368590889)卖家发货地址创建3qps/店铺bg.mall.address.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877369025160)卖家地址查询查询发货地址bg.shiporder.receiveaddressv2.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877375480432)大仓收货地址查询v2查询收货地址5qps/店铺
## 发货单

接口名称接口描述接口能力接口规则bg.shiporderv3.create (https://partner.kuajingmaihuo.com/document?cataId=875198836203&docId=877363521599)创建发货单接口v35qps/店铺bg.shiporderv2.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877366803148)查询发货单3qps/店铺bg.shiporder.cancel (https://agentpartner.temu.com/document?cataId=875198836203&docId=877365979882)发货单取消3qps/店铺
## 包裹

接口名称接口描述接口能力接口规则bg.shiporder.package.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877374260423)发货包裹查询用以支持商家创建发货单之后查询发货单对应的包裹信息3qps/店铺bg.shiporder.package.edit (https://agentpartner.temu.com/document?cataId=875198836203&docId=900362063372)发货包裹编辑3qps/店铺

## 商品条码和箱唛

接口名称接口描述接口能力接口规则打印说明 (https://agentpartner.temu.com/document?cataId=875198836203&docId=910847737016)打印bg.glo.goods.custom.label.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=924483272975)商品条码查询查询商品条码bg.glo.goods.labelv2.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=925530254496)定制品商品条码查询查询定制品商品条码bg.logistics.boxmarkinfo.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=910849146238)箱唛查询查询箱唛3qps/店铺

## 装箱发货

接口名称接口描述接口能力接口规则bg.shiporderv3.logisticsmatch.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=886730016425)平台推荐物流商匹配接口5qps/店铺bg.shiporder.logisticsorder.match (https://agentpartner.temu.com/document?cataId=875198836203&docId=877376122122)物流单号与可用物流公司校验当发货方式为自行委托第三方物流时，商家录入物流单号后需要提供接口校验所选择的物流公司是否匹配bg.shiporder.logistics.get (https://agentpartner.temu.comdocument?cataId=875198836203&docId=877378100662)自行委托三方物流公司查询接口当发货方式为自行委托第三方物流时需要提供接口给到商家查询可用的物流公司名单bg.logistics.company.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877369974057)快递公司查询bg.shiporder.packing.match (https://agentpartner.temu.com/document?cataId=875198836203&docId=877372462318)装箱发货校验bg.shiporder.packing.send (https://agentpartner.temu.com/document?cataId=875198836203&docId=877371096318)装箱发货接口5qps/店铺bg.shiporder.logistics.change (https://agentpartner.temu.com/document?cataId=875198836203&docId=877378826334)修改物流接口3qps/店铺
# 四、寄样/质检/退货API

## 寄样
接口名称接口描述接口能力bg.refund.returnpackage.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877355656670)退货包裹查询接口bg.refund.returnpackagedetail.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877356156839)退货包裹详情查询bg.refund.returnpackagelist.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877357625845)退货包裹明细列表

## 质检

接口名称接口描述接口能力bg.goods.qualityinspection.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877358586514)质检列表查询bg.goods.qualityinspectiondetail.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877360192843)质检结果详情查看
## 退货

接口名称接口描述接口能力bg.sample.order.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=899316604827)查询寄样单列表bg.sample.send (https://agentpartner.temu.com/document?cataId=875198836203&docId=899318389808)回传样品发货信息

# 五、销售数据API组

接口名称网关接口描述接口能力bg.goods.salesv2.get (https://agentpartner.temu.com/document?cataId=875198836203&docId=877385749076)CN销售管理分仓组数据查询接口支持查询全托管销售管理数据

## 文档中心 / 开发者文档 / 开发指南 / 基本信息

- 文档 ID：`130322504140`
- 更新时间：`2026-03-30T14:21:26.894000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=130322504140`

# 一、接口地址

CN网关地址https://openapi.kuajingmaihuo.com/openapi/routerPA网关地址https://openapi-b-partner.temu.com/openapi/routerPA网关调用说明https://agentpartner.temu.com/document?cataId=875198836203&docId=915047650924请求方式POST

# 二、场景说明
本平台提供CN区接口 (https://agentpartner.temu.com/document?cataId=875196199516&docId=899312840459)，覆盖场景包括全托半托发品、库存和全托备货履约业务
如需其他场景（如半托订单履约、本本业务）请跳转至其他区域合作伙伴平台

分区说明：https://agentpartner.temu.com/document?cataId=875196199516&docId=909799935182

UShttps://partner-us.temu.com/ EUhttps://partner-eu.temu.com/GLOBALhttps://partner.temu.com/

# 三、请求参数

请求参数，包含公共参数和业务参数。跳转至API接口文档 (https://partner.kuajingmaihuo.com/document?cataId=875198836203)

参数说明截图公共参数调用接口必须传入的通用参数其中app_key、secret、token参考鉴权信息获取 (https://agentpartner.temu.com/document?cataId=875196199516&docId=896168820140)[image] f8122bcdb99c3ddae21b3a91c340388a41e7f970_knock_capture_image.jpg https://oms.temu.team/supply-service-order-private/supply-basic-open-private/2013f77515c/e3ecd76f-c65c-4142-8b44-c0282b405efb_832x401.jpeg?signOMSA=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1774851681%3B1774852581%26q-key-time%3D1774851681%3B1774852581%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D338039a821bb5c9b58d38763ccf6bbb7921fc58f业务参数各个接口业务相关的参数，每个接口的业务参数不同，以每个接口的对接文档为准，跳转至API接口文档 (https://agentpartner.temu.com/document?cataId=875198836203)[image] edc163e6bbe37304c66595d43076fda88f968202_knock_capture_image.jpg https://oms.temu.team/supply-service-order-private/supply-basic-open-private/2013f77515c/8cbd77bd-1231-4fdc-acc1-784fa8752854_1198x522.jpeg?signOMSA=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1774851681%3B1774852581%26q-key-time%3D1774851681%3B1774852581%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D44cc55c545d5f736fa37ecca4b3b8e31e948df58

# 四、签名规则

为了防止API调用过程中被恶意篡改，调用API需要携带请求签名，开放平台服务端会根据请求参数，对签名进行验证，对签名不合法的请求，将会拒绝访问。点击跳转至签名规则 (https://agentpartner.temu.com/document?cataId=875196199516&docId=896167235113)。

# 五、测试账号

## 1、全托管测试账号：全托发品、库存、全托履约备货

字段测试账号1测试账号2app_key47bb4bb7769e12d9f7aa93cf029fe52972bc9e4143e960b2134e1cdf22fec651app_secretac0a3e952eaaa5b19c0e615c2ef497f50afa6e49c54100b5b15d69d5cf0db9e8a653333a60f73c23accesss_tokeniimd5vhtzapi0rbu9ixzijjgr6k4cvflyf5zezgjcsda0gjb3fseadlurrtyc9kmtvyzl6ln954kyidgu9lpifqfipr8tkqrcawjk0stjy1jahmp店铺名称girl clothes店铺id1052202882

## 2、半托管测试账号：半托发品、库存

字段测试账号1测试账号2测试账号3app_key47bb4bb7769e12d9f7aa93cf029fe52972bc9e4143e960b2134e1cdf22fec651b0b9660c9f00f47c96d03444436eb59aapp_secretac0a3e952eaaa5b19c0e615c2ef497f50afa6e49c54100b5b15d69d5cf0db9e8a653333a60f73c2355c137956a30577a31c2b45157bc0c517d16feaeaccesss_tokenbra6kezgxi8zeac6qfuwjvgmwp4dq9av0kcal4on6wviezfw3x61epanorbejsu5f3mnipqlkzkvcmiw5epo9g1ncfoxc6kgnu6mkz6plrspmb4itf79mcgjoqblbbicx9qorbjorxxvwdbmeq6vy4g1fr1071c2mbg7xryl店铺名称girl clothessswoshi gongsuanyuan店铺id634418215494106634418215136420

## 文档中心 / 开发者文档 / 调用流程 / 全托履约流程

- 文档 ID：`129279166501`
- 更新时间：`2025-09-02T22:02:34.675000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=129279166501`

[image]  https://oms.temu.team/supply-basic-open-private-glo/20150c2184f/f7c0ae3c-d743-43d5-94ae-9a3ada028265_1874x3950.jpeg?signOMSA=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1756821747%3B1756822647%26q-key-time%3D1756821747%3B1756822647%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Dfb4e42b683fe2e784b4456b90fcbbee9d5447239

## 文档中心 / 开发者文档 / 调用流程 / 货品发布流程

- 文档 ID：`129278535668`
- 更新时间：`2026-04-09T23:29:54.224000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=129278535668`

适用范围：全托、半托货品发布

# 一、确定发品类目

发布货品前，需要明确本次发品的叶子类目id

方式一：bg.goods.cats.get，遍历全部类目，通过0查到一级类目，通过一级类目查二级，以此类推，查到叶子类目id和名称
[image] b05c2eb6e71cad6c58dd87d5e8a3b9281f8e43b9_knock_capture_image.jpg https://oms.temu.team/supply-service-order-private/supply-basic-open-private/20a3d45b04/8d76187d-8fc1-4d50-aa2d-1714a1785d92_1919x758.jpeg?signOMSA=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1775748513%3B1775749413%26q-key-time%3D1775748513%3B1775749413%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3De780020c25d64bc69c0b95bdcd2db32b856a4ff9

方式二：bg.goods.category.match，通过关键词模糊匹配类目
[image] 7311aa39c05ec85734564755c2b849ebdb25b520_knock_capture_image.jpg https://oms.temu.team/supply-service-order-private/supply-basic-open-private/20a3d45b04/1428980a-4935-470a-8204-7024b64aad08_1920x957.jpeg?signOMSA=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1775748513%3B1775749413%26q-key-time%3D1775748513%3B1775749413%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Dfc0995ad0921a9a4b75e19a6ce2a48d9025e76a8

传入发品接口中的请求参数：从一级类目到叶子类目，其他传0

# 二、确认站点、仓库、运费模版（全托店铺跳过本步骤）

2-1. 确认发品站点： 半托管站点列表 (https://agentpartner.temu.com/document?cataId=875196199516&docId=893022798763)
[image] 6e958d540eb5f1a85544a3203327f8c8ef8149d4_knock_capture_image.jpg https://oms.temu.team/supply-service-order-private/supply-basic-open-private/20a3d46c4f/5981f511-2741-4a8e-b295-883cf86b546d_1295x706.jpeg?signOMSA=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1775748513%3B1775749413%26q-key-time%3D1775748513%3B1775749413%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D46aa4e24f199422b9379e73d66a43d0d378c8d2e

2-2. 查询站点对应的仓库：bg.goods.warehouse.list.get，bg.btg.goods.stock.warehouse.list.get
[image] 0600af0d7c5d791cabd314aff2b9a64c5a094ea1_knock_capture_image.jpg https://oms.temu.team/supply-service-order-private/supply-basic-open-private/20a3d46c4f/f70f1337-c595-4801-9a21-cc2a5ece8685_1325x421.jpeg?signOMSA=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1775748513%3B1775749413%26q-key-time%3D1775748513%3B1775749413%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Dbaf0159a3cd43ad3f5b59bc8340994dfc258d903

2-3. 查询站点对应的运费模板：bg.logistics.template.get
[image] b190711ca5775cbdc88b299cadd9e9224d212702_knock_capture_image.jpg https://oms.temu.team/supply-service-order-private/supply-basic-open-private/20a3d46c4f/51e46bae-81fa-4d40-a7d6-1702b4230692_1281x221.jpeg?signOMSA=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1775748513%3B1775749413%26q-key-time%3D1775748513%3B1775749413%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Dd676570d828881c02648cf1c56dd71db0b5ee36e

# 三、查询属性模版
将第一步的叶子类目id作为请求参数，查询bg.goods.attrs.get获取类目对应的属性模板

## 3-1. 货品规格

规格是销售属性，不同的规格值决定了sku，需要满足笛卡尔积关系，即sku数量=规格1的规格值数量*规格2的规格值数量
举例：颜色：红色、黑色；尺码：S、M、L，那么sku必须为6个，即红色S、红色M、红色L、黑色S、黑色M、黑色L

inputMaxSpecNum：模板允许的最大的自定义规格数量
情况一：inputMaxSpecNum=0，不允许自定义规格，只能用属性模板返回的isSale=ture销售属性作为规格，在发品接口中传入
情况二：inputMaxSpecNum=n(n≠0)允许自定义规格，通过bg.goods.parentspec.get查询父规格，从中选n个父规格，再通过bg.goods.spec.create生成子规格

在发品接口的productSpecPropertyReqs传入规格
[image] b88a90f36cef207494ea0d1f3b029a68d2d24a6a_knock_capture_image.jpg https://oms.temu.team/supply-service-order-private/supply-basic-open-private/20a3d46c4f/15250c40-05d9-4004-bd70-64cf5a306587_1218x504.jpeg?signOMSA=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1775748513%3B1775749413%26q-key-time%3D1775748513%3B1775749413%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Ded7c89da1defadf7ecf5fac96ce84ce41d00e823

## 3-2. 货品属性
isSale=false为普通属性，required=true为必填，注意父子属性需要单独适配
[image] 5d0d6a237f81d6177bd27339f71a6ddbc78515c3_knock_capture_image.jpg https://oms.temu.team/supply-service-order-private/supply-basic-open-private/20a3d46c4f/5390b703-011b-4bc0-a30a-1ba726d28433_1244x362.jpeg?signOMSA=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1775748513%3B1775749413%26q-key-time%3D1775748513%3B1775749413%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Dd5ba4c3c429f1c61c59b2db6cdadcfab61ee4ff0

在发品接口的productPropertyReqs传入，取值参考如下：

# 四、尺码表

## 4-1. 查尺码表分类
bg.goods.sizecharts.class.get，通过叶子类目catId查到对应的尺码表分类classId
当classType=1时为套装，需要关注relatedClassIds，将relatedClassIds中的值作为classId使用，套装要求至少传入2个尺码表
## 4-2. 尺码表是否必填
bg.goods.sizecharts.class.get，确定尺码表是否必填，如接口有返回，则为必填
## 4-3. 查询尺码表规则
bg.goods.sizecharts.meta.get，关注groupList和elementList，相当于尺码表的列名
bg.goods.sizecharts.settings.get，关注sizeList
## 4-4. 创建尺码表
方式一：bg.goods.sizecharts.create，reusable=true创建可复用尺码表，即尺码表模板（等同于用bg.goods.sizecharts.get查到的在卖家中心后台创建的尺码表模板）；
再用businessId通过bg.goods.sizecharts.template.create生成tempBusinessId，作为发品入参使用
方式二：bg.goods.sizecharts.create，reusable=false创建不可复用尺码表，接口返回的businessId可直接发品入参使用
套装（classType=1）时创建尺码表不传catid

注意：尺码表中的records数量和值必须与发品接口中的尺码保持一致

## 4-5. 尺码表样例

# 五、图片和视频

图片和视频，需要先使用平台提供的上传接口，使用上传接口返回的URL作为发品入参

图片处理API组 (https://agentpartner.temu.com/document?cataId=875198836203&docId=929743122710)
视频上传API组 (https://agentpartner.temu.com/document?cataId=875198836203&docId=917139576842)

# 六、货品skc

## 6-1. 货品结构说明

spu-skc-sku，对应的货品id在调用发品接口成功后返回

货品解释说明对应发品接口返回参数字段规则spu一次接口请求相当于一个spuproductId一个SPU下最多25个SKC，每个SKC下的SKU数量无限制；
一个SPU下最多500个SKUskc非服饰类目只传一个skc服饰类目，几个颜色对应几个skcproductSkcIdsku一个skc下可以传多个skuproductSkuId
## 6-2. 主销售属性

mainProductSkuSpecReqs

非服饰类目固定传值：

服饰类目传入颜色，例如：

# 七、发品样例

https://agentpartner.temu.com/document?cataId=875198836203&docId=909798859447

# 八、FAQ

8-1. "主销售属性不合法"
非服饰固定传值："mainProductSkuSpecReqs":[{"parentSpecId":0,"parentSpecName":"","specId":0,"specName":""}]

8-2. "尺码表包含不合法的尺码规格"
发品的尺码必须和尺码表中的尺码一致，例如发品传入S、M、L三种尺码，那么尺码表必须为S、M、L三种尺码

8-3. “URL域名校验不通过或URL包含不合法字符串"
图片视频需要先调用上传接口，将返回的URL作为发品接口入参，详见【五、图片和视频】

8-4. “主销售规格属性值列表重复”
非服饰只能传入一个skc

8-5. "服饰类目skc轮播图xxx校验失败，应符合宽高比例为xxx"
图片校验是使用图片上传接口的base64原图做校验，请商家排查base64原图是否符合接口返回提示的要求

8-6. "不合法的尺码模板id：[0]"
showSizeTemplateIds和sizeTemplateIds，没有尺码表时传空数组[]

8-7. "不合法的尺码模板id：[123456]"
bg.goods.sizecharts.get返回的id不能直接作为发品入参使用，需要通过bg.goods.sizecharts.template.create生成tempBusinessId
详细见【4-4. 创建尺码表】方式一

8-8. “当前商品仅允许填写分站点申报价格”
申报价字段，全托半托字段不同
半托只传siteSupplierPrices，不允许传supplierPrice
全托只传supplierPrice，不允许传siteSupplierPrices

8-9. “分站点申报价格站点信息错误”
半托管检查productSemiManagedReq字段

8-10. 属性模版接口返回为空，没有属性数据
请检查入参的catId，要求传入叶子类目
（货品类目接口bg.goods.cats.get返回的isLeaf=true为叶子类目）

8-11. "不允许创建套装模板"
套装（classType=1）时创建尺码表不传catid

8-12. "货品类目属性更新，请刷新页面后重新创建货品"
报错原因：请求中传入的属性有缺失
解决方案：重新拉取属性模板（bg.goods.attrs.get），比对返回的属性，找到缺失的属性值并重新传参；或在卖家中心页面发品选择属性和对应的属性值后，定位缺失的属性；

8-13. “Semi-managed delivery information cannot be empty”
运费模板没传，样例
"productShipmentReq": {
"freightTemplateId": "HFT-16961217732280430733",
"shipmentLimitSecond": 86400
},

## 文档中心 / 开发者文档 / 数据字典 / 尺码表分类

- 文档 ID：`150248517406`
- 更新时间：`2025-06-30T20:10:43.632000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=150248517406`

classId与className映射关系如下
3 男上装
4 男下装
5 女上装
6 女下装
7 女连衣裙
8 女童装
9 文胸
11 男鞋
12 女鞋
13 女童鞋
14 鞋子
15 男套装
16 女套装
17 男女套装
18 女上装-大码
19 女下装-大码
20 女连衣裙-大码
21 女套装-大码
23 宠物配饰
25 女袜
26 男袜
27 童袜
28 女士短裙-常规
29 女士外套-常规
30 女士连体裤-常规
31 女士紧身衣-常规
32 女士内裤-常规
33 女士连身泳衣-常规
34 女士塑身衣-常规
35 女士短裙-大码
36 女士外套-大码
37 女士连体裤-大码
38 女士紧身衣-大码
39 女士内裤-大码
40 女士连身泳衣-大码
41 女士塑身衣-大码
42 男士外套
43 男士连体裤
44 男士内裤
45 男下装-前后浪选填款
46 男上装-大码
47 男下装-大码
48 男上装（背心）-大码
49 男套装-大码
50 猫狗服饰
51 猫狗鞋袜
52 上装-中性
53 下装-中性
54 连体裤-中性
55 孕妇上装
56 孕妇下装
57 孕妇背心
58 孕妇连衣裙
59 孕妇套装
60 大码男装内衣下装
61 大码男装内裤
63 男士大码内衣套装
64 唐装汉服男上装
65 唐装汉服男下装
66 唐装汉服男其它
67 唐装汉服男套装
71 唐装汉服童其它
72 唐装汉服女童套装
74 腰带
75 情趣男连体衣
76 情趣男下装
77 唐装汉服大码男下装
78 其他大码男传统服装
79 唐装汉服大码男套装
80 女童装-下装
81 女童装-上装
82 女童装套装
83 男上装（背心）
84 女童装-连体衣
85 女童装-马甲
86 女童装-半身裙
87 女童装-连衣裙
89 床笠
95 被套组
96 床单组
97 枕套组
98 羽绒被/厚被
99 薄被/床盖
102 男内调节码
103 床单床笠四件套
104 羽绒被套三件套
105 薄被三件套
106 厚被三件套
107 男童鞋
108 男-裙子
109 连裤袜
110 孕妇半身裙
111 男-牛仔
112 大码孕妇-上装
113 大码孕妇-下装
114 大码孕妇背心
115 大码孕妇内裤
116 大码孕妇连衣裙
117 大码孕妇半身裙
118 大码孕妇连体衣
119 大码孕妇套装
120 孕妇内裤
122 孕妇连体衣
123 孕妇连体裤
124 大码孕妇连体裤
125 男童装
126 唐装汉服童其它-男
127 男童装-下装
128 男童装-上装
129 男童装-连体衣
130 男童装-马甲
131 唐装汉服男童套装
132 男童装套装
133 男上装（衬衫）
1003 床上用品
1005 吊袜带、吊袜腰带
1006 挂毯、壁毯
1007 女士情趣配件
1008 收腹带
1010 车罩
1013 运动鞋鞋带尺码模板
1014 枕头枕芯
1015 被子类
1016 床笠2
1017 床单、被套类
1018 窗帘类
1020 男士内衣睡衣
1021 男士塑身衣
1022 宠物床具
1024 浴袍毛巾
1025 服饰
1026 隐形文胸

## 文档中心 / 开发者文档 / 数据字典 / 发品-省份枚举值

- 文档 ID：`127177168942`
- 更新时间：`2025-08-05T20:08:28.083000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=127177168942`

适用于上传货品（bg.goods.add） (https://agentpartner.temu.com/document?cataId=875198836203&docId=875202591662)接口省份字段枚举值
 (https://)
字段名：productWhExtAttrReq.productOrigin.region2Id
region2Id省份43000000000002北京市43000000000003安徽省43000000000004福建省43000000000005甘肃省43000000000006广东省43000000000007广西壮族自治区43000000000008贵州省43000000000009海南省43000000000010河北省43000000000011河南省43000000000012黑龙江省43000000000013湖北省43000000000014湖南省43000000000015吉林省43000000000016江苏省43000000000017江西省43000000000018辽宁省43000000000019内蒙古自治区43000000000020宁夏回族自治区43000000000021青海省43000000000022山东省43000000000023山西省43000000000024陕西省43000000000025上海市43000000000026四川省43000000000027天津市43000000000028西藏自治区43000000000029新疆维吾尔自治区43000000000030云南省43000000000031浙江省43000000000032重庆市

## 文档中心 / 开发者文档 / 数据字典 / 部分类目模特信息必填

- 文档 ID：`153400122150`
- 更新时间：`2025-08-26T21:32:28.662000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=153400122150`

30681,30679,30682,30683,30680,30713,30715,30714,30703,30695,30693,30696,30699,30701,30700,30712,30711,30708,30705,30707,30706,30709,30687,30689,30691,30688,30690,30686,30678,30702,30697,30245,30246,30248,30231,30247,30233,30232,30235,30230,30276,30241,30240,30239,30237,30238,40270,40271,40268,40173,40172,40171,40174,40170,40259,40258,40225,40224,40221,40199,40206,40219,40213,40202,40222,40218,40216,40210,40209,40217,40214,40200,40207,40212,40201,40203,40204,40220,40197,40250,40238,40248,40246,40227,40251,40230,40231,40232,40234,40243,40247,40256,40233,40255,40252,40237,40254,40241,40240,40242,40245,40229,40236,40182,40179,40180,40181,40183,40267,40265,40266,40264,40261,40263,40262,40193,40185,40194,40191,40186,40189,40188,40190,40177,40176,28779,28781,28780,28778,28777,28823,28816,28814,28817,28820,28822,28821,28813,28818,28862,28860,28863,28864,28861,28859,30478,30479,30476,30333,30332,30331,30334,30330,30466,30467,30415,30412,30408,30386,30393,30406,30400,30389,39250,30405,30403,30397,30396,30404,30401,30387,30394,30399,30388,30390,30391,30407,30384,30442,30429,30440,30438,30417,30443,30421,30422,30423,30425,30435,30439,30458,30424,30456,30444,30428,30446,30433,30432,30437,30420,30427,30342,30339,30340,30341,30343,30475,30473,30474,30472,30469,30471,30470,30353,30345,30354,30351,30346,30349,30348,30350,30337,30336,28886,28883,28885,28884,28887,28794,28796,28798,28795,28797,28793,28689,28690,28687,28688,28691,27600,27601,27598,27599,27602,27982,27983,27980,27981,30366,30367,30364,30365,30359,30372,30370,30369,30373,27837,27838,27835,27836,27349,27350,27347,27348,27356,27272,27273,27270,27271,30460,30464,30461,30463,30462,30451,30452,30449,30450,30447,30431,27749,27750,27747,27748,28089,28090,28087,28088,28091

## 文档中心 / 开发者文档 / 数据字典 / 定制品定制工艺层级关系

- 文档 ID：`139759717684`
- 更新时间：`2025-09-25T16:43:52.186000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=139759717684`

# 层级关系
用于bg.goods.add (https://agentpartner.temu.com/document?cataId=875198836203&docId=875202591662)接口中productSaleExtAttrReq.customizedTechnologyReq定制工艺

工艺类型一级工艺firstType二级工艺（子工艺）twiceType单一工艺（仅支持单选）基础工艺（无需审版）/木/竹制品定制工艺激光雕刻-文字激光雕刻-图片机械雕刻-文字机械雕刻-图片UV热转印-文字热转印-图片丝网印刷-文字丝网印刷-图片喷漆烫画-文字烫画-图片手绘金属制品定制工艺焊接蚀刻UV丝网印刷-文字丝网印刷-图片喷漆滴油滴胶-文字滴胶-图片激光雕刻-文字激光雕刻-图片机械雕刻-文字机械雕刻-图片激光切割-文字激光切割-图片镶钻电镀烫钻热转印-文字热转印-图片皮具/布艺定制工艺烫金-文字烫金-图片锡金热转印-文字热转印-图片UV丝网印刷-文字丝网印刷-图片滴胶-文字滴胶-图片滴油激光雕刻-文字激光雕刻-图片刺绣植绒烫画-文字烫画-图片数码直喷压印机织图案-胶贴镶钻烫钻手绘有机材料（亚克力/树脂/玻璃/陶瓷/塑料等）定制工艺激光雕刻-文字激光雕刻-图片机械雕刻-文字机械雕刻-图片激光切割-文字激光切割-图片UV丝网印刷-文字丝网印刷-图片美甲手绘镶钻烫钻水转印印刷画布/纸张/纸定制工艺手绘压印丝网印刷-文字丝网印刷-图片烫金-文字烫金-图片UV组合工艺（支持多选：最少选两项，最多选三项）木/竹制品定制工艺激光雕刻-文字激光雕刻-图片机械雕刻-文字机械雕刻-图片UV热转印-文字热转印-图片丝网印刷-文字丝网印刷-图片喷漆烫画-文字烫画-图片手绘金属制品定制工艺焊接UV丝网印刷-文字丝网印刷-图片喷漆滴油激光雕刻-文字激光雕刻-图片机械雕刻-文字机械雕刻-图片激光切割-文字激光切割-图片镶钻电镀蚀刻滴胶-文字滴胶-图片烫钻热转印-文字热转印-图片皮具/布艺定制工艺UV丝网印刷-文字丝网印刷-图片激光雕刻-文字激光雕刻-图片烫金-文字烫金-图片滴油压印锡金热转印-文字热转印-图片滴胶-文字滴胶-图片刺绣植绒烫画-文字烫画-图片数码直喷机织图案-胶贴烫钻镶钻手绘有机材料（亚克力/树脂/玻璃/陶瓷/塑料等）定制工艺激光雕刻-文字激光雕刻-图片机械雕刻-文字机械雕刻-图片激光切割-文字激光切割-图片UV丝网印刷-文字丝网印刷-图片美甲手绘烫钻镶钻水转印印刷画布/纸张/纸定制工艺丝网印刷-文字丝网印刷-图片烫金-文字烫金-图片压印手绘UV

# 枚举值

firstType：一级工艺，10001：基础工艺，10002：木制品定制工艺，10003：金属制品定制工艺，10004：皮具/布艺定制工艺，10005：有机材料（亚克力/树脂等）定制工艺，10006：画布/纸张定制工艺

twiceType：二级工艺，20001: 激光雕刻-文字 , 20002: 激光雕刻-图片 , 20003: 机械雕刻-文字 , 20004: 机械雕刻-图片 , 20005: 焊接 , 20006: 蚀刻 , 20007: UV , 20008: 丝网印刷-文字 , 20009: 丝网印刷-图片 , 20010: 喷漆 , 20011: 滴油 , 20012: 滴胶-文字 , 20013: 滴胶-图片 , 20014: 激光切割-文字 , 20015: 激光切割-图片 , 20016: 镶钻 , 20017: 烫金-文字 , 20018: 烫金-图片 , 20019: 锡金 , 20020: 热转印-文字 , 20021: 热转印-图片 , 20022: 刺绣 , 20023: 植绒 , 20024: 电镀 , 20025: 烫画-文字 , 20026: 烫画-图片 , 20027: 数码直喷 , 20033: 压印 , 20034: 美甲手绘 , 20035: 机织图案-胶贴 20036: 烫钻 , 20037：手绘 , 20038: 水转印印刷

## 文档中心 / 开发者文档 / 数据字典 / 半托管站点列表

- 文档 ID：`126128279515`
- 更新时间：`2025-09-29T20:20:36.572000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=126128279515`

泛欧27个站点：105,106,107,108,109,111,112,113,115,116,117,141,137,138,139,140,142,143,144,145,146,147,148,149,150,151,152

siteIdsiteName是否开站关联站点100美国站true-101加拿大站true-102英国站true-103澳大利亚站true103,104104新西兰站true103,104105德国站true泛欧106法国站true泛欧107意大利站true泛欧108荷兰站true泛欧109西班牙站true泛欧110墨西哥站true-111葡萄牙站true泛欧112波兰站true泛欧113瑞典站true泛欧114瑞士站true-115希腊true泛欧116爱尔兰true泛欧117塞浦路斯true泛欧118日本站true-119韩国站false-120沙特站true-121新加坡站false-122阿联酋站true-123科威特站true-124挪威站true-125智利站true-126马来西亚站true-127菲律宾站true-128中国台湾站false-129泰国站true-130卡塔尔站true-131约旦站true-132巴西站false-133阿曼站true-134巴林站true-135以色列站true-136南非站true-141保加利亚站true泛欧137捷克站true泛欧138匈牙利站true泛欧139丹麦站true泛欧140罗马尼亚站true泛欧142比利时站true泛欧143奥地利站true泛欧144芬兰站true泛欧145斯洛伐克站true泛欧146克罗地亚站true泛欧147斯洛文尼亚站true泛欧148立陶宛站true泛欧149爱沙尼亚站true泛欧150拉脱维亚站true泛欧151马耳他站true泛欧152卢森堡站true泛欧153塞尔维亚true-154摩尔多瓦true-155黑山true-156冰岛true-157安道尔false-158波黑true-159阿尔巴尼亚true-162哈萨克斯坦false-163秘鲁true-164哥伦比亚true-165格鲁吉亚true-166亚美尼亚true-167阿塞拜疆true-168乌克兰false-169乌拉圭false-161科索沃false-170毛里求斯true-171摩洛哥true-172多米尼加false-173哥斯达黎加false-174土耳其false-175阿尔及利亚站false-176巴拿马站true-177肯尼亚站false-178厄瓜多尔站true-179特立尼达和多巴哥站false-180危地马拉站false-181乌兹别克斯坦站false-182洪都拉斯站false-183萨尔瓦多站false-184巴基斯坦站false-185斯里兰卡站true-186蒙古站false-187越南站true-188文莱站true-189阿根廷站false-190尼日利亚站false-191柬埔寨站false-192北马其顿true-193孟加拉站false-194吉尔吉斯斯坦站true-196马尔代夫站false-197列支敦士登站true

## 文档中心 / 开发者文档 / 数据字典 / 货品名称长度限制规则

- 文档 ID：`132430304308`
- 更新时间：`2025-10-10T20:48:12.879000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=132430304308`

货品名称productName长度规则限制如下，其他默认500

catIdcatNamelimit1CD和黑胶唱片100653办公用品2001464宠物用品2502096大家电2502542电子5004673工业和科学2509711家具厨房用品25013512家居装修25015945健康和家具用品25017719乐器25018768美容和个人护理25019858汽车用品25023177视频游戏25024252手机和配件25024389庭院草坪和园艺25026207母婴用品25027011服装鞋靴和珠宝饰品25031148运动与户外用品250

## 文档中心 / 开发者文档 / 数据字典 / （单码）鞋类尺码&脚长映射配置

- 文档 ID：`134523592060`
- 更新时间：`2025-11-16T14:28:25.230000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=134523592060`

# 尺码组名

euSize 欧码
ukSize 英码
usSize 美码
brSize 巴西码
mxSize 墨西哥码
jpSize 日本码
krSize 韩国码
clSize 智利码
coSize 哥伦比亚码
footLength 脚长  //单位mm

# 尺码分类
## 女鞋
[
{
"euSize": "31",
"ukSize": "0",
"usSize": "2.5",
"brSize": "26",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "205",
"clSize": "31",
"coSize": "29",
"footLength": 200
},
{
"euSize": "32",
"ukSize": "0",
"usSize": "2.5",
"brSize": "27",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "205",
"clSize": "31.5",
"coSize": "29.5",
"footLength": 201
},
{
"euSize": "32",
"ukSize": "0",
"usSize": "2.5",
"brSize": "27",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "205",
"clSize": "31.5",
"coSize": "30",
"footLength": 202
},
{
"euSize": "32",
"ukSize": "0.5",
"usSize": "3",
"brSize": "27",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "210",
"clSize": "31.5",
"coSize": "30",
"footLength": 203
},
{
"euSize": "32.5",
"ukSize": "0.5",
"usSize": "3",
"brSize": "27",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "210",
"clSize": "31.5",
"coSize": "30",
"footLength": 204
},
{
"euSize": "32.5",
"ukSize": "0.5",
"usSize": "3",
"brSize": "28",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "210",
"clSize": "32",
"coSize": "30",
"footLength": 205
},
{
"euSize": "32.5",
"ukSize": "0.5",
"usSize": "3",
"brSize": "28",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "210",
"clSize": "32",
"coSize": "30.5",
"footLength": 206
},
{
"euSize": "33",
"ukSize": "1",
"usSize": "3.5",
"brSize": "28",
"mxSize": "20.5-21cm",
"jpSize": "20.5-21cm",
"krSize": "210-215",
"clSize": "32",
"coSize": "31",
"footLength": 207
},
{
"euSize": "33",
"ukSize": "1",
"usSize": "3.5",
"brSize": "28",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "215",
"clSize": "32.5",
"coSize": "31",
"footLength": 208
},
{
"euSize": "33",
"ukSize": "1",
"usSize": "3.5",
"brSize": "29",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "215",
"clSize": "32.5",
"coSize": "31",
"footLength": 209
},
{
"euSize": "33",
"ukSize": "1",
"usSize": "3.5",
"brSize": "29",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "215",
"clSize": "32.5",
"coSize": "31",
"footLength": 210
},
{
"euSize": "33.5",
"ukSize": "1.5",
"usSize": "4",
"brSize": "29",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "215",
"clSize": "33",
"coSize": "31.5",
"footLength": 211
},
{
"euSize": "33.5",
"ukSize": "1.5",
"usSize": "4",
"brSize": "29",
"mxSize": "21.5cm",
"jpSize": "21-21.5cm",
"krSize": "215-220",
"clSize": "33",
"coSize": "32",
"footLength": 212
},
{
"euSize": "33.5",
"ukSize": "1.5",
"usSize": "4",
"brSize": "30",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "220",
"clSize": "33",
"coSize": "32",
"footLength": 213
},
{
"euSize": "34",
"ukSize": "1.5",
"usSize": "4",
"brSize": "30",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "220",
"clSize": "33",
"coSize": "32",
"footLength": 214
},
{
"euSize": "34",
"ukSize": "2",
"usSize": "4.5",
"brSize": "30",
"mxSize": "21.5-22cm",
"jpSize": "21.5cm",
"krSize": "220",
"clSize": "33.5",
"coSize": "32",
"footLength": 215
},
{
"euSize": "34",
"ukSize": "2",
"usSize": "4.5",
"brSize": "30",
"mxSize": "22cm",
"jpSize": "21.5cm",
"krSize": "220",
"clSize": "33.5",
"coSize": "32.5",
"footLength": 216
},
{
"euSize": "34.5",
"ukSize": "2",
"usSize": "4.5",
"brSize": "31",
"mxSize": "22cm",
"jpSize": "21.5-22cm",
"krSize": "220-225",
"clSize": "33.5",
"coSize": "33",
"footLength": 217
},
{
"euSize": "34.5",
"ukSize": "2",
"usSize": "4.5",
"brSize": "31",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "225",
"clSize": "34",
"coSize": "33",
"footLength": 218
},
{
"euSize": "34.5",
"ukSize": "2.5",
"usSize": "4.5",
"brSize": "31",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "225",
"clSize": "34",
"coSize": "33",
"footLength": 219
},
{
"euSize": "35",
"ukSize": "2.5",
"usSize": "5",
"brSize": "31",
"mxSize": "22.5cm",
"jpSize": "22-22.5cm",
"krSize": "225",
"clSize": "34",
"coSize": "33",
"footLength": 220
},
{
"euSize": "35",
"ukSize": "2.5",
"usSize": "5",
"brSize": "32",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"clSize": "34.5",
"coSize": "33.5",
"footLength": 221
},
{
"euSize": "35",
"ukSize": "2.5",
"usSize": "5",
"brSize": "32",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225-230",
"clSize": "34.5",
"coSize": "34",
"footLength": 222
},
{
"euSize": "35",
"ukSize": "3",
"usSize": "5",
"brSize": "32",
"mxSize": "23cm",
"jpSize": "22.5cm",
"krSize": "230",
"clSize": "34.5",
"coSize": "34",
"footLength": 223
},
{
"euSize": "35.5",
"ukSize": "3",
"usSize": "5.5",
"brSize": "32",
"mxSize": "23cm",
"jpSize": "22.5cm",
"krSize": "230",
"clSize": "34.5",
"coSize": "34",
"footLength": 224
},
{
"euSize": "35.5",
"ukSize": "3",
"usSize": "5.5",
"brSize": "33",
"mxSize": "23cm",
"jpSize": "22.5-23cm",
"krSize": "230",
"clSize": "35",
"coSize": "34",
"footLength": 225
},
{
"euSize": "35.5",
"ukSize": "3",
"usSize": "5.5",
"brSize": "33",
"mxSize": "23cm",
"jpSize": "22.5-23cm",
"krSize": "230",
"clSize": "35",
"coSize": "34.5",
"footLength": 226
},
{
"euSize": "35.5",
"ukSize": "3.5",
"usSize": "5.5",
"brSize": "33",
"mxSize": "23-23.5cm",
"jpSize": "23cm",
"krSize": "230-235",
"clSize": "35",
"coSize": "35",
"footLength": 227
},
{
"euSize": "36",
"ukSize": "3.5",
"usSize": "6",
"brSize": "33",
"mxSize": "23.5cm",
"jpSize": "23cm",
"krSize": "235",
"clSize": "35.5",
"coSize": "35",
"footLength": 228
},
{
"euSize": "36",
"ukSize": "3.5",
"usSize": "6",
"brSize": "34",
"mxSize": "23.5cm",
"jpSize": "23cm",
"krSize": "235",
"clSize": "35.5",
"coSize": "35",
"footLength": 229
},
{
"euSize": "36",
"ukSize": "3.5",
"usSize": "6",
"brSize": "34",
"mxSize": "23.5cm",
"jpSize": "23cm",
"krSize": "235",
"clSize": "35.5",
"coSize": "35",
"footLength": 230
},
{
"euSize": "36.5",
"ukSize": "3.5",
"usSize": "6",
"brSize": "34",
"mxSize": "23.5cm",
"jpSize": "23-23.5cm",
"krSize": "235",
"clSize": "36",
"coSize": "35.5",
"footLength": 231
},
{
"euSize": "36.5",
"ukSize": "4",
"usSize": "6.5",
"brSize": "34",
"mxSize": "23.5-24cm",
"jpSize": "23.5cm",
"krSize": "235-240",
"clSize": "36",
"coSize": "36",
"footLength": 232
},
{
"euSize": "36.5",
"ukSize": "4",
"usSize": "6.5",
"brSize": "35",
"mxSize": "24cm",
"jpSize": "23.5cm",
"krSize": "240",
"clSize": "36",
"coSize": "36",
"footLength": 233
},
{
"euSize": "37",
"ukSize": "4",
"usSize": "6.5",
"brSize": "35",
"mxSize": "24cm",
"jpSize": "23.5cm",
"krSize": "240",
"clSize": "36.5",
"coSize": "36",
"footLength": 234
},
{
"euSize": "37",
"ukSize": "4",
"usSize": "6.5",
"brSize": "35",
"mxSize": "24cm",
"jpSize": "23.5cm",
"krSize": "240",
"clSize": "36.5",
"coSize": "36",
"footLength": 235
},
{
"euSize": "37",
"ukSize": "4.5",
"usSize": "6.5",
"brSize": "35",
"mxSize": "24cm",
"jpSize": "23.5-24cm",
"krSize": "240",
"clSize": "37",
"coSize": "36.5",
"footLength": 236
},
{
"euSize": "37.5",
"ukSize": "4.5",
"usSize": "7",
"brSize": "35.5",
"mxSize": "24.5cm",
"jpSize": "24cm",
"krSize": "240-245",
"clSize": "37",
"coSize": "37",
"footLength": 237
},
{
"euSize": "37.5",
"ukSize": "4.5",
"usSize": "7",
"brSize": "36",
"mxSize": "24.5cm",
"jpSize": "24cm",
"krSize": "245",
"clSize": "37",
"coSize": "37",
"footLength": 238
},
{
"euSize": "37.5",
"ukSize": "4.5",
"usSize": "7",
"brSize": "36",
"mxSize": "24.5cm",
"jpSize": "24cm",
"krSize": "245",
"clSize": "37.5",
"coSize": "37",
"footLength": 239
},
{
"euSize": "38",
"ukSize": "5",
"usSize": "7",
"brSize": "36",
"mxSize": "24.5cm",
"jpSize": "24cm",
"krSize": "245",
"clSize": "37.5",
"coSize": "37",
"footLength": 240
},
{
"euSize": "38",
"ukSize": "5",
"usSize": "7.5",
"brSize": "36",
"mxSize": "25cm",
"jpSize": "24.5cm",
"krSize": "245",
"clSize": "37.5",
"coSize": "37.5",
"footLength": 241
},
{
"euSize": "38",
"ukSize": "5",
"usSize": "7.5",
"brSize": "37",
"mxSize": "25cm",
"jpSize": "24.5cm",
"krSize": "245-250",
"clSize": "38",
"coSize": "38",
"footLength": 242
},
{
"euSize": "38",
"ukSize": "5",
"usSize": "7.5",
"brSize": "37",
"mxSize": "25cm",
"jpSize": "24.5cm",
"krSize": "250",
"clSize": "38",
"coSize": "38",
"footLength": 243
},
{
"euSize": "38.5",
"ukSize": "5.5",
"usSize": "7.5",
"brSize": "37",
"mxSize": "25cm",
"jpSize": "24.5cm",
"krSize": "250",
"clSize": "38",
"coSize": "38",
"footLength": 244
},
{
"euSize": "38.5",
"ukSize": "5.5",
"usSize": "7.5",
"brSize": "37",
"mxSize": "25.5cm",
"jpSize": "24.5-25cm",
"krSize": "250",
"clSize": "38",
"coSize": "38",
"footLength": 245
},
{
"euSize": "38.5",
"ukSize": "5.5",
"usSize": "8",
"brSize": "38",
"mxSize": "25.5cm",
"jpSize": "24.5-25cm",
"krSize": "250",
"clSize": "38.5",
"coSize": "38.5",
"footLength": 246
},
{
"euSize": "39",
"ukSize": "5.5",
"usSize": "8",
"brSize": "38",
"mxSize": "25.5cm",
"jpSize": "25cm",
"krSize": "250-255",
"clSize": "38.5",
"coSize": "39",
"footLength": 247
},
{
"euSize": "39",
"ukSize": "6",
"usSize": "8",
"brSize": "38",
"mxSize": "25.5cm",
"jpSize": "25cm",
"krSize": "255",
"clSize": "39",
"coSize": "39",
"footLength": 248
},
{
"euSize": "39",
"ukSize": "6",
"usSize": "8",
"brSize": "38",
"mxSize": "26cm",
"jpSize": "25cm",
"krSize": "255",
"clSize": "39",
"coSize": "39",
"footLength": 249
},
{
"euSize": "39",
"ukSize": "6",
"usSize": "8",
"brSize": "39",
"mxSize": "26cm",
"jpSize": "25cm",
"krSize": "255",
"clSize": "39",
"coSize": "39",
"footLength": 250
},
{
"euSize": "39.5",
"ukSize": "6",
"usSize": "8.5",
"brSize": "39",
"mxSize": "26cm",
"jpSize": "25-25.5cm",
"krSize": "255",
"clSize": "39.5",
"coSize": "39.5",
"footLength": 251
},
{
"euSize": "39.5",
"ukSize": "6",
"usSize": "8.5",
"brSize": "39",
"mxSize": "26cm",
"jpSize": "25-25.5cm",
"krSize": "255-260",
"clSize": "40",
"coSize": "40",
"footLength": 252
},
{
"euSize": "39.5",
"ukSize": "6.5",
"usSize": "8.5",
"brSize": "39",
"mxSize": "26-26.5cm",
"jpSize": "25-25.5cm",
"krSize": "260",
"clSize": "40",
"coSize": "40",
"footLength": 253
},
{
"euSize": "40",
"ukSize": "6.5",
"usSize": "8.5",
"brSize": "40",
"mxSize": "26.5cm",
"jpSize": "25.5cm",
"krSize": "260",
"clSize": "40",
"coSize": "40",
"footLength": 254
},
{
"euSize": "40",
"ukSize": "6.5",
"usSize": "9",
"brSize": "40",
"mxSize": "26.5cm",
"jpSize": "25.5cm",
"krSize": "260",
"clSize": "40",
"coSize": "40",
"footLength": 255
},
{
"euSize": "40",
"ukSize": "6.5",
"usSize": "9",
"brSize": "40",
"mxSize": "26.5cm",
"jpSize": "25.5cm",
"krSize": "260",
"clSize": "40.5",
"coSize": "40.5",
"footLength": 256
},
{
"euSize": "40",
"ukSize": "7",
"usSize": "9",
"brSize": "40",
"mxSize": "26.5cm",
"jpSize": "25.5cm",
"krSize": "260-265",
"clSize": "40.5",
"coSize": "41",
"footLength": 257
},
{
"euSize": "40.5",
"ukSize": "7",
"usSize": "9.5",
"brSize": "41",
"mxSize": "26.5-27cm",
"jpSize": "26cm",
"krSize": "265",
"clSize": "41",
"coSize": "41",
"footLength": 258
},
{
"euSize": "40.5",
"ukSize": "7",
"usSize": "9.5",
"brSize": "41",
"mxSize": "27cm",
"jpSize": "26cm",
"krSize": "265",
"clSize": "41",
"coSize": "41",
"footLength": 259
},
{
"euSize": "40.5",
"ukSize": "7",
"usSize": "9.5",
"brSize": "41",
"mxSize": "27cm",
"jpSize": "26cm",
"krSize": "265",
"clSize": "41",
"coSize": "41",
"footLength": 260
},
{
"euSize": "40.5",
"ukSize": "7.5",
"usSize": "9.5",
"brSize": "41",
"mxSize": "27cm",
"jpSize": "26cm",
"krSize": "265",
"clSize": "41",
"coSize": "41.5",
"footLength": 261
},
{
"euSize": "41",
"ukSize": "7.5",
"usSize": "10",
"brSize": "41.5",
"mxSize": "27cm",
"jpSize": "26-26.5cm",
"krSize": "265-270",
"clSize": "41.5",
"coSize": "42",
"footLength": 262
},
{
"euSize": "41",
"ukSize": "7.5",
"usSize": "10",
"brSize": "41.5",
"mxSize": "27-27.5cm",
"jpSize": "26-26.5cm",
"krSize": "270",
"clSize": "41.5",
"coSize": "42",
"footLength": 263
},
{
"euSize": "41",
"ukSize": "7.5",
"usSize": "10",
"brSize": "41.5",
"mxSize": "27.5cm",
"jpSize": "26.5cm",
"krSize": "270",
"clSize": "42",
"coSize": "42",
"footLength": 264
},
{
"euSize": "41.5",
"ukSize": "7.5",
"usSize": "10",
"brSize": "42",
"mxSize": "27.5cm",
"jpSize": "26.5cm",
"krSize": "270",
"clSize": "42",
"coSize": "42",
"footLength": 265
},
{
"euSize": "41.5",
"ukSize": "8",
"usSize": "10.5",
"brSize": "42",
"mxSize": "27.5cm",
"jpSize": "26.5cm",
"krSize": "270",
"clSize": "42.5",
"coSize": "42.5",
"footLength": 266
},
{
"euSize": "42",
"ukSize": "8",
"usSize": "10.5",
"brSize": "42",
"mxSize": "27.5cm",
"jpSize": "26.5cm",
"krSize": "270-275",
"clSize": "43",
"coSize": "43",
"footLength": 267
},
{
"euSize": "42",
"ukSize": "8",
"usSize": "10.5",
"brSize": "42",
"mxSize": "27.5-28cm",
"jpSize": "26.5-27cm",
"krSize": "275",
"clSize": "43",
"coSize": "43",
"footLength": 268
},
{
"euSize": "42",
"ukSize": "8",
"usSize": "10.5",
"brSize": "43",
"mxSize": "27.5-28cm",
"jpSize": "26.5-27cm",
"krSize": "275",
"clSize": "43",
"coSize": "43",
"footLength": 269
},
{
"euSize": "42",
"ukSize": "8.5",
"usSize": "10.5",
"brSize": "43",
"mxSize": "27.5-28cm",
"jpSize": "26.5-27cm",
"krSize": "275",
"clSize": "43",
"coSize": "43",
"footLength": 270
},
{
"euSize": "42.5",
"ukSize": "8.5",
"usSize": "11",
"brSize": "43",
"mxSize": "27.5-28cm",
"jpSize": "26.5-27cm",
"krSize": "275",
"clSize": "43.5",
"coSize": "43.5",
"footLength": 271
},
{
"euSize": "42.5",
"ukSize": "8.5",
"usSize": "11",
"brSize": "43",
"mxSize": "28cm",
"jpSize": "27cm",
"krSize": "275-280",
"clSize": "44",
"coSize": "44",
"footLength": 272
},
{
"euSize": "42.5",
"ukSize": "8.5",
"usSize": "11",
"brSize": "44",
"mxSize": "28cm",
"jpSize": "27cm",
"krSize": "280",
"clSize": "44",
"coSize": "44",
"footLength": 273
},
{
"euSize": "43",
"ukSize": "9",
"usSize": "11",
"brSize": "44",
"mxSize": "28cm",
"jpSize": "27cm",
"krSize": "280",
"clSize": "44",
"coSize": "44",
"footLength": 274
},
{
"euSize": "43",
"ukSize": "9",
"usSize": "11",
"brSize": "44",
"mxSize": "28cm",
"jpSize": "27cm",
"krSize": "280",
"clSize": "44",
"coSize": "44",
"footLength": 275
},
{
"euSize": "43",
"ukSize": "9",
"usSize": "11.5",
"brSize": "44",
"mxSize": "28-28.5cm",
"jpSize": "27-27.5cm",
"krSize": "280",
"clSize": "44.5",
"coSize": "44.5",
"footLength": 276
},
{
"euSize": "43.5",
"ukSize": "9",
"usSize": "11.5",
"brSize": "45",
"mxSize": "28.5cm",
"jpSize": "27.5cm",
"krSize": "280-285",
"clSize": "45",
"coSize": "45",
"footLength": 277
},
{
"euSize": "43.5",
"ukSize": "9",
"usSize": "11.5",
"brSize": "45",
"mxSize": "28.5cm",
"jpSize": "27.5cm",
"krSize": "285",
"clSize": "45",
"coSize": "45",
"footLength": 278
},
{
"euSize": "43.5",
"ukSize": "9.5",
"usSize": "11.5",
"brSize": "45",
"mxSize": "28.5cm",
"jpSize": "27.5cm",
"krSize": "285",
"clSize": "45",
"coSize": "45",
"footLength": 279
},
{
"euSize": "43.5",
"ukSize": "9.5",
"usSize": "11.5",
"brSize": "45",
"mxSize": "28.5cm",
"jpSize": "27.5cm",
"krSize": "285",
"clSize": "45",
"coSize": "45",
"footLength": 280
},
{
"euSize": "44",
"ukSize": "9.5",
"usSize": "12",
"brSize": "46",
"mxSize": "28.5-29cm",
"jpSize": "28cm",
"krSize": "285",
"clSize": "45.5",
"coSize": "45.5",
"footLength": 281
},
{
"euSize": "44",
"ukSize": "9.5",
"usSize": "12",
"brSize": "46",
"mxSize": "29cm",
"jpSize": "28cm",
"krSize": "285-290",
"clSize": "46",
"coSize": "46",
"footLength": 282
},
{
"euSize": "44",
"ukSize": "10",
"usSize": "12",
"brSize": "46",
"mxSize": "29cm",
"jpSize": "28cm",
"krSize": "290",
"clSize": "46",
"coSize": "46",
"footLength": 283
},
{
"euSize": "44.5",
"ukSize": "10",
"usSize": "12",
"brSize": "46",
"mxSize": "29cm",
"jpSize": "28cm",
"krSize": "290",
"clSize": "46",
"coSize": "46",
"footLength": 284
},
{
"euSize": "44.5",
"ukSize": "10",
"usSize": "12",
"brSize": "46.5",
"mxSize": "29cm",
"jpSize": "28.5cm",
"krSize": "290",
"clSize": "46",
"coSize": "46",
"footLength": 285
},
{
"euSize": "44.5",
"ukSize": "10",
"usSize": "12.5",
"brSize": "47",
"mxSize": "29-29.5cm",
"jpSize": "28.5cm",
"krSize": "290",
"clSize": "46.5",
"coSize": "46.5",
"footLength": 286
},
{
"euSize": "45",
"ukSize": "10.5",
"usSize": "12.5",
"brSize": "47",
"mxSize": "29.5cm",
"jpSize": "28.5cm",
"krSize": "290-295",
"clSize": "47",
"coSize": "47",
"footLength": 287
},
{
"euSize": "45",
"ukSize": "10.5",
"usSize": "12.5",
"brSize": "47",
"mxSize": "29.5cm",
"jpSize": "29cm",
"krSize": "295",
"clSize": "47",
"coSize": "47",
"footLength": 288
},
{
"euSize": "45",
"ukSize": "10.5",
"usSize": "12.5",
"brSize": "47",
"mxSize": "29.5cm",
"jpSize": "29cm",
"krSize": "295",
"clSize": "47",
"coSize": "47",
"footLength": 289
},
{
"euSize": "45",
"ukSize": "10.5",
"usSize": "13",
"brSize": "48",
"mxSize": "29.5cm",
"jpSize": "29cm",
"krSize": "295",
"clSize": "47",
"coSize": "47",
"footLength": 290
},
{
"euSize": "45.5",
"ukSize": "11",
"usSize": "13",
"brSize": "48",
"mxSize": "29.5-30cm",
"jpSize": "29cm",
"krSize": "295",
"clSize": "47.5",
"coSize": "47.5",
"footLength": 291
},
{
"euSize": "45.5",
"ukSize": "11",
"usSize": "13",
"brSize": "48",
"mxSize": "30cm",
"jpSize": "29-29.5cm",
"krSize": "295-300",
"clSize": "48",
"coSize": "48",
"footLength": 292
},
{
"euSize": "45.5",
"ukSize": "11",
"usSize": "13",
"brSize": "48",
"mxSize": "30cm",
"jpSize": "29.5cm",
"krSize": "300",
"clSize": "48",
"coSize": "48",
"footLength": 293
},
{
"euSize": "46",
"ukSize": "11",
"usSize": "13",
"brSize": "49",
"mxSize": "30cm",
"jpSize": "29.5cm",
"krSize": "300",
"clSize": "48",
"coSize": "48",
"footLength": 294
},
{
"euSize": "46",
"ukSize": "11.5",
"usSize": "13.5",
"brSize": "49",
"mxSize": "30cm",
"jpSize": "29.5cm",
"krSize": "300",
"clSize": "48",
"coSize": "48",
"footLength": 295
},
{
"euSize": "46",
"ukSize": "11.5",
"usSize": "13.5",
"brSize": "49",
"mxSize": "30-30.5cm",
"jpSize": "29.5cm",
"krSize": "300",
"clSize": "48.5",
"coSize": "48.5",
"footLength": 296
},
{
"euSize": "46.5",
"ukSize": "11.5",
"usSize": "13.5",
"brSize": "49",
"mxSize": "30.5cm",
"jpSize": "29.5-30cm",
"krSize": "300-305",
"clSize": "49",
"coSize": "49",
"footLength": 297
},
{
"euSize": "46.5",
"ukSize": "11.5",
"usSize": "13.5",
"brSize": "50",
"mxSize": "30.5cm",
"jpSize": "30cm",
"krSize": "305",
"clSize": "49",
"coSize": "49",
"footLength": 298
},
{
"euSize": "46.5",
"ukSize": "11.5",
"usSize": "13.5",
"brSize": "50",
"mxSize": "30.5cm",
"jpSize": "30cm",
"krSize": "305",
"clSize": "49",
"coSize": "49",
"footLength": 299
},
{
"euSize": "46.5",
"ukSize": "12",
"usSize": "14",
"brSize": "50",
"mxSize": "30.5cm",
"jpSize": "30cm",
"krSize": "305",
"clSize": "49",
"coSize": "49",
"footLength": 300
},
{
"euSize": "47",
"ukSize": "12",
"usSize": "14",
"brSize": "50",
"mxSize": "30.5-31cm",
"jpSize": "30cm",
"krSize": "305",
"clSize": "49.5",
"coSize": "49.5",
"footLength": 301
},
{
"euSize": "47",
"ukSize": "12",
"usSize": "14",
"brSize": "51",
"mxSize": "31cm",
"jpSize": "30-30.5cm",
"krSize": "305-310",
"clSize": "50",
"coSize": "50",
"footLength": 302
},
{
"euSize": "47",
"ukSize": "12",
"usSize": "14",
"brSize": "51",
"mxSize": "31cm",
"jpSize": "30.5cm",
"krSize": "310",
"clSize": "50",
"coSize": "50",
"footLength": 303
},
{
"euSize": "47.5",
"ukSize": "12.5",
"usSize": "14",
"brSize": "51",
"mxSize": "31cm",
"jpSize": "30.5cm",
"krSize": "310",
"clSize": "50",
"coSize": "50",
"footLength": 304
},
{
"euSize": "47.5",
"ukSize": "12.5",
"usSize": "14.5",
"brSize": "51",
"mxSize": "31cm",
"jpSize": "30.5cm",
"krSize": "310",
"clSize": "50",
"coSize": "50",
"footLength": 305
},
{
"euSize": "47.5",
"ukSize": "12.5",
"usSize": "14.5",
"brSize": "51.5",
"mxSize": "31.5-32cm",
"jpSize": "30.5cm",
"krSize": "310",
"clSize": "50.5",
"coSize": "50.5",
"footLength": 306
},
{
"euSize": "48",
"ukSize": "12.5",
"usSize": "14.5",
"brSize": "52",
"mxSize": "32cm",
"jpSize": "30.5-31cm",
"krSize": "310-315",
"clSize": "51",
"coSize": "51",
"footLength": 307
},
{
"euSize": "48",
"ukSize": "13",
"usSize": "14.5",
"brSize": "52",
"mxSize": "32cm",
"jpSize": "31cm",
"krSize": "315",
"clSize": "51",
"coSize": "51",
"footLength": 308
},
{
"euSize": "48",
"ukSize": "13",
"usSize": "14.5",
"brSize": "52",
"mxSize": "32cm",
"jpSize": "31cm",
"krSize": "315",
"clSize": "51",
"coSize": "51",
"footLength": 309
},
{
"euSize": "48",
"ukSize": "13",
"usSize": "15",
"brSize": "52",
"mxSize": "32cm",
"jpSize": "31cm",
"krSize": "315",
"clSize": "51",
"coSize": "51",
"footLength": 310
},
{
"euSize": "48.5",
"ukSize": "13",
"usSize": "15",
"brSize": "53",
"mxSize": "32.5-33cm",
"jpSize": "31cm",
"krSize": "315",
"clSize": "51.5",
"coSize": "51.5",
"footLength": 311
},
{
"euSize": "48.5",
"ukSize": "13.5",
"usSize": "15",
"brSize": "53",
"mxSize": "33cm",
"jpSize": "31-31.5cm",
"krSize": "315-320",
"clSize": "52",
"coSize": "52",
"footLength": 312
},
{
"euSize": "48.5",
"ukSize": "13.5",
"usSize": "15",
"brSize": "53",
"mxSize": "33cm",
"jpSize": "31.5cm",
"krSize": "320",
"clSize": "52",
"coSize": "52",
"footLength": 313
},
{
"euSize": "49",
"ukSize": "13.5",
"usSize": "15",
"brSize": "53",
"mxSize": "33cm",
"jpSize": "31.5cm",
"krSize": "320",
"clSize": "52",
"coSize": "52",
"footLength": 314
},
{
"euSize": "49",
"ukSize": "13.5",
"usSize": "15.5",
"brSize": "54",
"mxSize": "33cm",
"jpSize": "31.5cm",
"krSize": "320",
"clSize": "52",
"coSize": "52",
"footLength": 315
},
{
"euSize": "49",
"ukSize": "13.5",
"usSize": "15.5",
"brSize": "54",
"mxSize": "33-33.5cm",
"jpSize": "31.5cm",
"krSize": "320",
"clSize": "52.5",
"coSize": "52.5",
"footLength": 316
},
{
"euSize": "49.5",
"ukSize": "14",
"usSize": "15.5",
"brSize": "54",
"mxSize": "33.5cm",
"jpSize": "31.5-32cm",
"krSize": "320-325",
"clSize": "53",
"coSize": "53",
"footLength": 317
},
{
"euSize": "49.5",
"ukSize": "14",
"usSize": "15.5",
"brSize": "54",
"mxSize": "33.5cm",
"jpSize": "32cm",
"krSize": "325",
"clSize": "53",
"coSize": "53",
"footLength": 318
},
{
"euSize": "49.5",
"ukSize": "14",
"usSize": "15.5",
"brSize": "55",
"mxSize": "33.5cm",
"jpSize": "32cm",
"krSize": "325",
"clSize": "53",
"coSize": "53",
"footLength": 319
},
{
"euSize": "49.5",
"ukSize": "14",
"usSize": "16.5",
"brSize": "55",
"mxSize": "33.5cm",
"jpSize": "32cm",
"krSize": "325",
"clSize": "53",
"coSize": "53",
"footLength": 320
},
{
"euSize": "50",
"ukSize": "14.5",
"usSize": "16.5",
"brSize": "55",
"mxSize": "33.5-34cm",
"jpSize": "32cm",
"krSize": "325",
"clSize": "53.5",
"coSize": "53.5",
"footLength": 321
},
{
"euSize": "50",
"ukSize": "14.5",
"usSize": "16.5",
"brSize": "55",
"mxSize": "34cm",
"jpSize": "32-32.5cm",
"krSize": "325-330",
"clSize": "54",
"coSize": "54",
"footLength": 322
},
{
"euSize": "50",
"ukSize": "14.5",
"usSize": "16.5",
"brSize": "56",
"mxSize": "34cm",
"jpSize": "32.5cm",
"krSize": "330",
"clSize": "54",
"coSize": "54",
"footLength": 323
},
{
"euSize": "50.5",
"ukSize": "14.5",
"usSize": "16.5",
"brSize": "56",
"mxSize": "34cm",
"jpSize": "32.5cm",
"krSize": "330",
"clSize": "54",
"coSize": "54",
"footLength": 324
},
{
"euSize": "50.5",
"ukSize": "15",
"usSize": "17",
"brSize": "56",
"mxSize": "34cm",
"jpSize": "32.5cm",
"krSize": "330",
"clSize": "54",
"coSize": "54",
"footLength": 325
},
{
"euSize": "50.5",
"ukSize": "15",
"usSize": "17",
"brSize": "56",
"mxSize": "34-34.5cm",
"jpSize": "32.5cm",
"krSize": "330",
"clSize": "54.5",
"coSize": "54.5",
"footLength": 326
},
{
"euSize": "51",
"ukSize": "15",
"usSize": "17",
"brSize": "57",
"mxSize": "34.5cm",
"jpSize": "32.5-33cm",
"krSize": "330-335",
"clSize": "55",
"coSize": "55",
"footLength": 327
},
{
"euSize": "51",
"ukSize": "15",
"usSize": "17",
"brSize": "57",
"mxSize": "34.5cm",
"jpSize": "33cm",
"krSize": "335",
"clSize": "55",
"coSize": "55",
"footLength": 328
},
{
"euSize": "51",
"ukSize": "15.5",
"usSize": "17",
"brSize": "57",
"mxSize": "34.5cm",
"jpSize": "33cm",
"krSize": "335",
"clSize": "55",
"coSize": "55",
"footLength": 329
},
{
"euSize": "51",
"ukSize": "15.5",
"usSize": "17.5",
"brSize": "57",
"mxSize": "34.5cm",
"jpSize": "33cm",
"krSize": "335",
"clSize": "55",
"coSize": "55",
"footLength": 330
}
]

## 男鞋
[
{
"euSize": "32",
"ukSize": "1",
"usSize": "1.5",
"brSize": "30.5",
"mxSize": "20.5cm",
"jpSize": "20.5",
"krSize": "205",
"clSize": "32",
"coSize": "28.5",
"footLength": 204
},
{
"euSize": "32.5",
"ukSize": "1",
"usSize": "1.5",
"brSize": "30.5",
"mxSize": "20.5cm",
"jpSize": "20.5",
"krSize": "205",
"clSize": "32.5",
"coSize": "29",
"footLength": 205
},
{
"euSize": "32.5",
"ukSize": "1",
"usSize": "1.5",
"brSize": "30.5",
"mxSize": "21cm",
"jpSize": "20.5",
"krSize": "205",
"clSize": "32.5",
"coSize": "29",
"footLength": 206
},
{
"euSize": "33",
"ukSize": "1",
"usSize": "1.5",
"brSize": "31",
"mxSize": "21cm",
"jpSize": "20.5",
"krSize": "205",
"clSize": "33",
"coSize": "29",
"footLength": 207
},
{
"euSize": "33",
"ukSize": "1.5",
"usSize": "2",
"brSize": "31",
"mxSize": "21cm",
"jpSize": "21",
"krSize": "205",
"clSize": "33",
"coSize": "29.5",
"footLength": 208
},
{
"euSize": "33",
"ukSize": "1.5",
"usSize": "2",
"brSize": "31",
"mxSize": "21cm",
"jpSize": "21",
"krSize": "210",
"clSize": "33",
"coSize": "29.5",
"footLength": 209
},
{
"euSize": "33.5",
"ukSize": "1.5",
"usSize": "2",
"brSize": "31",
"mxSize": "21cm",
"jpSize": "21",
"krSize": "210",
"clSize": "33.5",
"coSize": "30",
"footLength": 210
},
{
"euSize": "33.5",
"ukSize": "1.5",
"usSize": "2",
"brSize": "31.5",
"mxSize": "21.5cm",
"jpSize": "21",
"krSize": "210",
"clSize": "33.5",
"coSize": "30",
"footLength": 211
},
{
"euSize": "33.5",
"ukSize": "2",
"usSize": "2.5",
"brSize": "31.5",
"mxSize": "21.5cm",
"jpSize": "21",
"krSize": "210",
"clSize": "33.5",
"coSize": "30",
"footLength": 212
},
{
"euSize": "33.5",
"ukSize": "2",
"usSize": "2.5",
"brSize": "32",
"mxSize": "21.5cm",
"jpSize": "21.5",
"krSize": "210",
"clSize": "33.5",
"coSize": "30.5",
"footLength": 213
},
{
"euSize": "34",
"ukSize": "2",
"usSize": "2.5",
"brSize": "32",
"mxSize": "21.5cm",
"jpSize": "21.5",
"krSize": "215",
"clSize": "34",
"coSize": "30.5",
"footLength": 214
},
{
"euSize": "34",
"ukSize": "2",
"usSize": "2.5",
"brSize": "32",
"mxSize": "21.5cm",
"jpSize": "21.5",
"krSize": "215",
"clSize": "34",
"coSize": "31",
"footLength": 215
},
{
"euSize": "34.5",
"ukSize": "2.5",
"usSize": "3",
"brSize": "32.5",
"mxSize": "22cm",
"jpSize": "21.5",
"krSize": "215",
"clSize": "34.5",
"coSize": "31",
"footLength": 216
},
{
"euSize": "34.5",
"ukSize": "2.5",
"usSize": "3",
"brSize": "32.5",
"mxSize": "22cm",
"jpSize": "21.5",
"krSize": "215",
"clSize": "34.5",
"coSize": "31",
"footLength": 217
},
{
"euSize": "34.5",
"ukSize": "2.5",
"usSize": "3",
"brSize": "32.5",
"mxSize": "22cm",
"jpSize": "22",
"krSize": "215",
"clSize": "34.5",
"coSize": "31.5",
"footLength": 218
},
{
"euSize": "34.5",
"ukSize": "2.5",
"usSize": "3",
"brSize": "33",
"mxSize": "22cm",
"jpSize": "22",
"krSize": "220",
"clSize": "34.5",
"coSize": "31.5",
"footLength": 219
},
{
"euSize": "35",
"ukSize": "3",
"usSize": "3",
"brSize": "33",
"mxSize": "22cm",
"jpSize": "22",
"krSize": "220",
"clSize": "35",
"coSize": "32",
"footLength": 220
},
{
"euSize": "35",
"ukSize": "3",
"usSize": "3.5",
"brSize": "33",
"mxSize": "22.5cm",
"jpSize": "22",
"krSize": "220",
"clSize": "35",
"coSize": "32",
"footLength": 221
},
{
"euSize": "35",
"ukSize": "3",
"usSize": "3.5",
"brSize": "33.5",
"mxSize": "22.5cm",
"jpSize": "22",
"krSize": "220",
"clSize": "35",
"coSize": "32",
"footLength": 222
},
{
"euSize": "35",
"ukSize": "3",
"usSize": "3.5",
"brSize": "33.5",
"mxSize": "22.5cm",
"jpSize": "22.5",
"krSize": "220",
"clSize": "35",
"coSize": "32.5",
"footLength": 223
},
{
"euSize": "35.5",
"ukSize": "3",
"usSize": "3.5",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5",
"krSize": "225",
"clSize": "35.5",
"coSize": "32.5",
"footLength": 224
},
{
"euSize": "35.5",
"ukSize": "3.5",
"usSize": "4",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5",
"krSize": "225",
"clSize": "35.5",
"coSize": "33",
"footLength": 225
},
{
"euSize": "35.5",
"ukSize": "3.5",
"usSize": "4",
"brSize": "34",
"mxSize": "23cm",
"jpSize": "22.5",
"krSize": "225",
"clSize": "35.5",
"coSize": "33",
"footLength": 226
},
{
"euSize": "36",
"ukSize": "3.5",
"usSize": "4",
"brSize": "34",
"mxSize": "23cm",
"jpSize": "22.5",
"krSize": "225",
"clSize": "36",
"coSize": "33",
"footLength": 227
},
{
"euSize": "36",
"ukSize": "3.5",
"usSize": "4",
"brSize": "34.5",
"mxSize": "23cm",
"jpSize": "23",
"krSize": "225",
"clSize": "36",
"coSize": "33.5",
"footLength": 228
},
{
"euSize": "36",
"ukSize": "4",
"usSize": "4.5",
"brSize": "34.5",
"mxSize": "23cm",
"jpSize": "23",
"krSize": "230",
"clSize": "36",
"coSize": "33.5",
"footLength": 229
},
{
"euSize": "36.5",
"ukSize": "4",
"usSize": "4.5",
"brSize": "34.5",
"mxSize": "23cm",
"jpSize": "23",
"krSize": "230",
"clSize": "36.5",
"coSize": "34",
"footLength": 230
},
{
"euSize": "36.5",
"ukSize": "4",
"usSize": "4.5",
"brSize": "34.5",
"mxSize": "23.5cm",
"jpSize": "23",
"krSize": "230",
"clSize": "36.5",
"coSize": "34",
"footLength": 231
},
{
"euSize": "36.5",
"ukSize": "4",
"usSize": "4.5",
"brSize": "35",
"mxSize": "23.5cm",
"jpSize": "23",
"krSize": "230",
"clSize": "36.5",
"coSize": "34",
"footLength": 232
},
{
"euSize": "37",
"ukSize": "4.5",
"usSize": "5",
"brSize": "35",
"mxSize": "23.5cm",
"jpSize": "23.5",
"krSize": "230",
"clSize": "36.5",
"coSize": "34.5",
"footLength": 233
},
{
"euSize": "37",
"ukSize": "4.5",
"usSize": "5",
"brSize": "35",
"mxSize": "23.5cm",
"jpSize": "23.5",
"krSize": "235",
"clSize": "37",
"coSize": "34.5",
"footLength": 234
},
{
"euSize": "37",
"ukSize": "4.5",
"usSize": "5",
"brSize": "35",
"mxSize": "23.5cm",
"jpSize": "23.5",
"krSize": "235",
"clSize": "37",
"coSize": "35",
"footLength": 235
},
{
"euSize": "37",
"ukSize": "4.5",
"usSize": "5.5",
"brSize": "35.5",
"mxSize": "24cm",
"jpSize": "23.5",
"krSize": "235",
"clSize": "37",
"coSize": "35",
"footLength": 236
},
{
"euSize": "37.5",
"ukSize": "5",
"usSize": "5.5",
"brSize": "35.5",
"mxSize": "24cm",
"jpSize": "23.5",
"krSize": "235",
"clSize": "37.5",
"coSize": "35",
"footLength": 237
},
{
"euSize": "37.5",
"ukSize": "5",
"usSize": "5.5",
"brSize": "35.5",
"mxSize": "24cm",
"jpSize": "24",
"krSize": "235",
"clSize": "37.5",
"coSize": "35.5",
"footLength": 238
},
{
"euSize": "37.5",
"ukSize": "5",
"usSize": "6",
"brSize": "36",
"mxSize": "24cm",
"jpSize": "24",
"krSize": "240",
"clSize": "37.5",
"coSize": "35.5",
"footLength": 239
},
{
"euSize": "38",
"ukSize": "5",
"usSize": "6",
"brSize": "36",
"mxSize": "24cm",
"jpSize": "24",
"krSize": "240",
"clSize": "38",
"coSize": "36",
"footLength": 240
},
{
"euSize": "38",
"ukSize": "5",
"usSize": "6",
"brSize": "36",
"mxSize": "24.5cm",
"jpSize": "24",
"krSize": "240",
"clSize": "38",
"coSize": "36",
"footLength": 241
},
{
"euSize": "38",
"ukSize": "5.5",
"usSize": "6.5",
"brSize": "36.5",
"mxSize": "24.5cm",
"jpSize": "24",
"krSize": "240",
"clSize": "38",
"coSize": "36",
"footLength": 242
},
{
"euSize": "38.5",
"ukSize": "5.5",
"usSize": "6.5",
"brSize": "36.5",
"mxSize": "24.5cm",
"jpSize": "24.5",
"krSize": "240",
"clSize": "38.5",
"coSize": "36.5",
"footLength": 243
},
{
"euSize": "38.5",
"ukSize": "5.5",
"usSize": "6.5",
"brSize": "36.5",
"mxSize": "24.5cm",
"jpSize": "24.5",
"krSize": "245",
"clSize": "38.5",
"coSize": "36.5",
"footLength": 244
},
{
"euSize": "38.5",
"ukSize": "5.5",
"usSize": "6.5",
"brSize": "37",
"mxSize": "24.5cm",
"jpSize": "24.5",
"krSize": "245",
"clSize": "38.5",
"coSize": "37",
"footLength": 245
},
{
"euSize": "39",
"ukSize": "6",
"usSize": "7",
"brSize": "37",
"mxSize": "25cm",
"jpSize": "24.5",
"krSize": "245",
"clSize": "39",
"coSize": "37",
"footLength": 246
},
{
"euSize": "39",
"ukSize": "6",
"usSize": "7",
"brSize": "37",
"mxSize": "25cm",
"jpSize": "24.5",
"krSize": "245",
"clSize": "39",
"coSize": "37",
"footLength": 247
},
{
"euSize": "39",
"ukSize": "6",
"usSize": "7",
"brSize": "37",
"mxSize": "25cm",
"jpSize": "25",
"krSize": "245",
"clSize": "39",
"coSize": "37.5",
"footLength": 248
},
{
"euSize": "39.5",
"ukSize": "6",
"usSize": "7",
"brSize": "37.5",
"mxSize": "25cm",
"jpSize": "25",
"krSize": "250",
"clSize": "39.5",
"coSize": "37.5",
"footLength": 249
},
{
"euSize": "39.5",
"ukSize": "6.5",
"usSize": "7.5",
"brSize": "37.5",
"mxSize": "25cm",
"jpSize": "25",
"krSize": "250",
"clSize": "39.5",
"coSize": "38",
"footLength": 250
},
{
"euSize": "39.5",
"ukSize": "6.5",
"usSize": "7.5",
"brSize": "37.5",
"mxSize": "25.5cm",
"jpSize": "25",
"krSize": "250",
"clSize": "39.5",
"coSize": "38",
"footLength": 251
},
{
"euSize": "39.5",
"ukSize": "6.5",
"usSize": "7.5",
"brSize": "37.5",
"mxSize": "25.5cm",
"jpSize": "25",
"krSize": "250",
"clSize": "39.5",
"coSize": "38",
"footLength": 252
},
{
"euSize": "40",
"ukSize": "6.5",
"usSize": "7.5",
"brSize": "38",
"mxSize": "25.5cm",
"jpSize": "25.5",
"krSize": "250",
"clSize": "40",
"coSize": "38.5",
"footLength": 253
},
{
"euSize": "40",
"ukSize": "7",
"usSize": "8",
"brSize": "38",
"mxSize": "25.5cm",
"jpSize": "25.5",
"krSize": "255",
"clSize": "40",
"coSize": "38.5",
"footLength": 254
},
{
"euSize": "40",
"ukSize": "7",
"usSize": "8",
"brSize": "38",
"mxSize": "25.5cm",
"jpSize": "25.5",
"krSize": "255",
"clSize": "40",
"coSize": "39",
"footLength": 255
},
{
"euSize": "40.5",
"ukSize": "7",
"usSize": "8",
"brSize": "38",
"mxSize": "26cm",
"jpSize": "25.5",
"krSize": "255",
"clSize": "40.5",
"coSize": "39",
"footLength": 256
},
{
"euSize": "40.5",
"ukSize": "7",
"usSize": "8",
"brSize": "38.5",
"mxSize": "26cm",
"jpSize": "25.5",
"krSize": "255",
"clSize": "40.5",
"coSize": "39",
"footLength": 257
},
{
"euSize": "40.5",
"ukSize": "7",
"usSize": "8",
"brSize": "38.5",
"mxSize": "26cm",
"jpSize": "26",
"krSize": "255",
"clSize": "40.5",
"coSize": "39.5",
"footLength": 258
},
{
"euSize": "41",
"ukSize": "7.5",
"usSize": "8.5",
"brSize": "38.5",
"mxSize": "26cm",
"jpSize": "26",
"krSize": "260",
"clSize": "41",
"coSize": "39.5",
"footLength": 259
},
{
"euSize": "41",
"ukSize": "7.5",
"usSize": "8.5",
"brSize": "39",
"mxSize": "26cm",
"jpSize": "26",
"krSize": "260",
"clSize": "41",
"coSize": "40",
"footLength": 260
},
{
"euSize": "41",
"ukSize": "7.5",
"usSize": "8.5",
"brSize": "39",
"mxSize": "26.5cm",
"jpSize": "26",
"krSize": "260",
"clSize": "41",
"coSize": "40",
"footLength": 261
},
{
"euSize": "41",
"ukSize": "7.5",
"usSize": "8.5",
"brSize": "39.5",
"mxSize": "26.5cm",
"jpSize": "26",
"krSize": "260",
"clSize": "41",
"coSize": "40",
"footLength": 262
},
{
"euSize": "41.5",
"ukSize": "8",
"usSize": "9",
"brSize": "39.5",
"mxSize": "26.5cm",
"jpSize": "26.5",
"krSize": "260",
"clSize": "41.5",
"coSize": "40.5",
"footLength": 263
},
{
"euSize": "41.5",
"ukSize": "8",
"usSize": "9",
"brSize": "40",
"mxSize": "26.5cm",
"jpSize": "26.5",
"krSize": "265",
"clSize": "41.5",
"coSize": "40.5",
"footLength": 264
},
{
"euSize": "42",
"ukSize": "8",
"usSize": "9",
"brSize": "40",
"mxSize": "26.5cm",
"jpSize": "26.5",
"krSize": "265",
"clSize": "42",
"coSize": "41",
"footLength": 265
},
{
"euSize": "42",
"ukSize": "8",
"usSize": "9",
"brSize": "40",
"mxSize": "27cm",
"jpSize": "26.5",
"krSize": "265",
"clSize": "42",
"coSize": "41",
"footLength": 266
},
{
"euSize": "42.5",
"ukSize": "8.5",
"usSize": "9.5",
"brSize": "40.5",
"mxSize": "27cm",
"jpSize": "26.5",
"krSize": "265",
"clSize": "42.5",
"coSize": "41",
"footLength": 267
},
{
"euSize": "42.5",
"ukSize": "8.5",
"usSize": "9.5",
"brSize": "40.5",
"mxSize": "27cm",
"jpSize": "27",
"krSize": "265",
"clSize": "42.5",
"coSize": "41.5",
"footLength": 268
},
{
"euSize": "42.5",
"ukSize": "8.5",
"usSize": "9.5",
"brSize": "40.5",
"mxSize": "27cm",
"jpSize": "27",
"krSize": "270",
"clSize": "42.5",
"coSize": "41.5",
"footLength": 269
},
{
"euSize": "43",
"ukSize": "8.5",
"usSize": "9.5",
"brSize": "41",
"mxSize": "27cm",
"jpSize": "27",
"krSize": "270",
"clSize": "43",
"coSize": "42",
"footLength": 270
},
{
"euSize": "43",
"ukSize": "9",
"usSize": "10",
"brSize": "41",
"mxSize": "27.5cm",
"jpSize": "27",
"krSize": "270",
"clSize": "43",
"coSize": "42",
"footLength": 271
},
{
"euSize": "43",
"ukSize": "9",
"usSize": "10",
"brSize": "41",
"mxSize": "27.5cm",
"jpSize": "27",
"krSize": "270",
"clSize": "43",
"coSize": "42",
"footLength": 272
},
{
"euSize": "43",
"ukSize": "9",
"usSize": "10",
"brSize": "41",
"mxSize": "27.5cm",
"jpSize": "27.5",
"krSize": "270",
"clSize": "43",
"coSize": "42.5",
"footLength": 273
},
{
"euSize": "43.5",
"ukSize": "9",
"usSize": "10",
"brSize": "41.5",
"mxSize": "27.5cm",
"jpSize": "27.5",
"krSize": "275",
"clSize": "43.5",
"coSize": "42.5",
"footLength": 274
},
{
"euSize": "43.5",
"ukSize": "9.5",
"usSize": "10.5",
"brSize": "41.5",
"mxSize": "27.5cm",
"jpSize": "27.5",
"krSize": "275",
"clSize": "43.5",
"coSize": "43",
"footLength": 275
},
{
"euSize": "43.5",
"ukSize": "9.5",
"usSize": "10.5",
"brSize": "41.5",
"mxSize": "28cm",
"jpSize": "27.5",
"krSize": "275",
"clSize": "43.5",
"coSize": "43",
"footLength": 276
},
{
"euSize": "44",
"ukSize": "9.5",
"usSize": "10.5",
"brSize": "42",
"mxSize": "28cm",
"jpSize": "27.5",
"krSize": "275",
"clSize": "44",
"coSize": "43",
"footLength": 277
},
{
"euSize": "44",
"ukSize": "9.5",
"usSize": "10.5",
"brSize": "42",
"mxSize": "28cm",
"jpSize": "28",
"krSize": "275",
"clSize": "44",
"coSize": "43.5",
"footLength": 278
},
{
"euSize": "44",
"ukSize": "10",
"usSize": "11",
"brSize": "42",
"mxSize": "28cm",
"jpSize": "28",
"krSize": "280",
"clSize": "44",
"coSize": "43.5",
"footLength": 279
},
{
"euSize": "44.5",
"ukSize": "10",
"usSize": "11",
"brSize": "42",
"mxSize": "28cm",
"jpSize": "28",
"krSize": "280",
"clSize": "44.5",
"coSize": "44",
"footLength": 280
},
{
"euSize": "44.5",
"ukSize": "10",
"usSize": "11",
"brSize": "42.5",
"mxSize": "28.5cm",
"jpSize": "28",
"krSize": "280",
"clSize": "44.5",
"coSize": "44",
"footLength": 281
},
{
"euSize": "44.5",
"ukSize": "10",
"usSize": "11",
"brSize": "42.5",
"mxSize": "28.5cm",
"jpSize": "28",
"krSize": "280",
"clSize": "44.5",
"coSize": "44",
"footLength": 282
},
{
"euSize": "44.5",
"ukSize": "10",
"usSize": "11",
"brSize": "42.5",
"mxSize": "28.5cm",
"jpSize": "28.5",
"krSize": "280",
"clSize": "44.5",
"coSize": "44.5",
"footLength": 283
},
{
"euSize": "45",
"ukSize": "10.5",
"usSize": "11.5",
"brSize": "43",
"mxSize": "28.5cm",
"jpSize": "28.5",
"krSize": "285",
"clSize": "45",
"coSize": "44.5",
"footLength": 284
},
{
"euSize": "45",
"ukSize": "10.5",
"usSize": "11.5",
"brSize": "43",
"mxSize": "28.5cm",
"jpSize": "28.5",
"krSize": "285",
"clSize": "45",
"coSize": "45",
"footLength": 285
},
{
"euSize": "45",
"ukSize": "10.5",
"usSize": "11.5",
"brSize": "43",
"mxSize": "29cm",
"jpSize": "28.5",
"krSize": "285",
"clSize": "45",
"coSize": "45",
"footLength": 286
},
{
"euSize": "45",
"ukSize": "10.5",
"usSize": "11.5",
"brSize": "43.5",
"mxSize": "29cm",
"jpSize": "28.5",
"krSize": "285",
"clSize": "45",
"coSize": "45",
"footLength": 287
},
{
"euSize": "45.5",
"ukSize": "11",
"usSize": "12",
"brSize": "43.5",
"mxSize": "29cm",
"jpSize": "29",
"krSize": "285",
"clSize": "45.5",
"coSize": "45.5",
"footLength": 288
},
{
"euSize": "45.5",
"ukSize": "11",
"usSize": "12",
"brSize": "43.5",
"mxSize": "29cm",
"jpSize": "29",
"krSize": "290",
"clSize": "45.5",
"coSize": "45.5",
"footLength": 289
},
{
"euSize": "46",
"ukSize": "11",
"usSize": "12",
"brSize": "44",
"mxSize": "29cm",
"jpSize": "29",
"krSize": "290",
"clSize": "46",
"coSize": "46",
"footLength": 290
},
{
"euSize": "46",
"ukSize": "11",
"usSize": "12",
"brSize": "44",
"mxSize": "29.5cm",
"jpSize": "29",
"krSize": "290",
"clSize": "46",
"coSize": "46",
"footLength": 291
},
{
"euSize": "46",
"ukSize": "11.5",
"usSize": "12.5",
"brSize": "44",
"mxSize": "29.5cm",
"jpSize": "29",
"krSize": "290",
"clSize": "46",
"coSize": "46",
"footLength": 292
},
{
"euSize": "46",
"ukSize": "11.5",
"usSize": "12.5",
"brSize": "44.5",
"mxSize": "29.5cm",
"jpSize": "29.5",
"krSize": "290",
"clSize": "46",
"coSize": "46.5",
"footLength": 293
},
{
"euSize": "46.5",
"ukSize": "11.5",
"usSize": "12.5",
"brSize": "44.5",
"mxSize": "29.5cm",
"jpSize": "29.5",
"krSize": "295",
"clSize": "46.5",
"coSize": "46.5",
"footLength": 294
},
{
"euSize": "46.5",
"ukSize": "11.5",
"usSize": "12.5",
"brSize": "44.5",
"mxSize": "29.5cm",
"jpSize": "29.5",
"krSize": "295",
"clSize": "46.5",
"coSize": "47",
"footLength": 295
},
{
"euSize": "46.5",
"ukSize": "12",
"usSize": "13",
"brSize": "44.5",
"mxSize": "30cm",
"jpSize": "29.5",
"krSize": "295",
"clSize": "46.5",
"coSize": "47",
"footLength": 296
},
{
"euSize": "47",
"ukSize": "12",
"usSize": "13",
"brSize": "45",
"mxSize": "30cm",
"jpSize": "29.5",
"krSize": "295",
"clSize": "47",
"coSize": "47",
"footLength": 297
},
{
"euSize": "47",
"ukSize": "12",
"usSize": "13",
"brSize": "45",
"mxSize": "30cm",
"jpSize": "30",
"krSize": "295",
"clSize": "47",
"coSize": "47.5",
"footLength": 298
},
{
"euSize": "47",
"ukSize": "12",
"usSize": "13",
"brSize": "45",
"mxSize": "30cm",
"jpSize": "30",
"krSize": "300",
"clSize": "47",
"coSize": "47.5",
"footLength": 299
},
{
"euSize": "47",
"ukSize": "12.5",
"usSize": "13.5",
"brSize": "45",
"mxSize": "30cm",
"jpSize": "30",
"krSize": "300",
"clSize": "47",
"coSize": "48",
"footLength": 300
},
{
"euSize": "47.5",
"ukSize": "12.5",
"usSize": "13.5",
"brSize": "45.5",
"mxSize": "30.5cm",
"jpSize": "30",
"krSize": "300",
"clSize": "47.5",
"coSize": "48",
"footLength": 301
},
{
"euSize": "47.5",
"ukSize": "12.5",
"usSize": "13.5",
"brSize": "45.5",
"mxSize": "30.5cm",
"jpSize": "30",
"krSize": "300",
"clSize": "47.5",
"coSize": "48",
"footLength": 302
},
{
"euSize": "47.5",
"ukSize": "12.5",
"usSize": "13.5",
"brSize": "45.5",
"mxSize": "30.5cm",
"jpSize": "30.5",
"krSize": "300",
"clSize": "47.5",
"coSize": "48.5",
"footLength": 303
},
{
"euSize": "47.5",
"ukSize": "12.5",
"usSize": "13.5",
"brSize": "45.5",
"mxSize": "30.5cm",
"jpSize": "30.5",
"krSize": "305",
"clSize": "47.5",
"coSize": "48.5",
"footLength": 304
},
{
"euSize": "47.5",
"ukSize": "13",
"usSize": "14",
"brSize": "46",
"mxSize": "30.5cm",
"jpSize": "30.5",
"krSize": "305",
"clSize": "47.5",
"coSize": "49",
"footLength": 305
},
{
"euSize": "48",
"ukSize": "13",
"usSize": "14",
"brSize": "46",
"mxSize": "31cm",
"jpSize": "30.5",
"krSize": "305",
"clSize": "48",
"coSize": "49",
"footLength": 306
},
{
"euSize": "48",
"ukSize": "13",
"usSize": "14",
"brSize": "46",
"mxSize": "31cm",
"jpSize": "30.5",
"krSize": "305",
"clSize": "48",
"coSize": "49",
"footLength": 307
},
{
"euSize": "48",
"ukSize": "13",
"usSize": "14",
"brSize": "46",
"mxSize": "31cm",
"jpSize": "31",
"krSize": "305",
"clSize": "48",
"coSize": "49.5",
"footLength": 308
},
{
"euSize": "48",
"ukSize": "13.5",
"usSize": "14.5",
"brSize": "46.5",
"mxSize": "31cm",
"jpSize": "31",
"krSize": "310",
"clSize": "48",
"coSize": "49.5",
"footLength": 309
},
{
"euSize": "48.5",
"ukSize": "13.5",
"usSize": "14.5",
"brSize": "46.5",
"mxSize": "31cm",
"jpSize": "31",
"krSize": "310",
"clSize": "48.5",
"coSize": "50",
"footLength": 310
},
{
"euSize": "48.5",
"ukSize": "13.5",
"usSize": "14.5",
"brSize": "46.5",
"mxSize": "31.5cm",
"jpSize": "31",
"krSize": "310",
"clSize": "48.5",
"coSize": "50",
"footLength": 311
},
{
"euSize": "48.5",
"ukSize": "13.5",
"usSize": "14.5",
"brSize": "46.5",
"mxSize": "31.5cm",
"jpSize": "31",
"krSize": "310",
"clSize": "48.5",
"coSize": "50",
"footLength": 312
},
{
"euSize": "48.5",
"ukSize": "14",
"usSize": "15",
"brSize": "47",
"mxSize": "31.5cm",
"jpSize": "31.5",
"krSize": "310",
"clSize": "48.5",
"coSize": "50.5",
"footLength": 313
},
{
"euSize": "49",
"ukSize": "14",
"usSize": "15",
"brSize": "47",
"mxSize": "31.5cm",
"jpSize": "31.5",
"krSize": "315",
"clSize": "49",
"coSize": "50.5",
"footLength": 314
},
{
"euSize": "49",
"ukSize": "14",
"usSize": "15",
"brSize": "47",
"mxSize": "31.5cm",
"jpSize": "31.5",
"krSize": "315",
"clSize": "49",
"coSize": "51",
"footLength": 315
},
{
"euSize": "49.5",
"ukSize": "14",
"usSize": "15",
"brSize": "47.5",
"mxSize": "32cm",
"jpSize": "31.5",
"krSize": "315",
"clSize": "49.5",
"coSize": "51",
"footLength": 316
},
{
"euSize": "49.5",
"ukSize": "14.5",
"usSize": "15.5",
"brSize": "47.5",
"mxSize": "32cm",
"jpSize": "31.5",
"krSize": "315",
"clSize": "49.5",
"coSize": "51",
"footLength": 317
},
{
"euSize": "50",
"ukSize": "14.5",
"usSize": "15.5",
"brSize": "48",
"mxSize": "32cm",
"jpSize": "32",
"krSize": "315",
"clSize": "50",
"coSize": "51.5",
"footLength": 318
},
{
"euSize": "50",
"ukSize": "14.5",
"usSize": "15.5",
"brSize": "48",
"mxSize": "32cm",
"jpSize": "32",
"krSize": "320",
"clSize": "50",
"coSize": "51.5",
"footLength": 319
},
{
"euSize": "50.5",
"ukSize": "14.5",
"usSize": "15.5",
"brSize": "48",
"mxSize": "32cm",
"jpSize": "32",
"krSize": "320",
"clSize": "50.5",
"coSize": "52",
"footLength": 320
},
{
"euSize": "50.5",
"ukSize": "15",
"usSize": "16",
"brSize": "48.5",
"mxSize": "32.5cm",
"jpSize": "32",
"krSize": "320",
"clSize": "50.5",
"coSize": "52",
"footLength": 321
},
{
"euSize": "50.5",
"ukSize": "15",
"usSize": "16",
"brSize": "48.5",
"mxSize": "32.5cm",
"jpSize": "32",
"krSize": "320",
"clSize": "50.5",
"coSize": "52",
"footLength": 322
},
{
"euSize": "51",
"ukSize": "15",
"usSize": "16",
"brSize": "48.5",
"mxSize": "32.5cm",
"jpSize": "32.5",
"krSize": "320",
"clSize": "51",
"coSize": "52.5",
"footLength": 323
},
{
"euSize": "51",
"ukSize": "15",
"usSize": "16",
"brSize": "49",
"mxSize": "32.5cm",
"jpSize": "32.5",
"krSize": "325",
"clSize": "51",
"coSize": "52.5",
"footLength": 324
},
{
"euSize": "51",
"ukSize": "15",
"usSize": "16",
"brSize": "49",
"mxSize": "32.5cm",
"jpSize": "32.5",
"krSize": "325",
"clSize": "51",
"coSize": "53",
"footLength": 325
},
{
"euSize": "51",
"ukSize": "15.5",
"usSize": "16.5",
"brSize": "49",
"mxSize": "33cm",
"jpSize": "32.5",
"krSize": "325",
"clSize": "51",
"coSize": "53",
"footLength": 326
},
{
"euSize": "51.5",
"ukSize": "15.5",
"usSize": "16.5",
"brSize": "49.5",
"mxSize": "33cm",
"jpSize": "32.5",
"krSize": "325",
"clSize": "51.5",
"coSize": "53",
"footLength": 327
},
{
"euSize": "51.5",
"ukSize": "15.5",
"usSize": "16.5",
"brSize": "49.5",
"mxSize": "33cm",
"jpSize": "33",
"krSize": "325",
"clSize": "51.5",
"coSize": "53.5",
"footLength": 328
},
{
"euSize": "51.5",
"ukSize": "15.5",
"usSize": "16.5",
"brSize": "49.5",
"mxSize": "33cm",
"jpSize": "33",
"krSize": "330",
"clSize": "51.5",
"coSize": "53.5",
"footLength": 329
},
{
"euSize": "52",
"ukSize": "16",
"usSize": "17",
"brSize": "50",
"mxSize": "33cm",
"jpSize": "33",
"krSize": "330",
"clSize": "52",
"coSize": "54",
"footLength": 330
},
{
"euSize": "52",
"ukSize": "16",
"usSize": "17",
"brSize": "50",
"mxSize": "33.5cm",
"jpSize": "33",
"krSize": "330",
"clSize": "52",
"coSize": "54",
"footLength": 331
},
{
"euSize": "52",
"ukSize": "16",
"usSize": "17",
"brSize": "50",
"mxSize": "33.5cm",
"jpSize": "33",
"krSize": "330",
"clSize": "52",
"coSize": "54",
"footLength": 332
},
{
"euSize": "52.5",
"ukSize": "16",
"usSize": "17",
"brSize": "50.5",
"mxSize": "33.5cm",
"jpSize": "33.5",
"krSize": "330",
"clSize": "52.5",
"coSize": "54.5",
"footLength": 333
},
{
"euSize": "52.5",
"ukSize": "16.5",
"usSize": "17.5",
"brSize": "50.5",
"mxSize": "33.5cm",
"jpSize": "33.5",
"krSize": "335",
"clSize": "52.5",
"coSize": "54.5",
"footLength": 334
},
{
"euSize": "52.5",
"ukSize": "16.5",
"usSize": "17.5",
"brSize": "51",
"mxSize": "33.5cm",
"jpSize": "33.5",
"krSize": "335",
"clSize": "52.5",
"coSize": "55",
"footLength": 335
},
{
"euSize": "53",
"ukSize": "16.5",
"usSize": "17.5",
"brSize": "51",
"mxSize": "34cm",
"jpSize": "33.5",
"krSize": "335",
"clSize": "53",
"coSize": "55",
"footLength": 336
},
{
"euSize": "53",
"ukSize": "16.5",
"usSize": "17.5",
"brSize": "51",
"mxSize": "34cm",
"jpSize": "33.5",
"krSize": "335",
"clSize": "53",
"coSize": "55",
"footLength": 337
},
{
"euSize": "53.5",
"ukSize": "17",
"usSize": "18",
"brSize": "51.5",
"mxSize": "34cm",
"jpSize": "34",
"krSize": "335",
"clSize": "53.5",
"coSize": "55.5",
"footLength": 338
},
{
"euSize": "53.5",
"ukSize": "17",
"usSize": "18",
"brSize": "51.5",
"mxSize": "34cm",
"jpSize": "34",
"krSize": "340",
"clSize": "53.5",
"coSize": "55.5",
"footLength": 339
},
{
"euSize": "54",
"ukSize": "17",
"usSize": "18",
"brSize": "52",
"mxSize": "34cm",
"jpSize": "34",
"krSize": "340",
"clSize": "54",
"coSize": "56",
"footLength": 340
},
{
"euSize": "54",
"ukSize": "17",
"usSize": "18",
"brSize": "52",
"mxSize": "34.5cm",
"jpSize": "34",
"krSize": "340",
"clSize": "54",
"coSize": "56",
"footLength": 341
},
{
"euSize": "54",
"ukSize": "17.5",
"usSize": "18.5",
"brSize": "52",
"mxSize": "34.5cm",
"jpSize": "34",
"krSize": "340",
"clSize": "54",
"coSize": "56",
"footLength": 342
},
{
"euSize": "54",
"ukSize": "17.5",
"usSize": "18.5",
"brSize": "52",
"mxSize": "34.5cm",
"jpSize": "34.5",
"krSize": "340",
"clSize": "54",
"coSize": "56.5",
"footLength": 343
}
]

## 女童鞋
[{
"euSize": "16",
"ukSize": "0.5 Infant",
"usSize": "1 Infant",
"brSize": "13",
"mxSize": "9cm",
"jpSize": "9cm",
"krSize": "90",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 91
},
{
"euSize": "16",
"ukSize": "0.5 Infant",
"usSize": "1 Infant",
"brSize": "13.5",
"mxSize": "9cm",
"jpSize": "9cm",
"krSize": "90",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 92
},
{
"euSize": "16",
"ukSize": "0.5 Infant",
"usSize": "1 Infant",
"brSize": "13.5",
"mxSize": "9cm",
"jpSize": "9cm",
"krSize": "90",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 93
},
{
"euSize": "16",
"ukSize": "0.5 Infant",
"usSize": "1 Infant",
"brSize": "14",
"mxSize": "9.5cm",
"jpSize": "9.5cm",
"krSize": "95",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 94
},
{
"euSize": "16.5",
"ukSize": "0.5 Infant",
"usSize": "1 Infant",
"brSize": "14",
"mxSize": "9.5cm",
"jpSize": "9.5cm",
"krSize": "95",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 95
},
{
"euSize": "16.5",
"ukSize": "1 Infant",
"usSize": "1 Infant",
"brSize": "14.5",
"mxSize": "9.5cm",
"jpSize": "9.5cm",
"krSize": "95",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 96
},
{
"euSize": "16.5",
"ukSize": "1 Infant",
"usSize": "1.5 Infant",
"brSize": "14.5",
"mxSize": "9.5cm",
"jpSize": "9.5cm",
"krSize": "95",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 97
},
{
"euSize": "16.5",
"ukSize": "1 Infant",
"usSize": "1.5 Infant",
"brSize": "15",
"mxSize": "9.5cm",
"jpSize": "9.5cm",
"krSize": "95",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 98
},
{
"euSize": "17",
"ukSize": "1 Infant",
"usSize": "1.5 Infant",
"brSize": "15",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 99
},
{
"euSize": "17",
"ukSize": "1.5 Infant",
"usSize": "2 Infant",
"brSize": "15.5",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 100
},
{
"euSize": "17",
"ukSize": "1.5 Infant",
"usSize": "2 Infant",
"brSize": "15.5",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 101
},
{
"euSize": "17",
"ukSize": "1.5 Infant",
"usSize": "2 Infant",
"brSize": "15.5",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 102
},
{
"euSize": "17.5",
"ukSize": "2 Infant",
"usSize": "2 Infant",
"brSize": "16",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 103
},
{
"euSize": "17.5",
"ukSize": "2 Infant",
"usSize": "2.5 Infant",
"brSize": "16",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 104
},
{
"euSize": "17.5",
"ukSize": "2 Infant",
"usSize": "2.5 Infant",
"brSize": "16",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 105
},
{
"euSize": "18",
"ukSize": "2 Infant",
"usSize": "2.5 Infant",
"brSize": "16..5",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 106
},
{
"euSize": "18",
"ukSize": "2.5 Infant",
"usSize": "3 Infant",
"brSize": "16.5",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 107
},
{
"euSize": "18.5",
"ukSize": "2.5 Infant",
"usSize": "3 Infant",
"brSize": "16.5",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 108
},
{
"euSize": "18.5",
"ukSize": "2.5 Infant",
"usSize": "3 Infant",
"brSize": "17",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 109
},
{
"euSize": "18.5",
"ukSize": "2.5 Infant",
"usSize": "3 Infant",
"brSize": "17",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 110
},
{
"euSize": "18.5",
"ukSize": "3 Toddler",
"usSize": "3 Infant",
"brSize": "17",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 111
},
{
"euSize": "19",
"ukSize": "3 Toddler",
"usSize": "3 Infant",
"brSize": "17.5",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 112
},
{
"euSize": "19",
"ukSize": "3 Toddler",
"usSize": "3.5 Toddler",
"brSize": "17.5",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "7-12M",
"footLength": 113
},
{
"euSize": "19",
"ukSize": "3 Toddler",
"usSize": "3.5 Toddler",
"brSize": "17.5",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 114
},
{
"euSize": "19.5",
"ukSize": "3.5 Toddler",
"usSize": "3.5 Toddler",
"brSize": "18",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 115
},
{
"euSize": "19.5",
"ukSize": "3.5 Toddler",
"usSize": "3.5 Toddler",
"brSize": "18",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 116
},
{
"euSize": "19.5",
"ukSize": "3.5 Toddler",
"usSize": "4 Toddler",
"brSize": "18",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 117
},
{
"euSize": "19.5",
"ukSize": "3.5 Toddler",
"usSize": "4 Toddler",
"brSize": "18.5",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 118
},
{
"euSize": "20",
"ukSize": "3.5 Toddler",
"usSize": "4 Toddler",
"brSize": "18.5",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 119
},
{
"euSize": "20",
"ukSize": "4 Toddler",
"usSize": "4 Toddler",
"brSize": "18.5",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 120
},
{
"euSize": "20",
"ukSize": "4 Toddler",
"usSize": "4.5 Toddler",
"brSize": "18.5",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 121
},
{
"euSize": "20.5",
"ukSize": "4 Toddler",
"usSize": "4.5 Toddler",
"brSize": "19",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 122
},
{
"euSize": "20.5",
"ukSize": "4 Toddler",
"usSize": "4.5 Toddler",
"brSize": "19",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 123
},
{
"euSize": "20.5",
"ukSize": "4.5 Toddler",
"usSize": "5 Toddler",
"brSize": "19",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 124
},
{
"euSize": "21",
"ukSize": "4.5 Toddler",
"usSize": "5 Toddler",
"brSize": "19.5",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 125
},
{
"euSize": "21",
"ukSize": "4.5 Toddler",
"usSize": "5 Toddler",
"brSize": "19.5",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 126
},
{
"euSize": "21",
"ukSize": "4.5 Toddler",
"usSize": "5 Toddler",
"brSize": "19.5",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 127
},
{
"euSize": "21.5",
"ukSize": "5 Toddler",
"usSize": "5.5 Toddler",
"brSize": "20",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 128
},
{
"euSize": "21.5",
"ukSize": "5 Toddler",
"usSize": "5.5 Toddler",
"brSize": "20",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 129
},
{
"euSize": "21.5",
"ukSize": "5 Toddler",
"usSize": "5.5 Toddler",
"brSize": "20",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 130
},
{
"euSize": "22",
"ukSize": "5 Toddler",
"usSize": "5.5 Toddler",
"brSize": "20.5",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 131
},
{
"euSize": "22",
"ukSize": "5.5 Toddler",
"usSize": "6 Toddler",
"brSize": "20.5",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 132
},
{
"euSize": "22",
"ukSize": "5.5 Toddler",
"usSize": "6 Toddler",
"brSize": "20.5",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 133
},
{
"euSize": "22.5",
"ukSize": "5.5 Toddler",
"usSize": "6 Toddler",
"brSize": "21",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 134
},
{
"euSize": "22.5",
"ukSize": "5.5 Toddler",
"usSize": "6 Toddler",
"brSize": "21",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 135
},
{
"euSize": "22.5",
"ukSize": "5.5 Toddler",
"usSize": "6 Toddler",
"brSize": "21",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 136
},
{
"euSize": "23",
"ukSize": "6 Toddler",
"usSize": "6.5 Toddler",
"brSize": "21.5",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 137
},
{
"euSize": "23",
"ukSize": "6 Toddler",
"usSize": "6.5 Toddler",
"brSize": "21.5",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 138
},
{
"euSize": "23",
"ukSize": "6 Toddler",
"usSize": "6.5 Toddler",
"brSize": "21.5",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 139
},
{
"euSize": "23",
"ukSize": "6 Toddler",
"usSize": "6.5 Toddler",
"brSize": "22",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 140
},
{
"euSize": "23.5",
"ukSize": "6.5 Toddler",
"usSize": "7 Toddler",
"brSize": "22",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 141
},
{
"euSize": "23.5",
"ukSize": "6.5 Toddler",
"usSize": "7 Toddler",
"brSize": "22",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 142
},
{
"euSize": "23.5",
"ukSize": "6.5 Toddler",
"usSize": "7 Toddler",
"brSize": "22.5",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 143
},
{
"euSize": "23.5",
"ukSize": "6.5 Toddler",
"usSize": "7 Toddler",
"brSize": "22.5",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 144
},
{
"euSize": "24",
"ukSize": "6.5 Toddler",
"usSize": "7 Toddler",
"brSize": "22.5",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 145
},
{
"euSize": "24",
"ukSize": "7 Toddler",
"usSize": "7.5 Toddler",
"brSize": "22.5",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 146
},
{
"euSize": "24",
"ukSize": "7 Toddler",
"usSize": "7.5 Toddler",
"brSize": "23",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 147
},
{
"euSize": "24",
"ukSize": "7 Toddler",
"usSize": "7.5 Toddler",
"brSize": "23",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 148
},
{
"euSize": "24.5",
"ukSize": "7 Toddler",
"usSize": "7.5 Toddler",
"brSize": "23",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 149
},
{
"euSize": "24.5",
"ukSize": "7 Toddler",
"usSize": "7.5 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 150
},
{
"euSize": "24.5",
"ukSize": "7.5 Toddler",
"usSize": "8 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 151
},
{
"euSize": "25",
"ukSize": "7.5 Toddler",
"usSize": "8 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 152
},
{
"euSize": "25",
"ukSize": "7.5 Toddler",
"usSize": "8 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 153
},
{
"euSize": "25",
"ukSize": "7.5 Toddler",
"usSize": "8 Toddler",
"brSize": "24",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 154
},
{
"euSize": "25.5",
"ukSize": "7.5 Toddler",
"usSize": "8 Toddler",
"brSize": "24",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 155
},
{
"euSize": "25.5",
"ukSize": "8 Toddler",
"usSize": "8.5 Toddler",
"brSize": "24",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 156
},
{
"euSize": "25.5",
"ukSize": "8 Toddler",
"usSize": "8.5 Toddler",
"brSize": "24.5",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 157
},
{
"euSize": "26",
"ukSize": "8 Toddler",
"usSize": "8.5 Toddler",
"brSize": "24.5",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 158
},
{
"euSize": "26",
"ukSize": "8 Toddler",
"usSize": "8.5 Toddler",
"brSize": "24.5",
"mxSize": "16cm",
"jpSize": "16cm",
"krSize": "160",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 159
},
{
"euSize": "26",
"ukSize": "8.5 Toddler",
"usSize": "9 Toddler",
"brSize": "24.5",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "160",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 160
},
{
"euSize": "26",
"ukSize": "8.5 Toddler",
"usSize": "9 Toddler",
"brSize": "25",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "160",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 161
},
{
"euSize": "26.5",
"ukSize": "8.5 Toddler",
"usSize": "9 Toddler",
"brSize": "25",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 162
},
{
"euSize": "26.5",
"ukSize": "8.5 Toddler",
"usSize": "9 Toddler",
"brSize": "25",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 163
},
{
"euSize": "26.5",
"ukSize": "8.5 Toddler",
"usSize": "9 Toddler",
"brSize": "25",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 164
},
{
"euSize": "26.5",
"ukSize": "9 Little Kid",
"usSize": "9.5 Little Kid",
"brSize": "25.5",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "4-7Y",
"footLength": 165
},
{
"euSize": "26.5",
"ukSize": "9 Little Kid",
"usSize": "9.5 Little Kid",
"brSize": "25.5",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "165",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "4-7Y",
"footLength": 166
},
{
"euSize": "27",
"ukSize": "9 Little Kid",
"usSize": "9.5 Little Kid",
"brSize": "25.5",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 167
},
{
"euSize": "27",
"ukSize": "9 Little Kid",
"usSize": "9.5 Little Kid",
"brSize": "25.5",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 168
},
{
"euSize": "27",
"ukSize": "9.5 Little Kid",
"usSize": "10 Little Kid",
"brSize": "26",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 169
},
{
"euSize": "27.5",
"ukSize": "9.5 Little Kid",
"usSize": "10 Little Kid",
"brSize": "26",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 170
},
{
"euSize": "27.5",
"ukSize": "9.5 Little Kid",
"usSize": "10 Little Kid",
"brSize": "26",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 171
},
{
"euSize": "27.5",
"ukSize": "9.5 Little Kid",
"usSize": "10 Little Kid",
"brSize": "26.5",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 172
},
{
"euSize": "28",
"ukSize": "9.5 Little Kid",
"usSize": "10 Little Kid",
"brSize": "26.5",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 173
},
{
"euSize": "28",
"ukSize": "10 Little Kid",
"usSize": "10.5 Little Kid",
"brSize": "26.5",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 174
},
{
"euSize": "28",
"ukSize": "10 Little Kid",
"usSize": "10.5 Little Kid",
"brSize": "27",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 175
},
{
"euSize": "28",
"ukSize": "10 Little Kid",
"usSize": "10.5 Little Kid",
"brSize": "27",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 176
},
{
"euSize": "28.5",
"ukSize": "10 Little Kid",
"usSize": "10.5 Little Kid",
"brSize": "27",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 177
},
{
"euSize": "28.5",
"ukSize": "10.5 Little Kid",
"usSize": "11 Little Kid",
"brSize": "27",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 178
},
{
"euSize": "28.5",
"ukSize": "10.5 Little Kid",
"usSize": "11 Little Kid",
"brSize": "27.5",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 179
},
{
"euSize": "29",
"ukSize": "10.5 Little Kid",
"usSize": "11 Little Kid",
"brSize": "27.5",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 180
},
{
"euSize": "29",
"ukSize": "11 Little Kid",
"usSize": "11.5 Little Kid",
"brSize": "27.5",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 181
},
{
"euSize": "29",
"ukSize": "11 Little Kid",
"usSize": "11.5 Little Kid",
"brSize": "28",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 182
},
{
"euSize": "29",
"ukSize": "11 Little Kid",
"usSize": "11.5 Little Kid",
"brSize": "28",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 183
},
{
"euSize": "29.5",
"ukSize": "11 Little Kid",
"usSize": "11.5 Little Kid",
"brSize": "28",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 184
},
{
"euSize": "29.5",
"ukSize": "11.5 Little Kid",
"usSize": "12 Little Kid",
"brSize": "28.5",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 185
},
{
"euSize": "29.5",
"ukSize": "11.5 Little Kid",
"usSize": "12 Little Kid",
"brSize": "28.5",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 186
},
{
"euSize": "30",
"ukSize": "11.5 Little Kid",
"usSize": "12 Little Kid",
"brSize": "28.5",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 187
},
{
"euSize": "30",
"ukSize": "11.5 Little Kid",
"usSize": "12 Little Kid",
"brSize": "28.5",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 188
},
{
"euSize": "30",
"ukSize": "12 Little Kid",
"usSize": "12.5 Little Kid",
"brSize": "29",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 189
},
{
"euSize": "30.5",
"ukSize": "12 Little Kid",
"usSize": "12.5 Little Kid",
"brSize": "29",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 190
},
{
"euSize": "30.5",
"ukSize": "12 Little Kid",
"usSize": "12.5 Little Kid",
"brSize": "29",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 191
},
{
"euSize": "30.5",
"ukSize": "12 Little Kid",
"usSize": "12.5 Little Kid",
"brSize": "29.5",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 192
},
{
"euSize": "31",
"ukSize": "12 Little Kid",
"usSize": "12.5 Little Kid",
"brSize": "29.5",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 193
},
{
"euSize": "31",
"ukSize": "12.5 Little Kid",
"usSize": "13 Little Kid",
"brSize": "29.5",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 194
},
{
"euSize": "31.5",
"ukSize": "12.5 Little Kid",
"usSize": "13 Little Kid",
"brSize": "30",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 195
},
{
"euSize": "31.5",
"ukSize": "12.5 Little Kid",
"usSize": "13 Little Kid",
"brSize": "30",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 196
},
{
"euSize": "31.5",
"ukSize": "12.5 Little Kid",
"usSize": "13 Little Kid",
"brSize": "30",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 197
},
{
"euSize": "32",
"ukSize": "13 Little Kid",
"usSize": "13.5 Little Kid",
"brSize": "30",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 198
},
{
"euSize": "32",
"ukSize": "13 Little Kid",
"usSize": "13.5 Little Kid",
"brSize": "30.5",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 199
},
{
"euSize": "32",
"ukSize": "13 Little Kid",
"usSize": "13.5 Little Kid",
"brSize": "30.5",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 200
},
{
"euSize": "32",
"ukSize": "13 Little Kid",
"usSize": "13.5 Little Kid",
"brSize": "30.5",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 201
},
{
"euSize": "32.5",
"ukSize": "13.5 Little Kid",
"usSize": "1 Big Kid",
"brSize": "31",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 202
},
{
"euSize": "32.5",
"ukSize": "13.5 Little Kid",
"usSize": "1 Big Kid",
"brSize": "31",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 203
},
{
"euSize": "33",
"ukSize": "13.5 Little Kid",
"usSize": "1 Big Kid",
"brSize": "31",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 204
},
{
"euSize": "33",
"ukSize": "13.5 Little Kid",
"usSize": "1 Big Kid",
"brSize": "31.5",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "8-12Y",
"footLength": 205
},
{
"euSize": "33",
"ukSize": "1 Big Kid",
"usSize": "1.5 Big Kid",
"brSize": "31.5",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "8-12Y",
"footLength": 206
},
{
"euSize": "33.5",
"ukSize": "1 Big Kid",
"usSize": "1.5 Big Kid",
"brSize": "31.5",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 207
},
{
"euSize": "33.5",
"ukSize": "1 Big Kid",
"usSize": "1.5 Big Kid",
"brSize": "32",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 208
},
{
"euSize": "33.5",
"ukSize": "1 Big Kid",
"usSize": "2 Big Kid",
"brSize": "32",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 209
},
{
"euSize": "34",
"ukSize": "1.5 Big Kid",
"usSize": "2 Big Kid",
"brSize": "32.5",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 210
},
{
"euSize": "34",
"ukSize": "1.5 Big Kid",
"usSize": "2 Big Kid",
"brSize": "32.5",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 211
},
{
"euSize": "34",
"ukSize": "1.5 Big Kid",
"usSize": "2 Big Kid",
"brSize": "32.5",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 212
},
{
"euSize": "34",
"ukSize": "1.5 Big Kid",
"usSize": "2.5 Big Kid",
"brSize": "33",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 213
},
{
"euSize": "34.5",
"ukSize": "1.5 Big Kid",
"usSize": "2.5 Big Kid",
"brSize": "33",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 214
},
{
"euSize": "34.5",
"ukSize": "2 Big Kid",
"usSize": "2.5 Big Kid",
"brSize": "33",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 215
},
{
"euSize": "34.5",
"ukSize": "2 Big Kid",
"usSize": "3 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 216
},
{
"euSize": "35",
"ukSize": "2 Big Kid",
"usSize": "3 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 217
},
{
"euSize": "35",
"ukSize": "2 Big Kid",
"usSize": "3 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 218
},
{
"euSize": "35",
"ukSize": "2.5 Big Kid",
"usSize": "3 Big Kid",
"brSize": "33.5",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 219
},
{
"euSize": "35.5",
"ukSize": "2.5 Big Kid",
"usSize": "3.5 Big Kid",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 220
},
{
"euSize": "35.5",
"ukSize": "2.5 Big Kid",
"usSize": "3.5 Big Kid",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 221
},
{
"euSize": "35.5",
"ukSize": "3 Big Kid",
"usSize": "3.5 Big Kid",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 222
},
{
"euSize": "35.5",
"ukSize": "3 Big Kid",
"usSize": "4 Big Kid",
"brSize": "34.5",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 223
},
{
"euSize": "36",
"ukSize": "3 Big Kid",
"usSize": "4 Big Kid",
"brSize": "34.5",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 224
},
{
"euSize": "36",
"ukSize": "3.5 Big Kid",
"usSize": "4 Big Kid",
"brSize": "34.5",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 225
},
{
"euSize": "36",
"ukSize": "3.5 Big Kid",
"usSize": "4.5 Big Kid",
"brSize": "34.5",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 226
},
{
"euSize": "36",
"ukSize": "3.5 Big Kid",
"usSize": "4.5 Big Kid",
"brSize": "35",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 227
},
{
"euSize": "36.5",
"ukSize": "3.5 Big Kid",
"usSize": "4.5 Big Kid",
"brSize": "35",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 228
},
{
"euSize": "36.5",
"ukSize": "4 Big Kid",
"usSize": "4.5 Big Kid",
"brSize": "35",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 229
},
{
"euSize": "36.5",
"ukSize": "4 Big Kid",
"usSize": "5 Big Kid",
"brSize": "35",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 230
},
{
"euSize": "36.5",
"ukSize": "4 Big Kid",
"usSize": "5 Big Kid",
"brSize": "35.5",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 231
},
{
"euSize": "37",
"ukSize": "4 Big Kid",
"usSize": "5 Big Kid",
"brSize": "35.5",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 232
},
{
"euSize": "37",
"ukSize": "4.5 Big Kid",
"usSize": "5.5 Big Kid",
"brSize": "35.5",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 233
},
{
"euSize": "37",
"ukSize": "4.5 Big Kid",
"usSize": "5.5 Big Kid",
"brSize": "36",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 234
},
{
"euSize": "37.5",
"ukSize": "4.5 Big Kid",
"usSize": "5.5 Big Kid",
"brSize": "36",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 235
},
{
"euSize": "37.5",
"ukSize": "5 Big Kid",
"usSize": "6 Big Kid",
"brSize": "36",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 236
},
{
"euSize": "37.5",
"ukSize": "5 Big Kid",
"usSize": "6 Big Kid",
"brSize": "36.5",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 237
},
{
"euSize": "38",
"ukSize": "5 Big Kid",
"usSize": "6 Big Kid",
"brSize": "36.5",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 238
},
{
"euSize": "38",
"ukSize": "5 Big Kid",
"usSize": "6.5 Big Kid",
"brSize": "37",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 239
},
{
"euSize": "38",
"ukSize": "5.5 Big Kid",
"usSize": "6.5 Big Kid",
"brSize": "37",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 240
},
{
"euSize": "38.5",
"ukSize": "5.5 Big Kid",
"usSize": "6.5 Big Kid",
"brSize": "37",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 241
},
{
"euSize": "38.5",
"ukSize": "5.5 Big Kid",
"usSize": "6.5 Big Kid",
"brSize": "37.5",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 242
},
{
"euSize": "39",
"ukSize": "6 Big Kid",
"usSize": "7 Big Kid",
"brSize": "37.5",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 243
},
{
"euSize": "39",
"ukSize": "6 Big Kid",
"usSize": "7 Big Kid",
"brSize": "37.5",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "13-14Y",
"footLength": 244
},
{
"euSize": "39",
"ukSize": "6 Big Kid",
"usSize": "7 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "13-14Y",
"footLength": 245
},
{
"euSize": "39.5",
"ukSize": "6 Big Kid",
"usSize": "7.5 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 246
},
{
"euSize": "39.5",
"ukSize": "6.5 Big Kid",
"usSize": "7.5 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 247
},
{
"euSize": "40",
"ukSize": "6.5 Big Kid",
"usSize": "7.5 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 248
},
{
"euSize": "40",
"ukSize": "6.5 Big Kid",
"usSize": "7.5 Big Kid",
"brSize": "38.5",
"mxSize": "25.5cm",
"jpSize": "25.5cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 249
},
{
"euSize": "40",
"ukSize": "7 Big Kid",
"usSize": "8 Big Kid",
"brSize": "38.5",
"mxSize": "25.5cm",
"jpSize": "25.5cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 250
}
]

## 男童鞋
[{
"euSize": "15.5",
"ukSize": "0.5 Infant",
"usSize": "1 Infant",
"brSize": "13",
"mxSize": "9cm",
"jpSize": "9cm",
"krSize": "90",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 91
},
{
"euSize": "16",
"ukSize": "0.5 Infant",
"usSize": "1 Infant",
"brSize": "13.5",
"mxSize": "9cm",
"jpSize": "9cm",
"krSize": "90",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 92
},
{
"euSize": "16",
"ukSize": "0.5 Infant",
"usSize": "1 Infant",
"brSize": "13.5",
"mxSize": "9cm",
"jpSize": "9cm",
"krSize": "90",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 93
},
{
"euSize": "16",
"ukSize": "0.5 Infant",
"usSize": "1 Infant",
"brSize": "14",
"mxSize": "9cm",
"jpSize": "9cm",
"krSize": "90",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 94
},
{
"euSize": "16",
"ukSize": "0.5 Infant",
"usSize": "1 Infant",
"brSize": "14",
"mxSize": "9.5cm",
"jpSize": "9.5cm",
"krSize": "90",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 95
},
{
"euSize": "16.5",
"ukSize": "1 Infant",
"usSize": "1.5 Infant",
"brSize": "14.5",
"mxSize": "9.5cm",
"jpSize": "9.5cm",
"krSize": "95",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 96
},
{
"euSize": "16.5",
"ukSize": "1 Infant",
"usSize": "1.5 Infant",
"brSize": "14.5",
"mxSize": "9.5cm",
"jpSize": "9.5cm",
"krSize": "95",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 97
},
{
"euSize": "16.5",
"ukSize": "1 Infant",
"usSize": "1.5 Infant",
"brSize": "15",
"mxSize": "9.5cm",
"jpSize": "9.5cm",
"krSize": "95",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 98
},
{
"euSize": "16.5",
"ukSize": "1 Infant",
"usSize": "1.5 Infant",
"brSize": "15",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "95",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 99
},
{
"euSize": "17",
"ukSize": "1.5 Infant",
"usSize": "2 Infant",
"brSize": "15.5",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 100
},
{
"euSize": "17",
"ukSize": "1.5 Infant",
"usSize": "2 Infant",
"brSize": "15.5",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 101
},
{
"euSize": "17",
"ukSize": "1.5 Infant",
"usSize": "2 Infant",
"brSize": "15.5",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 102
},
{
"euSize": "17",
"ukSize": "1.5 Infant",
"usSize": "2 Infant",
"brSize": "16",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 103
},
{
"euSize": "17.5",
"ukSize": "2 Infant",
"usSize": "2.5 Infant",
"brSize": "16",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 104
},
{
"euSize": "17.5",
"ukSize": "2 Infant",
"usSize": "2.5 Infant",
"brSize": "16.5",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 105
},
{
"euSize": "18",
"ukSize": "2 Infant",
"usSize": "2.5 Infant",
"brSize": "16.5",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 106
},
{
"euSize": "18",
"ukSize": "2 Infant",
"usSize": "2.5 Infant",
"brSize": "16.5",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 107
},
{
"euSize": "18.5",
"ukSize": "2.5 Infant",
"usSize": "3 Infant",
"brSize": "16.5",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 108
},
{
"euSize": "18.5",
"ukSize": "2.5 Infant",
"usSize": "3 Infant",
"brSize": "17",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 109
},
{
"euSize": "18.5",
"ukSize": "2.5 Infant",
"usSize": "3 Infant",
"brSize": "17",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 110
},
{
"euSize": "18.5",
"ukSize": "2.5 Infant",
"usSize": "3 Infant",
"brSize": "17",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 111
},
{
"euSize": "19",
"ukSize": "3 Toddler",
"usSize": "3.5 Toddler",
"brSize": "17.5",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 112
},
{
"euSize": "19",
"ukSize": "3 Toddler",
"usSize": "3.5 Toddler",
"brSize": "17.5",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "7-12M",
"footLength": 113
},
{
"euSize": "19",
"ukSize": "3 Toddler",
"usSize": "3.5 Toddler",
"brSize": "17.5",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 114
},
{
"euSize": "19.5",
"ukSize": "3 Toddler",
"usSize": "3.5 Toddler",
"brSize": "18",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 115
},
{
"euSize": "19.5",
"ukSize": "3 Toddler",
"usSize": "3.5 Toddler",
"brSize": "18",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 116
},
{
"euSize": "19.5",
"ukSize": "3.5 Toddler",
"usSize": "4 Toddler",
"brSize": "18",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 117
},
{
"euSize": "19.5",
"ukSize": "3.5 Toddler",
"usSize": "4 Toddler",
"brSize": "18",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 118
},
{
"euSize": "20",
"ukSize": "3.5 Toddler",
"usSize": "4 Toddler",
"brSize": "18.5",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 119
},
{
"euSize": "20",
"ukSize": "3.5 Toddler",
"usSize": "4 Toddler",
"brSize": "18.5",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 120
},
{
"euSize": "20",
"ukSize": "4 Toddler",
"usSize": "4.5 Toddler",
"brSize": "18.5",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 121
},
{
"euSize": "20.5",
"ukSize": "4 Toddler",
"usSize": "4.5 Toddler",
"brSize": "19",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 122
},
{
"euSize": "20.5",
"ukSize": "4 Toddler",
"usSize": "4.5 Toddler",
"brSize": "19",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 123
},
{
"euSize": "20.5",
"ukSize": "4 Toddler",
"usSize": "4.5 Toddler",
"brSize": "19",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 124
},
{
"euSize": "20.5",
"ukSize": "4.5 Toddler",
"usSize": "5 Toddler",
"brSize": "19.5",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 125
},
{
"euSize": "21",
"ukSize": "4.5 Toddler",
"usSize": "5 Toddler",
"brSize": "19.5",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 126
},
{
"euSize": "21",
"ukSize": "4.5 Toddler",
"usSize": "5 Toddler",
"brSize": "19.5",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 127
},
{
"euSize": "21",
"ukSize": "4.5 Toddler",
"usSize": "5 Toddler",
"brSize": "19.5",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 128
},
{
"euSize": "21",
"ukSize": "4.5 Toddler",
"usSize": "5 Toddler",
"brSize": "20",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 129
},
{
"euSize": "21.5",
"ukSize": "5 Toddler",
"usSize": "5.5 Toddler",
"brSize": "20",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 130
},
{
"euSize": "21.5",
"ukSize": "5 Toddler",
"usSize": "5.5 Toddler",
"brSize": "20",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 131
},
{
"euSize": "21.5",
"ukSize": "5 Toddler",
"usSize": "5.5 Toddler",
"brSize": "20.5",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 132
},
{
"euSize": "22",
"ukSize": "5 Toddler",
"usSize": "5.5 Toddler",
"brSize": "20.5",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 133
},
{
"euSize": "22",
"ukSize": "5.5 Toddler",
"usSize": "6 Toddler",
"brSize": "20.5",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 134
},
{
"euSize": "22",
"ukSize": "5.5 Toddler",
"usSize": "6 Toddler",
"brSize": "21",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 135
},
{
"euSize": "22.5",
"ukSize": "5.5 Toddler",
"usSize": "6 Toddler",
"brSize": "21",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 136
},
{
"euSize": "22.5",
"ukSize": "5.5 Toddler",
"usSize": "6 Toddler",
"brSize": "21",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 137
},
{
"euSize": "22.5",
"ukSize": "6 Toddler",
"usSize": "6.5 Toddler",
"brSize": "21.5",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 138
},
{
"euSize": "23",
"ukSize": "6 Toddler",
"usSize": "6.5 Toddler",
"brSize": "21.5",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 139
},
{
"euSize": "23",
"ukSize": "6 Toddler",
"usSize": "6.5 Toddler",
"brSize": "21.5",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 140
},
{
"euSize": "23",
"ukSize": "6 Toddler",
"usSize": "6.5 Toddler",
"brSize": "22",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 141
},
{
"euSize": "23.5",
"ukSize": "6.5 Toddler",
"usSize": "7 Toddler",
"brSize": "22",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 142
},
{
"euSize": "23.5",
"ukSize": "6.5 Toddler",
"usSize": "7 Toddler",
"brSize": "22",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 143
},
{
"euSize": "23.5",
"ukSize": "6.5 Toddler",
"usSize": "7 Toddler",
"brSize": "22.5",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 144
},
{
"euSize": "23.5",
"ukSize": "6.5 Toddler",
"usSize": "7 Toddler",
"brSize": "22.5",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 145
},
{
"euSize": "24",
"ukSize": "6.5 Toddler",
"usSize": "7 Toddler",
"brSize": "22.5",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 146
},
{
"euSize": "24",
"ukSize": "7 Toddler",
"usSize": "7.5 Toddler",
"brSize": "23",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 147
},
{
"euSize": "24",
"ukSize": "7 Toddler",
"usSize": "7.5 Toddler",
"brSize": "23",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 148
},
{
"euSize": "24",
"ukSize": "7 Toddler",
"usSize": "7.5 Toddler",
"brSize": "23",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 149
},
{
"euSize": "24.5",
"ukSize": "7 Toddler",
"usSize": "7.5 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 150
},
{
"euSize": "24.5",
"ukSize": "7 Toddler",
"usSize": "7.5 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 151
},
{
"euSize": "24.5",
"ukSize": "7.5 Toddler",
"usSize": "8 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 152
},
{
"euSize": "24.5",
"ukSize": "7.5 Toddler",
"usSize": "8 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 153
},
{
"euSize": "25",
"ukSize": "7.5 Toddler",
"usSize": "8 Toddler",
"brSize": "24",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 154
},
{
"euSize": "25",
"ukSize": "7.5 Toddler",
"usSize": "8 Toddler",
"brSize": "24",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 155
},
{
"euSize": "25",
"ukSize": "7.5 Toddler",
"usSize": "8 Toddler",
"brSize": "24",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 156
},
{
"euSize": "25.5",
"ukSize": "8 Toddler",
"usSize": "8.5 Toddler",
"brSize": "24",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 157
},
{
"euSize": "25.5",
"ukSize": "8 Toddler",
"usSize": "8.5 Toddler",
"brSize": "24.5",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 158
},
{
"euSize": "26",
"ukSize": "8 Toddler",
"usSize": "8.5 Toddler",
"brSize": "24.5",
"mxSize": "16cm",
"jpSize": "16cm",
"krSize": "160",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 159
},
{
"euSize": "26",
"ukSize": "8 Toddler",
"usSize": "8.5 Toddler",
"brSize": "24.5",
"mxSize": "16cm",
"jpSize": "16cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 160
},
{
"euSize": "26.5",
"ukSize": "8.5 Toddler",
"usSize": "9 Toddler",
"brSize": "25",
"mxSize": "16cm",
"jpSize": "16cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 161
},
{
"euSize": "26.5",
"ukSize": "8.5 Toddler",
"usSize": "9 Toddler",
"brSize": "25",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 162
},
{
"euSize": "26.5",
"ukSize": "8.5 Toddler",
"usSize": "9 Toddler",
"brSize": "25",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 163
},
{
"euSize": "26.5",
"ukSize": "8.5 Toddler",
"usSize": "9 Toddler",
"brSize": "25",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 164
},
{
"euSize": "27",
"ukSize": "8.5 Toddler",
"usSize": "9 Toddler",
"brSize": "25.5",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "170",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "4-7Y",
"footLength": 165
},
{
"euSize": "27",
"ukSize": "9 Little Kid",
"usSize": "9.5 Little Kid",
"brSize": "25.5",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "4-7Y",
"footLength": 166
},
{
"euSize": "27",
"ukSize": "9 Little Kid",
"usSize": "9.5 Little Kid",
"brSize": "25.5",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 167
},
{
"euSize": "27",
"ukSize": "9 Little Kid",
"usSize": "9.5 Little Kid",
"brSize": "25.5",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 168
},
{
"euSize": "27",
"ukSize": "9 Little Kid",
"usSize": "9.5 Little Kid",
"brSize": "26",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 169
},
{
"euSize": "27.5",
"ukSize": "9.5 Little Kid",
"usSize": "10 Little Kid",
"brSize": "26",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 170
},
{
"euSize": "27.5",
"ukSize": "9.5 Little Kid",
"usSize": "10 Little Kid",
"brSize": "26",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 171
},
{
"euSize": "27.5",
"ukSize": "9.5 Little Kid",
"usSize": "10 Little Kid",
"brSize": "26.5",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 172
},
{
"euSize": "28",
"ukSize": "9.5 Little Kid",
"usSize": "10 Little Kid",
"brSize": "26.5",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 173
},
{
"euSize": "28",
"ukSize": "10 Little Kid",
"usSize": "10.5 Little Kid",
"brSize": "26.5",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 174
},
{
"euSize": "28",
"ukSize": "10 Little Kid",
"usSize": "10.5 Little Kid",
"brSize": "27",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 175
},
{
"euSize": "28.5",
"ukSize": "10 Little Kid",
"usSize": "10.5 Little Kid",
"brSize": "27",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 176
},
{
"euSize": "28.5",
"ukSize": "10 Little Kid",
"usSize": "10.5 Little Kid",
"brSize": "27",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 177
},
{
"euSize": "28.5",
"ukSize": "10.5 Little Kid",
"usSize": "11 Little Kid",
"brSize": "27",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 178
},
{
"euSize": "28.5",
"ukSize": "10.5 Little Kid",
"usSize": "11 Little Kid",
"brSize": "27.5",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 179
},
{
"euSize": "29",
"ukSize": "10.5 Little Kid",
"usSize": "11 Little Kid",
"brSize": "27.5",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 180
},
{
"euSize": "29",
"ukSize": "10.5 Little Kid",
"usSize": "11 Little Kid",
"brSize": "27.5",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 181
},
{
"euSize": "29",
"ukSize": "11 Little Kid",
"usSize": "11.5 Little Kid",
"brSize": "28",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 182
},
{
"euSize": "29",
"ukSize": "11 Little Kid",
"usSize": "11.5 Little Kid",
"brSize": "28",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 183
},
{
"euSize": "29.5",
"ukSize": "11 Little Kid",
"usSize": "11.5 Little Kid",
"brSize": "28",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 184
},
{
"euSize": "29.5",
"ukSize": "11 Little Kid",
"usSize": "11.5 Little Kid",
"brSize": "28.5",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 185
},
{
"euSize": "29.5",
"ukSize": "11 Little Kid",
"usSize": "11.5 Little Kid",
"brSize": "28.5",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 186
},
{
"euSize": "30",
"ukSize": "11.5 Little Kid",
"usSize": "12 Little Kid",
"brSize": "28.5",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 187
},
{
"euSize": "30",
"ukSize": "11.5 Little Kid",
"usSize": "12 Little Kid",
"brSize": "28.5",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 188
},
{
"euSize": "30",
"ukSize": "11.5 Little Kid",
"usSize": "12 Little Kid",
"brSize": "29",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 189
},
{
"euSize": "30.5",
"ukSize": "11.5 Little Kid",
"usSize": "12 Little Kid",
"brSize": "29",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 190
},
{
"euSize": "30.5",
"ukSize": "12 Little Kid",
"usSize": "12.5 Little Kid",
"brSize": "29",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 191
},
{
"euSize": "30.5",
"ukSize": "12 Little Kid",
"usSize": "12.5 Little Kid",
"brSize": "29.5",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 192
},
{
"euSize": "31",
"ukSize": "12 Little Kid",
"usSize": "12.5 Little Kid",
"brSize": "29.5",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 193
},
{
"euSize": "31",
"ukSize": "12 Little Kid",
"usSize": "12.5 Little Kid",
"brSize": "29.5",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 194
},
{
"euSize": "31",
"ukSize": "12.5 Little Kid",
"usSize": "13 Little Kid",
"brSize": "30",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 195
},
{
"euSize": "31",
"ukSize": "12.5 Little Kid",
"usSize": "13 Little Kid",
"brSize": "30",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 196
},
{
"euSize": "31.5",
"ukSize": "12.5 Little Kid",
"usSize": "13 Little Kid",
"brSize": "30",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 197
},
{
"euSize": "31.5",
"ukSize": "12.5 Little Kid",
"usSize": "13 Little Kid",
"brSize": "30",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 198
},
{
"euSize": "31.5",
"ukSize": "13 Little Kid",
"usSize": "13.5 Little Kid",
"brSize": "30.5",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 199
},
{
"euSize": "32",
"ukSize": "13 Little Kid",
"usSize": "13.5 Little Kid",
"brSize": "30.5",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "205",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 200
},
{
"euSize": "32",
"ukSize": "13 Little Kid",
"usSize": "13.5 Little Kid",
"brSize": "30.5",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "205",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 201
},
{
"euSize": "32",
"ukSize": "13 Little Kid",
"usSize": "13.5 Little Kid",
"brSize": "31",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 202
},
{
"euSize": "32",
"ukSize": "13.5 Little Kid",
"usSize": "1 Big Kid",
"brSize": "31",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 203
},
{
"euSize": "32.5",
"ukSize": "13.5 Little Kid",
"usSize": "1 Big Kid",
"brSize": "31",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 204
},
{
"euSize": "32.5",
"ukSize": "13.5 Little Kid",
"usSize": "1 Big Kid",
"brSize": "31.5",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "8-12Y",
"footLength": 205
},
{
"euSize": "32.5",
"ukSize": "13.5 Little Kid",
"usSize": "1 Big Kid",
"brSize": "31.5",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "8-12Y",
"footLength": 206
},
{
"euSize": "33",
"ukSize": "1 Big Kid",
"usSize": "1.5 Big Kid",
"brSize": "31.5",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 207
},
{
"euSize": "33",
"ukSize": "1 Big Kid",
"usSize": "1.5 Big Kid",
"brSize": "32",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 208
},
{
"euSize": "33",
"ukSize": "1 Big Kid",
"usSize": "1.5 Big Kid",
"brSize": "32",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 209
},
{
"euSize": "33.5",
"ukSize": "1 Big Kid",
"usSize": "1.5 Big Kid",
"brSize": "32.5",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 210
},
{
"euSize": "33.5",
"ukSize": "1.5 Big Kid",
"usSize": "2 Big Kid",
"brSize": "32.5",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 211
},
{
"euSize": "33.5",
"ukSize": "1.5 Big Kid",
"usSize": "2 Big Kid",
"brSize": "32.5",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 212
},
{
"euSize": "34",
"ukSize": "1.5 Big Kid",
"usSize": "2 Big Kid",
"brSize": "33",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 213
},
{
"euSize": "34",
"ukSize": "1.5 Big Kid",
"usSize": "2 Big Kid",
"brSize": "33",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 214
},
{
"euSize": "34",
"ukSize": "2 Big Kid",
"usSize": "2.5 Big Kid",
"brSize": "33",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 215
},
{
"euSize": "34",
"ukSize": "2 Big Kid",
"usSize": "2.5 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 216
},
{
"euSize": "34.5",
"ukSize": "2 Big Kid",
"usSize": "2.5 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 217
},
{
"euSize": "34.5",
"ukSize": "2 Big Kid",
"usSize": "2.5 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 218
},
{
"euSize": "34.5",
"ukSize": "2.5 Big Kid",
"usSize": "3 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 219
},
{
"euSize": "35",
"ukSize": "2.5 Big Kid",
"usSize": "3 Big Kid",
"brSize": "34",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 220
},
{
"euSize": "35",
"ukSize": "2.5 Big Kid",
"usSize": "3 Big Kid",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 221
},
{
"euSize": "35",
"ukSize": "3 Big Kid",
"usSize": "3.5 Big Kid",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 222
},
{
"euSize": "35.5",
"ukSize": "3 Big Kid",
"usSize": "3.5 Big Kid",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 223
},
{
"euSize": "35.5",
"ukSize": "3 Big Kid",
"usSize": "3.5 Big Kid",
"brSize": "34.5",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 224
},
{
"euSize": "35.5",
"ukSize": "3.5 Big Kid",
"usSize": "4 Big Kid",
"brSize": "34.5",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 225
},
{
"euSize": "36",
"ukSize": "3.5 Big Kid",
"usSize": "4 Big Kid",
"brSize": "34.5",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 226
},
{
"euSize": "36",
"ukSize": "3.5 Big Kid",
"usSize": "4 Big Kid",
"brSize": "35",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 227
},
{
"euSize": "36",
"ukSize": "3.5 Big Kid",
"usSize": "4 Big Kid",
"brSize": "35",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 228
},
{
"euSize": "36.5",
"ukSize": "4 Big Kid",
"usSize": "4.5 Big Kid",
"brSize": "35",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 229
},
{
"euSize": "36.5",
"ukSize": "4 Big Kid",
"usSize": "4.5 Big Kid",
"brSize": "35.5",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 230
},
{
"euSize": "36.5",
"ukSize": "4 Big Kid",
"usSize": "4.5 Big Kid",
"brSize": "35.5",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 231
},
{
"euSize": "36.5",
"ukSize": "4 Big Kid",
"usSize": "4.5 Big Kid",
"brSize": "35.5",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 232
},
{
"euSize": "37",
"ukSize": "4.5 Big Kid",
"usSize": "5 Big Kid",
"brSize": "36",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 233
},
{
"euSize": "37",
"ukSize": "4.5 Big Kid",
"usSize": "5 Big Kid",
"brSize": "36",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 234
},
{
"euSize": "37",
"ukSize": "4.5 Big Kid",
"usSize": "5 Big Kid",
"brSize": "36",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 235
},
{
"euSize": "37.5",
"ukSize": "5 Big Kid",
"usSize": "5.5 Big Kid",
"brSize": "36",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 236
},
{
"euSize": "37.5",
"ukSize": "5 Big Kid",
"usSize": "5.5 Big Kid",
"brSize": "36.5",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 237
},
{
"euSize": "38",
"ukSize": "5 Big Kid",
"usSize": "5.5 Big Kid",
"brSize": "36.5",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 238
},
{
"euSize": "38",
"ukSize": "5 Big Kid",
"usSize": "5.5 Big Kid",
"brSize": "36.5",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 239
},
{
"euSize": "38",
"ukSize": "5.5 Big Kid",
"usSize": "6 Big Kid",
"brSize": "37",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 240
},
{
"euSize": "38",
"ukSize": "5.5 Big Kid",
"usSize": "6 Big Kid",
"brSize": "37",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 241
},
{
"euSize": "38.5",
"ukSize": "5.5 Big Kid",
"usSize": "6.5 Big Kid",
"brSize": "37",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 242
},
{
"euSize": "38.5",
"ukSize": "5.5 Big Kid",
"usSize": "6.5 Big Kid",
"brSize": "37.5",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 243
},
{
"euSize": "38.5",
"ukSize": "6 Big Kid",
"usSize": "6.5 Big Kid",
"brSize": "37.5",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "250",
"usKsaSize": "8-12Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "13-14Y",
"footLength": 244
},
{
"euSize": "38.5",
"ukSize": "6 Big Kid",
"usSize": "6.5 Big Kid",
"brSize": "37.5",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "250",
"usKsaSize": "8-12Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "13-14Y",
"footLength": 245
},
{
"euSize": "39",
"ukSize": "6 Big Kid",
"usSize": "7 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 246
},
{
"euSize": "39",
"ukSize": "6 Big Kid",
"usSize": "7 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 247
},
{
"euSize": "39",
"ukSize": "6.5 Big Kid",
"usSize": "7 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 248
},
{
"euSize": "39",
"ukSize": "6.5 Big Kid",
"usSize": "7 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "255",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 249
},
{
"euSize": "39.5",
"ukSize": "6.5 Big Kid",
"usSize": "7.5 Big Kid",
"brSize": "38.5",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "255",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 250
},
{
"euSize": "39.5",
"ukSize": "6.5 Big Kid",
"usSize": "7.5 Big Kid",
"brSize": "38.5",
"mxSize": "25.5cm",
"jpSize": "25.5cm",
"krSize": "255",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 251
},
{
"euSize": "39.5",
"ukSize": "6.5 Big Kid",
"usSize": "7.5 Big Kid",
"brSize": "38.5",
"mxSize": "25.5cm",
"jpSize": "25.5cm",
"krSize": "255",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 252
},
{
"euSize": "39.5",
"ukSize": "6.5 Big Kid",
"usSize": "7.5 Big Kid",
"brSize": "38.5",
"mxSize": "25.5cm",
"jpSize": "25.5cm",
"krSize": "255",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 253
},
{
"euSize": "40",
"ukSize": "7 Big Kid",
"usSize": "8 Big Kid",
"brSize": "39",
"mxSize": "25.5cm",
"jpSize": "25.5cm",
"krSize": "255",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 254
},
{
"euSize": "40",
"ukSize": "7 Big Kid",
"usSize": "8 Big Kid",
"brSize": "39",
"mxSize": "25.5cm",
"jpSize": "25.5cm",
"krSize": "260",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 255
},
{
"euSize": "40",
"ukSize": "7 Big Kid",
"usSize": "8 Big Kid",
"brSize": "39",
"mxSize": "25.5cm",
"jpSize": "25.5cm",
"krSize": "260",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 256
},
{
"euSize": "40",
"ukSize": "7 Big Kid",
"usSize": "8 Big Kid",
"brSize": "39",
"mxSize": "26cm",
"jpSize": "26cm",
"krSize": "260",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "13-14Y",
"footLength": 257
},
{
"euSize": "40.5",
"ukSize": "7 Big Kid",
"usSize": "8 Big Kid",
"brSize": "39.5",
"mxSize": "26cm",
"jpSize": "26cm",
"krSize": "260",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "13-14Y",
"footLength": 258
},
{
"euSize": "40.5",
"ukSize": "7.5 Big Kid",
"usSize": "8.5 Big Kid",
"brSize": "39.5",
"mxSize": "26cm",
"jpSize": "26cm",
"krSize": "260",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "13-14Y",
"footLength": 259
},
{
"euSize": "41",
"ukSize": "7.5 Big Kid",
"usSize": "8.5 Big Kid",
"brSize": "39.5",
"mxSize": "26cm",
"jpSize": "26cm",
"krSize": "265",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "13-14Y",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 260
},
{
"euSize": "41",
"ukSize": "7.5 Big Kid",
"usSize": "8.5 Big Kid",
"brSize": "40",
"mxSize": "26cm",
"jpSize": "26cm",
"krSize": "265",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 261
},
{
"euSize": "41",
"ukSize": "7.5 Big Kid",
"usSize": "8.5 Big Kid",
"brSize": "40",
"mxSize": "26.5cm",
"jpSize": "26.5cm",
"krSize": "265",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 262
},
{
"euSize": "41.5",
"ukSize": "7.5 Big Kid",
"usSize": "8.5 Big Kid",
"brSize": "40",
"mxSize": "26.5cm",
"jpSize": "26.5cm",
"krSize": "265",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 263
},
{
"euSize": "41.5",
"ukSize": "8 Big Kid",
"usSize": "9 Big Kid",
"brSize": "40.5",
"mxSize": "26.5cm",
"jpSize": "26.5cm",
"krSize": "265",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 264
},
{
"euSize": "41.5",
"ukSize": "8 Big Kid",
"usSize": "9 Big Kid",
"brSize": "40.5",
"mxSize": "26.5cm",
"jpSize": "26.5cm",
"krSize": "270",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 265
},
{
"euSize": "42",
"ukSize": "8 Big Kid",
"usSize": "9 Big Kid",
"brSize": "40.5",
"mxSize": "26.5cm",
"jpSize": "26.5cm",
"krSize": "270",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 266
},
{
"euSize": "42",
"ukSize": "8.5 Big Kid",
"usSize": "9.5 Big Kid",
"brSize": "41",
"mxSize": "27cm",
"jpSize": "27cm",
"krSize": "270",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 267
},
{
"euSize": "42",
"ukSize": "8.5 Big Kid",
"usSize": "9.5 Big Kid",
"brSize": "41",
"mxSize": "27cm",
"jpSize": "27cm",
"krSize": "270",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 268
},
{
"euSize": "42.5",
"ukSize": "8.5 Big Kid",
"usSize": "9.5 Big Kid",
"brSize": "41",
"mxSize": "27cm",
"jpSize": "27cm",
"krSize": "270",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 269
},
{
"euSize": "42.5",
"ukSize": "8.5 Big Kid",
"usSize": "9.5 Big Kid",
"brSize": "41.5",
"mxSize": "27cm",
"jpSize": "27cm",
"krSize": "275",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 270
},
{
"euSize": "42.5",
"ukSize": "9 Big Kid",
"usSize": "10 Big Kid",
"brSize": "41.5",
"mxSize": "27cm",
"jpSize": "27cm",
"krSize": "275",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 271
},
{
"euSize": "42.5",
"ukSize": "9 Big Kid",
"usSize": "10 Big Kid",
"brSize": "41.5",
"mxSize": "27.5cm",
"jpSize": "27.5cm",
"krSize": "275",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 272
},
{
"euSize": "43",
"ukSize": "9 Big Kid",
"usSize": "10 Big Kid",
"brSize": "41.5",
"mxSize": "27.5cm",
"jpSize": "27.5cm",
"krSize": "275",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 273
},
{
"euSize": "43",
"ukSize": "9 Big Kid",
"usSize": "10 Big Kid",
"brSize": "42",
"mxSize": "27.5cm",
"jpSize": "27.5cm",
"krSize": "275",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 274
},
{
"euSize": "43.5",
"ukSize": "9.5 Big Kid",
"usSize": "10.5 Big Kid",
"brSize": "42",
"mxSize": "27.5cm",
"jpSize": "27.5cm",
"krSize": "280",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 275
},
{
"euSize": "43.5",
"ukSize": "9.5 Big Kid",
"usSize": "10.5 Big Kid",
"brSize": "42",
"mxSize": "27.5cm",
"jpSize": "27.5cm",
"krSize": "280",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 276
},
{
"euSize": "43.5",
"ukSize": "9.5 Big Kid",
"usSize": "10.5 Big Kid",
"brSize": "42",
"mxSize": "28cm",
"jpSize": "28cm",
"krSize": "280",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 277
},
{
"euSize": "44",
"ukSize": "9.5 Big Kid",
"usSize": "10.5 Big Kid",
"brSize": "42.5",
"mxSize": "28cm",
"jpSize": "28cm",
"krSize": "280",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 278
},
{
"euSize": "44",
"ukSize": "10 Big Kid",
"usSize": "11 Big Kid",
"brSize": "42.5",
"mxSize": "28cm",
"jpSize": "28cm",
"krSize": "285",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 279
},
{
"euSize": "44",
"ukSize": "10 Big Kid",
"usSize": "11 Big Kid",
"brSize": "42.5",
"mxSize": "28cm",
"jpSize": "28cm",
"krSize": "285",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 280
},
{
"euSize": "44.5",
"ukSize": "10 Big Kid",
"usSize": "11 Big Kid",
"brSize": "42.5",
"mxSize": "28.5cm",
"jpSize": "28.5cm",
"krSize": "285",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 281
},
{
"euSize": "44.5",
"ukSize": "10 Big Kid",
"usSize": "11 Big Kid",
"brSize": "43",
"mxSize": "28.5cm",
"jpSize": "28.5cm",
"krSize": "285",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 282
},
{
"euSize": "44.5",
"ukSize": "10 Big Kid",
"usSize": "11 Big Kid",
"brSize": "43",
"mxSize": "28.5cm",
"jpSize": "28.5cm",
"krSize": "285",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 283
},
{
"euSize": "45",
"ukSize": "10.5 Big Kid",
"usSize": "11.5 Big Kid",
"brSize": "43",
"mxSize": "28.5cm",
"jpSize": "28.5cm",
"krSize": "290",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 284
},
{
"euSize": "45",
"ukSize": "10.5 Big Kid",
"usSize": "11.5 Big Kid",
"brSize": "43",
"mxSize": "28.5cm",
"jpSize": "28.5cm",
"krSize": "290",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 285
},
{
"euSize": "45",
"ukSize": "10.5 Big Kid",
"usSize": "11.5 Big Kid",
"brSize": "43.5",
"mxSize": "29cm",
"jpSize": "29cm",
"krSize": "290",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 286
},
{
"euSize": "45",
"ukSize": "10.5 Big Kid",
"usSize": "11.5 Big Kid",
"brSize": "43.5",
"mxSize": "29cm",
"jpSize": "29cm",
"krSize": "290",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 287
},
{
"euSize": "45.5",
"ukSize": "11 Big Kid",
"usSize": "12 Big Kid",
"brSize": "43.5",
"mxSize": "29cm",
"jpSize": "29cm",
"krSize": "290",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 288
},
{
"euSize": "45.5",
"ukSize": "11 Big Kid",
"usSize": "12 Big Kid",
"brSize": "44",
"mxSize": "29cm",
"jpSize": "29cm",
"krSize": "295",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 289
},
{
"euSize": "45.5",
"ukSize": "11 Big Kid",
"usSize": "12 Big Kid",
"brSize": "44",
"mxSize": "29cm",
"jpSize": "29cm",
"krSize": "295",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 290
},
{
"euSize": "46",
"ukSize": "11 Big Kid",
"usSize": "12 Big Kid",
"brSize": "44",
"mxSize": "29.5cm",
"jpSize": "29.5cm",
"krSize": "295",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 291
},
{
"euSize": "46",
"ukSize": "11.5 Big Kid",
"usSize": "12.5 Big Kid",
"brSize": "44.5",
"mxSize": "29.5cm",
"jpSize": "29.5cm",
"krSize": "295",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 292
}
]

## 文档中心 / 开发者文档 / 数据字典 / （双码）鞋类尺码&脚长映射配置

- 文档 ID：`159682943373`
- 更新时间：`2025-11-16T14:31:00.688000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=159682943373`

# 尺码组名

euSize 欧码
ukSize 英码
usSize 美码
brSize 巴西码
mxSize 墨西哥码
jpSize 日本码
krSize 韩国码
clSize 智利码
coSize 哥伦比亚码
footLength 脚长  //单位mm

# 尺码分类

## 女鞋双码
[
{
"euSize": "30.5-31",
"ukSize": "0",
"usSize": "1.5-2",
"brSize": "28",
"mxSize": "20-20.5cm",
"jpSize": "19-19.5cm",
"krSize": "200-205",
"clSize": "28",
"coSize": "28",
"footLength": 200
},
{
"euSize": "31.5-32",
"ukSize": "0",
"usSize": "1.5-2",
"brSize": "28",
"mxSize": "20-20.5cm",
"jpSize": "19-19.5cm",
"krSize": "200-205",
"clSize": "28",
"coSize": "28",
"footLength": 201
},
{
"euSize": "31.5-32",
"ukSize": "0.5-1",
"usSize": "1.5-2",
"brSize": "28",
"mxSize": "20-20.5cm",
"jpSize": "19-19.5cm",
"krSize": "200-205",
"clSize": "28",
"coSize": "28",
"footLength": 202
},
{
"euSize": "31.5-32",
"ukSize": "0.5-1",
"usSize": "1.5-2",
"brSize": "28.5",
"mxSize": "21-21.5cm",
"jpSize": "20-20.5cm",
"krSize": "200-205",
"clSize": "28",
"coSize": "28",
"footLength": 203
},
{
"euSize": "31.5-32",
"ukSize": "0.5-1",
"usSize": "2.5-3",
"brSize": "28.5",
"mxSize": "21-21.5cm",
"jpSize": "20-20.5cm",
"krSize": "200-205",
"clSize": "28",
"coSize": "28",
"footLength": 204
},
{
"euSize": "31.5-32",
"ukSize": "0.5-1",
"usSize": "2.5-3",
"brSize": "29",
"mxSize": "21-21.5cm",
"jpSize": "20-20.5cm",
"krSize": "200-205",
"clSize": "29",
"coSize": "29",
"footLength": 205
},
{
"euSize": "31.5-32",
"ukSize": "0.5-1",
"usSize": "2.5-3",
"brSize": "29",
"mxSize": "21-21.5cm",
"jpSize": "20-20.5cm",
"krSize": "200-205",
"clSize": "29",
"coSize": "29",
"footLength": 206
},
{
"euSize": "32.5-33",
"ukSize": "0.5-1",
"usSize": "2.5-3",
"brSize": "29",
"mxSize": "21-21.5cm",
"jpSize": "20-20.5cm",
"krSize": "200-205",
"clSize": "29",
"coSize": "29",
"footLength": 207
},
{
"euSize": "32.5-33",
"ukSize": "0.5-1",
"usSize": "2.5-3",
"brSize": "29.5",
"mxSize": "21-21.5cm",
"jpSize": "20-20.5cm",
"krSize": "210-215",
"clSize": "29",
"coSize": "29",
"footLength": 208
},
{
"euSize": "32.5-33",
"ukSize": "0.5-1",
"usSize": "2.5-3",
"brSize": "29.5",
"mxSize": "21-21.5cm",
"jpSize": "20-20.5cm",
"krSize": "210-215",
"clSize": "29",
"coSize": "29",
"footLength": 209
},
{
"euSize": "32.5-33",
"ukSize": "0.5-1",
"usSize": "2.5-3",
"brSize": "30",
"mxSize": "21-21.5cm",
"jpSize": "20-20.5cm",
"krSize": "210-215",
"clSize": "30",
"coSize": "30",
"footLength": 210
},
{
"euSize": "32.5-33",
"ukSize": "0.5-1",
"usSize": "2.5-3",
"brSize": "30",
"mxSize": "21-21.5cm",
"jpSize": "20-20.5cm",
"krSize": "210-215",
"clSize": "30",
"coSize": "30",
"footLength": 211
},
{
"euSize": "32.5-33",
"ukSize": "1.5-2",
"usSize": "3.5-4",
"brSize": "30",
"mxSize": "21-21.5cm",
"jpSize": "20-20.5cm",
"krSize": "210-215",
"clSize": "30",
"coSize": "30",
"footLength": 212
},
{
"euSize": "32.5-33",
"ukSize": "1.5-2",
"usSize": "3.5-4",
"brSize": "30.5",
"mxSize": "22-22.5cm",
"jpSize": "21-21.5cm",
"krSize": "210-215",
"clSize": "30",
"coSize": "30",
"footLength": 213
},
{
"euSize": "33.5-34",
"ukSize": "1.5-2",
"usSize": "3.5-4",
"brSize": "30.5",
"mxSize": "22-22.5cm",
"jpSize": "21-21.5cm",
"krSize": "210-215",
"clSize": "30",
"coSize": "30",
"footLength": 214
},
{
"euSize": "33.5-34",
"ukSize": "1.5-2",
"usSize": "3.5-4",
"brSize": "31",
"mxSize": "22-22.5cm",
"jpSize": "21-21.5cm",
"krSize": "210-215",
"clSize": "31",
"coSize": "31",
"footLength": 215
},
{
"euSize": "33.5-34",
"ukSize": "1.5-2",
"usSize": "3.5-4",
"brSize": "31",
"mxSize": "22-22.5cm",
"jpSize": "21-21.5cm",
"krSize": "210-215",
"clSize": "31",
"coSize": "31",
"footLength": 216
},
{
"euSize": "33.5-34",
"ukSize": "1.5-2",
"usSize": "3.5-4",
"brSize": "31",
"mxSize": "22-22.5cm",
"jpSize": "21-21.5cm",
"krSize": "210-215",
"clSize": "31",
"coSize": "31",
"footLength": 217
},
{
"euSize": "33.5-34",
"ukSize": "1.5-2",
"usSize": "3.5-4",
"brSize": "31.5",
"mxSize": "22-22.5cm",
"jpSize": "21-21.5cm",
"krSize": "220-225",
"clSize": "31",
"coSize": "31",
"footLength": 218
},
{
"euSize": "33.5-34",
"ukSize": "1.5-2",
"usSize": "3.5-4",
"brSize": "31.5",
"mxSize": "22-22.5cm",
"jpSize": "21-21.5cm",
"krSize": "220-225",
"clSize": "31",
"coSize": "31",
"footLength": 219
},
{
"euSize": "33.5-34",
"ukSize": "1.5-2",
"usSize": "3.5-4",
"brSize": "32",
"mxSize": "22-22.5cm",
"jpSize": "21-21.5cm",
"krSize": "220-225",
"clSize": "32",
"coSize": "32",
"footLength": 220
},
{
"euSize": "34.5-35",
"ukSize": "2.5-3",
"usSize": "4.5-5",
"brSize": "32",
"mxSize": "22-22.5cm",
"jpSize": "21-21.5cm",
"krSize": "220-225",
"clSize": "32",
"coSize": "32",
"footLength": 221
},
{
"euSize": "34.5-35",
"ukSize": "2.5-3",
"usSize": "4.5-5",
"brSize": "32",
"mxSize": "22-22.5cm",
"jpSize": "21-21.5cm",
"krSize": "220-225",
"clSize": "32",
"coSize": "32",
"footLength": 222
},
{
"euSize": "34.5-35",
"ukSize": "2.5-3",
"usSize": "4.5-5",
"brSize": "32.5",
"mxSize": "23-23.5cm",
"jpSize": "22-22.5cm",
"krSize": "220-225",
"clSize": "32",
"coSize": "32",
"footLength": 223
},
{
"euSize": "34.5-35",
"ukSize": "2.5-3",
"usSize": "4.5-5",
"brSize": "32.5",
"mxSize": "23-23.5cm",
"jpSize": "22-22.5cm",
"krSize": "220-225",
"clSize": "32",
"coSize": "32",
"footLength": 224
},
{
"euSize": "34.5-35",
"ukSize": "2.5-3",
"usSize": "4.5-5",
"brSize": "33",
"mxSize": "23-23.5cm",
"jpSize": "22-22.5cm",
"krSize": "220-225",
"clSize": "33",
"coSize": "33",
"footLength": 225
},
{
"euSize": "34.5-35",
"ukSize": "2.5-3",
"usSize": "4.5-5",
"brSize": "33",
"mxSize": "23-23.5cm",
"jpSize": "22-22.5cm",
"krSize": "220-225",
"clSize": "33",
"coSize": "33",
"footLength": 226
},
{
"euSize": "34.5-35",
"ukSize": "2.5-3",
"usSize": "4.5-5",
"brSize": "33",
"mxSize": "23-23.5cm",
"jpSize": "22-22.5cm",
"krSize": "220-225",
"clSize": "33",
"coSize": "33",
"footLength": 227
},
{
"euSize": "34.5-35",
"ukSize": "2.5-3",
"usSize": "5.5-6",
"brSize": "33.5",
"mxSize": "23-23.5cm",
"jpSize": "22-22.5cm",
"krSize": "230-235",
"clSize": "33",
"coSize": "33",
"footLength": 228
},
{
"euSize": "35.5-36",
"ukSize": "3.5-4",
"usSize": "5.5-6",
"brSize": "33.5",
"mxSize": "23-23.5cm",
"jpSize": "22-22.5cm",
"krSize": "230-235",
"clSize": "33",
"coSize": "33",
"footLength": 229
},
{
"euSize": "35.5-36",
"ukSize": "3.5-4",
"usSize": "5.5-6",
"brSize": "34",
"mxSize": "23-23.5cm",
"jpSize": "22-22.5cm",
"krSize": "230-235",
"clSize": "34",
"coSize": "34",
"footLength": 230
},
{
"euSize": "35.5-36",
"ukSize": "3.5-4",
"usSize": "5.5-6",
"brSize": "34",
"mxSize": "23-23.5cm",
"jpSize": "22-22.5cm",
"krSize": "230-235",
"clSize": "34",
"coSize": "34",
"footLength": 231
},
{
"euSize": "35.5-36",
"ukSize": "3.5-4",
"usSize": "5.5-6",
"brSize": "34",
"mxSize": "23-23.5cm",
"jpSize": "22-22.5cm",
"krSize": "230-235",
"clSize": "34",
"coSize": "34",
"footLength": 232
},
{
"euSize": "35.5-36",
"ukSize": "3.5-4",
"usSize": "5.5-6",
"brSize": "34.5",
"mxSize": "24-24.5cm",
"jpSize": "23-23.5cm",
"krSize": "230-235",
"clSize": "34",
"coSize": "34",
"footLength": 233
},
{
"euSize": "35.5-36",
"ukSize": "3.5-4",
"usSize": "5.5-6",
"brSize": "34.5",
"mxSize": "24-24.5cm",
"jpSize": "23-23.5cm",
"krSize": "230-235",
"clSize": "34",
"coSize": "34",
"footLength": 234
},
{
"euSize": "35.5-36",
"ukSize": "3.5-4",
"usSize": "5.5-6",
"brSize": "35",
"mxSize": "24-24.5cm",
"jpSize": "23-23.5cm",
"krSize": "230-235",
"clSize": "35",
"coSize": "35",
"footLength": 235
},
{
"euSize": "36.5-37",
"ukSize": "3.5-4",
"usSize": "5.5-6",
"brSize": "35",
"mxSize": "24-24.5cm",
"jpSize": "23-23.5cm",
"krSize": "230-235",
"clSize": "35",
"coSize": "35",
"footLength": 236
},
{
"euSize": "36.5-37",
"ukSize": "4.5-5",
"usSize": "6.5-7",
"brSize": "35",
"mxSize": "24-24.5cm",
"jpSize": "23-23.5cm",
"krSize": "230-235",
"clSize": "35",
"coSize": "35",
"footLength": 237
},
{
"euSize": "36.5-37",
"ukSize": "4.5-5",
"usSize": "6.5-7",
"brSize": "35.5",
"mxSize": "24-24.5cm",
"jpSize": "23-23.5cm",
"krSize": "240-245",
"clSize": "35",
"coSize": "35",
"footLength": 238
},
{
"euSize": "36.5-37",
"ukSize": "4.5-5",
"usSize": "6.5-7",
"brSize": "35.5",
"mxSize": "24-24.5cm",
"jpSize": "23-23.5cm",
"krSize": "240-245",
"clSize": "35",
"coSize": "35",
"footLength": 239
},
{
"euSize": "36.5-37",
"ukSize": "4.5-5",
"usSize": "6.5-7",
"brSize": "36",
"mxSize": "24-24.5cm",
"jpSize": "23-23.5cm",
"krSize": "240-245",
"clSize": "36",
"coSize": "36",
"footLength": 240
},
{
"euSize": "36.5-37",
"ukSize": "4.5-5",
"usSize": "6.5-7",
"brSize": "36",
"mxSize": "24-24.5cm",
"jpSize": "23-23.5cm",
"krSize": "240-245",
"clSize": "36",
"coSize": "36",
"footLength": 241
},
{
"euSize": "36.5-37",
"ukSize": "4.5-5",
"usSize": "6.5-7",
"brSize": "36",
"mxSize": "24-24.5cm",
"jpSize": "23-23.5cm",
"krSize": "240-245",
"clSize": "36",
"coSize": "36",
"footLength": 242
},
{
"euSize": "37.5-38",
"ukSize": "4.5-5",
"usSize": "6.5-7",
"brSize": "36.5",
"mxSize": "25-25.5cm",
"jpSize": "24-24.5cm",
"krSize": "240-245",
"clSize": "36",
"coSize": "36",
"footLength": 243
},
{
"euSize": "37.5-38",
"ukSize": "4.5-5",
"usSize": "7.5-8",
"brSize": "36.5",
"mxSize": "25-25.5cm",
"jpSize": "24-24.5cm",
"krSize": "240-245",
"clSize": "36",
"coSize": "36",
"footLength": 244
},
{
"euSize": "37.5-38",
"ukSize": "4.5-5",
"usSize": "7.5-8",
"brSize": "37",
"mxSize": "25-25.5cm",
"jpSize": "24-24.5cm",
"krSize": "240-245",
"clSize": "37",
"coSize": "37",
"footLength": 245
},
{
"euSize": "37.5-38",
"ukSize": "5.5-6",
"usSize": "7.5-8",
"brSize": "37",
"mxSize": "25-25.5cm",
"jpSize": "24-24.5cm",
"krSize": "240-245",
"clSize": "37",
"coSize": "37",
"footLength": 246
},
{
"euSize": "37.5-38",
"ukSize": "5.5-6",
"usSize": "7.5-8",
"brSize": "37",
"mxSize": "25-25.5cm",
"jpSize": "24-24.5cm",
"krSize": "240-245",
"clSize": "37",
"coSize": "37",
"footLength": 247
},
{
"euSize": "37.5-38",
"ukSize": "5.5-6",
"usSize": "7.5-8",
"brSize": "37.5",
"mxSize": "25-25.5cm",
"jpSize": "24-24.5cm",
"krSize": "250-255",
"clSize": "37",
"coSize": "37",
"footLength": 248
},
{
"euSize": "38.5-39",
"ukSize": "5.5-6",
"usSize": "7.5-8",
"brSize": "37.5",
"mxSize": "25-25.5cm",
"jpSize": "24-24.5cm",
"krSize": "250-255",
"clSize": "37",
"coSize": "37",
"footLength": 249
},
{
"euSize": "38.5-39",
"ukSize": "5.5-6",
"usSize": "7.5-8",
"brSize": "38",
"mxSize": "25-25.5cm",
"jpSize": "24-24.5cm",
"krSize": "250-255",
"clSize": "38",
"coSize": "38",
"footLength": 250
},
{
"euSize": "38.5-39",
"ukSize": "5.5-6",
"usSize": "7.5-8",
"brSize": "38",
"mxSize": "25-25.5cm",
"jpSize": "24-24.5cm",
"krSize": "250-255",
"clSize": "38",
"coSize": "38",
"footLength": 251
},
{
"euSize": "38.5-39",
"ukSize": "5.5-6",
"usSize": "8.5-9",
"brSize": "38",
"mxSize": "25-25.5cm",
"jpSize": "24-24.5cm",
"krSize": "250-255",
"clSize": "38",
"coSize": "38",
"footLength": 252
},
{
"euSize": "38.5-39",
"ukSize": "6.5-7",
"usSize": "8.5-9",
"brSize": "38.5",
"mxSize": "26-26.5cm",
"jpSize": "25-25.5cm",
"krSize": "250-255",
"clSize": "38",
"coSize": "38",
"footLength": 253
},
{
"euSize": "39.5-40",
"ukSize": "6.5-7",
"usSize": "8.5-9",
"brSize": "38.5",
"mxSize": "26-26.5cm",
"jpSize": "25-25.5cm",
"krSize": "250-255",
"clSize": "38",
"coSize": "38",
"footLength": 254
},
{
"euSize": "39.5-40",
"ukSize": "6.5-7",
"usSize": "8.5-9",
"brSize": "39",
"mxSize": "26-26.5cm",
"jpSize": "25-25.5cm",
"krSize": "250-255",
"clSize": "39",
"coSize": "39",
"footLength": 255
},
{
"euSize": "39.5-40",
"ukSize": "6.5-7",
"usSize": "8.5-9",
"brSize": "39",
"mxSize": "26-26.5cm",
"jpSize": "25-25.5cm",
"krSize": "250-255",
"clSize": "39",
"coSize": "39",
"footLength": 256
},
{
"euSize": "39.5-40",
"ukSize": "6.5-7",
"usSize": "8.5-9",
"brSize": "39",
"mxSize": "26-26.5cm",
"jpSize": "25-25.5cm",
"krSize": "250-255",
"clSize": "39",
"coSize": "39",
"footLength": 257
},
{
"euSize": "39.5-40",
"ukSize": "6.5-7",
"usSize": "8.5-9",
"brSize": "39.5",
"mxSize": "26-26.5cm",
"jpSize": "25-25.5cm",
"krSize": "260-265",
"clSize": "39",
"coSize": "39",
"footLength": 258
},
{
"euSize": "39.5-40",
"ukSize": "6.5-7",
"usSize": "8.5-9",
"brSize": "39.5",
"mxSize": "26-26.5cm",
"jpSize": "25-25.5cm",
"krSize": "260-265",
"clSize": "39",
"coSize": "39",
"footLength": 259
},
{
"euSize": "40.5-41",
"ukSize": "6.5-7",
"usSize": "9.5-10",
"brSize": "40",
"mxSize": "26-26.5cm",
"jpSize": "25-25.5cm",
"krSize": "260-265",
"clSize": "40",
"coSize": "40",
"footLength": 260
},
{
"euSize": "40.5-41",
"ukSize": "6.5-7",
"usSize": "9.5-10",
"brSize": "40",
"mxSize": "26-26.5cm",
"jpSize": "25-25.5cm",
"krSize": "260-265",
"clSize": "40",
"coSize": "40",
"footLength": 261
},
{
"euSize": "40.5-41",
"ukSize": "7.5-8",
"usSize": "9.5-10",
"brSize": "40",
"mxSize": "26-26.5cm",
"jpSize": "25-25.5cm",
"krSize": "260-265",
"clSize": "40",
"coSize": "40",
"footLength": 262
},
{
"euSize": "40.5-41",
"ukSize": "7.5-8",
"usSize": "9.5-10",
"brSize": "40.5",
"mxSize": "27-27.5cm",
"jpSize": "26-26.5cm",
"krSize": "260-265",
"clSize": "40",
"coSize": "40",
"footLength": 263
},
{
"euSize": "40.5-41",
"ukSize": "7.5-8",
"usSize": "9.5-10",
"brSize": "40.5",
"mxSize": "27-27.5cm",
"jpSize": "26-26.5cm",
"krSize": "260-265",
"clSize": "40",
"coSize": "40",
"footLength": 264
},
{
"euSize": "40.5-41",
"ukSize": "7.5-8",
"usSize": "9.5-10",
"brSize": "41",
"mxSize": "27-27.5cm",
"jpSize": "26-26.5cm",
"krSize": "260-265",
"clSize": "41",
"coSize": "41",
"footLength": 265
},
{
"euSize": "40.5-41",
"ukSize": "7.5-8",
"usSize": "9.5-10",
"brSize": "41",
"mxSize": "27-27.5cm",
"jpSize": "26-26.5cm",
"krSize": "260-265",
"clSize": "41",
"coSize": "41",
"footLength": 266
},
{
"euSize": "41.5-42",
"ukSize": "7.5-8",
"usSize": "9.5-10",
"brSize": "41",
"mxSize": "27-27.5cm",
"jpSize": "26-26.5cm",
"krSize": "260-265",
"clSize": "41",
"coSize": "41",
"footLength": 267
},
{
"euSize": "41.5-42",
"ukSize": "7.5-8",
"usSize": "10.5-11",
"brSize": "41.5",
"mxSize": "27-27.5cm",
"jpSize": "26-26.5cm",
"krSize": "270-275",
"clSize": "41",
"coSize": "41",
"footLength": 268
},
{
"euSize": "41.5-42",
"ukSize": "7.5-8",
"usSize": "10.5-11",
"brSize": "41.5",
"mxSize": "27-27.5cm",
"jpSize": "26-26.5cm",
"krSize": "270-275",
"clSize": "41",
"coSize": "41",
"footLength": 269
},
{
"euSize": "41.5-42",
"ukSize": "8.5-9",
"usSize": "10.5-11",
"brSize": "42",
"mxSize": "27-27.5cm",
"jpSize": "26-26.5cm",
"krSize": "270-275",
"clSize": "42",
"coSize": "42",
"footLength": 270
},
{
"euSize": "41.5-42",
"ukSize": "8.5-9",
"usSize": "10.5-11",
"brSize": "42",
"mxSize": "27-27.5cm",
"jpSize": "26-26.5cm",
"krSize": "270-275",
"clSize": "42",
"coSize": "42",
"footLength": 271
},
{
"euSize": "41.5-42",
"ukSize": "8.5-9",
"usSize": "10.5-11",
"brSize": "42",
"mxSize": "27-27.5cm",
"jpSize": "26-26.5cm",
"krSize": "270-275",
"clSize": "42",
"coSize": "42",
"footLength": 272
},
{
"euSize": "41.5-42",
"ukSize": "8.5-9",
"usSize": "10.5-11",
"brSize": "42.5",
"mxSize": "28-28.5cm",
"jpSize": "27-27.5cm",
"krSize": "270-275",
"clSize": "42",
"coSize": "42",
"footLength": 273
},
{
"euSize": "42.5-43",
"ukSize": "8.5-9",
"usSize": "10.5-11",
"brSize": "42.5",
"mxSize": "28-28.5cm",
"jpSize": "27-27.5cm",
"krSize": "270-275",
"clSize": "42",
"coSize": "42",
"footLength": 274
},
{
"euSize": "42.5-43",
"ukSize": "8.5-9",
"usSize": "10.5-11",
"brSize": "43",
"mxSize": "28-28.5cm",
"jpSize": "27-27.5cm",
"krSize": "270-275",
"clSize": "43",
"coSize": "43",
"footLength": 275
},
{
"euSize": "42.5-43",
"ukSize": "8.5-9",
"usSize": "10.5-11",
"brSize": "43",
"mxSize": "28-28.5cm",
"jpSize": "27-27.5cm",
"krSize": "270-275",
"clSize": "43",
"coSize": "43",
"footLength": 276
},
{
"euSize": "42.5-43",
"ukSize": "8.5-9",
"usSize": "11.5-12",
"brSize": "43",
"mxSize": "28-28.5cm",
"jpSize": "27-27.5cm",
"krSize": "270-275",
"clSize": "43",
"coSize": "43",
"footLength": 277
},
{
"euSize": "42.5-43",
"ukSize": "9.5-10",
"usSize": "11.5-12",
"brSize": "43.5",
"mxSize": "28-28.5cm",
"jpSize": "27-27.5cm",
"krSize": "280-285",
"clSize": "43",
"coSize": "43",
"footLength": 278
},
{
"euSize": "42.5-43",
"ukSize": "9.5-10",
"usSize": "11.5-12",
"brSize": "43.5",
"mxSize": "28-28.5cm",
"jpSize": "27-27.5cm",
"krSize": "280-285",
"clSize": "43",
"coSize": "43",
"footLength": 279
},
{
"euSize": "43.5-44",
"ukSize": "9.5-10",
"usSize": "11.5-12",
"brSize": "44",
"mxSize": "28-28.5cm",
"jpSize": "27-27.5cm",
"krSize": "280-285",
"clSize": "44",
"coSize": "44",
"footLength": 280
},
{
"euSize": "43.5-44",
"ukSize": "9.5-10",
"usSize": "11.5-12",
"brSize": "44",
"mxSize": "28-28.5cm",
"jpSize": "27-27.5cm",
"krSize": "280-285",
"clSize": "44",
"coSize": "44",
"footLength": 281
},
{
"euSize": "43.5-44",
"ukSize": "9.5-10",
"usSize": "11.5-12",
"brSize": "44",
"mxSize": "28-28.5cm",
"jpSize": "27-27.5cm",
"krSize": "280-285",
"clSize": "44",
"coSize": "44",
"footLength": 282
},
{
"euSize": "43.5-44",
"ukSize": "9.5-10",
"usSize": "11.5-12",
"brSize": "44.5",
"mxSize": "29-29.5cm",
"jpSize": "28-28.5cm",
"krSize": "280-285",
"clSize": "44",
"coSize": "44",
"footLength": 283
},
{
"euSize": "43.5-44",
"ukSize": "9.5-10",
"usSize": "11.5-12",
"brSize": "44.5",
"mxSize": "29-29.5cm",
"jpSize": "28-28.5cm",
"krSize": "280-285",
"clSize": "44",
"coSize": "44",
"footLength": 284
},
{
"euSize": "43.5-44",
"ukSize": "9.5-10",
"usSize": "11.5-12",
"brSize": "45",
"mxSize": "29-29.5cm",
"jpSize": "28-28.5cm",
"krSize": "280-285",
"clSize": "45",
"coSize": "45",
"footLength": 285
},
{
"euSize": "43.5-44",
"ukSize": "10.5-11",
"usSize": "12.5-13",
"brSize": "45",
"mxSize": "29-29.5cm",
"jpSize": "28-28.5cm",
"krSize": "280-285",
"clSize": "45",
"coSize": "45",
"footLength": 286
},
{
"euSize": "44.5-45",
"ukSize": "10.5-11",
"usSize": "12.5-13",
"brSize": "45",
"mxSize": "29-29.5cm",
"jpSize": "28-28.5cm",
"krSize": "280-285",
"clSize": "45",
"coSize": "45",
"footLength": 287
},
{
"euSize": "44.5-45",
"ukSize": "10.5-11",
"usSize": "12.5-13",
"brSize": "45.5",
"mxSize": "29-29.5cm",
"jpSize": "28-28.5cm",
"krSize": "290-295",
"clSize": "45",
"coSize": "45",
"footLength": 288
},
{
"euSize": "44.5-45",
"ukSize": "10.5-11",
"usSize": "12.5-13",
"brSize": "45.5",
"mxSize": "29-29.5cm",
"jpSize": "28-28.5cm",
"krSize": "290-295",
"clSize": "45",
"coSize": "45",
"footLength": 289
},
{
"euSize": "44.5-45",
"ukSize": "10.5-11",
"usSize": "12.5-13",
"brSize": "46",
"mxSize": "29-29.5cm",
"jpSize": "28-28.5cm",
"krSize": "290-295",
"clSize": "46",
"coSize": "46",
"footLength": 290
},
{
"euSize": "44.5-45",
"ukSize": "10.5-11",
"usSize": "12.5-13",
"brSize": "46",
"mxSize": "29-29.5cm",
"jpSize": "28-28.5cm",
"krSize": "290-295",
"clSize": "46",
"coSize": "46",
"footLength": 291
},
{
"euSize": "44.5-45",
"ukSize": "10.5-11",
"usSize": "12.5-13",
"brSize": "46",
"mxSize": "29-29.5cm",
"jpSize": "28-28.5cm",
"krSize": "290-295",
"clSize": "46",
"coSize": "46",
"footLength": 292
},
{
"euSize": "44.5-45",
"ukSize": "10.5-11",
"usSize": "12.5-13",
"brSize": "46.5",
"mxSize": "30-30.5cm",
"jpSize": "29-29.5cm",
"krSize": "290-295",
"clSize": "46",
"coSize": "46",
"footLength": 293
},
{
"euSize": "45.5-46",
"ukSize": "10.5-11",
"usSize": "12.5-13",
"brSize": "46.5",
"mxSize": "30-30.5cm",
"jpSize": "29-29.5cm",
"krSize": "290-295",
"clSize": "46",
"coSize": "46",
"footLength": 294
},
{
"euSize": "45.5-46",
"ukSize": "11.5-12",
"usSize": "13.5-14",
"brSize": "47",
"mxSize": "30-30.5cm",
"jpSize": "29-29.5cm",
"krSize": "290-295",
"clSize": "47",
"coSize": "47",
"footLength": 295
},
{
"euSize": "45.5-46",
"ukSize": "11.5-12",
"usSize": "13.5-14",
"brSize": "47",
"mxSize": "30-30.5cm",
"jpSize": "29-29.5cm",
"krSize": "290-295",
"clSize": "47",
"coSize": "47",
"footLength": 296
},
{
"euSize": "45.5-46",
"ukSize": "11.5-12",
"usSize": "13.5-14",
"brSize": "47",
"mxSize": "30-30.5cm",
"jpSize": "29-29.5cm",
"krSize": "290-295",
"clSize": "47",
"coSize": "47",
"footLength": 297
},
{
"euSize": "45.5-46",
"ukSize": "11.5-12",
"usSize": "13.5-14",
"brSize": "47.5",
"mxSize": "30-30.5cm",
"jpSize": "29-29.5cm",
"krSize": "300-305",
"clSize": "47",
"coSize": "47",
"footLength": 298
},
{
"euSize": "45.5-46",
"ukSize": "11.5-12",
"usSize": "13.5-14",
"brSize": "47.5",
"mxSize": "30-30.5cm",
"jpSize": "29-29.5cm",
"krSize": "300-305",
"clSize": "47",
"coSize": "47",
"footLength": 299
},
{
"euSize": "45.5-46",
"ukSize": "11.5-12",
"usSize": "13.5-14",
"brSize": "48",
"mxSize": "30-30.5cm",
"jpSize": "29-29.5cm",
"krSize": "300-305",
"clSize": "48",
"coSize": "48",
"footLength": 300
},
{
"euSize": "46.5-47",
"ukSize": "11.5-12",
"usSize": "13.5-14",
"brSize": "48",
"mxSize": "30-30.5cm",
"jpSize": "29-29.5cm",
"krSize": "300-305",
"clSize": "48",
"coSize": "48",
"footLength": 301
},
{
"euSize": "46.5-47",
"ukSize": "11.5-12",
"usSize": "13.5-14",
"brSize": "48",
"mxSize": "30-30.5cm",
"jpSize": "29-29.5cm",
"krSize": "300-305",
"clSize": "48",
"coSize": "48",
"footLength": 302
},
{
"euSize": "46.5-47",
"ukSize": "12.5-13",
"usSize": "13.5-14",
"brSize": "48.5",
"mxSize": "31-31.5cm",
"jpSize": "30-30.5cm",
"krSize": "300-305",
"clSize": "48",
"coSize": "48",
"footLength": 303
},
{
"euSize": "46.5-47",
"ukSize": "12.5-13",
"usSize": "14.5-15",
"brSize": "48.5",
"mxSize": "31-31.5cm",
"jpSize": "30-30.5cm",
"krSize": "300-305",
"clSize": "48",
"coSize": "48",
"footLength": 304
},
{
"euSize": "46.5-47",
"ukSize": "12.5-13",
"usSize": "14.5-15",
"brSize": "49",
"mxSize": "31-31.5cm",
"jpSize": "30-30.5cm",
"krSize": "300-305",
"clSize": "49",
"coSize": "49",
"footLength": 305
},
{
"euSize": "46.5-47",
"ukSize": "12.5-13",
"usSize": "14.5-15",
"brSize": "49",
"mxSize": "31-31.5cm",
"jpSize": "30-30.5cm",
"krSize": "300-305",
"clSize": "49",
"coSize": "49",
"footLength": 306
},
{
"euSize": "47.5-48",
"ukSize": "12.5-13",
"usSize": "14.5-15",
"brSize": "49",
"mxSize": "31-31.5cm",
"jpSize": "30-30.5cm",
"krSize": "300-305",
"clSize": "49",
"coSize": "49",
"footLength": 307
},
{
"euSize": "47.5-48",
"ukSize": "12.5-13",
"usSize": "14.5-15",
"brSize": "49.5",
"mxSize": "31-31.5cm",
"jpSize": "30-30.5cm",
"krSize": "310-315",
"clSize": "49",
"coSize": "49",
"footLength": 308
},
{
"euSize": "47.5-48",
"ukSize": "12.5-13",
"usSize": "14.5-15",
"brSize": "49.5",
"mxSize": "31-31.5cm",
"jpSize": "30-30.5cm",
"krSize": "310-315",
"clSize": "49",
"coSize": "49",
"footLength": 309
},
{
"euSize": "47.5-48",
"ukSize": "12.5-13",
"usSize": "14.5-15",
"brSize": "50",
"mxSize": "31-31.5cm",
"jpSize": "30-30.5cm",
"krSize": "310-315",
"clSize": "50",
"coSize": "50",
"footLength": 310
},
{
"euSize": "47.5-48",
"ukSize": "12.5-13",
"usSize": "14.5-15",
"brSize": "50",
"mxSize": "31-31.5cm",
"jpSize": "30-30.5cm",
"krSize": "310-315",
"clSize": "50",
"coSize": "50",
"footLength": 311
},
{
"euSize": "47.5-48",
"ukSize": "13.5-14",
"usSize": "14.5-15",
"brSize": "50",
"mxSize": "31-31.5cm",
"jpSize": "30-30.5cm",
"krSize": "310-315",
"clSize": "50",
"coSize": "50",
"footLength": 312
},
{
"euSize": "47.5-48",
"ukSize": "13.5-14",
"usSize": "15.5-16",
"brSize": "50.5",
"mxSize": "32-32.5cm",
"jpSize": "31-31.5cm",
"krSize": "310-315",
"clSize": "50",
"coSize": "50",
"footLength": 313
},
{
"euSize": "48.5-49",
"ukSize": "13.5-14",
"usSize": "15.5-16",
"brSize": "50.5",
"mxSize": "32-32.5cm",
"jpSize": "31-31.5cm",
"krSize": "310-315",
"clSize": "50",
"coSize": "50",
"footLength": 314
},
{
"euSize": "48.5-49",
"ukSize": "13.5-14",
"usSize": "15.5-16",
"brSize": "51",
"mxSize": "32-32.5cm",
"jpSize": "31-31.5cm",
"krSize": "310-315",
"clSize": "51",
"coSize": "51",
"footLength": 315
},
{
"euSize": "48.5-49",
"ukSize": "13.5-14",
"usSize": "15.5-16",
"brSize": "51",
"mxSize": "32-32.5cm",
"jpSize": "31-31.5cm",
"krSize": "310-315",
"clSize": "51",
"coSize": "51",
"footLength": 316
},
{
"euSize": "48.5-49",
"ukSize": "13.5-14",
"usSize": "15.5-16",
"brSize": "51",
"mxSize": "32-32.5cm",
"jpSize": "31-31.5cm",
"krSize": "310-315",
"clSize": "51",
"coSize": "51",
"footLength": 317
},
{
"euSize": "48.5-49",
"ukSize": "13.5-14",
"usSize": "15.5-16",
"brSize": "51.5",
"mxSize": "32-32.5cm",
"jpSize": "31-31.5cm",
"krSize": "320-325",
"clSize": "51",
"coSize": "51",
"footLength": 318
},
{
"euSize": "48.5-49",
"ukSize": "13.5-14",
"usSize": "15.5-16",
"brSize": "51.5",
"mxSize": "32-32.5cm",
"jpSize": "31-31.5cm",
"krSize": "320-325",
"clSize": "51",
"coSize": "51",
"footLength": 319
},
{
"euSize": "48.5-49",
"ukSize": "14.5-15",
"usSize": "15.5-16",
"brSize": "52",
"mxSize": "32-32.5cm",
"jpSize": "31-31.5cm",
"krSize": "320-325",
"clSize": "52",
"coSize": "52",
"footLength": 320
},
{
"euSize": "49.5-50",
"ukSize": "14.5-15",
"usSize": "15.5-16",
"brSize": "52",
"mxSize": "32-32.5cm",
"jpSize": "31-31.5cm",
"krSize": "320-325",
"clSize": "52",
"coSize": "52",
"footLength": 321
},
{
"euSize": "49.5-50",
"ukSize": "14.5-15",
"usSize": "16.5-17",
"brSize": "52",
"mxSize": "32-32.5cm",
"jpSize": "31-31.5cm",
"krSize": "320-325",
"clSize": "52",
"coSize": "52",
"footLength": 322
},
{
"euSize": "49.5-50",
"ukSize": "14.5-15",
"usSize": "16.5-17",
"brSize": "52.5",
"mxSize": "33cm",
"jpSize": "32-32.5cm",
"krSize": "320-325",
"clSize": "52",
"coSize": "52",
"footLength": 323
},
{
"euSize": "49.5-50",
"ukSize": "14.5-15",
"usSize": "16.5-17",
"brSize": "52.5",
"mxSize": "33cm",
"jpSize": "32-32.5cm",
"krSize": "320-325",
"clSize": "52",
"coSize": "52",
"footLength": 324
},
{
"euSize": "49.5-50",
"ukSize": "14.5-15",
"usSize": "16.5-17",
"brSize": "53",
"mxSize": "33cm",
"jpSize": "32-32.5cm",
"krSize": "320-325",
"clSize": "53",
"coSize": "53",
"footLength": 325
},
{
"euSize": "49.5-50",
"ukSize": "14.5-15",
"usSize": "16.5-17",
"brSize": "53",
"mxSize": "33cm",
"jpSize": "32-32.5cm",
"krSize": "320-325",
"clSize": "53",
"coSize": "53",
"footLength": 326
},
{
"euSize": "50.5-51",
"ukSize": "14.5-15",
"usSize": "16.5-17",
"brSize": "53",
"mxSize": "33cm",
"jpSize": "32-32.5cm",
"krSize": "320-325",
"clSize": "53",
"coSize": "53",
"footLength": 327
},
{
"euSize": "50.5-51",
"ukSize": "16",
"usSize": "16.5-17",
"brSize": "53.5",
"mxSize": "33cm",
"jpSize": "32-32.5cm",
"krSize": "330",
"clSize": "53",
"coSize": "53",
"footLength": 328
},
{
"euSize": "50.5-51",
"ukSize": "16",
"usSize": "16.5-17",
"brSize": "53.5",
"mxSize": "33cm",
"jpSize": "32-32.5cm",
"krSize": "330",
"clSize": "53",
"coSize": "53",
"footLength": 329
},
{
"euSize": "50.5-51",
"ukSize": "16",
"usSize": "18",
"brSize": "54",
"mxSize": "33cm",
"jpSize": "32-32.5cm",
"krSize": "330",
"clSize": "54",
"coSize": "54",
"footLength": 330
}
]

## 男鞋双码
[
{
"euSize": "31.5-32",
"ukSize": "0.5-1",
"usSize": "1-1.5",
"brSize": "30.5",
"mxSize": "20.5cm",
"jpSize": "20.5",
"krSize": "205",
"clSize": "32.5",
"coSize": "28.5",
"footLength": 204
},
{
"euSize": "32-32.5",
"ukSize": "0.5-1",
"usSize": "1-1.5",
"brSize": "30.5",
"mxSize": "20.5cm",
"jpSize": "20.5",
"krSize": "205",
"clSize": "32.5",
"coSize": "29",
"footLength": 205
},
{
"euSize": "32-32.5",
"ukSize": "0.5-1",
"usSize": "1-1.5",
"brSize": "30.5",
"mxSize": "21cm",
"jpSize": "20.5",
"krSize": "205",
"clSize": "32.5",
"coSize": "29",
"footLength": 206
},
{
"euSize": "32.5-33",
"ukSize": "0.5-1",
"usSize": "1.5-2",
"brSize": "31",
"mxSize": "21cm",
"jpSize": "20.5",
"krSize": "205",
"clSize": "33",
"coSize": "29",
"footLength": 207
},
{
"euSize": "32.5-33",
"ukSize": "0.5-1",
"usSize": "1.5-2",
"brSize": "31",
"mxSize": "21cm",
"jpSize": "21",
"krSize": "205",
"clSize": "33",
"coSize": "29.5",
"footLength": 208
},
{
"euSize": "32.5-33",
"ukSize": "0.5-1",
"usSize": "1.5-2",
"brSize": "31",
"mxSize": "21cm",
"jpSize": "21",
"krSize": "210",
"clSize": "33",
"coSize": "29.5",
"footLength": 209
},
{
"euSize": "33-33.5",
"ukSize": "0.5-1",
"usSize": "1.5-2",
"brSize": "31",
"mxSize": "21cm",
"jpSize": "21",
"krSize": "210",
"clSize": "33.5",
"coSize": "30",
"footLength": 210
},
{
"euSize": "33-33.5",
"ukSize": "1.5-2",
"usSize": "1.5-2",
"brSize": "31.5",
"mxSize": "21.5cm",
"jpSize": "21",
"krSize": "210",
"clSize": "33.5",
"coSize": "30",
"footLength": 211
},
{
"euSize": "33-33.5",
"ukSize": "1.5-2",
"usSize": "1.5-2",
"brSize": "31.5",
"mxSize": "21.5cm",
"jpSize": "21",
"krSize": "210",
"clSize": "33.5",
"coSize": "30",
"footLength": 212
},
{
"euSize": "33-33.5",
"ukSize": "1.5-2",
"usSize": "1.5-2",
"brSize": "32",
"mxSize": "21.5cm",
"jpSize": "21.5",
"krSize": "210",
"clSize": "34",
"coSize": "30.5",
"footLength": 213
},
{
"euSize": "33.5-34",
"ukSize": "1.5-2",
"usSize": "1.5-2",
"brSize": "32",
"mxSize": "21.5cm",
"jpSize": "21.5",
"krSize": "215",
"clSize": "34",
"coSize": "30.5",
"footLength": 214
},
{
"euSize": "33.5-34",
"ukSize": "1.5-2",
"usSize": "2.5-3",
"brSize": "32",
"mxSize": "21.5cm",
"jpSize": "21.5",
"krSize": "215",
"clSize": "34",
"coSize": "31",
"footLength": 215
},
{
"euSize": "34-34.5",
"ukSize": "1.5-2",
"usSize": "2.5-3",
"brSize": "32.5",
"mxSize": "22cm",
"jpSize": "21.5",
"krSize": "215",
"clSize": "34",
"coSize": "31",
"footLength": 216
},
{
"euSize": "34-34.5",
"ukSize": "1.5-2",
"usSize": "2.5-3",
"brSize": "32.5",
"mxSize": "22cm",
"jpSize": "21.5",
"krSize": "215",
"clSize": "34.5",
"coSize": "31",
"footLength": 217
},
{
"euSize": "34-34.5",
"ukSize": "1.5-2",
"usSize": "2.5-3",
"brSize": "32.5",
"mxSize": "22cm",
"jpSize": "22",
"krSize": "215",
"clSize": "34.5",
"coSize": "31.5",
"footLength": 218
},
{
"euSize": "34-34.5",
"ukSize": "2.5-3",
"usSize": "2.5-3",
"brSize": "33",
"mxSize": "22cm",
"jpSize": "22",
"krSize": "220",
"clSize": "34.5",
"coSize": "31.5",
"footLength": 219
},
{
"euSize": "34.5-35",
"ukSize": "2.5-3",
"usSize": "2.5-3",
"brSize": "33",
"mxSize": "22cm",
"jpSize": "22",
"krSize": "220",
"clSize": "35",
"coSize": "32",
"footLength": 220
},
{
"euSize": "34.5-35",
"ukSize": "2.5-3",
"usSize": "2.5-3",
"brSize": "33",
"mxSize": "22.5cm",
"jpSize": "22",
"krSize": "220",
"clSize": "35",
"coSize": "32",
"footLength": 221
},
{
"euSize": "34.5-35",
"ukSize": "2.5-3",
"usSize": "2.5-3",
"brSize": "33.5",
"mxSize": "22.5cm",
"jpSize": "22",
"krSize": "220",
"clSize": "35",
"coSize": "32",
"footLength": 222
},
{
"euSize": "34.5-35",
"ukSize": "2.5-3",
"usSize": "2.5-3",
"brSize": "33.5",
"mxSize": "22.5cm",
"jpSize": "22.5",
"krSize": "220",
"clSize": "35",
"coSize": "32.5",
"footLength": 223
},
{
"euSize": "35-35.5",
"ukSize": "2.5-3",
"usSize": "3.5-4",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5",
"krSize": "225",
"clSize": "35.5",
"coSize": "32.5",
"footLength": 224
},
{
"euSize": "35-35.5",
"ukSize": "2.5-3",
"usSize": "3.5-4",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5",
"krSize": "225",
"clSize": "35.5",
"coSize": "33",
"footLength": 225
},
{
"euSize": "35-35.5",
"ukSize": "2.5-3",
"usSize": "3.5-4",
"brSize": "34",
"mxSize": "23cm",
"jpSize": "22.5",
"krSize": "225",
"clSize": "35.5",
"coSize": "33",
"footLength": 226
},
{
"euSize": "35.5-36",
"ukSize": "2.5-3",
"usSize": "3.5-4",
"brSize": "34",
"mxSize": "23cm",
"jpSize": "22.5",
"krSize": "225",
"clSize": "36",
"coSize": "33",
"footLength": 227
},
{
"euSize": "35.5-36",
"ukSize": "3.5-4",
"usSize": "3.5-4",
"brSize": "34.5",
"mxSize": "23cm",
"jpSize": "23",
"krSize": "225",
"clSize": "36",
"coSize": "33.5",
"footLength": 228
},
{
"euSize": "35.5-36",
"ukSize": "3.5-4",
"usSize": "3.5-4",
"brSize": "34.5",
"mxSize": "23cm",
"jpSize": "23",
"krSize": "230",
"clSize": "36",
"coSize": "33.5",
"footLength": 229
},
{
"euSize": "36-36.5",
"ukSize": "3.5-4",
"usSize": "3.5-4",
"brSize": "34.5",
"mxSize": "23cm",
"jpSize": "23",
"krSize": "230",
"clSize": "36.5",
"coSize": "34",
"footLength": 230
},
{
"euSize": "36-36.5",
"ukSize": "3.5-4",
"usSize": "3.5-4",
"brSize": "34.5",
"mxSize": "23.5cm",
"jpSize": "23",
"krSize": "230",
"clSize": "36.5",
"coSize": "34",
"footLength": 231
},
{
"euSize": "36-36.5",
"ukSize": "3.5-4",
"usSize": "4.5-5",
"brSize": "35",
"mxSize": "23.5cm",
"jpSize": "23",
"krSize": "230",
"clSize": "36.5",
"coSize": "34",
"footLength": 232
},
{
"euSize": "36.5-37",
"ukSize": "3.5-4",
"usSize": "4.5-5",
"brSize": "35",
"mxSize": "23.5cm",
"jpSize": "23.5",
"krSize": "230",
"clSize": "37",
"coSize": "34.5",
"footLength": 233
},
{
"euSize": "36.5-37",
"ukSize": "3.5-4",
"usSize": "4.5-5",
"brSize": "35",
"mxSize": "23.5cm",
"jpSize": "23.5",
"krSize": "235",
"clSize": "37",
"coSize": "34.5",
"footLength": 234
},
{
"euSize": "36.5-37",
"ukSize": "3.5-4",
"usSize": "4.5-5",
"brSize": "35",
"mxSize": "23.5cm",
"jpSize": "23.5",
"krSize": "235",
"clSize": "37",
"coSize": "35",
"footLength": 235
},
{
"euSize": "36.5-37",
"ukSize": "4.5-5",
"usSize": "4.5-5",
"brSize": "35.5",
"mxSize": "24cm",
"jpSize": "23.5",
"krSize": "235",
"clSize": "37",
"coSize": "35",
"footLength": 236
},
{
"euSize": "37-37.5",
"ukSize": "4.5-5",
"usSize": "4.5-5",
"brSize": "35.5",
"mxSize": "24cm",
"jpSize": "23.5",
"krSize": "235",
"clSize": "37.5",
"coSize": "35",
"footLength": 237
},
{
"euSize": "37-37.5",
"ukSize": "4.5-5",
"usSize": "5.5-6",
"brSize": "35.5",
"mxSize": "24cm",
"jpSize": "24",
"krSize": "235",
"clSize": "37.5",
"coSize": "35.5",
"footLength": 238
},
{
"euSize": "37-37.5",
"ukSize": "4.5-5",
"usSize": "5.5-6",
"brSize": "36",
"mxSize": "24cm",
"jpSize": "24",
"krSize": "240",
"clSize": "37.5",
"coSize": "35.5",
"footLength": 239
},
{
"euSize": "37.5-38",
"ukSize": "4.5-5",
"usSize": "5.5-6",
"brSize": "36",
"mxSize": "24cm",
"jpSize": "24",
"krSize": "240",
"clSize": "38",
"coSize": "36",
"footLength": 240
},
{
"euSize": "37.5-38",
"ukSize": "4.5-5",
"usSize": "5.5-6",
"brSize": "36",
"mxSize": "24.5cm",
"jpSize": "24",
"krSize": "240",
"clSize": "38",
"coSize": "36",
"footLength": 241
},
{
"euSize": "37.5-38",
"ukSize": "4.5-5",
"usSize": "5.5-6",
"brSize": "36.5",
"mxSize": "24.5cm",
"jpSize": "24",
"krSize": "240",
"clSize": "38",
"coSize": "36",
"footLength": 242
},
{
"euSize": "38-38.5",
"ukSize": "4.5-5",
"usSize": "5.5-6",
"brSize": "36.5",
"mxSize": "24.5cm",
"jpSize": "24.5",
"krSize": "240",
"clSize": "38.5",
"coSize": "36.5",
"footLength": 243
},
{
"euSize": "38-38.5",
"ukSize": "4.5-5",
"usSize": "5.5-6",
"brSize": "36.5",
"mxSize": "24.5cm",
"jpSize": "24.5",
"krSize": "245",
"clSize": "38.5",
"coSize": "36.5",
"footLength": 244
},
{
"euSize": "38-38.5",
"ukSize": "5.5-6",
"usSize": "6.5-7",
"brSize": "37",
"mxSize": "24.5cm",
"jpSize": "24.5",
"krSize": "245",
"clSize": "38.5",
"coSize": "37",
"footLength": 245
},
{
"euSize": "38.5-39",
"ukSize": "5.5-6",
"usSize": "6.5-7",
"brSize": "37",
"mxSize": "25cm",
"jpSize": "24.5",
"krSize": "245",
"clSize": "39",
"coSize": "37",
"footLength": 246
},
{
"euSize": "38.5-39",
"ukSize": "5.5-6",
"usSize": "6.5-7",
"brSize": "37",
"mxSize": "25cm",
"jpSize": "24.5",
"krSize": "245",
"clSize": "39",
"coSize": "37",
"footLength": 247
},
{
"euSize": "38.5-39",
"ukSize": "5.5-6",
"usSize": "6.5-7",
"brSize": "37",
"mxSize": "25cm",
"jpSize": "25",
"krSize": "245",
"clSize": "39",
"coSize": "37.5",
"footLength": 248
},
{
"euSize": "39-39.5",
"ukSize": "5.5-6",
"usSize": "6.5-7",
"brSize": "37.5",
"mxSize": "25cm",
"jpSize": "25",
"krSize": "250",
"clSize": "39.5",
"coSize": "37.5",
"footLength": 249
},
{
"euSize": "39-39.5",
"ukSize": "5.5-6",
"usSize": "6.5-7",
"brSize": "37.5",
"mxSize": "25cm",
"jpSize": "25",
"krSize": "250",
"clSize": "39.5",
"coSize": "38",
"footLength": 250
},
{
"euSize": "39-39.5",
"ukSize": "5.5-6",
"usSize": "6.5-7",
"brSize": "37.5",
"mxSize": "25.5cm",
"jpSize": "25",
"krSize": "250",
"clSize": "39.5",
"coSize": "38",
"footLength": 251
},
{
"euSize": "39-39.5",
"ukSize": "5.5-6",
"usSize": "6.5-7",
"brSize": "37.5",
"mxSize": "25.5cm",
"jpSize": "25",
"krSize": "250",
"clSize": "40",
"coSize": "38",
"footLength": 252
},
{
"euSize": "39.5-40",
"ukSize": "6.5-7",
"usSize": "7.5-8",
"brSize": "38",
"mxSize": "25.5cm",
"jpSize": "25.5",
"krSize": "250",
"clSize": "40",
"coSize": "38.5",
"footLength": 253
},
{
"euSize": "39.5-40",
"ukSize": "6.5-7",
"usSize": "7.5-8",
"brSize": "38",
"mxSize": "25.5cm",
"jpSize": "25.5",
"krSize": "255",
"clSize": "40",
"coSize": "38.5",
"footLength": 254
},
{
"euSize": "39.5-40",
"ukSize": "6.5-7",
"usSize": "7.5-8",
"brSize": "38",
"mxSize": "25.5cm",
"jpSize": "25.5",
"krSize": "255",
"clSize": "40",
"coSize": "39",
"footLength": 255
},
{
"euSize": "40-40.5",
"ukSize": "6.5-7",
"usSize": "7.5-8",
"brSize": "38",
"mxSize": "26cm",
"jpSize": "25.5",
"krSize": "255",
"clSize": "40.5",
"coSize": "39",
"footLength": 256
},
{
"euSize": "40-40.5",
"ukSize": "6.5-7",
"usSize": "7.5-8",
"brSize": "38.5",
"mxSize": "26cm",
"jpSize": "25.5",
"krSize": "255",
"clSize": "40.5",
"coSize": "39",
"footLength": 257
},
{
"euSize": "40-40.5",
"ukSize": "6.5-7",
"usSize": "7.5-8",
"brSize": "38.5",
"mxSize": "26cm",
"jpSize": "26",
"krSize": "255",
"clSize": "40.5",
"coSize": "39.5",
"footLength": 258
},
{
"euSize": "40.5-41",
"ukSize": "6.5-7",
"usSize": "7.5-8",
"brSize": "38.5",
"mxSize": "26cm",
"jpSize": "26",
"krSize": "260",
"clSize": "40.5",
"coSize": "39.5",
"footLength": 259
},
{
"euSize": "40.5-41",
"ukSize": "6.5-7",
"usSize": "7.5-8",
"brSize": "39",
"mxSize": "26cm",
"jpSize": "26",
"krSize": "260",
"clSize": "41",
"coSize": "40",
"footLength": 260
},
{
"euSize": "40.5-41",
"ukSize": "6.5-7",
"usSize": "7.5-8",
"brSize": "39",
"mxSize": "26.5cm",
"jpSize": "26",
"krSize": "260",
"clSize": "41",
"coSize": "40",
"footLength": 261
},
{
"euSize": "40.5-41",
"ukSize": "7.5-8",
"usSize": "8.5-9",
"brSize": "39.5",
"mxSize": "26.5cm",
"jpSize": "26",
"krSize": "260",
"clSize": "41",
"coSize": "40",
"footLength": 262
},
{
"euSize": "41-41.5",
"ukSize": "7.5-8",
"usSize": "8.5-9",
"brSize": "39.5",
"mxSize": "26.5cm",
"jpSize": "26.5",
"krSize": "260",
"clSize": "41.5",
"coSize": "40.5",
"footLength": 263
},
{
"euSize": "41-41.5",
"ukSize": "7.5-8",
"usSize": "8.5-9",
"brSize": "40",
"mxSize": "26.5cm",
"jpSize": "26.5",
"krSize": "265",
"clSize": "41.5",
"coSize": "40.5",
"footLength": 264
},
{
"euSize": "41.5-42",
"ukSize": "7.5-8",
"usSize": "8.5-9",
"brSize": "40",
"mxSize": "26.5cm",
"jpSize": "26.5",
"krSize": "265",
"clSize": "41.5",
"coSize": "41",
"footLength": 265
},
{
"euSize": "41.5-42",
"ukSize": "7.5-8",
"usSize": "8.5-9",
"brSize": "40",
"mxSize": "27cm",
"jpSize": "26.5",
"krSize": "265",
"clSize": "42",
"coSize": "41",
"footLength": 266
},
{
"euSize": "42-42.5",
"ukSize": "7.5-8",
"usSize": "8.5-9",
"brSize": "40.5",
"mxSize": "27cm",
"jpSize": "26.5",
"krSize": "265",
"clSize": "42",
"coSize": "41",
"footLength": 267
},
{
"euSize": "42-42.5",
"ukSize": "7.5-8",
"usSize": "8.5-9",
"brSize": "40.5",
"mxSize": "27cm",
"jpSize": "27",
"krSize": "265",
"clSize": "42",
"coSize": "41.5",
"footLength": 268
},
{
"euSize": "42-42.5",
"ukSize": "7.5-8",
"usSize": "8.5-9",
"brSize": "40.5",
"mxSize": "27cm",
"jpSize": "27",
"krSize": "270",
"clSize": "42.5",
"coSize": "41.5",
"footLength": 269
},
{
"euSize": "42.5-43",
"ukSize": "8.5-9",
"usSize": "9.5-10",
"brSize": "41",
"mxSize": "27cm",
"jpSize": "27",
"krSize": "270",
"clSize": "42.5",
"coSize": "42",
"footLength": 270
},
{
"euSize": "42.5-43",
"ukSize": "8.5-9",
"usSize": "9.5-10",
"brSize": "41",
"mxSize": "27.5cm",
"jpSize": "27",
"krSize": "270",
"clSize": "42.5",
"coSize": "42",
"footLength": 271
},
{
"euSize": "42.5-43",
"ukSize": "8.5-9",
"usSize": "9.5-10",
"brSize": "41",
"mxSize": "27.5cm",
"jpSize": "27",
"krSize": "270",
"clSize": "43",
"coSize": "42",
"footLength": 272
},
{
"euSize": "42.5-43",
"ukSize": "8.5-9",
"usSize": "9.5-10",
"brSize": "41",
"mxSize": "27.5cm",
"jpSize": "27.5",
"krSize": "270",
"clSize": "43",
"coSize": "42.5",
"footLength": 273
},
{
"euSize": "43-43.5",
"ukSize": "8.5-9",
"usSize": "9.5-10",
"brSize": "41.5",
"mxSize": "27.5cm",
"jpSize": "27.5",
"krSize": "275",
"clSize": "43",
"coSize": "42.5",
"footLength": 274
},
{
"euSize": "43-43.5",
"ukSize": "8.5-9",
"usSize": "9.5-10",
"brSize": "41.5",
"mxSize": "27.5cm",
"jpSize": "27.5",
"krSize": "275",
"clSize": "43",
"coSize": "43",
"footLength": 275
},
{
"euSize": "43-43.5",
"ukSize": "8.5-9",
"usSize": "9.5-10",
"brSize": "41.5",
"mxSize": "28cm",
"jpSize": "27.5",
"krSize": "275",
"clSize": "43.5",
"coSize": "43",
"footLength": 276
},
{
"euSize": "43.5-44",
"ukSize": "8.5-9",
"usSize": "9.5-10",
"brSize": "42",
"mxSize": "28cm",
"jpSize": "27.5",
"krSize": "275",
"clSize": "43.5",
"coSize": "43",
"footLength": 277
},
{
"euSize": "43.5-44",
"ukSize": "9.5-10",
"usSize": "10.5-11",
"brSize": "42",
"mxSize": "28cm",
"jpSize": "28",
"krSize": "275",
"clSize": "43.5",
"coSize": "43.5",
"footLength": 278
},
{
"euSize": "43.5-44",
"ukSize": "9.5-10",
"usSize": "10.5-11",
"brSize": "42",
"mxSize": "28cm",
"jpSize": "28",
"krSize": "280",
"clSize": "44",
"coSize": "43.5",
"footLength": 279
},
{
"euSize": "44-44.5",
"ukSize": "9.5-10",
"usSize": "10.5-11",
"brSize": "42",
"mxSize": "28cm",
"jpSize": "28",
"krSize": "280",
"clSize": "44",
"coSize": "44",
"footLength": 280
},
{
"euSize": "44-44.5",
"ukSize": "9.5-10",
"usSize": "10.5-11",
"brSize": "42.5",
"mxSize": "28.5cm",
"jpSize": "28",
"krSize": "280",
"clSize": "44",
"coSize": "44",
"footLength": 281
},
{
"euSize": "44-44.5",
"ukSize": "9.5-10",
"usSize": "10.5-11",
"brSize": "42.5",
"mxSize": "28.5cm",
"jpSize": "28",
"krSize": "280",
"clSize": "44",
"coSize": "44",
"footLength": 282
},
{
"euSize": "44-44.5",
"ukSize": "9.5-10",
"usSize": "10.5-11",
"brSize": "42.5",
"mxSize": "28.5cm",
"jpSize": "28.5",
"krSize": "280",
"clSize": "44.5",
"coSize": "44.5",
"footLength": 283
},
{
"euSize": "44.5-45",
"ukSize": "9.5-10",
"usSize": "10.5-11",
"brSize": "43",
"mxSize": "28.5cm",
"jpSize": "28.5",
"krSize": "285",
"clSize": "44.5",
"coSize": "44.5",
"footLength": 284
},
{
"euSize": "44.5-45",
"ukSize": "9.5-10",
"usSize": "10.5-11",
"brSize": "43",
"mxSize": "28.5cm",
"jpSize": "28.5",
"krSize": "285",
"clSize": "44.5",
"coSize": "45",
"footLength": 285
},
{
"euSize": "44.5-45",
"ukSize": "9.5-10",
"usSize": "10.5-11",
"brSize": "43",
"mxSize": "29cm",
"jpSize": "28.5",
"krSize": "285",
"clSize": "45",
"coSize": "45",
"footLength": 286
},
{
"euSize": "44.5-45",
"ukSize": "10.5-11",
"usSize": "11.5-12",
"brSize": "43.5",
"mxSize": "29cm",
"jpSize": "28.5",
"krSize": "285",
"clSize": "45",
"coSize": "45",
"footLength": 287
},
{
"euSize": "45-45.5",
"ukSize": "10.5-11",
"usSize": "11.5-12",
"brSize": "43.5",
"mxSize": "29cm",
"jpSize": "29",
"krSize": "285",
"clSize": "45",
"coSize": "45.5",
"footLength": 288
},
{
"euSize": "45-45.5",
"ukSize": "10.5-11",
"usSize": "11.5-12",
"brSize": "43.5",
"mxSize": "29cm",
"jpSize": "29",
"krSize": "290",
"clSize": "45.5",
"coSize": "45.5",
"footLength": 289
},
{
"euSize": "45.5-46",
"ukSize": "10.5-11",
"usSize": "11.5-12",
"brSize": "44",
"mxSize": "29cm",
"jpSize": "29",
"krSize": "290",
"clSize": "45.5",
"coSize": "46",
"footLength": 290
},
{
"euSize": "45.5-46",
"ukSize": "10.5-11",
"usSize": "11.5-12",
"brSize": "44",
"mxSize": "29.5cm",
"jpSize": "29",
"krSize": "290",
"clSize": "45.5",
"coSize": "46",
"footLength": 291
},
{
"euSize": "45.5-46",
"ukSize": "10.5-11",
"usSize": "11.5-12",
"brSize": "44",
"mxSize": "29.5cm",
"jpSize": "29",
"krSize": "290",
"clSize": "45.5",
"coSize": "46",
"footLength": 292
},
{
"euSize": "45.5-46",
"ukSize": "10.5-11",
"usSize": "11.5-12",
"brSize": "44.5",
"mxSize": "29.5cm",
"jpSize": "29.5",
"krSize": "290",
"clSize": "46",
"coSize": "46.5",
"footLength": 293
},
{
"euSize": "46-46.5",
"ukSize": "10.5-11",
"usSize": "11.5-12",
"brSize": "44.5",
"mxSize": "29.5cm",
"jpSize": "29.5",
"krSize": "295",
"clSize": "46",
"coSize": "46.5",
"footLength": 294
},
{
"euSize": "46-46.5",
"ukSize": "11.5-12",
"usSize": "12.5-13",
"brSize": "44.5",
"mxSize": "29.5cm",
"jpSize": "29.5",
"krSize": "295",
"clSize": "46",
"coSize": "47",
"footLength": 295
},
{
"euSize": "46-46.5",
"ukSize": "11.5-12",
"usSize": "12.5-13",
"brSize": "44.5",
"mxSize": "30cm",
"jpSize": "29.5",
"krSize": "295",
"clSize": "46.5",
"coSize": "47",
"footLength": 296
},
{
"euSize": "46.5-47",
"ukSize": "11.5-12",
"usSize": "12.5-13",
"brSize": "45",
"mxSize": "30cm",
"jpSize": "29.5",
"krSize": "295",
"clSize": "46.5",
"coSize": "47",
"footLength": 297
},
{
"euSize": "46.5-47",
"ukSize": "11.5-12",
"usSize": "12.5-13",
"brSize": "45",
"mxSize": "30cm",
"jpSize": "30",
"krSize": "295",
"clSize": "46.5",
"coSize": "47.5",
"footLength": 298
},
{
"euSize": "46.5-47",
"ukSize": "11.5-12",
"usSize": "12.5-13",
"brSize": "45",
"mxSize": "30cm",
"jpSize": "30",
"krSize": "300",
"clSize": "47",
"coSize": "47.5",
"footLength": 299
},
{
"euSize": "46.5-47",
"ukSize": "11.5-12",
"usSize": "12.5-13",
"brSize": "45",
"mxSize": "30cm",
"jpSize": "30",
"krSize": "300",
"clSize": "47",
"coSize": "48",
"footLength": 300
},
{
"euSize": "47-47.5",
"ukSize": "11.5-12",
"usSize": "12.5-13",
"brSize": "45.5",
"mxSize": "30.5cm",
"jpSize": "30",
"krSize": "300",
"clSize": "47",
"coSize": "48",
"footLength": 301
},
{
"euSize": "47-47.5",
"ukSize": "11.5-12",
"usSize": "12.5-13",
"brSize": "45.5",
"mxSize": "30.5cm",
"jpSize": "30",
"krSize": "300",
"clSize": "47.5",
"coSize": "48",
"footLength": 302
},
{
"euSize": "47-47.5",
"ukSize": "11.5-12",
"usSize": "12.5-13",
"brSize": "45.5",
"mxSize": "30.5cm",
"jpSize": "30.5",
"krSize": "300",
"clSize": "47.5",
"coSize": "48.5",
"footLength": 303
},
{
"euSize": "47-47.5",
"ukSize": "12.5-13",
"usSize": "13.5-14",
"brSize": "45.5",
"mxSize": "30.5cm",
"jpSize": "30.5",
"krSize": "305",
"clSize": "47.5",
"coSize": "48.5",
"footLength": 304
},
{
"euSize": "47-47.5",
"ukSize": "12.5-13",
"usSize": "13.5-14",
"brSize": "46",
"mxSize": "30.5cm",
"jpSize": "30.5",
"krSize": "305",
"clSize": "48",
"coSize": "49",
"footLength": 305
},
{
"euSize": "47.5-48",
"ukSize": "12.5-13",
"usSize": "13.5-14",
"brSize": "46",
"mxSize": "31cm",
"jpSize": "30.5",
"krSize": "305",
"clSize": "48",
"coSize": "49",
"footLength": 306
},
{
"euSize": "47.5-48",
"ukSize": "12.5-13",
"usSize": "13.5-14",
"brSize": "46",
"mxSize": "31cm",
"jpSize": "30.5",
"krSize": "305",
"clSize": "48",
"coSize": "49",
"footLength": 307
},
{
"euSize": "47.5-48",
"ukSize": "12.5-13",
"usSize": "13.5-14",
"brSize": "46",
"mxSize": "31cm",
"jpSize": "31",
"krSize": "305",
"clSize": "48.5",
"coSize": "49.5",
"footLength": 308
},
{
"euSize": "47.5-48",
"ukSize": "12.5-13",
"usSize": "13.5-14",
"brSize": "46.5",
"mxSize": "31cm",
"jpSize": "31",
"krSize": "310",
"clSize": "48.5",
"coSize": "49.5",
"footLength": 309
},
{
"euSize": "48-48.5",
"ukSize": "12.5-13",
"usSize": "13.5-14",
"brSize": "46.5",
"mxSize": "31cm",
"jpSize": "31",
"krSize": "310",
"clSize": "48.5",
"coSize": "50",
"footLength": 310
},
{
"euSize": "48-48.5",
"ukSize": "12.5-13",
"usSize": "13.5-14",
"brSize": "46.5",
"mxSize": "31.5cm",
"jpSize": "31",
"krSize": "310",
"clSize": "49",
"coSize": "50",
"footLength": 311
},
{
"euSize": "48-48.5",
"ukSize": "13.5-14",
"usSize": "14.5-15",
"brSize": "46.5",
"mxSize": "31.5cm",
"jpSize": "31",
"krSize": "310",
"clSize": "49",
"coSize": "50",
"footLength": 312
},
{
"euSize": "48-48.5",
"ukSize": "13.5-14",
"usSize": "14.5-15",
"brSize": "47",
"mxSize": "31.5cm",
"jpSize": "31.5",
"krSize": "310",
"clSize": "49",
"coSize": "50.5",
"footLength": 313
},
{
"euSize": "48.5-49",
"ukSize": "13.5-14",
"usSize": "14.5-15",
"brSize": "47",
"mxSize": "31.5cm",
"jpSize": "31.5",
"krSize": "315",
"clSize": "49.5",
"coSize": "50.5",
"footLength": 314
},
{
"euSize": "48.5-49",
"ukSize": "13.5-14",
"usSize": "14.5-15",
"brSize": "47",
"mxSize": "31.5cm",
"jpSize": "31.5",
"krSize": "315",
"clSize": "49.5",
"coSize": "51",
"footLength": 315
},
{
"euSize": "49-49.5",
"ukSize": "13.5-14",
"usSize": "14.5-15",
"brSize": "47.5",
"mxSize": "32cm",
"jpSize": "31.5",
"krSize": "315",
"clSize": "49.5",
"coSize": "51",
"footLength": 316
},
{
"euSize": "49-49.5",
"ukSize": "13.5-14",
"usSize": "14.5-15",
"brSize": "47.5",
"mxSize": "32cm",
"jpSize": "31.5",
"krSize": "315",
"clSize": "49.5",
"coSize": "51",
"footLength": 317
},
{
"euSize": "49.5-50",
"ukSize": "13.5-14",
"usSize": "14.5-15",
"brSize": "48",
"mxSize": "32cm",
"jpSize": "32",
"krSize": "315",
"clSize": "50",
"coSize": "51.5",
"footLength": 318
},
{
"euSize": "49.5-50",
"ukSize": "13.5-14",
"usSize": "14.5-15",
"brSize": "48",
"mxSize": "32cm",
"jpSize": "32",
"krSize": "320",
"clSize": "50",
"coSize": "51.5",
"footLength": 319
},
{
"euSize": "50-50.5",
"ukSize": "14.5-15",
"usSize": "15.5-16",
"brSize": "48",
"mxSize": "32cm",
"jpSize": "32",
"krSize": "320",
"clSize": "50",
"coSize": "52",
"footLength": 320
},
{
"euSize": "50-50.5",
"ukSize": "14.5-15",
"usSize": "15.5-16",
"brSize": "48.5",
"mxSize": "32.5cm",
"jpSize": "32",
"krSize": "320",
"clSize": "50.5",
"coSize": "52",
"footLength": 321
},
{
"euSize": "50-50.5",
"ukSize": "14.5-15",
"usSize": "15.5-16",
"brSize": "48.5",
"mxSize": "32.5cm",
"jpSize": "32",
"krSize": "320",
"clSize": "50.5",
"coSize": "52",
"footLength": 322
},
{
"euSize": "50.5-51",
"ukSize": "14.5-15",
"usSize": "15.5-16",
"brSize": "48.5",
"mxSize": "32.5cm",
"jpSize": "32.5",
"krSize": "320",
"clSize": "50.5",
"coSize": "52.5",
"footLength": 323
},
{
"euSize": "50.5-51",
"ukSize": "14.5-15",
"usSize": "15.5-16",
"brSize": "49",
"mxSize": "32.5cm",
"jpSize": "32.5",
"krSize": "325",
"clSize": "50.5",
"coSize": "52.5",
"footLength": 324
},
{
"euSize": "50.5-51",
"ukSize": "14.5-15",
"usSize": "15.5-16",
"brSize": "49",
"mxSize": "32.5cm",
"jpSize": "32.5",
"krSize": "325",
"clSize": "50.5",
"coSize": "53",
"footLength": 325
},
{
"euSize": "50.5-51",
"ukSize": "14.5-15",
"usSize": "15.5-16",
"brSize": "49",
"mxSize": "33cm",
"jpSize": "32.5",
"krSize": "325",
"clSize": "51",
"coSize": "53",
"footLength": 326
},
{
"euSize": "51-51.5",
"ukSize": "14.5-15",
"usSize": "15.5-16",
"brSize": "49.5",
"mxSize": "33cm",
"jpSize": "32.5",
"krSize": "325",
"clSize": "51",
"coSize": "53",
"footLength": 327
},
{
"euSize": "51-51.5",
"ukSize": "14.5-15",
"usSize": "15.5-16",
"brSize": "49.5",
"mxSize": "33cm",
"jpSize": "33",
"krSize": "325",
"clSize": "51",
"coSize": "53.5",
"footLength": 328
},
{
"euSize": "51-51.5",
"ukSize": "15.5-16",
"usSize": "16.5-17",
"brSize": "49.5",
"mxSize": "33cm",
"jpSize": "33",
"krSize": "330",
"clSize": "51.5",
"coSize": "53.5",
"footLength": 329
},
{
"euSize": "51.5-52",
"ukSize": "15.5-16",
"usSize": "16.5-17",
"brSize": "50",
"mxSize": "33cm",
"jpSize": "33",
"krSize": "330",
"clSize": "51.5",
"coSize": "54",
"footLength": 330
},
{
"euSize": "51.5-52",
"ukSize": "15.5-16",
"usSize": "16.5-17",
"brSize": "50",
"mxSize": "33.5cm",
"jpSize": "33",
"krSize": "330",
"clSize": "51.5",
"coSize": "54",
"footLength": 331
},
{
"euSize": "51.5-52",
"ukSize": "15.5-16",
"usSize": "16.5-17",
"brSize": "50",
"mxSize": "33.5cm",
"jpSize": "33",
"krSize": "330",
"clSize": "52",
"coSize": "54",
"footLength": 332
},
{
"euSize": "52-52.5",
"ukSize": "15.5-16",
"usSize": "16.5-17",
"brSize": "50.5",
"mxSize": "33.5cm",
"jpSize": "33.5",
"krSize": "330",
"clSize": "52",
"coSize": "54.5",
"footLength": 333
},
{
"euSize": "52-52.5",
"ukSize": "15.5-16",
"usSize": "16.5-17",
"brSize": "50.5",
"mxSize": "33.5cm",
"jpSize": "33.5",
"krSize": "335",
"clSize": "52",
"coSize": "54.5",
"footLength": 334
},
{
"euSize": "52-52.5",
"ukSize": "15.5-16",
"usSize": "16.5-17",
"brSize": "51",
"mxSize": "33.5cm",
"jpSize": "33.5",
"krSize": "335",
"clSize": "52.5",
"coSize": "55",
"footLength": 335
},
{
"euSize": "52.5-53",
"ukSize": "15.5-16",
"usSize": "16.5-17",
"brSize": "51",
"mxSize": "34cm",
"jpSize": "33.5",
"krSize": "335",
"clSize": "52.5",
"coSize": "55",
"footLength": 336
},
{
"euSize": "52.5-53",
"ukSize": "15.5-16",
"usSize": "17.5-18",
"brSize": "51",
"mxSize": "34cm",
"jpSize": "33.5",
"krSize": "335",
"clSize": "52.5",
"coSize": "55",
"footLength": 337
},
{
"euSize": "53-53.5",
"ukSize": "16.5-17",
"usSize": "17.5-18",
"brSize": "51.5",
"mxSize": "34cm",
"jpSize": "34",
"krSize": "335",
"clSize": "53",
"coSize": "55.5",
"footLength": 338
},
{
"euSize": "53-53.5",
"ukSize": "16.5-17",
"usSize": "17.5-18",
"brSize": "51.5",
"mxSize": "34cm",
"jpSize": "34",
"krSize": "340",
"clSize": "53",
"coSize": "55.5",
"footLength": 339
},
{
"euSize": "53.5-54",
"ukSize": "16.5-17",
"usSize": "17.5-18",
"brSize": "52",
"mxSize": "34cm",
"jpSize": "34",
"krSize": "340",
"clSize": "53",
"coSize": "56",
"footLength": 340
},
{
"euSize": "53.5-54",
"ukSize": "16.5-17",
"usSize": "17.5-18",
"brSize": "52",
"mxSize": "34.5cm",
"jpSize": "34",
"krSize": "340",
"clSize": "53",
"coSize": "56",
"footLength": 341
},
{
"euSize": "53.5-54",
"ukSize": "16.5-17",
"usSize": "17.5-18",
"brSize": "52",
"mxSize": "34.5cm",
"jpSize": "34",
"krSize": "340",
"clSize": "53.5",
"coSize": "56",
"footLength": 342
},
{
"euSize": "53.5-54",
"ukSize": "16.5-17",
"usSize": "17.5-18",
"brSize": "52",
"mxSize": "34.5cm",
"jpSize": "34.5",
"krSize": "340",
"clSize": "53.5",
"coSize": "56.5",
"footLength": 343
}
]

## 女童鞋双码
[
{
"euSize": "16.5-17",
"ukSize": "1-1.5 Infant",
"usSize": "1.5-2 Infant",
"brSize": "15.5",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 100
},
{
"euSize": "16.5-17",
"ukSize": "1-1.5 Infant",
"usSize": "1.5-2 Infant",
"brSize": "15.5",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 101
},
{
"euSize": "16.5-17",
"ukSize": "1-1.5 Infant",
"usSize": "1.5-2 Infant",
"brSize": "15.5",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 102
},
{
"euSize": "17-17.5",
"ukSize": "1-1.5 Infant",
"usSize": "1.5-2 Infant",
"brSize": "16",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 103
},
{
"euSize": "17-17.5",
"ukSize": "1-1.5 Infant",
"usSize": "1.5-2 Infant",
"brSize": "16",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 104
},
{
"euSize": "17-17.5",
"ukSize": "1-1.5 Infant",
"usSize": "1.5-2 Infant",
"brSize": "16",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 105
},
{
"euSize": "17.5-18",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "16.5",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 106
},
{
"euSize": "17.5-18",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "16.5",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 107
},
{
"euSize": "18-18.5",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "16.5",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 108
},
{
"euSize": "18-18.5",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "17",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 109
},
{
"euSize": "18-18.5",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "17",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 110
},
{
"euSize": "18-18.5",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "17",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 111
},
{
"euSize": "18.5-19",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "17.5",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 112
},
{
"euSize": "18.5-19",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "17.5",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 113
},
{
"euSize": "18.5-19",
"ukSize": "3-3.5 Toddler",
"usSize": "2.5-3 Infant",
"brSize": "17.5",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "0-6M",
"ukKsaSize": "7-12M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 114
},
{
"euSize": "19-19.5",
"ukSize": "3-3.5 Toddler",
"usSize": "2.5-3 Infant",
"brSize": "18",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "0-6M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 115
},
{
"euSize": "19-19.5",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "18",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 116
},
{
"euSize": "19-19.5",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "18",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 117
},
{
"euSize": "19-19.5",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "18.5",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 118
},
{
"euSize": "19.5-20",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "18.5",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 119
},
{
"euSize": "19.5-20",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "18.5",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 120
},
{
"euSize": "19.5-20",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "18.5",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 121
},
{
"euSize": "20-20.5",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "19",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 122
},
{
"euSize": "20-20.5",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "19",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 123
},
{
"euSize": "20-20.5",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "19",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 124
},
{
"euSize": "20.5-21",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "19.5",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 125
},
{
"euSize": "20.5-21",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "19.5",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 126
},
{
"euSize": "20.5-21",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "19.5",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 127
},
{
"euSize": "21-21.5",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "20",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 128
},
{
"euSize": "21-21.5",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "20",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 129
},
{
"euSize": "21-21.5",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "20",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 130
},
{
"euSize": "21.5-22",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "20.5",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 131
},
{
"euSize": "21.5-22",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "20.5",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 132
},
{
"euSize": "21.5-22",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "20.5",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 133
},
{
"euSize": "22-22.5",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "21",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 134
},
{
"euSize": "22-22.5",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "21",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 135
},
{
"euSize": "22-22.5",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "21",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 136
},
{
"euSize": "22.5-23",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "21.5",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 137
},
{
"euSize": "22.5-23",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "21.5",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 138
},
{
"euSize": "22.5-23",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "21.5",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 139
},
{
"euSize": "22.5-23",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "22",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 140
},
{
"euSize": "23-23.5",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "22",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 141
},
{
"euSize": "23-23.5",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "22",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 142
},
{
"euSize": "23-23.5",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "22.5",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 143
},
{
"euSize": "23-23.5",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "22.5",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 144
},
{
"euSize": "23.5-24",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "22.5",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 145
},
{
"euSize": "23.5-24",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "22.5",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 146
},
{
"euSize": "23.5-24",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "23",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 147
},
{
"euSize": "23.5-24",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "23",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 148
},
{
"euSize": "24-24.5",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "23",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 149
},
{
"euSize": "24-24.5",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 150
},
{
"euSize": "24-24.5",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 151
},
{
"euSize": "24.5-25",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 152
},
{
"euSize": "24.5-25",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 153
},
{
"euSize": "24.5-25",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "24",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 154
},
{
"euSize": "25-25.5",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "24",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 155
},
{
"euSize": "25-25.5",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "24",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 156
},
{
"euSize": "25-25.5",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "24.5",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 157
},
{
"euSize": "25.5-26",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "24.5",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 158
},
{
"euSize": "25.5-26",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "24.5",
"mxSize": "16cm",
"jpSize": "16cm",
"krSize": "160",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 159
},
{
"euSize": "25.5-26",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "24.5",
"mxSize": "16cm",
"jpSize": "16cm",
"krSize": "160",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 160
},
{
"euSize": "25.5-26",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25",
"mxSize": "16cm",
"jpSize": "16cm",
"krSize": "160",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 161
},
{
"euSize": "26-26.5",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 162
},
{
"euSize": "26-26.5",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 163
},
{
"euSize": "26-26.5",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 164
},
{
"euSize": "26-26.5",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25.5",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 165
},
{
"euSize": "26-26.5",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25.5",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 166
},
{
"euSize": "26.5-27",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25.5",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 167
},
{
"euSize": "26.5-27",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "25.5",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 168
},
{
"euSize": "26.5-27",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "26",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 169
},
{
"euSize": "27-27.5",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "26",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 170
},
{
"euSize": "27-27.5",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "26",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 171
},
{
"euSize": "27-27.5",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "26.5",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 172
},
{
"euSize": "27.5-28",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "26.5",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 173
},
{
"euSize": "27.5-28",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "26.5",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 174
},
{
"euSize": "27.5-28",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "27",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 175
},
{
"euSize": "27.5-28",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "27",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 176
},
{
"euSize": "28-28.5",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "27",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 177
},
{
"euSize": "28-28.5",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "27",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 178
},
{
"euSize": "28-28.5",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "27.5",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 179
},
{
"euSize": "28.5-29",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "27.5",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 180
},
{
"euSize": "28.5-29",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "27.5",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 181
},
{
"euSize": "28.5-29",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "28",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 182
},
{
"euSize": "28.5-29",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "28",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 183
},
{
"euSize": "29-29.5",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "28",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 184
},
{
"euSize": "29-29.5",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "28.5",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 185
},
{
"euSize": "29-29.5",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "28.5",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 186
},
{
"euSize": "29.5-30",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "28.5",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 187
},
{
"euSize": "29.5-30",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "28.5",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 188
},
{
"euSize": "29.5-30",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "29",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 189
},
{
"euSize": "30-30.5",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "29",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 190
},
{
"euSize": "30-30.5",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "29",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 191
},
{
"euSize": "30-30.5",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "29.5",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 192
},
{
"euSize": "30.5-31",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "29.5",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 193
},
{
"euSize": "30.5-31",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "29.5",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 194
},
{
"euSize": "31-31.5",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "30",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 195
},
{
"euSize": "31-31.5",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "30",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 196
},
{
"euSize": "31-31.5",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "30",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 197
},
{
"euSize": "31.5-32",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "30",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 198
},
{
"euSize": "31.5-32",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "30.5",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 199
},
{
"euSize": "31.5-32",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "30.5",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 200
},
{
"euSize": "31.5-32",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "30.5",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 201
},
{
"euSize": "32-32.5",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "31",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 202
},
{
"euSize": "32-32.5",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "31",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 203
},
{
"euSize": "32.5-33",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "31",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 204
},
{
"euSize": "32.5-33",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "31.5",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 205
},
{
"euSize": "32.5-33",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "31.5",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 206
},
{
"euSize": "33-33.5",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "31.5",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 207
},
{
"euSize": "33-33.5",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "32",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 208
},
{
"euSize": "33-33.5",
"ukSize": "1-1.5 Big Kid",
"usSize": "1.5-2 Big Kid",
"brSize": "32",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 209
},
{
"euSize": "33.5-34",
"ukSize": "1-1.5 Big Kid",
"usSize": "1.5-2 Big Kid",
"brSize": "32.5",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 210
},
{
"euSize": "33.5-34",
"ukSize": "1-1.5 Big Kid",
"usSize": "1.5-2 Big Kid",
"brSize": "32.5",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 211
},
{
"euSize": "33.5-34",
"ukSize": "1-1.5 Big Kid",
"usSize": "1.5-2 Big Kid",
"brSize": "32.5",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 212
},
{
"euSize": "33.5-34",
"ukSize": "1-1.5 Big Kid",
"usSize": "1.5-2 Big Kid",
"brSize": "33",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 213
},
{
"euSize": "34-34.5",
"ukSize": "1-1.5 Big Kid",
"usSize": "1.5-2 Big Kid",
"brSize": "33",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 214
},
{
"euSize": "34-34.5",
"ukSize": "1-1.5 Big Kid",
"usSize": "2.5-3 Big Kid",
"brSize": "33",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 215
},
{
"euSize": "34-34.5",
"ukSize": "1-1.5 Big Kid",
"usSize": "2.5-3 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 216
},
{
"euSize": "34.5-35",
"ukSize": "1-1.5 Big Kid",
"usSize": "2.5-3 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 217
},
{
"euSize": "34.5-35",
"ukSize": "2-2.5 Big Kid",
"usSize": "2.5-3 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 218
},
{
"euSize": "34.5-35",
"ukSize": "2-2.5 Big Kid",
"usSize": "2.5-3 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 219
},
{
"euSize": "35-35.5",
"ukSize": "2-2.5 Big Kid",
"usSize": "2.5-3 Big Kid",
"brSize": "34",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 220
},
{
"euSize": "35-35.5",
"ukSize": "2-2.5 Big Kid",
"usSize": "2.5-3 Big Kid",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 221
},
{
"euSize": "35-35.5",
"ukSize": "2-2.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 222
},
{
"euSize": "35-35.5",
"ukSize": "2-2.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "34.5",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 223
},
{
"euSize": "35.5-36",
"ukSize": "3-3.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "34.5",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 224
},
{
"euSize": "35.5-36",
"ukSize": "3-3.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "34.5",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 225
},
{
"euSize": "35.5-36",
"ukSize": "3-3.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "34.5",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 226
},
{
"euSize": "35.5-36",
"ukSize": "3-3.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "35",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 227
},
{
"euSize": "36-36.5",
"ukSize": "3-3.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "35",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 228
},
{
"euSize": "36-36.5",
"ukSize": "3-3.5 Big Kid",
"usSize": "4.5-5 Big Kid",
"brSize": "35",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 229
},
{
"euSize": "36-36.5",
"ukSize": "3-3.5 Big Kid",
"usSize": "4.5-5 Big Kid",
"brSize": "35",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 230
},
{
"euSize": "36-36.5",
"ukSize": "3-3.5 Big Kid",
"usSize": "4.5-5 Big Kid",
"brSize": "35.5",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 231
},
{
"euSize": "36.5-37",
"ukSize": "4-4.5 Big Kid",
"usSize": "4.5-5 Big Kid",
"brSize": "35.5",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 232
},
{
"euSize": "36.5-37",
"ukSize": "4-4.5 Big Kid",
"usSize": "4.5-5 Big Kid",
"brSize": "35.5",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 233
},
{
"euSize": "36.5-37",
"ukSize": "4-4.5 Big Kid",
"usSize": "4.5-5 Big Kid",
"brSize": "36",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 234
},
{
"euSize": "37-37.5",
"ukSize": "4-4.5 Big Kid",
"usSize": "5.5-6 Big Kid",
"brSize": "36",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 235
},
{
"euSize": "37-37.5",
"ukSize": "4-4.5 Big Kid",
"usSize": "5.5-6 Big Kid",
"brSize": "36",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 236
},
{
"euSize": "37-37.5",
"ukSize": "4-4.5 Big Kid",
"usSize": "5.5-6 Big Kid",
"brSize": "36.5",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 237
},
{
"euSize": "37.5-38",
"ukSize": "4-4.5 Big Kid",
"usSize": "5.5-6 Big Kid",
"brSize": "36.5",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 238
},
{
"euSize": "37.5-38",
"ukSize": "5-5.5 Big Kid",
"usSize": "5.5-6 Big Kid",
"brSize": "37",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 239
},
{
"euSize": "37.5-38",
"ukSize": "5-5.5 Big Kid",
"usSize": "5.5-6 Big Kid",
"brSize": "37",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 240
},
{
"euSize": "38-38.5",
"ukSize": "5-5.5 Big Kid",
"usSize": "5.5-6 Big Kid",
"brSize": "37",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 241
},
{
"euSize": "38-38.5",
"ukSize": "5-5.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "37.5",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "13-14Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 242
},
{
"euSize": "38.5-39",
"ukSize": "5-5.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "37.5",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "13-14Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "13-14Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 243
},
{
"euSize": "38.5-39",
"ukSize": "5-5.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "37.5",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "13-14Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "13-14Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 244
},
{
"euSize": "38.5-39",
"ukSize": "5-5.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "38",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "13-14Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 245
},
{
"euSize": "39-39.5",
"ukSize": "6-6.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 246
},
{
"euSize": "39-39.5",
"ukSize": "6-6.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 247
},
{
"euSize": "39.5-40",
"ukSize": "6-6.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 248
},
{
"euSize": "39.5-40",
"ukSize": "6-6.5 Big Kid",
"usSize": "7.5-8 Big Kid",
"brSize": "38.5",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 249
},
{
"euSize": "39.5-40",
"ukSize": "6-6.5 Big Kid",
"usSize": "7.5-8 Big Kid",
"brSize": "38.5",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 250
}
]

## 男童鞋双码

[
{
"euSize": "16.5-17",
"ukSize": "1-1.5 Infant",
"usSize": "1.5-2 Infant",
"brSize": "15.5",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 100
},
{
"euSize": "16.5-17",
"ukSize": "1-1.5 Infant",
"usSize": "1.5-2 Infant",
"brSize": "15.5",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 101
},
{
"euSize": "16.5-17",
"ukSize": "1-1.5 Infant",
"usSize": "1.5-2 Infant",
"brSize": "15.5",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 102
},
{
"euSize": "16.5-17",
"ukSize": "1-1.5 Infant",
"usSize": "1.5-2 Infant",
"brSize": "16",
"mxSize": "10cm",
"jpSize": "10cm",
"krSize": "100",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 103
},
{
"euSize": "17-17.5",
"ukSize": "1-1.5 Infant",
"usSize": "1.5-2 Infant",
"brSize": "16",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 104
},
{
"euSize": "17-17.5",
"ukSize": "1-1.5 Infant",
"usSize": "1.5-2 Infant",
"brSize": "16.5",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 105
},
{
"euSize": "17.5-18",
"ukSize": "1-1.5 Infant",
"usSize": "1.5-2 Infant",
"brSize": "16.5",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 106
},
{
"euSize": "17.5-18",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "16.5",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "105",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 107
},
{
"euSize": "18-18.5",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "16.5",
"mxSize": "10.5cm",
"jpSize": "10.5cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 108
},
{
"euSize": "18-18.5",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "17",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 109
},
{
"euSize": "18-18.5",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "17",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 110
},
{
"euSize": "18-18.5",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "17",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 111
},
{
"euSize": "18.5-19",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "17.5",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "110",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "0-6M",
"footLength": 112
},
{
"euSize": "18.5-19",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "17.5",
"mxSize": "11cm",
"jpSize": "11cm",
"krSize": "115",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "0-6M",
"mxKsaSize": "0-6M",
"krKsaSize": "7-12M",
"footLength": 113
},
{
"euSize": "18.5-19",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "17.5",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "0-6M",
"brKsaSize": "0-6M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 114
},
{
"euSize": "19-19.5",
"ukSize": "2-2.5 Infant",
"usSize": "2.5-3 Infant",
"brSize": "18",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "0-6M",
"ukKsaSize": "0-6M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 115
},
{
"euSize": "19-19.5",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "18",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 116
},
{
"euSize": "19-19.5",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "18",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 117
},
{
"euSize": "19-19.5",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "18",
"mxSize": "11.5cm",
"jpSize": "11.5cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 118
},
{
"euSize": "19.5-20",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "18.5",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 119
},
{
"euSize": "19.5-20",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "18.5",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "115",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 120
},
{
"euSize": "19.5-20",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "18.5",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 121
},
{
"euSize": "20-20.5",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "19",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 122
},
{
"euSize": "20-20.5",
"ukSize": "3-3.5 Toddler",
"usSize": "3.5-4 Toddler",
"brSize": "19",
"mxSize": "12cm",
"jpSize": "12cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 123
},
{
"euSize": "20-20.5",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "19",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "120",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 124
},
{
"euSize": "20-20.5",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "19.5",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 125
},
{
"euSize": "20.5-21",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "19.5",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 126
},
{
"euSize": "20.5-21",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "19.5",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 127
},
{
"euSize": "20.5-21",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "19.5",
"mxSize": "12.5cm",
"jpSize": "12.5cm",
"krSize": "125",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "7-12M",
"mxKsaSize": "7-12M",
"krKsaSize": "7-12M",
"footLength": 128
},
{
"euSize": "20.5-21",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "20",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 129
},
{
"euSize": "21-21.5",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "20",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 130
},
{
"euSize": "21-21.5",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "20",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "7-12M",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 131
},
{
"euSize": "21-21.5",
"ukSize": "4-4.5 Toddler",
"usSize": "4.5-5 Toddler",
"brSize": "20.5",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "130",
"usKsaSize": "7-12M",
"ukKsaSize": "7-12M",
"euKsaSize": "7-12M",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 132
},
{
"euSize": "21.5-22",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "20.5",
"mxSize": "13cm",
"jpSize": "13cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 133
},
{
"euSize": "21.5-22",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "20.5",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 134
},
{
"euSize": "21.5-22",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "21",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 135
},
{
"euSize": "22-22.5",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "21",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 136
},
{
"euSize": "22-22.5",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "21",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "135",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 137
},
{
"euSize": "22-22.5",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "21.5",
"mxSize": "13.5cm",
"jpSize": "13.5cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 138
},
{
"euSize": "22.5-23",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "21.5",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 139
},
{
"euSize": "22.5-23",
"ukSize": "5-5.5 Toddler",
"usSize": "5.5-6 Toddler",
"brSize": "21.5",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 140
},
{
"euSize": "22.5-23",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "22",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 141
},
{
"euSize": "23-23.5",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "22",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "140",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 142
},
{
"euSize": "23-23.5",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "22",
"mxSize": "14cm",
"jpSize": "14cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 143
},
{
"euSize": "23-23.5",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "22.5",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 144
},
{
"euSize": "23-23.5",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "22.5",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 145
},
{
"euSize": "23.5-24",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "22.5",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 146
},
{
"euSize": "23.5-24",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "23",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 147
},
{
"euSize": "23.5-24",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "23",
"mxSize": "14.5cm",
"jpSize": "14.5cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 148
},
{
"euSize": "23.5-24",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "23",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "145",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 149
},
{
"euSize": "24-24.5",
"ukSize": "6-6.5 Toddler",
"usSize": "6.5-7 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 150
},
{
"euSize": "24-24.5",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 151
},
{
"euSize": "24-24.5",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 152
},
{
"euSize": "24-24.5",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "23.5",
"mxSize": "15cm",
"jpSize": "15cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 153
},
{
"euSize": "24.5-25",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "24",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "150",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 154
},
{
"euSize": "24.5-25",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "24",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 155
},
{
"euSize": "24.5-25",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "24",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 156
},
{
"euSize": "25-25.5",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "24",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 157
},
{
"euSize": "25-25.5",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "24.5",
"mxSize": "15.5cm",
"jpSize": "15.5cm",
"krSize": "155",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 158
},
{
"euSize": "25.5-26",
"ukSize": "7-7.5 Toddler",
"usSize": "7.5-8 Toddler",
"brSize": "24.5",
"mxSize": "16cm",
"jpSize": "16cm",
"krSize": "160",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 159
},
{
"euSize": "25.5-26",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "24.5",
"mxSize": "16cm",
"jpSize": "16cm",
"krSize": "160",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 160
},
{
"euSize": "26-26.5",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25",
"mxSize": "16cm",
"jpSize": "16cm",
"krSize": "160",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 161
},
{
"euSize": "26-26.5",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 162
},
{
"euSize": "26-26.5",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 163
},
{
"euSize": "26-26.5",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 164
},
{
"euSize": "26.5-27",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25.5",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 165
},
{
"euSize": "26.5-27",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25.5",
"mxSize": "16.5cm",
"jpSize": "16.5cm",
"krSize": "165",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "1-3Y",
"mxKsaSize": "1-3Y",
"krKsaSize": "1-3Y",
"footLength": 166
},
{
"euSize": "26.5-27",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25.5",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 167
},
{
"euSize": "26.5-27",
"ukSize": "8-8.5 Toddler",
"usSize": "8.5-9 Toddler",
"brSize": "25.5",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "1-3Y",
"ukKsaSize": "1-3Y",
"euKsaSize": "1-3Y",
"brKsaSize": "1-3Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 168
},
{
"euSize": "26.5-27",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "26",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "1-3Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 169
},
{
"euSize": "27-27.5",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "26",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 170
},
{
"euSize": "27-27.5",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "26",
"mxSize": "17cm",
"jpSize": "17cm",
"krSize": "170",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 171
},
{
"euSize": "27-27.5",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "26.5",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 172
},
{
"euSize": "27.5-28",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "26.5",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 173
},
{
"euSize": "27.5-28",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "26.5",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 174
},
{
"euSize": "27.5-28",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "27",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 175
},
{
"euSize": "28-28.5",
"ukSize": "9-9.5 Little Kid",
"usSize": "9.5-10 Little Kid",
"brSize": "27",
"mxSize": "17.5cm",
"jpSize": "17.5cm",
"krSize": "175",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 176
},
{
"euSize": "28-28.5",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "27",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 177
},
{
"euSize": "28-28.5",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "27",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 178
},
{
"euSize": "28-28.5",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "27.5",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 179
},
{
"euSize": "28.5-29",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "27.5",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 180
},
{
"euSize": "28.5-29",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "27.5",
"mxSize": "18cm",
"jpSize": "18cm",
"krSize": "180",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 181
},
{
"euSize": "28.5-29",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "28",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 182
},
{
"euSize": "28.5-29",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "28",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 183
},
{
"euSize": "29-29.5",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "28",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 184
},
{
"euSize": "29-29.5",
"ukSize": "10-10.5 Little Kid",
"usSize": "10.5-11 Little Kid",
"brSize": "28.5",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 185
},
{
"euSize": "29-29.5",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "28.5",
"mxSize": "18.5cm",
"jpSize": "18.5cm",
"krSize": "185",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 186
},
{
"euSize": "29.5-30",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "28.5",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 187
},
{
"euSize": "29.5-30",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "28.5",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 188
},
{
"euSize": "29.5-30",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "29",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 189
},
{
"euSize": "30-30.5",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "29",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 190
},
{
"euSize": "30-30.5",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "29",
"mxSize": "19cm",
"jpSize": "19cm",
"krSize": "190",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 191
},
{
"euSize": "30-30.5",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "29.5",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 192
},
{
"euSize": "30.5-31",
"ukSize": "11-11.5 Little Kid",
"usSize": "11.5-12 Little Kid",
"brSize": "29.5",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 193
},
{
"euSize": "30.5-31",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "29.5",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 194
},
{
"euSize": "30.5-31",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "30",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 195
},
{
"euSize": "30.5-31",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "30",
"mxSize": "19.5cm",
"jpSize": "19.5cm",
"krSize": "195",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 196
},
{
"euSize": "31-31.5",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "30",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 197
},
{
"euSize": "31-31.5",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "30",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 198
},
{
"euSize": "31-31.5",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "30.5",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 199
},
{
"euSize": "31.5-32",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "30.5",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 200
},
{
"euSize": "31.5-32",
"ukSize": "12-12.5 Little Kid",
"usSize": "12.5-13 Little Kid",
"brSize": "30.5",
"mxSize": "20cm",
"jpSize": "20cm",
"krSize": "200",
"usKsaSize": "4-7Y",
"ukKsaSize": "4-7Y",
"euKsaSize": "4-7Y",
"brKsaSize": "4-7Y",
"jpKsaSize": "4-7Y",
"mxKsaSize": "4-7Y",
"krKsaSize": "4-7Y",
"footLength": 201
},
{
"euSize": "31.5-32",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "31",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "4-7Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 202
},
{
"euSize": "31.5-32",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "31",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "4-7Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 203
},
{
"euSize": "32-32.5",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "31",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 204
},
{
"euSize": "32-32.5",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "31.5",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 205
},
{
"euSize": "32-32.5",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "31.5",
"mxSize": "20.5cm",
"jpSize": "20.5cm",
"krSize": "205",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 206
},
{
"euSize": "32.5-33",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "31.5",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 207
},
{
"euSize": "32.5-33",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "32",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 208
},
{
"euSize": "32.5-33",
"ukSize": "13-13.5 Little Kid",
"usSize": "13.5-1 Big Kid",
"brSize": "32",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 209
},
{
"euSize": "33-33.5",
"ukSize": "1-1.5 Big Kid",
"usSize": "1.5-2 Big Kid",
"brSize": "32.5",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 210
},
{
"euSize": "33-33.5",
"ukSize": "1-1.5 Big Kid",
"usSize": "1.5-2 Big Kid",
"brSize": "32.5",
"mxSize": "21cm",
"jpSize": "21cm",
"krSize": "210",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 211
},
{
"euSize": "33-33.5",
"ukSize": "1-1.5 Big Kid",
"usSize": "1.5-2 Big Kid",
"brSize": "32.5",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 212
},
{
"euSize": "33.5-34",
"ukSize": "1-1.5 Big Kid",
"usSize": "1.5-2 Big Kid",
"brSize": "33",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 213
},
{
"euSize": "33.5-34",
"ukSize": "1-1.5 Big Kid",
"usSize": "1.5-2 Big Kid",
"brSize": "33",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 214
},
{
"euSize": "33.5-34",
"ukSize": "1-1.5 Big Kid",
"usSize": "1.5-2 Big Kid",
"brSize": "33",
"mxSize": "21.5cm",
"jpSize": "21.5cm",
"krSize": "215",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 215
},
{
"euSize": "33.5-34",
"ukSize": "1-1.5 Big Kid",
"usSize": "1.5-2 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 216
},
{
"euSize": "34-34.5",
"ukSize": "1-1.5 Big Kid",
"usSize": "1.5-2 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 217
},
{
"euSize": "34-34.5",
"ukSize": "2-2.5 Big Kid",
"usSize": "2.5-3 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 218
},
{
"euSize": "34-34.5",
"ukSize": "2-2.5 Big Kid",
"usSize": "2.5-3 Big Kid",
"brSize": "33.5",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 219
},
{
"euSize": "34.5-35",
"ukSize": "2-2.5 Big Kid",
"usSize": "2.5-3 Big Kid",
"brSize": "34",
"mxSize": "22cm",
"jpSize": "22cm",
"krSize": "220",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 220
},
{
"euSize": "34.5-35",
"ukSize": "2-2.5 Big Kid",
"usSize": "2.5-3 Big Kid",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 221
},
{
"euSize": "34.5-35",
"ukSize": "2-2.5 Big Kid",
"usSize": "2.5-3 Big Kid",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 222
},
{
"euSize": "35-35.5",
"ukSize": "2-2.5 Big Kid",
"usSize": "2.5-3 Big Kid",
"brSize": "34",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 223
},
{
"euSize": "35-35.5",
"ukSize": "3-3.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "34.5",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 224
},
{
"euSize": "35-35.5",
"ukSize": "3-3.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "34.5",
"mxSize": "22.5cm",
"jpSize": "22.5cm",
"krSize": "225",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 225
},
{
"euSize": "35.5-36",
"ukSize": "3-3.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "34.5",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 226
},
{
"euSize": "35.5-36",
"ukSize": "3-3.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "35",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 227
},
{
"euSize": "35.5-36",
"ukSize": "3-3.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "35",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 228
},
{
"euSize": "36-36.5",
"ukSize": "3-3.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "35",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 229
},
{
"euSize": "36-36.5",
"ukSize": "3-3.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "35.5",
"mxSize": "23cm",
"jpSize": "23cm",
"krSize": "230",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 230
},
{
"euSize": "36-36.5",
"ukSize": "3-3.5 Big Kid",
"usSize": "3.5-4 Big Kid",
"brSize": "35.5",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 231
},
{
"euSize": "36-36.5",
"ukSize": "4-4.5 Big Kid",
"usSize": "4.5-5 Big Kid",
"brSize": "35.5",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 232
},
{
"euSize": "36.5-37",
"ukSize": "4-4.5 Big Kid",
"usSize": "4.5-5 Big Kid",
"brSize": "36",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 233
},
{
"euSize": "36.5-37",
"ukSize": "4-4.5 Big Kid",
"usSize": "4.5-5 Big Kid",
"brSize": "36",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 234
},
{
"euSize": "36.5-37",
"ukSize": "4-4.5 Big Kid",
"usSize": "4.5-5 Big Kid",
"brSize": "36",
"mxSize": "23.5cm",
"jpSize": "23.5cm",
"krSize": "235",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 235
},
{
"euSize": "37-37.5",
"ukSize": "4-4.5 Big Kid",
"usSize": "4.5-5 Big Kid",
"brSize": "36",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 236
},
{
"euSize": "37-37.5",
"ukSize": "4-4.5 Big Kid",
"usSize": "4.5-5 Big Kid",
"brSize": "36.5",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 237
},
{
"euSize": "37.5-38",
"ukSize": "4-4.5 Big Kid",
"usSize": "4.5-5 Big Kid",
"brSize": "36.5",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 238
},
{
"euSize": "37.5-38",
"ukSize": "5-5.5 Big Kid",
"usSize": "5.5-6 Big Kid",
"brSize": "36.5",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 239
},
{
"euSize": "37.5-38",
"ukSize": "5-5.5 Big Kid",
"usSize": "5.5-6 Big Kid",
"brSize": "37",
"mxSize": "24cm",
"jpSize": "24cm",
"krSize": "240",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "8-12Y",
"mxKsaSize": "8-12Y",
"krKsaSize": "8-12Y",
"footLength": 240
},
{
"euSize": "37.5-38",
"ukSize": "5-5.5 Big Kid",
"usSize": "5.5-6 Big Kid",
"brSize": "37",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 241
},
{
"euSize": "38-38.5",
"ukSize": "5-5.5 Big Kid",
"usSize": "5.5-6 Big Kid",
"brSize": "37",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "8-12Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 242
},
{
"euSize": "38-38.5",
"ukSize": "5-5.5 Big Kid",
"usSize": "5.5-6 Big Kid",
"brSize": "37.5",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 243
},
{
"euSize": "38-38.5",
"ukSize": "5-5.5 Big Kid",
"usSize": "5.5-6 Big Kid",
"brSize": "37.5",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "8-12Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 244
},
{
"euSize": "38-38.5",
"ukSize": "5-5.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "37.5",
"mxSize": "24.5cm",
"jpSize": "24.5cm",
"krSize": "245",
"usKsaSize": "13-14Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "8-12Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 245
},
{
"euSize": "38.5-39",
"ukSize": "5-5.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "8-12Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 246
},
{
"euSize": "38.5-39",
"ukSize": "6-6.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 247
},
{
"euSize": "38.5-39",
"ukSize": "6-6.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 248
},
{
"euSize": "38.5-39",
"ukSize": "6-6.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "38",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 249
},
{
"euSize": "39-39.5",
"ukSize": "6-6.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "38.5",
"mxSize": "25cm",
"jpSize": "25cm",
"krSize": "250",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 250
},
{
"euSize": "39-39.5",
"ukSize": "6-6.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "38.5",
"mxSize": "25.5cm",
"jpSize": "25.5cm",
"krSize": "255",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 251
},
{
"euSize": "39-39.5",
"ukSize": "6-6.5 Big Kid",
"usSize": "6.5-7 Big Kid",
"brSize": "38.5",
"mxSize": "25.5cm",
"jpSize": "25.5cm",
"krSize": "255",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 252
},
{
"euSize": "39-39.5",
"ukSize": "6-6.5 Big Kid",
"usSize": "7.5-8 Big Kid",
"brSize": "38.5",
"mxSize": "25.5cm",
"jpSize": "25.5cm",
"krSize": "255",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 253
},
{
"euSize": "39.5-40",
"ukSize": "6-6.5 Big Kid",
"usSize": "7.5-8 Big Kid",
"brSize": "39",
"mxSize": "25.5cm",
"jpSize": "25.5cm",
"krSize": "255",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 254
},
{
"euSize": "39.5-40",
"ukSize": "6-6.5 Big Kid",
"usSize": "7.5-8 Big Kid",
"brSize": "39",
"mxSize": "25.5cm",
"jpSize": "25.5cm",
"krSize": "255",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 255
},
{
"euSize": "39.5-40",
"ukSize": "6-6.5 Big Kid",
"usSize": "7.5-8 Big Kid",
"brSize": "39",
"mxSize": "25.5cm",
"jpSize": "25.5cm",
"krSize": "255",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "13-14Y",
"mxKsaSize": "13-14Y",
"krKsaSize": "13-14Y",
"footLength": 256
},
{
"euSize": "39.5-40",
"ukSize": "6-6.5 Big Kid",
"usSize": "7.5-8 Big Kid",
"brSize": "39",
"mxSize": "26cm",
"jpSize": "26cm",
"krSize": "260",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 257
},
{
"euSize": "40-40.5",
"ukSize": "7-7.5 Big Kid",
"usSize": "7.5-8 Big Kid",
"brSize": "39.5",
"mxSize": "26cm",
"jpSize": "26cm",
"krSize": "260",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 258
},
{
"euSize": "40-40.5",
"ukSize": "7-7.5 Big Kid",
"usSize": "7.5-8 Big Kid",
"brSize": "39.5",
"mxSize": "26cm",
"jpSize": "26cm",
"krSize": "260",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 259
},
{
"euSize": "40.5-41",
"ukSize": "7-7.5 Big Kid",
"usSize": "7.5-8 Big Kid",
"brSize": "39.5",
"mxSize": "26cm",
"jpSize": "26cm",
"krSize": "260",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "13-14Y",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 260
},
{
"euSize": "40.5-41",
"ukSize": "7-7.5 Big Kid",
"usSize": "7.5-8 Big Kid",
"brSize": "40",
"mxSize": "26cm",
"jpSize": "26cm",
"krSize": "260",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 261
},
{
"euSize": "40.5-41",
"ukSize": "7-7.5 Big Kid",
"usSize": "7.5-8 Big Kid",
"brSize": "40",
"mxSize": "26.5cm",
"jpSize": "26.5cm",
"krSize": "265",
"usKsaSize": "13-14Y",
"ukKsaSize": "13-14Y",
"euKsaSize": "13-14Y",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 262
},
{
"euSize": "41-41.5",
"ukSize": "7-7.5 Big Kid",
"usSize": "8.5-9 Big Kid",
"brSize": "40",
"mxSize": "26.5cm",
"jpSize": "26.5cm",
"krSize": "265",
"usKsaSize": "15Y+",
"ukKsaSize": "13-14Y",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 263
},
{
"euSize": "41-41.5",
"ukSize": "7-7.5 Big Kid",
"usSize": "8.5-9 Big Kid",
"brSize": "40.5",
"mxSize": "26.5cm",
"jpSize": "26.5cm",
"krSize": "265",
"usKsaSize": "15Y+",
"ukKsaSize": "13-14Y",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 264
},
{
"euSize": "41-41.5",
"ukSize": "7-7.5 Big Kid",
"usSize": "8.5-9 Big Kid",
"brSize": "40.5",
"mxSize": "26.5cm",
"jpSize": "26.5cm",
"krSize": "265",
"usKsaSize": "15Y+",
"ukKsaSize": "13-14Y",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 265
},
{
"euSize": "41.5-42",
"ukSize": "8-8.5 Big Kid",
"usSize": "8.5-9 Big Kid",
"brSize": "40.5",
"mxSize": "26.5cm",
"jpSize": "26.5cm",
"krSize": "265",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 266
},
{
"euSize": "41.5-42",
"ukSize": "8-8.5 Big Kid",
"usSize": "8.5-9 Big Kid",
"brSize": "41",
"mxSize": "27cm",
"jpSize": "27cm",
"krSize": "270",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 267
},
{
"euSize": "41.5-42",
"ukSize": "8-8.5 Big Kid",
"usSize": "8.5-9 Big Kid",
"brSize": "41",
"mxSize": "27cm",
"jpSize": "27cm",
"krSize": "270",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 268
},
{
"euSize": "42-42.5",
"ukSize": "8-8.5 Big Kid",
"usSize": "8.5-9 Big Kid",
"brSize": "41",
"mxSize": "27cm",
"jpSize": "27cm",
"krSize": "270",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 269
},
{
"euSize": "42-42.5",
"ukSize": "8-8.5 Big Kid",
"usSize": "9.5-10 Big Kid",
"brSize": "41.5",
"mxSize": "27cm",
"jpSize": "27cm",
"krSize": "270",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 270
},
{
"euSize": "42-42.5",
"ukSize": "8-8.5 Big Kid",
"usSize": "9.5-10 Big Kid",
"brSize": "41.5",
"mxSize": "27cm",
"jpSize": "27cm",
"krSize": "270",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 271
},
{
"euSize": "42-42.5",
"ukSize": "8-8.5 Big Kid",
"usSize": "9.5-10 Big Kid",
"brSize": "41.5",
"mxSize": "27.5cm",
"jpSize": "27.5cm",
"krSize": "275",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 272
},
{
"euSize": "42.5-43",
"ukSize": "8-8.5 Big Kid",
"usSize": "9.5-10 Big Kid",
"brSize": "41.5",
"mxSize": "27.5cm",
"jpSize": "27.5cm",
"krSize": "275",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 273
},
{
"euSize": "42.5-43",
"ukSize": "9-9.5 Big Kid",
"usSize": "9.5-10 Big Kid",
"brSize": "42",
"mxSize": "27.5cm",
"jpSize": "27.5cm",
"krSize": "275",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 274
},
{
"euSize": "43-43.5",
"ukSize": "9-9.5 Big Kid",
"usSize": "9.5-10 Big Kid",
"brSize": "42",
"mxSize": "27.5cm",
"jpSize": "27.5cm",
"krSize": "275",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 275
},
{
"euSize": "43-43.5",
"ukSize": "9-9.5 Big Kid",
"usSize": "9.5-10 Big Kid",
"brSize": "42",
"mxSize": "27.5cm",
"jpSize": "27.5cm",
"krSize": "275",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 276
},
{
"euSize": "43-43.5",
"ukSize": "9-9.5 Big Kid",
"usSize": "9.5-10 Big Kid",
"brSize": "42",
"mxSize": "28cm",
"jpSize": "28cm",
"krSize": "280",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 277
},
{
"euSize": "43.5-44",
"ukSize": "9-9.5 Big Kid",
"usSize": "10.5-11 Big Kid",
"brSize": "42.5",
"mxSize": "28cm",
"jpSize": "28cm",
"krSize": "280",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 278
},
{
"euSize": "43.5-44",
"ukSize": "9-9.5 Big Kid",
"usSize": "10.5-11 Big Kid",
"brSize": "42.5",
"mxSize": "28cm",
"jpSize": "28cm",
"krSize": "280",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 279
},
{
"euSize": "43.5-44",
"ukSize": "9-9.5 Big Kid",
"usSize": "10.5-11 Big Kid",
"brSize": "42.5",
"mxSize": "28cm",
"jpSize": "28cm",
"krSize": "280",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 280
},
{
"euSize": "44-44.5",
"ukSize": "9-9.5 Big Kid",
"usSize": "10.5-11 Big Kid",
"brSize": "42.5",
"mxSize": "28.5cm",
"jpSize": "28.5cm",
"krSize": "285",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 281
},
{
"euSize": "44-44.5",
"ukSize": "9-9.5 Big Kid",
"usSize": "10.5-11 Big Kid",
"brSize": "43",
"mxSize": "28.5cm",
"jpSize": "28.5cm",
"krSize": "285",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 282
},
{
"euSize": "44-44.5",
"ukSize": "10-10.5 Big Kid",
"usSize": "10.5-11 Big Kid",
"brSize": "43",
"mxSize": "28.5cm",
"jpSize": "28.5cm",
"krSize": "285",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 283
},
{
"euSize": "44.5-45",
"ukSize": "10-10.5 Big Kid",
"usSize": "10.5-11 Big Kid",
"brSize": "43",
"mxSize": "28.5cm",
"jpSize": "28.5cm",
"krSize": "285",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 284
},
{
"euSize": "44.5-45",
"ukSize": "10-10.5 Big Kid",
"usSize": "10.5-11 Big Kid",
"brSize": "43",
"mxSize": "28.5cm",
"jpSize": "28.5cm",
"krSize": "285",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 285
},
{
"euSize": "44.5-45",
"ukSize": "10-10.5 Big Kid",
"usSize": "10.5-11 Big Kid",
"brSize": "43.5",
"mxSize": "29cm",
"jpSize": "29cm",
"krSize": "290",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 286
},
{
"euSize": "44.5-45",
"ukSize": "10-10.5 Big Kid",
"usSize": "11.5-12 Big Kid",
"brSize": "43.5",
"mxSize": "29cm",
"jpSize": "29cm",
"krSize": "290",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 287
},
{
"euSize": "45-45.5",
"ukSize": "10-10.5 Big Kid",
"usSize": "11.5-12 Big Kid",
"brSize": "43.5",
"mxSize": "29cm",
"jpSize": "29cm",
"krSize": "290",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 288
},
{
"euSize": "45-45.5",
"ukSize": "10-10.5 Big Kid",
"usSize": "11.5-12 Big Kid",
"brSize": "44",
"mxSize": "29cm",
"jpSize": "29cm",
"krSize": "290",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 289
},
{
"euSize": "45-45.5",
"ukSize": "10-10.5 Big Kid",
"usSize": "11.5-12 Big Kid",
"brSize": "44",
"mxSize": "29cm",
"jpSize": "29cm",
"krSize": "290",
"usKsaSize": "15Y+",
"ukKsaSize": "15Y+",
"euKsaSize": "15Y+",
"brKsaSize": "15Y+",
"jpKsaSize": "15Y+",
"mxKsaSize": "15Y+",
"krKsaSize": "15Y+",
"footLength": 290
}
]

## 文档中心 / 开发者文档 / 数据字典 / 车型库必填类目

- 文档 ID：`161781232534`
- 更新时间：`2025-12-09T21:04:22.668000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=161781232534`

# 必填说明：
全托发布如下类目的货品 / 半托发布以下站点&如下类目的货品
当“适用车型维护 =见详情“时，兼容车型数据不能为空。“适用车型维护 =通用“时，则车型库非必填。

# 站点：
美国 100
加拿大 101
英国 102
德国 105
澳大利亚 103
意大利 107
法国 106
西班牙 109

# 类目ID：
20686,20692,20693,20699,20701,20702,20703,20706,20707,20711,20712,20719,20720,20736,20737,20738,20739,20740,20741,20746,20749,20750,20751,20753,20754,20774,20775,20776,20777,20778,20808,20824,20826,20834,20838,20843,20875,20876,20877,20878,20879,20881,20886,20887,20888,20889,20890,20891,20904,20908,20909,20917,20918,20919,21109,21110,21111,21112,21113,21117,21118,21119,21120,21121,21123,21124,21125,21126,21127,21128,21129,21130,21131,21132,21133,21134,21135,21136,21137,21138,21139,21140,21141,21142,21143,21144,21145,21146,21147,21149,21150,21151,21155,21156,21158,21159,21160,21161,21162,21163,21164,21165,21166,21168,21169,21170,21171,21536,21537,21538,21539,21540,21541,21543,21544,21545,21546,21547,21548,21549,21550,21551,21552,21553,21555,21556,21557,21558,21559,21560,21561,21562,21563,21565,21566,21567,21571,21572,21573,21575,21576,21577,21578,21580,21581,21582,21583,21585,21587,21588,21589,21590,21591,21592,21593,21595,21596,21597,21598,21599,21601,21603,21604,21606,21607,21608,21610,21611,21613,21614,21616,21617,21618,21619,21620,21621,21622,21623,21624,21625,21626,21627,21628,21629,21630,21632,21633,21634,21635,21636,21637,21638,21639,21640,21641,21642,21643,21644,21645,21646,21648,21649,21650,21651,21652,21653,21654,21655,21656,21658,21659,21660,21661,21662,21663,21674,21677,21681,21684,21685,21686,21687,20582,20645,20922,20923,20932,20936,20945,20947,21738,21767,21775,21776,21778,21779,21780,21781,21790,21799,21805,21873,21878,21879,21881,21892,21896,21897,21898,21899,21900,21901,21902,21904,21905,21906,21907,21908,21249,21250,21251,21252,21253,21254,21255,21256,21257,21258,21259,21260,21261,21262,21263,21264,21265,21266,21267,21268,21270,21271,21272,21273,21274,21275,21276,21277,21278,21279,21280,21281,21282,21283,21284,21285,21286,21287,21288,21291,21292,21293,21294,21295,21296,21297,21784,21786,21788,21792,20544,20545,20546,20547,20548,20565,20566,20567,20673,20674,20675,20676,20677,20679,20681,20682,21050,21051,21052,21053,21055,21056,21057,21058,21059,21060,21061,21062,21063,21064,21065,21066,21069,21070,21071,21072,21073,21074,21075,21076,21077,21079,21080,21081,21082,21083,21085,21086,21087,21088,21089,21090,21091,21092,21093,21094,21095,21097,21098,21099,21101,21103,21104,21105,21106,21107,21229,21230,21231,21232,21233,21234,21235,21236,21237,21238,21239,21240,21241,21242,21243,21420,21422,21434,21447,21452,21453,21457,21462,21463,21464,21469,21470,21471,21475,21476,21483,21487,21488,21489,21490,21491,21502,20446,20448,20450,20451,20452,20453,20454,20455,20456,20457,20459,20460,20461,20463,20464,20466,20468,20469,20470,20471,20472,20473,20474,20475,20476,20477,20479,20481,20482,20483,20484,20485,22176,22152,22184,22392,22049,22050,22034,22035,22036,22037,22038,22039,22040,22041,22042,22043,22044,22045,22046,22047,22048,22049,22050,22051,22052,22053,22054,22055,22056,22057,22058,22149,20724,20719

## 文档中心 / 开发者文档 / 数据字典 / 支持底板套板的类目

- 文档 ID：`151293979205`
- 更新时间：`2026-01-06T16:47:27.639000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=151293979205`

28994, 29014, 28992, 28951, 28950, 28949, 39128, 29066, 29065, 28952, 39129, 39153, 39127, 29069, 29070, 29075, 29151, 29074, 29140, 29071, 29067, 29073, 29357, 29362, 29347, 29346, 29356, 29355, 28786, 28805, 28802, 28804, 53787, 29012, 39107, 29149, 29076, 28958, 28959, 28972, 39155, 29126, 29150, 29345, 29350, 29348, 29351, 29349, 28806, 28790, 28788, 28791, 28789, 28787, 28807, 28960, 27046, 39033, 39038, 39034, 39040, 39041, 39029, 39044, 39035, 39030, 39031, 39090, 39092, 39088, 39093, 39091, 39089, 39097, 29080, 29082, 29083, 29098, 29106, 29130, 29134, 29131, 29132, 29135, 29107, 29084, 29100, 29086, 30089, 30090, 30112, 30111, 30113, 30114, 30115, 39272, 39273, 40356, 40357, 40358, 40359, 40360, 40362, 40363, 40364, 40365, 40366, 53993, 39052, 39055, 39056, 29015, 39022, 39023, 39025, 39079, 39082, 39081, 39078, 39084, 39080, 39083, 29008, 29002, 29001, 28996, 28997, 28998, 29009, 28999, 29010, 29006, 29007, 29005, 29003, 28730, 34578, 34579, 34583, 34594, 34328, 38614, 53837, 53840, 53841, 53845, 53846, 53852, 53855, 53856, 53858, 53859, 53861, 53862, 53866, 53869, 53870, 53871, 53874, 53875, 53886, 53890, 53891, 53892, 53895, 53896, 53898, 53899, 53902, 53903, 53905, 53910, 53914, 53915, 53918, 53920, 40461, 53988, 53989, 53946, 53947, 53952, 53959, 53962, 53963, 53964, 53965, 53977, 53978, 53979, 53980, 53982, 53983, 53985, 53986, 29966, 30028, 30031, 30029, 30030, 30027, 39135, 30024, 29970, 29971, 29969, 30034, 30033, 30013, 30012, 30015, 30014, 30011, 29973, 29974, 29979, 29978, 29976, 29987, 29986, 29982, 29981, 29984, 29983, 30025, 30002, 30001, 30003, 29967, 29989, 29999, 29995, 29993, 29994, 29992, 29998, 29997, 29990, 30008, 30006, 30007, 30009, 30005, 29861, 29918, 29916, 29920, 29917, 29919, 29915, 29912, 39134, 29865, 29867, 29866, 29864, 29859, 29860, 29858, 29923, 29922, 29901, 29900, 29903, 29902, 29899, 29869, 29870, 29875, 29874, 29872, 29883, 29882, 29878, 29877, 29880, 29879, 29913, 29862, 29890, 29889, 29888, 29887, 29885, 29893, 29894, 29897, 29896, 29892, 29891, 29849, 29848, 29850, 29851, 29847, 31060, 31059, 26402, 26464, 26467, 26465, 26466, 26463, 26460, 26406, 26407, 26405, 26470, 26469, 26449, 26448, 26451, 26450, 26447, 26409, 26410, 26415, 26414, 26412, 26423, 26422, 26418, 26417, 26420, 26419, 26461, 26438, 26437, 26439, 26403, 26425, 26435, 26431, 26429, 26430, 26428, 26434, 26433, 26426, 26444, 26442, 26443, 26445, 26441, 26325, 26382, 26380, 26384, 26381, 26383, 26379, 26376, 26329, 26331, 26330, 26328, 26323, 26324, 26322, 26387, 26386, 26365, 26364, 26367, 26366, 26363, 26333, 26334, 26339, 26338, 26336, 26347, 26346, 26342, 26341, 26344, 26343, 26377, 26326, 26354, 26353, 26352, 26351, 26349, 26357, 26358, 26361, 26360, 26356, 26355, 26313, 26312, 26314, 26315, 26311, 31168, 31169, 31173, 31172, 31165, 31162, 31166, 31161, 30032, 27066, 27067, 27069, 27068, 27070, 40343, 40344, 40342, 40270, 40271, 40268, 40173, 40172, 40171, 40174, 40170, 40259, 40258, 40225, 40224, 40221, 40213, 40212, 40222, 40210, 40209, 40219, 40218, 40216, 40217, 40214, 40206, 40207, 40199, 40202, 40200, 40201, 40203, 40197, 40204, 40220, 40255, 40254, 40248, 40241, 40240, 40246, 40245, 40227, 40234, 40243, 40247, 40230, 40231, 40232, 40233, 40229, 40250, 40251, 40252, 40238, 40237, 40236, 40256, 40348, 40349, 40347, 40350, 40346, 40182, 40179, 40180, 40181, 40183, 40267, 40265, 40266, 40264, 40261, 40263, 40262, 40193, 40194, 40185, 40191, 40186, 40189, 40188, 40190, 40177, 40176, 29433, 29435, 29434, 29437, 29436, 29438, 29465, 29466, 29467, 29388, 39131, 29378, 29441, 29442, 29380, 29385, 29386, 29381, 29383, 29384, 29387, 29439, 29463, 29445, 29451, 29450, 29447, 29446, 29448, 29453, 29452, 29461, 29462, 29458, 29459, 29456, 29455, 29468, 39132, 29390, 39133, 29392, 29393, 29395, 29397, 29396, 29398, 29400, 29401, 29405, 29407, 29408, 29409, 29413, 29414, 29415, 29420, 29418, 29419, 29421, 29411, 29416, 29403, 29404, 29428, 29426, 29427, 29424, 29425, 29429, 29430, 29431, 29091, 29092, 29133, 40383, 40384, 40385, 40386, 53689, 53673, 53750, 53707, 53666, 53668, 53669, 53670, 53671, 53672, 53674, 53676, 53677, 53678, 53679, 53681, 53682, 53686, 53688, 53690, 53692, 53694, 53695, 53696, 53697, 53699, 53700, 53701, 53702, 53705, 53706, 53708, 53709, 53710, 53711, 53712, 53714, 53715, 53716, 53717, 53718, 53719, 53720, 53722, 53723, 53726, 53727, 53728, 53729, 53731, 53732, 53733, 53734, 53736, 53737, 53739, 53740, 53742, 53743, 53744, 53746, 53747, 53748, 53749, 53751, 53752, 27156, 27141, 27061, 27060, 27104, 27103, 27105, 27101, 27106, 27100, 27030, 30765, 30728, 30770, 30767, 30769, 30768, 30729, 30844, 30842, 30841, 30843, 30846, 30847, 30837, 30839, 30838, 30773, 30782, 30772, 30776, 30775, 30783, 30781, 30780, 30778, 30779, 30751, 30752, 30764, 30756, 30763, 30755, 30754, 30758, 30760, 30761, 30762, 30834, 30833, 30835, 30800, 30797, 30787, 30788, 30786, 30793, 30794, 30795, 30796, 30792, 30789, 30790, 30803, 30804, 30820, 30824, 30819, 30821, 30799, 30811, 30810, 30812, 30808, 30798, 30807, 30727, 30958, 30955, 30956, 30954, 30959, 30960, 30957, 30964, 30966, 30963, 30965, 28709, 28713, 28708, 28710, 28716, 28715, 28701, 28699, 27196, 27197, 27194, 27198, 28538, 28537, 28540, 28534, 27254, 27255, 27256, 28334, 28333, 28335, 28063, 28059, 28057, 28060, 27548, 27549, 27552, 27553, 27551, 27554, 27555, 27559, 27556, 27558, 27676, 27680, 27675, 27677, 27684, 27688, 27685, 27687, 27686, 27660, 27661, 27664, 27665, 27663, 27666, 27667, 27696, 27682, 28639, 28021, 28020, 28016, 28012, 28011, 28018, 28734, 28735, 28736, 28738, 28733, 28737, 28364, 27229, 27228, 27225, 27226, 27224, 27231, 27227, 27232, 28453, 28452, 28454, 28449, 27163, 27160, 27162, 27161, 27497, 27496, 27499, 27500, 28258, 28257, 28261, 28260, 27906, 27907, 27916, 27920, 27915, 27917, 27896, 27895, 27898, 27900, 27901, 27902, 27924, 27925, 27922, 27425, 27429, 27424, 27426, 27440, 27412, 27413, 27411, 27442, 27432, 27437, 27438, 27435, 27436, 27439, 27434, 27415, 28504, 28503, 28502, 27308, 27312, 27307, 27309, 27298, 27299, 27314, 27300, 28418, 28417, 28419, 28216, 28219, 28220, 28218, 28221, 28223, 28483, 28484, 28480, 28482, 28598, 28599, 28600, 28390, 28385, 28387, 28386, 28388, 28391, 27789, 27793, 27788, 27790, 27778, 27777, 27781, 27776, 27779, 28307, 28305, 28297, 28298, 28301, 28300, 28302, 28296, 28304, 28306, 28764, 28762, 28763, 28144, 28148, 28143, 28145, 28151, 28152, 28131, 28130, 28155, 28129, 28154, 28132, 28134, 28153, 28136, 30300, 30289, 30287, 30290, 30288, 30279, 30280, 30281, 30292, 30286, 30291, 30326, 28831, 28828, 28829, 28827, 28832, 28833, 28830, 28837, 28839, 28836, 28838, 28905, 28907, 28908, 28909, 28906, 28890, 28892, 28893, 28894, 28891, 31063, 33886, 33887, 33890, 33884, 33709, 33810, 33819, 33818, 33816, 33809, 33814, 33202, 33206, 33201, 33203, 33208, 33190, 33191, 33189, 33192, 33193, 33187, 33210, 33214, 33211, 33213, 33212, 33186, 33222, 33521, 33525, 33520, 33522, 33509, 33511, 33508, 33533, 33534, 33531, 33532, 33535, 33530, 33536, 33528, 33538, 33507, 34261, 34278, 34374, 34401, 34467, 34439, 34229, 34332, 34334, 34336, 34333, 34335, 34331, 34029, 34033, 34028, 34030, 34037, 34041, 34038, 34040, 34039, 34013, 34014, 34017, 34018, 34016, 34019, 34020, 34049, 34035, 31786, 31783, 31773, 31774, 31772, 31779, 31780, 31781, 31782, 31778, 31775, 31776, 31789, 31790, 31806, 31810, 31805, 31807, 31785, 31797, 31796, 31798, 31794, 31784, 31793, 32173, 32177, 32172, 32174, 32179, 32181, 32182, 32159, 32153, 32155, 32157, 32158, 32152, 32163, 32164, 32264, 32275, 32269, 32268, 32270, 32266, 32265, 32272, 32274, 38863, 38871, 38875, 38870, 38872, 38861, 38878, 38877, 38409, 38410, 38413, 38407, 38232, 38333, 38342, 38341, 38339, 38332, 38337, 35634, 35631, 35635, 35628, 35629, 35627, 35630, 35625, 35624, 35632, 36005, 36043, 38907, 38905, 38909, 38908, 35784, 35788, 35783, 35785, 35790, 35792, 35793, 35770, 35764, 35766, 35768, 35769, 35763, 35774, 35775, 38000, 37749, 37748, 37750, 37747, 37720, 37724, 37719, 37721, 37726, 37716, 37715, 37714, 37837, 37838, 37836, 37946, 37947, 37948, 38037, 38038, 38035, 38034, 38033, 38032, 35386, 35390, 35385, 35387, 35374, 35376, 35373, 35398, 35399, 35396, 35397, 35400, 35395, 35401, 35393, 35403, 35372, 38547, 38564, 38660, 38687, 38753, 38725, 38515, 38618, 38620, 38622, 38619, 38621, 38617, 36084, 36083, 37608, 37614, 37612, 37611, 36631, 36630, 36629, 36368, 36370, 36373, 36369, 36372, 36366, 36367, 36365, 37523, 37528, 37527, 37526, 36416, 36415, 36417, 36414, 36528, 36527, 36525, 36524, 36886, 36885, 36888, 36889, 37178, 37213, 37216, 37215, 37217, 37262, 37264, 37263, 37296, 37291, 37293, 37292, 37294, 36581, 36582, 36580, 36997, 36995, 36999, 36702, 36701, 36703, 36800, 36804, 36808, 36803, 36805, 36793, 36795, 36812, 36811, 36813, 36794, 36798, 36796, 36814, 36815, 38135, 38133, 38134, 38132, 38130, 38137, 36144, 36143, 36145, 34994, 34995, 34991, 34993, 34997, 34992, 34998, 34996, 35000, 35003, 35001, 35002, 34989, 34988, 34973, 34974, 34971, 34970, 34986, 34985, 34982, 34977, 34980, 34981, 34978, 34979, 34983, 35082, 35047, 35045, 35054, 35053, 35049, 35055, 35044, 35046, 35050, 35048, 35042, 35043, 35041, 35031, 35034, 35033, 35028, 35029, 35030, 35027, 35032, 35037, 35036, 35012, 35011, 35020, 35010, 35009, 35013, 35015, 35019, 35016, 35018, 35017, 35006, 35007, 35022, 35024, 35023, 34967, 34966, 35093, 35095, 35089, 35090, 35096, 31650, 31651, 31649, 40396, 27899, 32156, 32273, 35767, 40295, 40290, 40291, 40294, 40305, 40304, 40302, 40306, 40303, 40299, 40300, 40297, 40298, 40307, 40292, 40293, 40289, 40313, 40309, 40310, 40311, 40312, 40242, 30362, 30360, 30357, 30358, 30361, 30356, 30372, 30371, 30369, 30373, 30370, 30366, 30367, 30364, 30365, 30374, 30359, 30464, 30460, 30461, 30462, 30463, 30431, 30434, 30451, 30452, 30449, 30450, 30455, 30454, 30453, 30739, 30731, 30732, 30734, 30737, 30735, 30736, 30738, 30831, 30829, 30827, 30830, 30828, 30802, 30815, 30818, 30816, 30817, 29595, 29600, 29601, 29598, 29599, 29594, 29593, 29583, 29581, 29580, 29579, 29582, 29578, 29675, 29676, 29673, 29674, 29660, 29661, 29659, 28689, 28690, 28687, 28688, 28704, 28707, 28705, 28706, 28672, 28673, 28670, 28671, 27600, 27601, 27598, 27599, 27671, 27674, 27672, 27673, 27727, 27728, 27725, 27726, 27982, 27983, 27980, 27981, 28007, 28010, 28008, 28009, 28031, 28032, 28029, 28030, 27818, 27837, 27838, 27835, 27836, 27905, 27911, 27914, 27912, 27913, 27961, 27962, 27959, 27960, 27932, 27933, 27931, 27349, 27350, 27347, 27348, 27356, 27420, 27423, 27421, 27422, 27431, 27475, 27476, 27473, 27474, 27454, 27272, 27273, 27270, 27271, 27303, 27306, 27304, 27305, 27325, 27326, 27323, 27324, 27749, 27750, 27747, 27748, 27784, 27787, 27785, 27786, 27808, 27809, 27806, 27807, 28089, 28090, 28087, 28088, 28139, 28142, 28140, 28141, 28175, 28176, 28173, 28174, 30077, 30069, 30075, 40338, 40337, 30071, 30070, 30073, 30072, 30074, 30076, 30285, 30284, 30283, 30298, 30297, 30296, 30294, 30295, 30175, 30176, 30191, 30190, 30189, 30187, 30188, 30192, 30229, 30225, 30228, 30227, 30226, 30241, 30240, 30239, 30237, 30238, 29962, 29963, 29965, 29964, 30018, 30020, 30017, 30022, 30019, 30021, 29854, 29853, 29856, 29855, 29906, 29908, 29905, 29909, 29907, 29910, 26398, 26399, 26401, 26400, 26454, 26456, 26453, 26458, 26455, 26457, 26318, 26317, 26320, 26319, 26370, 26372, 26369, 26373, 26371, 26374, 26663, 33780, 33781, 33778, 33779, 33805, 33808, 33806, 33807, 33829, 33830, 33827, 33828, 33197, 33200, 33198, 33199, 33253, 33254, 33251, 33252, 33126, 33127, 33124, 33125, 33516, 33519, 33517, 33518, 33527, 33571, 33572, 33569, 33570, 33550, 33445, 33446, 33443, 33444, 33452, 33953, 33954, 33951, 33952, 34024, 34027, 34025, 34026, 34080, 34081, 34078, 34079, 31788, 31801, 31804, 31802, 31803, 31874, 31894, 31895, 31892, 31893, 31852, 31853, 31850, 31851, 31837, 31838, 31836, 32168, 32171, 32169, 32170, 32162, 32218, 32219, 32216, 32217, 32189, 32190, 32188, 32094, 32095, 32092, 32093, 32075, 38866, 38869, 38867, 38868, 38834, 38835, 38832, 38833, 38851, 38852, 38849, 38850, 38303, 38304, 38301, 38302, 38328, 38331, 38329, 38330, 38352, 38353, 38350, 38351, 35779, 35782, 35780, 35781, 35773, 35829, 35830, 35827, 35828, 35800, 35801, 35799, 35705, 35706, 35703, 35704, 35686, 35381, 35384, 35382, 35383, 35392, 35436, 35437, 35434, 35435, 35415, 35310, 35311, 35308, 35309, 35317, 34832, 34956, 34957, 34954, 34955, 34965, 35085, 35088, 35086, 35087, 34675, 34674, 34676, 34823, 34824, 34821, 34822, 31170, 31163, 40392, 28895, 27153, 27154, 27155, 27133, 27134, 27132, 27140, 27123, 27121, 27128, 27129, 27122, 27057, 27058, 27056, 27042, 27093, 27098, 27095, 27091, 27097, 27096, 27090, 27063, 27033, 27037, 27038, 27039, 27031, 27027, 27029, 27014, 30681, 30679, 30682, 30683, 30680, 30678, 30713, 30715, 30714, 30712, 30711, 30703, 30693, 30699, 30701, 30695, 30696, 30697, 30700, 30702, 30708, 30705, 30707, 30706, 30709, 30687, 30689, 30691, 30688, 30690, 30686, 30479, 30478, 30476, 30331, 30330, 30333, 30334, 30332, 30467, 30466, 30412, 30411, 30415, 30413, 30414, 30410, 30389, 30388, 30390, 30386, 30387, 30384, 39250, 30393, 30394, 30391, 30397, 30396, 30406, 30405, 30403, 30404, 30400, 30399, 30407, 30401, 30408, 30438, 30437, 30440, 30429, 30428, 30427, 30421, 30422, 30423, 30424, 30420, 30425, 30417, 30433, 30432, 30447, 30456, 30446, 30458, 30442, 30443, 30444, 30439, 30435, 30339, 30340, 30341, 30342, 30343, 30471, 30470, 30473, 30472, 30475, 30469, 30474, 30346, 30353, 30354, 30345, 30349, 30348, 30350, 30351, 30337, 30336, 28685, 28694, 28684, 28691, 28697, 28696, 28682, 28681, 27190, 27191, 27188, 27192, 28530, 28529, 28531, 28526, 27247, 27248, 27246, 28324, 28323, 28325, 28047, 28043, 28041, 28044, 27512, 27513, 27516, 27517, 27515, 27518, 27519, 27511, 27520, 27510, 27596, 27605, 27595, 27602, 27608, 27612, 27609, 27611, 27610, 27585, 27586, 27589, 27590, 27588, 27591, 27592, 27621, 27613, 28636, 27972, 27971, 27987, 27988, 27984, 27974, 27973, 27985, 28722, 28719, 28720, 28724, 28721, 28723, 28363, 27208, 27207, 27206, 27205, 27204, 27209, 27202, 27210, 28444, 28443, 28445, 28441, 27173, 27170, 27172, 27171, 27486, 27485, 27487, 27488, 28248, 28247, 28249, 28246, 27820, 27819, 27833, 27842, 27832, 27839, 27822, 27821, 27827, 27826, 27824, 27825, 27845, 27847, 27846, 27828, 27852, 27345, 27354, 27344, 27351, 27366, 27337, 27338, 27336, 27368, 27357, 27364, 27365, 27362, 27363, 27361, 27359, 27360, 27342, 27340, 28500, 28499, 28498, 27268, 27277, 27267, 27274, 27263, 27264, 27279, 27265, 28414, 28413, 28415, 28189, 28192, 28193, 28191, 28194, 28188, 28187, 28478, 28476, 28475, 28477, 28596, 28595, 28594, 28382, 28377, 28379, 28378, 28380, 28383, 27745, 27754, 27744, 27751, 27741, 27740, 27742, 27738, 27739, 28281, 28279, 28272, 28273, 28276, 28275, 28277, 28270, 28271, 28280, 28760, 28758, 28759, 28085, 28094, 28084, 28091, 28096, 28097, 28080, 28079, 28076, 28075, 28100, 28078, 28099, 28077, 28082, 30245, 30246, 30248, 30247, 30243, 30231, 30233, 30232, 30235, 30230, 30234, 30276, 28929, 28779, 28781, 28780, 28778, 28777, 28823, 28814, 28820, 28822, 28816, 28817, 28818, 28821, 28813, 28862, 28860, 28863, 28864, 28861, 28859, 28886, 28883, 28885, 28884, 28887, 28794, 28796, 28798, 28795, 28797, 28793, 31079, 31080, 31078, 31081, 31077, 33635, 33870, 33871, 33874, 33868, 33851, 33706, 33772, 33785, 33786, 33783, 33771, 33770, 33769, 33782, 33122, 33131, 33121, 33128, 33115, 33116, 33114, 33117, 33118, 33112, 33139, 33134, 33138, 33135, 33137, 33136, 33111, 33147, 33438, 33441, 33450, 33440, 33447, 33434, 33436, 33433, 33460, 33461, 33458, 33459, 33457, 33455, 33456, 33462, 33453, 33464, 33432, 34260, 34257, 34277, 34274, 34272, 34288, 34286, 34287, 34271, 34266, 34269, 34270, 34267, 34268, 34255, 34250, 34253, 34254, 34251, 34252, 34373, 34370, 34394, 34410, 34408, 34409, 34400, 34397, 34393, 34388, 34391, 34392, 34389, 34390, 34461, 34477, 34475, 34476, 34466, 34463, 34460, 34455, 34458, 34459, 34456, 34457, 34431, 34448, 34446, 34447, 34438, 34435, 34415, 34430, 34425, 34428, 34429, 34426, 34427, 34206, 34207, 34205, 34200, 34203, 34204, 34201, 34202, 34228, 34225, 34320, 34318, 34322, 34317, 34321, 34319, 34314, 33949, 33958, 33948, 33955, 33961, 33965, 33962, 33964, 33963, 33938, 33939, 33942, 33943, 33941, 33944, 33945, 33974, 33966, 31881, 31880, 31883, 31872, 31871, 31870, 31864, 31865, 31866, 31867, 31863, 31868, 31860, 31876, 31875, 31890, 31899, 31889, 31896, 31901, 31885, 31886, 31887, 31882, 31878, 31769, 32090, 32099, 32089, 32096, 32102, 32104, 32103, 32085, 32079, 32109, 32083, 32081, 32082, 32077, 32076, 32078, 32238, 32249, 32244, 32243, 32245, 32241, 32240, 32239, 32248, 38844, 38847, 38856, 38846, 38853, 38843, 38859, 38858, 38393, 38394, 38397, 38391, 38374, 38229, 38295, 38308, 38309, 38306, 38294, 38293, 38292, 38305, 35595, 35587, 35592, 35593, 35591, 35594, 35596, 35589, 35588, 35586, 36014, 36012, 36013, 36004, 36052, 36050, 36051, 36042, 38902, 38900, 38903, 38901, 38897, 38881, 38985, 38946, 35701, 35710, 35700, 35707, 35713, 35715, 35714, 35696, 35690, 35720, 35694, 35692, 35693, 35688, 35687, 35689, 37997, 38060, 38059, 37759, 37758, 37760, 37757, 37691, 37696, 37690, 37693, 37698, 37688, 37687, 37686, 37681, 37833, 37834, 37832, 37830, 37959, 37926, 37930, 37955, 37951, 37965, 37881, 37971, 37944, 37943, 37942, 38029, 38030, 38027, 38026, 38025, 38024, 35303, 35306, 35315, 35305, 35312, 35299, 35301, 35298, 35325, 35326, 35323, 35324, 35322, 35320, 35321, 35327, 35318, 35329, 35297, 38460, 38546, 38543, 38563, 38560, 38558, 38574, 38572, 38573, 38557, 38552, 38555, 38556, 38553, 38554, 38541, 38536, 38539, 38540, 38537, 38538, 38659, 38656, 38696, 38694, 38695, 38686, 38683, 38747, 38763, 38761, 38762, 38752, 38749, 38746, 38741, 38744, 38745, 38742, 38743, 38717, 38734, 38732, 38733, 38724, 38721, 38701, 38716, 38711, 38714, 38715, 38712, 38713, 38492, 38493, 38491, 38486, 38489, 38490, 38487, 38488, 38514, 38511, 38606, 38604, 38608, 38603, 38607, 38605, 38600, 36081, 36080, 36079, 37600, 37605, 37604, 37603, 36621, 36620, 36619, 36343, 36349, 36351, 36348, 36350, 36347, 36346, 36345, 36330, 37515, 37519, 37518, 37517, 37452, 37449, 37451, 36426, 36425, 36427, 36424, 36516, 36515, 36514, 36513, 36500, 36876, 36875, 36874, 36877, 36858, 37177, 37162, 37207, 37210, 37209, 37211, 37219, 37367, 37374, 37373, 37258, 37260, 37259, 37256, 37237, 37280, 37276, 37279, 37278, 37277, 36577, 36578, 36576, 36574, 37081, 37097, 37128, 37121, 36980, 36978, 36976, 36977, 36698, 36697, 36699, 36674, 36753, 36756, 36761, 36755, 36758, 36746, 36751, 36764, 36763, 36766, 36750, 36748, 36749, 36767, 36747, 38108, 38106, 38107, 38105, 38103, 38101, 38102, 36137, 36136, 36135, 34949, 34931, 34932, 34928, 34930, 34934, 34929, 34935, 34933, 34924, 34937, 34940, 34938, 34939, 34926, 34925, 34910, 34908, 34916, 34917, 34912, 34918, 34907, 34909, 34913, 34911, 34906, 34905, 34904, 34898, 34901, 34900, 34895, 34896, 34897, 34894, 34899, 34920, 34922, 34845, 34844, 34852, 34843, 34842, 34841, 34847, 34851, 34848, 34850, 34849, 34838, 34839, 34854, 34855, 34882, 34881, 34879, 34878, 34876, 34890, 34885, 34888, 34889, 34886, 34887, 34891, 34833, 34834, 34951, 34952, 34962, 34960, 34835, 31674, 31646, 31647, 31645, 31643, 40395, 40415, 53753, 32084, 32247, 35695, 36509, 38954, 27150, 27117, 27054, 27053, 27052, 27051, 27081, 27084, 27085, 27083, 27088, 27087, 27082, 27023, 29604, 29603, 29576, 29687, 29574, 29691, 29608, 29606, 29609, 29607, 29614, 29611, 29613, 29612, 29615, 29596, 29575, 29556, 29554, 29555, 29553, 29690, 29689, 29683, 29686, 29685, 29684, 29626, 29628, 29633, 29617, 29627, 29634, 29632, 29631, 29630, 29623, 29625, 29624, 29622, 29620, 29619, 29559, 29560, 29565, 29564, 29572, 29563, 29562, 29569, 29570, 29567, 29571, 29657, 29665, 29649, 29639, 29640, 29638, 29645, 29646, 29647, 29648, 29644, 29641, 29636, 29671, 29680, 29670, 29677, 29656, 29642, 29655, 29654, 29653, 29667, 29668, 29650, 29651, 29662, 29664, 29573, 29827, 29828, 29824, 29825, 29823, 29829, 29830, 29826, 29832, 29835, 29837, 29834, 29836, 28668, 28676, 28667, 28678, 28665, 28664, 28663, 28661, 27184, 27185, 27182, 27186, 28519, 28518, 28521, 28516, 27259, 27260, 27258, 28339, 28338, 28340, 28070, 28067, 28065, 28068, 27576, 27567, 27568, 27571, 27572, 27570, 27573, 27574, 27578, 27579, 27564, 27565, 27575, 27723, 27731, 27722, 27733, 27709, 27713, 27710, 27712, 27711, 27698, 27699, 27702, 27703, 27701, 27704, 27705, 27734, 27707, 28632, 28634, 28630, 28631, 28633, 28035, 28036, 28037, 28024, 28023, 28033, 28741, 28745, 28742, 28740, 28744, 28743, 28354, 28355, 28356, 28359, 28361, 28362, 28360, 28358, 27241, 27240, 27236, 27237, 27235, 27242, 27238, 27243, 28434, 28433, 28435, 28431, 27504, 27503, 27505, 27506, 28266, 28265, 28267, 28263, 27957, 27965, 27956, 27967, 27936, 27935, 27938, 27939, 27940, 27941, 27942, 27946, 27947, 27934, 27950, 27951, 27948, 27471, 27479, 27470, 27481, 27463, 27460, 27461, 27458, 27459, 27462, 27457, 27449, 27450, 27465, 27455, 27452, 28495, 28494, 28492, 28493, 27321, 27329, 27320, 27331, 27316, 27317, 27332, 27318, 28410, 28409, 28411, 28230, 28229, 28233, 28234, 28235, 28232, 28236, 28239, 28238, 28240, 28227, 28470, 28469, 28471, 28466, 28468, 28589, 28590, 28591, 28398, 28400, 28393, 28396, 28395, 28397, 28399, 28394, 28401, 27804, 27812, 27803, 27814, 27800, 27799, 27801, 27796, 27797, 28320, 28311, 28312, 28313, 28316, 28315, 28317, 28309, 28310, 28319, 28756, 28755, 28753, 28754, 28171, 28179, 28170, 28181, 28165, 28166, 28162, 28161, 28183, 28157, 28182, 28158, 28159, 28168, 28164, 30177, 30181, 30197, 30182, 30179, 30183, 30180, 30170, 30171, 30173, 30172, 30185, 30178, 30184, 30222, 28846, 28847, 28843, 28844, 28842, 28848, 28849, 28845, 28851, 28854, 28856, 28853, 28855, 28915, 28912, 28914, 28916, 28917, 28913, 31053, 33894, 33895, 33897, 33892, 33702, 33703, 33704, 33700, 33701, 33822, 33833, 33834, 33831, 33821, 33835, 33249, 33257, 33248, 33259, 33233, 33228, 33229, 33227, 33230, 33231, 33225, 33235, 33239, 33236, 33238, 33237, 33224, 33260, 33567, 33575, 33566, 33577, 33546, 33548, 33545, 33556, 33557, 33554, 33555, 33558, 33553, 33559, 33551, 33561, 33544, 34259, 34276, 34372, 34399, 34465, 34437, 34227, 34339, 34340, 34341, 34343, 34342, 34338, 34076, 34084, 34075, 34086, 34062, 34066, 34063, 34065, 34064, 34051, 34052, 34055, 34056, 34054, 34057, 34058, 34087, 34060, 31834, 31842, 31826, 31816, 31817, 31815, 31822, 31823, 31824, 31825, 31821, 31818, 31813, 31848, 31857, 31847, 31854, 31833, 31819, 31832, 31831, 31830, 31844, 31845, 31827, 31828, 31839, 31841, 32203, 32204, 32214, 32222, 32213, 32224, 32205, 32207, 32208, 32199, 32193, 32196, 32197, 32198, 32192, 32191, 32277, 32288, 32284, 32283, 32285, 32281, 32280, 32278, 32287, 38825, 38830, 38838, 38829, 38840, 38823, 38827, 38826, 38417, 38418, 38420, 38415, 38225, 38226, 38227, 38223, 38224, 38345, 38356, 38357, 38354, 38344, 38358, 35654, 35655, 35651, 35650, 35652, 35640, 35647, 35648, 35646, 35649, 35644, 35643, 35641, 36003, 36041, 38893, 38891, 38896, 38895, 38894, 35814, 35815, 35825, 35833, 35824, 35835, 35816, 35818, 35819, 35810, 35804, 35807, 35808, 35809, 35803, 35802, 37993, 37994, 37995, 37991, 37992, 37733, 37737, 37732, 37739, 37740, 37730, 37729, 37728, 37828, 37829, 37827, 37937, 37938, 37939, 38047, 38048, 38042, 38044, 38046, 38043, 38045, 38041, 38040, 35432, 35440, 35431, 35442, 35411, 35413, 35410, 35421, 35422, 35419, 35420, 35423, 35418, 35424, 35416, 35426, 35409, 38545, 38562, 38658, 38685, 38751, 38723, 38513, 38625, 38626, 38627, 38629, 38628, 38624, 36077, 36076, 37590, 37595, 37593, 37592, 36636, 36635, 36634, 36379, 36382, 36384, 36381, 36383, 36377, 36378, 36376, 37505, 37509, 37508, 37507, 36534, 36533, 36532, 36531, 36894, 36893, 36891, 36895, 37174, 37175, 37173, 37201, 37204, 37203, 37205, 37253, 37252, 37255, 37254, 37304, 37299, 37303, 37302, 37300, 36572, 36573, 36571, 37008, 37006, 37005, 37003, 36693, 36692, 36695, 36694, 36824, 36831, 36835, 36830, 36837, 36817, 36822, 36826, 36825, 36828, 36821, 36819, 36818, 36838, 36839, 38150, 38144, 38153, 38152, 38154, 38147, 38148, 38149, 38146, 38143, 38141, 36149, 36148, 36147, 34677, 34816, 34685, 34686, 34679, 34682, 34681, 34683, 34792, 34793, 34789, 34791, 34795, 34790, 34796, 34794, 34798, 34800, 34799, 34801, 34787, 34773, 34771, 34779, 34780, 34775, 34781, 34770, 34772, 34776, 34774, 34768, 34769, 34767, 34761, 34759, 34764, 34763, 34757, 34758, 34760, 34756, 34762, 34784, 34783, 34813, 34812, 34815, 34814, 34811, 34700, 34707, 34699, 34708, 34698, 34697, 34696, 34702, 34706, 34703, 34705, 34704, 34693, 34694, 34689, 34691, 34690, 34741, 34753, 34752, 34729, 34739, 34736, 34738, 34737, 34735, 34733, 34732, 34749, 34744, 34747, 34748, 34745, 34746, 34819, 34829, 34818, 34827, 34672, 31641, 31642, 31640, 40394, 53809, 32195, 32279, 35806, 53997, 53998, 53999, 54000, 54001, 54020, 54021, 54022, 54023, 54024, 54025, 54026, 54027, 54028, 54029, 54030, 54031, 54032, 34777, 34750, 27025, 34914, 35051, 39047, 40477, 28195, 30208, 27953, 38138, 27691, 29023, 31909, 29017, 31158, 31903, 29046, 28285, 28293, 28283, 28284, 28292, 28294, 28288, 28289, 31913, 31933, 31910, 31921, 31922, 31936, 32251, 32261, 32262, 34616, 32256, 32257, 31908, 31919, 31937, 32252, 32253, 32260, 40367, 40469, 29033, 29030, 29053, 29031, 29062, 29051, 29026, 29035, 29024, 28253, 27871, 27375, 27535, 27866, 28202, 28748, 27407, 31912, 34629, 31916, 31917, 33155, 34398, 33483, 34610, 32112, 35348, 29025, 29047, 29027, 29045, 29054, 29041, 29050, 29018, 29044, 27860, 28199, 27857, 28213, 27527, 28200, 27541, 27881, 27892, 27893, 28212, 31931, 31932, 31940, 34537, 34542, 34623, 34626, 35603, 35728, 35617, 35725, 38114, 38126, 31927, 31930, 32117, 32123, 34528, 34540, 35734, 32150, 35760, 38115, 35749, 32114, 32138, 35761, 36986, 27630, 33156, 34651, 33983, 34646, 27373, 28984, 30134, 30136, 39009, 39014, 39015, 28990, 31040, 28985, 28988, 39011, 28983, 28989, 39012, 39017, 30135, 28982, 30133, 39010

## 文档中心 / 开发者文档 / 数据字典 / 半托管sku分类&净含量必填叶子类目

- 文档 ID：`154442717054`
- 更新时间：`2026-03-25T11:06:45.643000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=154442717054`

[
1814, 42579, 42461, 42462, 54336, 54337, 42459, 42460, 42463, 42464, 42465, 42466, 54311,
54312, 54313, 54314, 54315, 54316, 54317, 54318, 54319, 54320, 54321, 54322, 54323, 54324,
54325, 54326, 54327, 54328, 54330, 54331, 54332, 54333, 54334, 54335, 54310, 54329, 54338,
54309, 42375, 16288, 16289, 9780, 9787, 9788, 9789, 17502, 17503, 17504, 17505, 17506, 17507,
17508, 17509, 17510, 17511, 17512, 17513, 17514, 17515, 17516, 17517, 17518, 17519, 17520,
17521, 17522, 17523, 17524, 17525, 17526, 17527, 17528, 17529, 17530, 17531, 17532, 17533,
17534, 17535, 17536, 17537, 17538, 17539, 17540, 17541, 17542, 17543, 17544, 17545, 17546,
17547, 17548, 17549, 17550, 17551, 17552, 17553, 17554, 17555, 17556, 17557, 17558, 17560,
17561, 17562, 17563, 17564, 17565, 17566, 17567, 17568, 17569, 17570, 17571, 17572, 17573,
17574, 17575, 17576, 17577, 17578, 17579, 17580, 17581, 17582, 17583, 17584, 17585, 17587,
17588, 17589, 17591, 17592, 17593, 17594, 17595, 17597, 17598, 17599, 17600, 17601, 17602,
10435, 17603, 10436, 17604, 10437, 17605, 10439, 17607, 10440, 17608, 10441, 17609, 10442,
17610, 10443, 17611, 17612, 10445, 17613, 10446, 17614, 17615, 10448, 17616, 10449, 17617,
10450, 17618, 10451, 17619, 10452, 17620, 10453, 17621, 10454, 17622, 10455, 17624, 10457,
17625, 10458, 17626, 10459, 17627, 10460, 17628, 10461, 17629, 10462, 17630, 10463, 17631,
10464, 17632, 17633, 17635, 17637, 17638, 17639, 17640, 17641, 17642, 17643, 17645, 17646,
17647, 17648, 17650, 17651, 17652, 17653, 17654, 17655, 17656, 17657, 17658, 17659, 17660,
17661, 17662, 17663, 17665, 17666, 17667, 17668, 17669, 17670, 17671, 17672, 17673, 17674,
17676, 17677, 17678, 17679, 17680, 17681, 17682, 17683, 17685, 17686, 17688, 17689, 17690,
17691, 17692, 17694, 17696, 17697, 17698, 17699, 17700, 17701, 17702, 17703, 17704, 17705,
17706, 17707, 17708, 17709, 17710, 17711, 17712, 17713, 17715, 17716, 17717, 17718, 16210,
16211, 16213, 16214, 16215, 16216, 16217, 16218, 16219, 16220, 16221, 16222, 16223, 16224,
16225, 16226, 16227, 16228, 16230, 16232, 16233, 16234, 16235, 16236, 16238, 16240, 16241,
16242, 16243, 16244, 16245, 16246, 16247, 16248, 16249, 16250, 16251, 16252, 16253, 16255,
16257, 16258, 16259, 16260, 16261, 16262, 16263, 16264, 16265, 16266, 16267, 16268, 16269,
16271, 16272, 16273, 16274, 16275, 16277, 16278, 16279, 16280, 16281, 16282, 16283, 16284,
16285, 16286, 16291, 16292, 16294, 16295, 16296, 16297, 20412, 20406, 20399, 20388, 20379,
20362, 20360, 20420, 20419, 20427, 20426, 20425, 20424, 20423, 20418, 20417, 20395, 20394,
20393, 20392, 20391, 20390, 20389, 20386, 20385, 20384, 20383, 20375, 20373, 20372, 20371,
20370, 20369, 20364, 20363, 20368, 20367, 20366, 20377, 39387, 23162, 43978, 44909, 42370,
42371, 42372, 42373, 42374, 42377, 42378, 42379, 42380, 42381, 42382, 42383, 42384, 42385,
42386, 42387, 42388, 42389, 42390, 42391, 42392, 42393, 42394, 42395, 43264, 43265, 43266,
43267, 43268, 43269, 43270, 43271, 43272, 43273, 43274, 43136, 43137, 43138, 43139, 43141,
43142, 43143, 43144, 43145, 43146, 43147, 43148, 43150, 43152, 43153, 43154, 43155, 43157,
43158, 43159, 43160, 43161, 43162, 43163, 43164, 43165, 43166, 43167, 43168, 43169, 43171,
43172, 43173, 43175, 43176, 43178, 43179, 43180, 43181, 43183, 43184, 43185, 43186, 43187,
43188, 43189, 43191, 43192, 43193, 43194, 43195, 43196, 43197, 43198, 43199, 43200, 43201,
43202, 43203, 43204, 43205, 43207, 43208, 43209, 43211, 43212, 43213, 43214, 43215, 43216,
43217, 43218, 43219, 43220, 43221, 43222, 43223, 43226, 43227, 43228, 43229, 43230, 43231,
43232, 43233, 43234, 43235, 43236, 43237, 43238, 43239, 43241, 43242, 43243, 43244, 43245,
43246, 43247, 43248, 43249, 43250, 43251, 43252, 43253, 43254, 43255, 43256, 43258, 43259,
43260, 43261, 43262, 42752, 42753, 42754, 42755, 42756, 42757, 42758, 42759, 42760, 42762,
42763, 42764, 42765, 42766, 42767, 42768, 42769, 42770, 42771, 42772, 42773, 42774, 42775,
42776, 42777, 42778, 42779, 42780, 42781, 42782, 42783, 42785, 42786, 42787, 42788, 42789,
42790, 42791, 42792, 42793, 42794, 42796, 42797, 42798, 42799, 42800, 42696, 42698, 42699,
42700, 42701, 42702, 42703, 42704, 42705, 42706, 42707, 42708, 42709, 42711, 42712, 42713,
42714, 42715, 42716, 42717, 42719, 42720, 42721, 42722, 42724, 42725, 42726, 42727, 42728,
42729, 42730, 42731, 42732, 42734, 42735, 42736, 42737, 42738, 42739, 42740, 42741, 42742,
42743, 42744, 42745, 42746, 42748, 42749, 42750, 42751, 43008, 43009, 43011, 43012, 43013,
43014, 43015, 43016, 43019, 43020, 43021, 43022, 43023, 43024, 43025, 43026, 43027, 43028,
43029, 43030, 43031, 43033, 43034, 43035, 43036, 43037, 43038, 43039, 43041, 43042, 43043,
43044, 43045, 43046, 43047, 43048, 43050, 43051, 43052, 42803, 42805, 42806, 42807, 42808,
42809, 42810, 42811, 42812, 42813, 42814, 42815, 42816, 42817, 42818, 42819, 42820, 42821,
42822, 42823, 42825, 42826, 42827, 42829, 42830, 42831, 42832, 42833, 42834, 42835, 42837,
42838, 42839, 42840, 42841, 42843, 42844, 42845, 42846, 42847, 42848, 42849, 42850, 42851,
42853, 42854, 42856, 42857, 42858, 42859, 42860, 42861, 42862, 42864, 42865, 42867, 42868,
42869, 42870, 42872, 42873, 42874, 42875, 42876, 42877, 42879, 42880, 42881, 42882, 42883,
42884, 42885, 42886, 42887, 42888, 42891, 42892, 42893, 42894, 42895, 42896, 42897, 42898,
42899, 42900, 42901, 42902, 42903, 42904, 42905, 42906, 42907, 42908, 42909, 42910, 42911,
42912, 42913, 42914, 42916, 42917, 42918, 42919, 42920, 42921, 42922, 42923, 42924, 42926,
42927, 42928, 42929, 42930, 42931, 42932, 42933, 42935, 42936, 42937, 42938, 42939, 42940,
42941, 42942, 42943, 42944, 42946, 42947, 42948, 42949, 42950, 42951, 42952, 42953, 42954,
42955, 42956, 42957, 42958, 42960, 42961, 42962, 42963, 42964, 42965, 42966, 42967, 42968,
42969, 42970, 42972, 42973, 42974, 42975, 42976, 42977, 42979, 42981, 42982, 42983, 42984,
42985, 42987, 42988, 42989, 42990, 42991, 42992, 42993, 42994, 42995, 42996, 42998, 42999,
43000, 43001, 43002, 43003, 43004, 43006, 43007, 16293, 16254, 43453, 43455, 43456, 43457,
43458, 43459, 43460, 43462, 43463, 43464, 43465, 43466, 43467, 43468, 43469, 43470, 43471,
43472, 43473, 43474, 43475, 43476, 43477, 43478, 43479, 43480, 43481, 43482, 43484, 43485,
43486, 43487, 43488, 43489, 43490, 43492, 43493, 43494, 43495, 43496, 43497, 43498, 43499,
43501, 43503, 43504, 43505, 43506, 43507, 43508, 43509, 43510, 43511, 43512, 43513, 43514,
43515, 43517, 43518, 43519, 43520, 43521, 43522, 43523, 43524, 43525, 43526, 43527, 43528,
43529, 43530, 43531, 43534, 43535, 43536, 43537, 43539, 43540, 43541, 43542, 43543, 43544,
43546, 43547, 43548, 43549, 43550, 43551, 43552, 43553, 43555, 43556, 43557, 43558, 43559,
43560, 43561, 43562, 43563, 43564, 43565, 43566, 43567, 43569, 43570, 43571, 43572, 43574,
43575, 43576, 43577, 43578, 43579, 43580, 43581, 43582, 43583, 43584, 43585, 43586, 43587,
43588, 43589, 43591, 43592, 43593, 43594, 43596, 43597, 43598, 43599, 43600, 43601, 43602,
43603, 43604, 43606, 43607, 43608, 43609, 43610, 43611, 43612, 43613, 43614, 43615, 43616,
43617, 43619, 43620, 43621, 43622, 43623, 43624, 43625, 43627, 43628, 43629, 43630, 43632,
43633, 43635, 43636, 43637, 43638, 43639, 43640, 43641, 43642, 43643, 43644, 43646, 43647,
43648, 43650, 43651, 43652, 43653, 43654, 43655, 43656, 43657, 43660, 43661, 43662, 43663,
43664, 43665, 43666, 43667, 43668, 43669, 43670, 43671, 43672, 43674, 43675, 43676, 43677,
43678, 43679, 43681, 43682, 43683, 43684, 43685, 43686, 43687, 43688, 43689, 43690, 43691,
43692, 43693, 43694, 43695, 43696, 43698, 43699, 43700, 43701, 43702, 43703, 43704, 43705,
43706, 43707, 43708, 43709, 43710, 43711, 43713, 43714, 43715, 43716, 43717, 43718, 43719,
43720, 43721, 43722, 43723, 43724, 43725, 43726, 43727, 43728, 43729, 43730, 43731, 43732,
43733, 43734, 43735, 43736, 43737, 43738, 43739, 43741, 43743, 43744, 43745, 43746, 43747,
43748, 43750, 43751, 43752, 43753, 43754, 43755, 43756, 43757, 43758, 43759, 43760, 43761,
43762, 43763, 43764, 43765, 43766, 43767, 43768, 43769, 43770, 43771, 43773, 43774, 43775,
43776, 43777, 43778, 43779, 43780, 43781, 43782, 43783, 43784, 43786, 43787, 43788, 43789,
43790, 43791, 43792, 43793, 43794, 43795, 43796, 43797, 43798, 43799, 43802, 43803, 43804,
43805, 43806, 43807, 43808, 43809, 43810, 43811, 43812, 43813, 43814, 43815, 43816, 43817,
43819, 43820, 43821, 43822, 43823, 43824, 43826, 43827, 43828, 43829, 43830, 43831, 43832,
43835, 43836, 43837, 43838, 43839, 43840, 43841, 43842, 43843, 43844, 43846, 43847, 43849,
43850, 43851, 43852, 43853, 43854, 43855, 43856, 43857, 43858, 43859, 43860, 43861, 43862,
43863, 43864, 43865, 43867, 43868, 43869, 43870, 43871, 43872, 43873, 43874, 43876, 43877,
43878, 43880, 43881, 43882, 43883, 43884, 43885, 43887, 43889, 43890, 43891, 43892, 43893,
43894, 43895, 43896, 43897, 43898, 43899, 43900, 43902, 43903, 43904, 43905, 43906, 43907,
43908, 43910, 43911, 43912, 43913, 43914, 43915, 43916, 43918, 43919, 43920, 43921, 43922,
43923, 43924, 43925, 43926, 43927, 43928, 43929, 43930, 43932, 43933, 43934, 43936, 43937,
43938, 43939, 43940, 43941, 43942, 43943, 43944, 43945, 43946, 43947, 43948, 43949, 43950,
43951, 43952, 43953, 43955, 43956, 43957, 43958, 43960, 43961, 43962, 43963, 43964, 43965,
43966, 43967, 43968, 43969, 43970, 43971, 43972, 43973, 43974, 43975, 42496, 42497, 42498,
42500, 42501, 42502, 42504, 42505, 42397, 42399, 42400, 42401, 42403, 42404, 42405, 42406,
42407, 42409, 42410, 42412, 42413, 42414, 42415, 42416, 42417, 42418, 42419, 42421, 42422,
42423, 42424, 42425, 42426, 42427, 42428, 42429, 42430, 42432, 42433, 42435, 42436, 42439,
42440, 42441, 42442, 42443, 42444, 42445, 42446, 42447, 42448, 42449, 42451, 42452, 42453,
42454, 42455, 42456, 42457, 42468, 42469, 42470, 42471, 42472, 42473, 42474, 42475, 42476,
42477, 42478, 42479, 42480, 42482, 42483, 42484, 42485, 42486, 42487, 42488, 42489, 42490,
42492, 42493, 42494, 42495, 43277, 43278, 43279, 43280, 43281, 43282, 43283, 43284, 43285,
43286, 43287, 43288, 43290, 43291, 43292, 43293, 43294, 43295, 43296, 43297, 43298, 43299,
43300, 43302, 43303, 43304, 43305, 43306, 43308, 43309, 43310, 43311, 43313, 43314, 43316,
43317, 43318, 43320, 43321, 43323, 43324, 43325, 43327, 43328, 43329, 43330, 43331, 43332,
43333, 43334, 43335, 43336, 43338, 43339, 43340, 43341, 43342, 43343, 43344, 43345, 43346,
43347, 43348, 43349, 43351, 43353, 43354, 43355, 43356, 43358, 43359, 43361, 43363, 43364,
43365, 43366, 43367, 43369, 43370, 43371, 43372, 43373, 43374, 43375, 43376, 43377, 43378,
43380, 43381, 43382, 43383, 43384, 43385, 43386, 43388, 43389, 43390, 43391, 43392, 43393,
43395, 43396, 43397, 43398, 43399, 43400, 43401, 43402, 43403, 43404, 43406, 43407, 43408,
43409, 43410, 43411, 43412, 43413, 43414, 43415, 43416, 43417, 43418, 43419, 43420, 43421,
43422, 43424, 43425, 43426, 43427, 43429, 43430, 43431, 43433, 43434, 43435, 43436, 43437,
43438, 43440, 43441, 43442, 43443, 43444, 43445, 43446, 43447, 43448, 43449, 43450, 44931,
42515, 44910, 42514, 44915, 44925, 42510, 44907, 44921, 42516, 44922, 44930, 44912, 44903,
44911, 42509, 44920, 44905, 44927, 42513, 44906, 44923, 44904, 44908, 44914, 44916, 44918,
44932, 44913, 44919, 42507, 44928, 42511, 43066, 43094, 43070, 42670, 43084, 42647, 42691,
42673, 42629, 43069, 42662, 42634, 42674, 42680, 42676, 43091, 43057, 43075, 43093, 42694,
42660, 42693, 43067, 42657, 42689, 43058, 43095, 42636, 43056, 43059, 42686, 42683, 42672,
42632, 42661, 42682, 42649, 43068, 43055, 42685, 42646, 42656, 42690, 42658, 43086, 42654,
43081, 42667, 42630, 42633, 42666, 42664, 42687, 42679, 42655, 42668, 42640, 42669, 42684,
42639, 42659, 42652, 42635, 42645, 42678, 42653, 42651, 42644, 42642, 42638, 42631, 42637,
42671, 43085, 43060, 42643, 43097, 43092, 43083, 42665, 42650, 43079, 43074, 43061, 43090,
43087, 43063, 43072, 43077, 43082, 43098, 43062, 43096, 43071, 43065, 43088, 43099, 43076,
43078, 43089, 42525, 42615, 42540, 42570, 42528, 42519, 42521, 42558, 42606, 42584, 42552,
42593, 42614, 42595, 42598, 42524, 42618, 42577, 42554, 42556, 42587, 42569, 42586, 42534,
42600, 42536, 42533, 42589, 42622, 42517, 42529, 42597, 42526, 42607, 42532, 42604, 42568,
42567, 42560, 42613, 42576, 42609, 42541, 42555, 42544, 42608, 42594, 42530, 42523, 42553,
42572, 42575, 42580, 42612, 42549, 42564, 42591, 42628, 42527, 42538, 42603, 42557, 42581,
42621, 42559, 42566, 42518, 42542, 42520, 42596, 42539, 42578, 42583, 42605, 42623, 42535,
42620, 42563, 42619, 42571, 42550, 42617, 42602, 42582, 42611, 42545, 42590, 42616, 42547,
42565, 42601, 42573, 42551, 42599, 42562, 42626, 42588, 42627, 42592, 44432, 44419, 44423,
44420, 44434, 44435, 44444, 44426, 44438, 44441, 44428, 44446, 44429, 44431, 44447, 44425,
44424, 44417, 44427, 44442, 44443, 44421, 44433, 44430, 44422, 44439, 44440, 44445, 44436,
44033, 44045, 43129, 43999, 43980, 43997, 44016, 43998, 43109, 44008, 43990, 43134, 43991,
43985, 44013, 43996, 43108, 44053, 43130, 43995, 44011, 43102, 44025, 44019, 44026, 43120,
43112, 43114, 44057, 44031, 43986, 44051, 44022, 43117, 43988, 44046, 43992, 44005, 43989,
43982, 44060, 44003, 44007, 44009, 43122, 44004, 44015, 43994, 43119, 43981, 43115, 43105,
43126, 44047, 43111, 43983, 43100, 43110, 43104, 43125, 44034, 44006, 44040, 44010, 43132,
44012, 43993, 43123, 43118, 43106, 43133, 44001, 44035, 44020, 43984, 44000, 44030, 44042,
43101, 44050, 44059, 44018, 44048, 44056, 44024, 44027, 44039, 44021, 43128, 44049, 44038,
44052, 44041, 44044, 44023, 44029, 44058, 44055, 44028, 44100, 44108, 44116, 44155, 44062,
44063, 44064, 44101, 44073, 44125, 44161, 44158, 44061, 44156, 44147, 44094, 44148, 44164,
44151, 44133, 44092, 44172, 44098, 44144, 44072, 44120, 44171, 44165, 44159, 44150, 44123,
44117, 44083, 44066, 44080, 44079, 44138, 44074, 44113, 44068, 44096, 44115, 44078, 44087,
44118, 44124, 44104, 44102, 44105, 44136, 44077, 44076, 44169, 44149, 44090, 44065, 44152,
44119, 44145, 44111, 44097, 44166, 44106, 44093, 44128, 44107, 44088, 44114, 44109, 44143,
44084, 44110, 44085, 44067, 44089, 44129, 44069, 44086, 44132, 44157, 44122, 44126, 44134,
44075, 44139, 44071, 44099, 44160, 44140, 44168, 44091, 44142, 44163, 44162, 44081, 44082,
44146, 44130, 44167, 44137, 44195, 44202, 44243, 44279, 44184, 44208, 44212, 44194, 44215,
44181, 44178, 44233, 44276, 44190, 44266, 44232, 44204, 44193, 44267, 44231, 44230, 44180,
44260, 44205, 44196, 44282, 44248, 44263, 44264, 44247, 44227, 44242, 44254, 44203, 44265,
44274, 44188, 44252, 44255, 44174, 44191, 44210, 44244, 44220, 44272, 44236, 44207, 44185,
44187, 44222, 44211, 44189, 44213, 44235, 44240, 44182, 44224, 44217, 44179, 44173, 44229,
44200, 44209, 44175, 44238, 44186, 44262, 44237, 44199, 44218, 44256, 44261, 44275, 44206,
44234, 44245, 44223, 44216, 44271, 44258, 44219, 44280, 44259, 44250, 44253, 44226, 44183,
44176, 44268, 44249, 44273, 44246, 44269, 44192, 44241, 44257, 44228, 44277, 44281, 44270,
44305, 44371, 44309, 44330, 44375, 44360, 44301, 44284, 44283, 44342, 44313, 44352, 44315,
44294, 44299, 44326, 44331, 44368, 44303, 44355, 44320, 44296, 44300, 44310, 44317, 44286,
44308, 44334, 44304, 44319, 44285, 44324, 44328, 44306, 44345, 44339, 44336, 44337, 44354,
44329, 44333, 44341, 44353, 44385, 44335, 44312, 44394, 44314, 44363, 44358, 44376, 44343,
44291, 44298, 44325, 44338, 44289, 44364, 44362, 44295, 44348, 44290, 44374, 44381, 44359,
44366, 44293, 44356, 44351, 44389, 44321, 44349, 44380, 44397, 44373, 44297, 44367, 44391,
44386, 44350, 44347, 44377, 44392, 44383, 44287, 44390, 44302, 44316, 44382, 44388, 44370,
44369, 44361, 44322, 44393, 44378, 44379, 44542, 44586, 44550, 44612, 44599, 44582, 44640,
44570, 44538, 44653, 44549, 44626, 44649, 44566, 44581, 44610, 44598, 44592, 44646, 44652,
44615, 44642, 44629, 44641, 44596, 44561, 44539, 44562, 44557, 44635, 44563, 44556, 44589,
44591, 44555, 44603, 44605, 44625, 44547, 44545, 44546, 44654, 44651, 44637, 44579, 44620,
44650, 44576, 44567, 44627, 44611, 44594, 44593, 44618, 44544, 44575, 44628, 44614, 44647,
44619, 44639, 44558, 44551, 44645, 44548, 44569, 44568, 44564, 44632, 44607, 44595, 44552,
44602, 44622, 44634, 44580, 44588, 44600, 44560, 44644, 44583, 44636, 44577, 44624, 44587,
44606, 44573, 44631, 44623, 44633, 44553, 44554, 44609, 44584, 44616, 44597, 44604, 44643,
44621, 44541, 44494, 44412, 44399, 44481, 44406, 44492, 44488, 44472, 44500, 44518, 44485,
44522, 44460, 44497, 44509, 44531, 44475, 44407, 44501, 44469, 44512, 44511, 44495, 44471,
44487, 44525, 44400, 44491, 44482, 44474, 44503, 44507, 44414, 44521, 44484, 44504, 44404,
44456, 44451, 44529, 44523, 44536, 44409, 44530, 44464, 44449, 44468, 44467, 44453, 44463,
44473, 44455, 44458, 44505, 44476, 44410, 44486, 44513, 44405, 44480, 44478, 44499, 44466,
44496, 44401, 44524, 44532, 44515, 44489, 44514, 44502, 44483, 44402, 44506, 44461, 44508,
44527, 44516, 44462, 44533, 44479, 44537, 44519, 44493, 44517, 44408, 44534, 44413, 44459,
44452, 44520, 44465, 44411, 44528, 44535, 44526, 44498, 44415, 44477, 44510, 44667, 44670,
44664, 44666, 44655, 44707, 44699, 44658, 44748, 44767, 44740, 44661, 44716, 44691, 44656,
44708, 44719, 44676, 44677, 44724, 44760, 44682, 44727, 44695, 44747, 44732, 44702, 44741,
44764, 44680, 44681, 44759, 44668, 44745, 44713, 44686, 44758, 44717, 44768, 44763, 44706,
44755, 44669, 44672, 44754, 44704, 44735, 44710, 44728, 44703, 44750, 44709, 44739, 44662,
44697, 44698, 44696, 44690, 44752, 44757, 44705, 44722, 44673, 44684, 44692, 44687, 44731,
44701, 44726, 44665, 44660, 44659, 44674, 44746, 44700, 44671, 44685, 44718, 44683, 44715,
44743, 44733, 44675, 44712, 44734, 44736, 44737, 44738, 44720, 44756, 44751, 44689, 44711,
44744, 44729, 44742, 44761, 44766, 44730, 44753, 44769, 44812, 44779, 44848, 44841, 44853,
44787, 44874, 44850, 44872, 44821, 44832, 44785, 44877, 44818, 44816, 44825, 44851, 44875,
44793, 44836, 44773, 44823, 44831, 44843, 44772, 44803, 44837, 44844, 44813, 44856, 44808,
44873, 44826, 44849, 44781, 44774, 44846, 44829, 44800, 44790, 44862, 44810, 44857, 44868,
44804, 44852, 44819, 44864, 44840, 44822, 44788, 44796, 44871, 44801, 44799, 44807, 44786,
44778, 44794, 44791, 44863, 44795, 44783, 44858, 44806, 44814, 44784, 44838, 44861, 44789,
44842, 44827, 44859, 44847, 44866, 44780, 44805, 44835, 44771, 44865, 44870, 44828, 44802,
44820, 44845, 44815, 44839, 44876, 44777, 44817, 44834, 44798, 44855, 44809, 44833, 44824,
44860, 44770, 44867, 44887, 44902, 44888, 44895, 44878, 44880, 44892, 44889, 44884, 44885,
44901, 44900, 44898, 44890, 44894, 44883, 44891, 44896, 44886, 44879, 44924, 44929, 1821,
17110, 19328, 19329, 19330, 19331, 19332, 19334, 19335, 19336, 19337, 19338, 19356, 19357,
19358, 19231, 19359, 19360, 19233, 19361, 19362, 19244, 19245, 19246, 19247, 19249, 19250,
19251, 19252, 19253, 19254, 19255, 19257, 19258, 19259, 19261, 19262, 19263, 19264, 19265,
19266, 19267, 19268, 19269, 19270, 19271, 19272, 19273, 19274, 19275, 19276, 19277, 19278,
19321, 19322, 19324, 19326, 19327, 13586, 1527, 40043, 18981, 19475, 53778, 53777, 53776,
16891, 19469, 18975, 26915, 1773, 1566, 1567, 1774, 13531, 39463, 39761, 17449, 17450, 17439,
17472, 17422, 17446, 17427, 17460, 16838, 16969, 16970, 16959, 16992, 16942, 16966, 16947,
16980, 19457, 23170, 2092, 1989, 1983, 1981, 1980, 1979, 1940, 1847, 1811, 1809, 1808, 1807,
1806, 1641, 1640, 1619, 1595, 1593, 1592, 1591, 1590, 2095, 2078, 2073, 2027, 1974, 1957,
1918, 1917, 1916, 1915, 1914, 1912, 1911, 1910, 1909, 1908, 1906, 1905, 1904, 1903, 1902,
1801, 1758, 1757, 1755, 1754, 1753, 1752, 1751, 1750, 1748, 1747, 1642, 1585, 1556, 1555,
1553, 1552, 1551, 1550, 1549, 1548, 1547, 1545, 1544, 2023, 1995, 1956, 1476, 1473, 26905,
26503, 2093, 1990, 1982, 1978, 1976, 1885, 1882, 1848, 1825, 1824, 1823, 1810, 1805, 1799,
1770, 1768, 1620, 1608, 1605, 1603, 1598, 1594, 1589, 1584, 1582, 1563, 1530, 17207, 17205,
19433, 18939, 16855, 16921, 13515, 19226, 19227, 19439, 18945, 16861, 19440, 18946, 16862,
19437, 18943, 16859, 18922, 19434, 18940, 16856, 19494, 19000, 16916, 19500, 19006, 16922,
19441, 18947, 16863, 19223, 19225, 19224, 19468, 18974, 16890, 17357, 16897, 19424, 18930,
18776, 16846, 16692, 19218, 19453, 19502, 19008, 18959, 16924, 16875, 19449, 18955, 16871,
13561, 13563, 13562, 19450, 18956, 13568, 13564, 16872, 13567, 13565, 13566, 19454, 18960,
16876, 19452, 18958, 16874, 17489, 19442, 18948, 16864, 19420, 18926, 18772, 16842, 16688,
19425, 18931, 13552, 18777, 16847, 16693, 13542, 19486, 18992, 13544, 16908, 13587, 17493,
19485, 18991, 16907, 19483, 18989, 16905, 19484, 18990, 16906, 19035, 17431, 16951, 19036,
19487, 18993, 16909, 19045, 17441, 16961, 13598, 13546, 13599, 23169, 19041, 17437, 16957,
19047, 17443, 16963, 19076, 13521, 13522, 13534, 13545, 19463, 18969, 16885, 23173, 17355,
13540, 17354, 20408, 23174, 19456, 20398, 18962, 16878, 19216, 19212, 13595, 13596, 20376,
19431, 18937, 16853, 17358, 19229, 19228, 20410, 19215, 20403, 20402, 20400, 19423, 18929,
18775, 16845, 16691, 19421, 18927, 18773, 16843, 16689, 19498, 19004, 16920, 19432, 18938,
16854, 19211, 17028, 23167, 20407, 20416, 20401, 20409, 23175, 19214, 19213, 20404, 19219,
13537, 18781, 16697, 13551, 19435, 18941, 16857, 19430, 13577, 13576, 18936, 16852, 20414,
17031, 13601, 13557, 13569, 19480, 18986, 16902, 19043, 18779, 16695, 23165, 23172, 19464,
18970, 16886, 13594, 13548, 19221, 18782, 16698, 18780, 16696, 19488, 18994, 16910, 13554,
19491, 18997, 16913, 19478, 18984, 16900, 18963, 16879, 19495, 19001, 16917, 19467, 18973,
16889, 19501, 19007, 16923, 19466, 18972, 16888, 19465, 18971, 13581, 16887, 19438, 18944,
16860, 19429, 18935, 16851, 19426, 13525, 19476, 18982, 16898, 18932, 16848, 19497, 19003,
16919, 13549, 13583, 13538, 19222, 13559, 13543, 19459, 18965, 16881, 19447, 18953, 16869,
19445, 18951, 16867, 19026, 13529, 13530, 13532, 13558, 19064, 13539, 19490, 18996, 16912,
13573, 13571, 19053, 17356, 13580, 20421, 19443, 18949, 16865, 19422, 18928, 18774, 16844,
16690, 26504, 19419, 18925, 18771, 16841, 16687, 13585, 13553, 13555, 13550, 13520, 20381,
20382, 20380, 13589, 13590, 13523, 13536, 13582, 13592, 13591, 13593, 13588, 13516, 13541,
17381, 17387, 13578, 23171, 13517, 26520, 19056, 17452, 17043, 16972, 13519, 19209, 26911,
26894, 17036, 26893, 17035, 26892, 17034, 26895, 17037, 26910, 26909, 17033, 26899, 26517,
26890, 17032, 26518, 19028, 17424, 19040, 17436, 16944, 16956, 19050, 19031, 26519, 26513,
19062, 17458, 17049, 16978, 26522, 20413, 19054, 17027, 26514, 17025, 26521, 26516, 13575,
17490, 17486, 19499, 19005, 13556, 13574, 20415, 19462, 18968, 16884, 19461, 18967, 16883,
19460, 18966, 16882, 13533, 23166, 20223, 33022, 40431, 39759, 17365, 16104, 19744, 19804,
19806, 19818, 16591, 19857, 19770, 16592, 16593, 16712, 19152, 19143, 19012, 19200, 8283,
19611, 18980, 18799, 16943, 18977, 18979, 18791, 16707, 18887, 16765, 19375, 19604, 16808,
19113, 19530, 19046, 19534, 19206, 18811, 16809, 16097, 16055, 16818, 19508, 40391, 19505,
16815, 18848, 19387, 19103, 19414, 19410, 19512, 19195, 18784, 18912, 19153, 16962, 19513,
19095, 16708, 15990, 16825, 19605, 19088, 19814, 18800, 19758, 19404, 32953, 18812, 8544,
19532, 19773, 18814, 19769, 19102, 19366, 19090, 19576, 18805, 6592, 16894, 18809, 16939,
18786, 32929, 16802, 15962, 16194, 16728, 16896, 17423, 19813, 16702, 19401, 19614, 16045,
19798, 18802, 19101, 19411, 19319, 19391, 16048, 19523, 19367, 53782, 19203, 16700, 16895,
18911, 16770, 18909, 16182, 19158, 16703, 16756, 18884, 18840, 19526, 18890, 19794, 16706,
19568, 19117, 16799, 19369, 19572, 19527, 18787, 19110, 53779, 18886, 16071, 19049, 19318,
19776, 18798, 19569, 19187, 19204, 8362, 18839, 18999, 19761, 19570, 6589, 16904, 16928,
19607, 19521, 19140, 18885, 19561, 19118, 17440, 15998, 19370, 16965, 19409, 19104, 19753,
19395, 16760, 18906, 18988, 16767, 19364, 19155, 16721, 16763, 19493, 18883, 15967, 16803,
18849, 16059, 19144, 19398, 19560, 19799, 8546, 19774, 16915, 19405, 18891, 19620, 19014,
16761, 16816, 16828, 19145, 19382, 19565, 16421, 19197, 18845, 19407, 8284, 19159, 19557,
18796, 16764, 19191, 18806, 8751, 53784, 19371, 16730, 18910, 19376, 16047, 18908, 19617,
19190, 19812, 19323, 16086, 19608, 19519, 18797, 16116, 19392, 18844, 19403, 19517, 16960,
19096, 16807, 16812, 16711, 15948, 18847, 39876, 18907, 19402, 16827, 17445, 19416, 19383,
19768, 19535, 17360, 16117, 19472, 19743, 19474, 19377, 19473, 16727, 19741, 15965, 17442,
16771, 19822, 19397, 19415, 19027, 19189, 19384, 18841, 19390, 19148, 16718, 6590, 16806,
16762, 19533, 16822, 19819, 16893, 19100, 19566, 16826, 19518, 19408, 19796, 19368, 19374,
19389, 19149, 19623, 19567, 16722, 16755, 19116, 19388, 19800, 19393, 19520, 16098, 18790,
16124, 16800, 18855, 19805, 19188, 19091, 15985, 19099, 15987, 18892, 19412, 16824, 19516,
16713, 19109, 19613, 18899, 16725, 19621, 19394, 19396, 18896, 16420, 18846, 18851, 19767,
17363, 19575, 19378, 16715, 19562, 19771, 8363, 19511, 19106, 16729, 19379, 19194, 19482,
19742, 19606, 17359, 18978, 18900, 17324, 19380, 19400, 16099, 18854, 18813, 19151, 18795,
18902, 32950, 19115, 19196, 16714, 15981, 53783, 19810, 19795, 19471, 19044, 8257, 19801,
19807, 16752, 19775, 19817, 16823, 18792, 18836, 19413, 18893, 16930, 19023, 16102, 19507,
19150, 15993, 19612, 16757, 19094, 16801, 16716, 17011, 17040, 17041, 26499, 26889, 26891,
26900, 26908, 27144, 54007, 19749, 19381, 19372, 19650, 19651, 19652, 19763, 32311, 4610,
6529, 17217, 5270, 5276, 5248, 40157, 35962, 23134, 39838, 7482, 5275, 872, 23637, 6532,
17218, 23022, 6539, 1339, 6531, 3260, 5250, 4222, 2737, 6526, 31146, 23148, 5251, 7431, 6530,
3805, 22759, 39624, 31131, 25534, 4223, 5266, 31123, 6538, 2742, 6553, 13981, 39837, 5265,
1335, 36111, 5274, 24056, 6552, 5273, 23044, 6658, 17208, 6499, 8643, 23366, 5272, 12929,
6578, 22761, 3263, 5234, 14432, 875, 4225, 4227, 6524, 2739, 32634, 6528, 14433, 6498, 17206,
6533, 33381, 1338, 6534, 874, 5267, 6542, 3258, 23977, 39836, 17220, 39833, 35246, 23051,
1330, 1341, 39828, 12935, 17109, 12051, 12908, 17121, 17092, 15937, 12067, 12939, 17094,
12069, 18011, 12924, 12062, 12056, 18006, 20315, 17112, 12912, 12070, 18007, 12057, 20307,
14426, 11722, 10893, 20318, 12071, 39775, 12913, 25997, 20080, 20091, 12923, 17093, 17111,
12987, 12934, 22757, 11696, 31273, 12918, 12926, 22756, 17126, 17115, 22758, 15883, 12910,
17091, 12945, 17104, 17203, 17098, 18870, 10362, 12922, 19591, 16090, 20306, 17105, 18003,
12063, 14422, 17089, 17221, 17120, 16683, 12065, 17114, 12059, 12911, 17116, 12066, 17351,
17103, 18013, 22753, 12917, 12930, 19174, 11655, 20011, 12933, 16786, 19347, 17107, 12928,
17099, 12931, 32940, 12940, 17199, 17494, 17212, 12872, 17053, 6545, 6576, 22059, 17200,
31201, 17213, 17214, 12955, 12953, 6540, 40798, 24669, 24668, 24667, 40872, 32550, 24670,
17021, 26523, 26524, 26511, 26525, 26515, 14765, 16041, 26512, 16129, 19748, 23045, 40420,
40421, 40430, 40429, 40437, 40436, 40434, 40433, 40435, 40423, 40425, 40427, 40424, 40426
]

## 文档中心 / 开发者文档 / 数据字典 / 承诺发货时效说明

- 文档 ID：`156551928165`
- 更新时间：`2026-03-31T17:41:15.084000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=156551928165`

站点普通品定制品美国1/2/7/9个工作日1/2/3/7/9/10/12个工作日墨西哥1/2/7-13个工作日1/2/3/7-16个工作日智利1/2/7-12个工作日1/2/3/7-15个工作日秘鲁1/2/7-15个工作日1/2/3/7-18个工作日哥伦比亚1/2/7-16个工作日1/2/3/7-19个工作日厄瓜多尔1/2/10-20个工作日1/2/3/10-23工作日欧盟1/2/8-12个工作日1/2/3/8-15个工作日其他1/2个工作日1/2/3个工作日

## 文档中心 / 开发者文档 / 常见问题 / 常见问题

- 文档 ID：`114595649140`
- 更新时间：`2026-01-20T16:00:58.998000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=114595649140`

# 1. 鉴权常见报错

1-1. 接口报错"errorMsg":"type not exists."
请检查入参的接口type值是否在CN区接口范围内，可通过bg.open.accesstoken.info.get查询接口范围

# 2. 货品常见报错

2-1. 发品接口bg.goods.add报错提示"errorMsg":"主销售属性不合法"
非服饰默认传值："mainProductSkuSpecReqs":[{"parentSpecId":0,"parentSpecName":"","specId":0,"specName":""}]

2-2. 发品接口bg.goods.add报错提示"尺码表包含不合法的尺码规格"
发品的尺码必须和尺码表中的尺码一致，例如发品传入S、M、L三种尺码，那么尺码表必须为S、M、L三种尺码

2-3. 发品接口报错提示“URL域名校验不通过或URL包含不合法字符串"
图片需要先调用图片上传接口（bg.goods.image.upload），将返回的URL作为发品接口入参

2-4. 属性模版接口bg.goods.attrs.get返回为空
请检查入参的catId，要求传入叶子类目
货品类目接口bg.goods.cats.get返回的isLeaf=true为叶子类目

2-5. 发品接口提示：“主销售规格属性值列表重复”
非服饰只能传入一个skc

2-6. "服饰类目skc轮播图xxx校验失败，应符合宽高比例为3:4，宽>=1340px，高>=1785px，<=2M"
图片校验是使用图片上传接口的base64原图做校验，请商家排查base64原图是否符合接口返回提示的要求

2-7. 发品接口返回"不合法的尺码模板id：[0]"
showSizeTemplateIds和sizeTemplateIds，没有尺码表时传空数组[]

# 3. 全托备货发货

3-1. 查询大仓收货地址接口bg.shiporder.receiveaddressv2.get未返回收货地址
请检查备货单是否已经加入发货台，按照流程先加入发货，在调用收货地址接口

## 文档中心 / 开发者文档 / 入驻流程 / 入驻流程说明

- 文档 ID：`136614434571`
- 更新时间：`2026-01-28T15:17:14.833000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=136614434571`

欢迎您加入TEMU合作伙伴平台！为了帮助您快速完成入驻并开始使用平台接口服务，请详读以下内容。您也可通过右侧目录快速导航。

# 一、平台简介

本平台提供TEMU在CN区的接口能力，覆盖场景包括全托半托发品、库存和全托备货履约业务
如需其他场景（如半托订单履约、本本业务）请跳转至其他区域合作伙伴平台，点击分区说明 (https://agentpartner.temu.com/document?cataId=875196199516&docId=909799935182)了解更多分区情况

UShttps://partner-us.temu.com/ EUhttps://partner-eu.temu.com/GLOBALhttps://partner.temu.com/
# 二、角色介绍

合作伙伴角色应用角色说明入驻流程电商软件服务商即三方ERP，主要为Temu商家提供ERP等软件应用服务，入驻后，TEMU商家可在卖家中心后台选到您的应用，并获取授权主体入驻->应用创建->应用上线具体步骤参考下文中的「四、电商软件服务商入驻SOP」Temu商家即自研应用，Temu商家为了实现自研系统跟Temu跨境卖家中心的数据同步，授权信息仅允许本主体的店铺使用CN区的自研应用联系对接招商申请应用申请后参考下文中的「五、Temu商家入驻SOP」绑定

# 三、流程说明

[image] 入驻流程.png https://commimg.kwcdn.com/feed-public-tag/21a4888af0/85a68b38-cd9f-4bba-88d2-76e023c2af30_1750x2754.png

# 四、电商软件服务商入驻SOP

## 第一步：完成资质审核

1.选择合作伙伴类型：电商软件服务商

[image]  https://commimg.kwcdn.com/feed-public-tag/21a488e82c/d9edb481-987a-46ff-9175-de57ac2994ce_828x380.png

2.提交合作伙伴主体入驻申请
- 支持“中国内地企业”入驻，需填写公司营业执照/法人身份信息/管理身份信息。
- 支持“中国香港企业“入驻，需填写公司注册证/商业登记证/银行账户/开户证明/法人身份信息/管理员身份信息。
- 注意：填写字段需和上传的营业执照图片上一致，否则入驻申请会被驳回，如对审核结果有疑议，可联系开放平台技术支持团队处理。
3.查看合作伙伴主体入驻审核结果

[image]  https://commimg.kwcdn.com/feed-public-tag/21a488e82c/12e02723-6526-4c1b-8d95-e50e9d38c120_834x384.png

4.更新资质信息
- 主体入驻审核通过后，主体类型和统一社会信用代码不可修改
- 更新合作伙伴信息/公司主体信息/法定代表人信息/管理员信息需发起资质变更申请
- 更新管理员邮箱/电话/其他信息可直接变更生效

[image]  https://commimg.kwcdn.com/feed-public-tag/21a488e82c/593370e7-1f9a-4928-8bfb-93a1636ccb4a_824x378.png

## 第二步：创建应用

1.发起创建应用申请
- 请务必准确填写您的成功应用软件的开发经验，并提供相关的应用网站链接，应用在其他电商平台服务市场的上线截图，应用在其他电商平台应用管理模块上线凭证，并说明清楚您的软件的MRD文档和PRD等设计文档帮助我们更好的了解你们的开发计划。
- 每个主体只能申请创建一个货品管理的三方应用

[image]  https://commimg.kwcdn.com/feed-public-tag/21a488e82c/6a0677db-d959-4da9-a0b3-93ee026116f0_2836x1358.png

2.查看应用创建申请结果
- 创建审核驳回：常见原因：应用说明不准确/缺失与其他平台对接信息，开发者可更新补充材料后再次发起应用创建申请
温馨提示：驳回后，如没有任何修改，请不要重新提交申请，以免影响审核结果。请仔细阅读平台要求后，按照要求提交素材后再次申请
- 创建审核通过：可以开始进行Open API接口对接
[image]  https://commimg.kwcdn.com/feed-public-tag/21a488e82c/05158fe3-1e98-433e-8fdb-895f2bea0b84_900x560.png

## 第三步：应用开发和测试

点击【文档中心】-【开发者文档】 (https://partner.kuajingmaihuo.com/document?cataId=875196199516)可跳转查看对接信息、流程，文档在主体入驻审核通过后有权查看

点击【文档中心】-【API文档】 (https://agentpartner.temu.com/document?cataId=875198836203&docId=875202591662)可跳转API接口文档，文档在主体入驻审核通过后有权查看

[image]  https://commimg.kwcdn.com/feed-public-tag/21a488e82c/1922040c-d7d1-4b6a-82b5-127036f0a3ec_2536x1294.jpeg

## 第四步：发布上线应用

1.发起应用上线申请
- 请务必保证提供平台验收的软件测试地址和测试账号在外网可访问，确认相关功能已经开发测试完成具备开放上线的能力

[image]  https://commimg.kwcdn.com/feed-public-tag/21a488e82c/a28f1959-109c-4b2e-949e-7ecf19a690ba_900x560.png  [image]  https://commimg.kwcdn.com/feed-public-tag/21a488e82c/bf67edf5-42fa-430f-9483-7e639525fa3a_988x676.png

2.查看应用上线申请结果
- 上线审核驳回/异常：常见原因：测试系统无法登录/测试地址中无相关接口功能和数据，开发者可更新补充材料后再次发起应用上线申请
温馨提示：驳回后，如没有任何修改，请不要重新提交申请，以免影响审核结果。请仔细阅读平台要求后，按照要求提交素材后再次申请

- 上线审核通过：Temu全托/半托卖家可以在跨境卖家中心CN区授权管理页面搜索授权此应用。

[image]  https://commimg.kwcdn.com/feed-public-tag/21a488e82c/2eaa8c11-981d-4f31-9a7c-917d2ddc5a16_1632x1020.png [image]  https://commimg.kwcdn.com/feed-public-tag/21a488e82c/74d3ba8b-a9db-4436-9da4-1ff2ad16a560_2830x1368.png

# 四、Temu商家入驻SOP

## 第一步：自研应用申请

请商家联系招商运营申请

## 第二步：绑定自研应用

1、应用申请成功后，使用主账号登录到跨境卖家中心 (https://seller.kuajingmaihuo.com/)
2、登陆本平台，点击【应用管理】，选择“Temu商家自研软件”，跳转至卖家中心授权入驻

[image]  https://commimg.kwcdn.com/feed-public-tag/21a488e82c/5f0579d5-981f-4bc2-afab-ef6143d8a221_226x146.jpeg

[image]  https://commimg.kwcdn.com/feed-public-tag/21a488e82c/31dbfb8f-60bd-4c13-bf8f-81d8e82216f6_516x258.jpeg

# 五、查看接口文档

接口文档不允许游客查看，三方主体入驻成功或自研应用绑定应用后，可查下以下文档

点击【文档中心】-【开发者文档】 (https://agentpartner.temu.com/document?cataId=875196199516&docId=897215162233)可跳转查看对接信息、流程

点击【文档中心】-【API文档】 (https://agentpartner.temu.com/document?cataId=875198836203&docId=875202591662)可跳转API接口文档

[image]  https://commimg.kwcdn.com/feed-public-tag/21a488e82c/1997ea11-afc0-4ecb-98d4-d342c375ba3d_2536x1294.jpeg

## 学习中心 / 协议中心 / 最新通知 / 《服务市场服务协议（服务商版）》更新生效通知

- 文档 ID：`157603932572`
- 更新时间：`2025-11-24T21:13:42.829000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=157603932572`

为了进一步优化服务商使用服务市场服务的功能与体验，服务市场现修订了《服务市场服务协议（服务商版）》 (https://agentpartner.temu.com/document?cataId=882537068463&docId=925555108743)，并于2025年11月17日至2025年11月24日进行公示，现本协议将于2025年11月24日正式生效，感谢关注与支持！

服务市场
2025年11月24日

## 学习中心 / 协议中心 / 最新通知 / 《开发者协议》更新生效通知

- 文档 ID：`157608743694`
- 更新时间：`2025-11-24T21:14:12.410000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=157608743694`

为了进一步优化服务商使用服务市场服务的功能与体验，服务市场现修订了《开发者协议》 (https://agentpartner.temu.com/document?cataId=882537068463&docId=925554053926)，并于2025年11月17日至2025年11月24日进行公示，现本协议将于2025年11月24日正式生效，感谢关注与支持！

服务市场
2025年11月24日

## 学习中心 / 协议中心 / 最新通知 / 《服务市场违规处理规则（服务商版）》更新生效通知

- 文档 ID：`158636608251`
- 更新时间：`2025-11-24T21:13:59.106000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=158636608251`

为了进一步优化服务商使用服务市场服务的功能与体验，服务市场现修订了《服务市场违规处理规则（服务商版）》 (https://agentpartner.temu.com/document?cataId=882537068463&docId=924499818076)，并于2025年11月17日至2025年11月24日进行公示，现本协议将于2025年11月24日正式生效，感谢关注与支持！

服务市场
2025年11月24日

## 学习中心 / 协议中心 / 最新通知 / 《服务市场服务协议（服务商版）》更新公示通知

- 文档 ID：`157602757771`
- 更新时间：`2025-11-17T16:05:37.313000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=157602757771`

为了进一步优化服务商使用服务市场服务的功能与体验，服务市场现修订了《服务市场服务协议（服务商版）》 (https://agentpartner.temu.com/document?cataId=882537068463&docId=925555108743)，并于2025年11月10日至2025年11月17日公开进行意见征集，未收到有效意见，现将本协议进行公示。本协议将于2025年11月24日正式生效，感谢关注与支持！

服务市场
2025年11月17日

## 学习中心 / 协议中心 / 最新通知 / 《开发者协议》更新公示通知

- 文档 ID：`157607629635`
- 更新时间：`2025-11-17T16:05:04.188000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=157607629635`

为了进一步优化服务商使用服务市场服务的功能与体验，服务市场现修订了《开发者协议》 (https://agentpartner.temu.com/document?cataId=882537068463&docId=925554053926)，并于2025年11月10日至2025年11月17日公开进行意见征集，未收到有效意见，现将本协议进行公示。本协议将于2025年11月24日正式生效，感谢关注与支持！

服务市场
2025年11月17日

## 学习中心 / 协议中心 / 最新通知 / 《服务市场违规处理规则（服务商版）》更新公示通知

- 文档 ID：`157607162247`
- 更新时间：`2025-11-17T16:05:19.259000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=157607162247`

为了进一步优化服务商使用服务市场服务的功能与体验，服务市场现修订了《服务市场违规处理规则（服务商版）》 (https://agentpartner.temu.com/document?cataId=882537068463&docId=924499818076)，并于2025年11月10日至2025年11月17日公开进行意见征集，未收到有效意见，现将本协议进行公示。本协议将于2025年11月24日正式生效，感谢关注与支持！

服务市场
2025年11月17日

## 学习中心 / 协议中心 / 最新通知 / 《服务市场服务协议（服务商版）》更新意见征集

- 文档 ID：`157601465263`
- 更新时间：`2025-11-10T17:19:45.673000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=157601465263`

为了进一步优化服务商使用服务市场服务的功能与体验，服务市场现修订了《服务市场服务协议（服务商版）》 (https://agentpartner.temu.com/document?cataId=882537068463&docId=925555108743)，并公开进行意见征集。如您对本次修订有任何意见或建议，可在2025年11月17日（含当日）前联系我们，感谢您的关注与支持！

服务市场
2025年11月10日

## 学习中心 / 协议中心 / 最新通知 / 《开发者协议》更新意见征集

- 文档 ID：`158637750572`
- 更新时间：`2025-11-10T17:18:57.458000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=158637750572`

为了进一步优化服务商使用服务市场服务的功能与体验，服务市场现修订了《开发者协议》 (https://agentpartner.temu.com/document?cataId=882537068463&docId=925554053926)，并公开进行意见征集。如您对本次修订有任何意见或建议，可在2025年11月17日（含当日）前联系我们，感谢您的关注与支持！

服务市场
2025年11月10日

## 学习中心 / 协议中心 / 最新通知 / 《服务市场违规处理规则（服务商版）》更新意见征集

- 文档 ID：`157605378472`
- 更新时间：`2025-11-10T17:19:20.408000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=157605378472`

为了进一步优化服务商使用服务市场服务的功能与体验，服务市场现修订了《服务市场违规处理规则（服务商版）》 (https://agentpartner.temu.com/document?cataId=882537068463&docId=924499818076)，并公开进行意见征集。如您对本次修订有任何意见或建议，可在2025年11月17日（含当日）前联系我们，感谢您的关注与支持！

服务市场
2025年11月10日

## 学习中心 / 协议中心 / 协议列表 / 开发者协议 V1.1

- 文档 ID：`156557486956`
- 更新时间：`2025-11-10T17:10:52.168000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=156557486956`

开发者协议
（V1.1版本 发布日期：2025年11月17日）
签约须知：
《开发者协议》（以下简称“本协议”）为上海从鲸信息技术有限公司（以下简称“甲方”）与注册、使用Partner Platform（以下简称“开放平台”）的法律实体（以下简称“乙方”或“开发者”）达成的各项条款、条件和规则。
甲方在此特别提醒乙方认真阅读本协议各项条款（对于本协议中以加粗字体显示的内容应重点阅读），并请乙方审慎考虑是否接受本协议。如乙方在线接受或以甲方认可的其他方式签署本协议，或者实际使用本协议项下服务的，则表明乙方已充分阅读、理解并自愿接受本协议，同意受本协议各项条款约束。
本“签约须知”为本协议正文的组成部分。

1.  协议内容、变更及生效
1.1. 本协议包括协议正文、附件及所有甲方已经发布的或将来可能发布的各类规则（包括但不限于规则、规范等，以下合称“规则”）。所有附件及规则均为本协议不可分割的组成部分，与协议正文具有同等法律效力。协议正文、附件或规则之间不一致的，以发布在后的文件为准执行。
1.2. 甲方有权变更（包括但不限于制定、修订、废止）本协议正文、附件及/或规则，并进行公示，乙方应实时关注公示内容。如乙方不接受变更，应当立即停止使用本服务并书面通知甲方，本协议于甲方收到乙方书面通知之日起终止，甲方对于该等终止不负有任何违约责任或其他责任。如乙方继续使用本服务，或者未书面通知甲方终止协议的，即视为乙方接受前述变更事项，该等变更事项对乙方有约束力。
1.3. 乙方理解并同意，本协议第4.1款项下服务的实际提供方可能为甲方及/或甲方的关联公司（可单称或合称“我们”），但该等情形不会影响本协议的效力和乙方依据本协议所享有的权利和承担的义务、责任。甲方有权根据其关联公司的资源、人力、条件、能力等各方面因素自行安排实际为乙方提供本协议第4.1款项下服务的关联公司，但仍由甲方行使本协议项下权利，并独立承担本协议项下义务和责任。
1.4. 乙方签署或在线接受本协议后本协议即生效，但本协议项下服务并不立即开通。乙方履行上传相关资质等义务且经甲方审核通过后，本协议项下服务正式开通。
2.  定义
2.1. 应用，是指开发者基于开放平台所开发的软件或服务，包括自用型应用和他用型应用两种类型。
2.2. 应用程序编程接口，英文名称为Application Programming Interface，可简称为API，是指一些预先定义的函数，目的是提供应用程序与开发者基于某软件或硬件的以访问一组例程的能力，而又无需访问源码或理解内部工作机制的细节。
2.3. 开放平台，是指这样一个网络空间：我们提供一些计算机软件和支持材料，开发者可以通过这些软件和支持材料开发应用以服务于自身或特定类型的用户（下称“用户”），开发者可以通过开放平台应用编程接口调用指定的功能服务，访问由我们提供的或用户授权的与用户相关的数据及/或来自其他我们应用程序的数据信息，或者由开发者应用向我们提供数据；开放平台可能包括但不限于一个或多个API、编程工具和文档。
2.4. 用户，本协议项下是指所有直接或间接使用开发者基于开放平台开发的应用的主体，以及浏览开发者应用相关信息的网络访客。
2.5. 开发者，是指经有效申请并通过验证的、可以基于开放平台进行应用开发的主体。
2.6. 开发者账号，是指我们为经有效申请并通过验证的开发者分配的账号。
2.7. App_key & App_secret，是指开发者在申请开发新应用时获得的由我们授予的应用程序接入账户和密钥。App_key是应用的唯一标识，我们通过App_key来识别应用开发者的身份。App_secret是我们给应用分配的密钥，该密钥在一定技术条件下可保证应用来源的可靠性。
2.8. 某一主体的“关联公司”或“关联方”，是指由该主体控制、受同一实体控制或控制该主体的公司、组织或其他主体。前述“控制”是指直接或间接拥有的权力，从而通过行使表决权、合同或其他方式决定或影响某一方的管理或决策方向。
3.  开发者注册
3.1. 乙方应按照注册流程要求提交相关注册信息及注册资料，经甲方审核通过后即可获得开发者身份及相应权限。
3.2. 乙方理解并认可，甲方仅能以普通或非专业人员的知识水平标准对乙方在注册环节填写或提交的注册信息及注册资料进行形式上的识别，并且甲方保留抽查、要求乙方补充提交、及时更新前述信息或资料的权利。乙方应当对注册信息及注册资料的真实性、合法性、持续有效性独立承担全部责任；如甲方发现乙方的注册信息或资料存在造假、失效等情形的，甲方有权对乙方的开发者账号采取限制措施或终止本协议、停止提供服务，并根据相关规则采取处理措施。
4.  权利义务约定
4.1. 我们根据我们的能力和意愿为开发者提供一定的应用开发的相关网络环境和技术支持，包括应用数据接口的开发、封装，数据同步，应用开发、运行的系统环境，以及与此有关的互联网技术服务，为开发者和用户之间进行应用许可相关事宜提供便利。
4.2. 甲方有权管理开放平台，对开发者和用户的注册数据及交易行为进行查阅，发现注册数据或交易行为中存在任何异常或疑问，均有权向开发者发出询问或要求改正的通知，或者直接做出删除等处理措施。如存在以下任一违规情形的，甲方有权以普通或非专业人员的知识水平标准对相关内容或行为进行判断，并有权根据判断结果采取删除相关信息、停止向开发者提供服务及其他甲方认为应当采取的处理措施：
（1）   开发者存在或可能存在诈骗、盗窃、传播计算机病毒、侵犯用户隐私等违法违规行为或不当行为的；
（2）   行政机关或司法机关就开发者在开放平台上的行为进行调查，或作出相关决定或裁决的；
（3）   我们从任何第三方获知开发者存在侵犯他人合法权益、违反公序良俗等违法违规行为或不当行为，或者具体应用存在前述问题的。
4.3. 开发者同意，因其注册账号、使用开放平台、行使或履行本协议的权利义务而产生的或向我们提交的任何信息和数据，无论本协议终止前还是终止后，我们均有权合理使用，使用方式包括但不限于依据该等信息、数据进行技术分析、市场调研；同时，对于该等信息、数据，无论本协议是否终止，我们均无义务返还开发者。我们无义务就获取、备份、处理、使用前述信息、数据而向开发者支付任何费用。
4.4. 开发者理解并同意，我们有义务根据有关法律要求向司法机关或行政机关提供开发者的信息和资料。在开发者未能按照本协议、开放平台规则或者与用户之间的约定履行其应尽的义务时，我们有权根据自己的判断、有关协议和规则、生效裁判文书或者与交易有关的用户的合理请求披露开发者的信息、资料，我们不对此承担任何责任。
5.  开放平台使用规范
5.1. 开发者成功注册开发者账号后，我们将根据开发者账号和密码确认其身份，该账号仅限于开发者自身使用，开发者不得将该账号以任何形式向第三方转让、出租、出借、泄露、披露等。
5.2. 开发者应妥善保管账号和密码，并对使用该账号和密码所进行的一切行为承担全部责任。乙方承诺在密码或账号遭到未获授权的使用，或者发生其他安全问题时，将立即通知我们。乙方同意并确认，我们不对上述情形产生的任何直接或间接损失承担责任。
5.3. 开发者声明并保证其使用开放平台相关服务过程中遵守如下要求：
（1）   不复制、模仿、修改、篡改、翻译、改编、出借、出售、转许可、在信息网络上传播或转让开放平台相关服务及/或软件，也不得逆向工程、反汇编、反编译、分解拆卸或试图以其他方式发现开放平台服务/软件的源代码，或者在未经明确允许的情况下创作衍生作品；
（2）   不分发、销售、转销、租赁、许可、再许可或通过其他方式将开放平台或任何用户信息提供给第三方（包括以任何方式存储开放平台或用户信息致使第三方能够访问）；
（3）   不从事避开或修改我们的数据统计工具的行为；
（4）   不发送或存储带有病毒、蠕虫、木马或其他有害的计算机代码、文件、脚本和程序；
（5）   不利用我们提供的资源和服务上传、下载、存储、发布任何违法违规、侵权、淫秽、色情、不道德、欺诈、诽谤（包括商业诽谤）、非法恐吓或非法骚扰等信息或内容，不为他人发布该等信息提供任何便利（包括但不限于设置URL、BANNER链接等）；
（6）   不侵犯甲方、甲方的关联公司或其他任何第三方的合法权益；
（7）   如开放平台相关服务涉及第三方软件之许可使用的，开发者同意遵守相关许可协议的约定；
（8）   不从事其他违法、违规或不恰当的行为。
5.4. 开发者声明并保证其在开放平台开发、发布的应用符合如下要求：
（1）   真实、合法、准确、完整，不会有任何淫秽、色情、不道德、欺诈、诽谤（包括商业诽谤）、非法恐吓或非法骚扰的内容；
（2）   不会侵犯任何第三方享有的合法权利和利益，包括但不限于知识产权等；
（3）   不会违反任何法律、法规、条例、规章等；
（4）   不会直接或间接与下述各项内容链接：a）任何法律、法规、条例或规章所禁止的商品或服务；b）无权链接或包含的商品或服务。
5.5. 开发者开发、发布的应用需要收集或使用用户数据的，应当符合以下要求：
（1）   开发者必须确保通过合法渠道获取、使用、保存用户数据，并应事先获得用户同意，且应当告知用户相关数据收集的目的、范围及使用方式，保障用户知情权；
（2）   开发者不得请求、收集、索取或以其他方式从任何用户那里获取对甲方或甲方关联公司旗下产品及服务的账户、密码或其他身份验证凭据的访问权，不得为任何用户自动登录到甲方或甲方关联公司旗下产品及服务的网站提供代理身份验证凭据，不得提供“跟踪”功能，包括但不限于识别其他用户在开发者应用档案文件页上查看或操作；
（3）   开发者不得利用其他开发者的App_key或相关权限获取用户数据；
（4）   开发者应当仅获取为应用程序运行及功能实现目的而必要的数据，开发者在特定应用中收集的用户数据仅可在该特定应用中使用，不得将收集的用户数据转移或使用在该特定应用之外，不得将用户数据出售、转让或用于特定应用之外的任何其他目的；
（5）   开发者应当向用户提供查询、修改、删除用户数据的方式，确保用户要求删除其用户数据时可通过该方式自行操作完成，并确保相关数据被完全删除；
（6）   我们有权限制或阻止开发者获取用户数据及开放平台运营数据，有权自主决定相关数据的保存期限，如我们认为开发者使用用户数据的方式、数据收集目的或收集范围有可能损害用户体验、侵犯用户权益或者不符合应用程序运行或功能实现的目的，我们有权要求开发者立即删除相关数据并不得再以该方式使用或再行收集该等数据；
（7）   一旦用户退订或停止使用开发者的应用，开发者必须立即删除从该用户处获取的全部数据，且我们有权基于数据安全考虑不经通知径行采取删除数据的处理措施。
5.6. 开发者同意，如经甲方书面同意开发者可以使用开放平台运营数据的，开发者使用行为应当同时符合本协议约定及我们另行告知的相关要求。
5.7. 开发者违反法律法规或本协议约定非法获取或不当使用相关数据的，甲方有权采取中止本协议、删除开发者已获取的相关数据、下架应用等处理措施；开发者应当独立承担由此产生的全部责任，并赔偿给我们、用户或任何第三方造成的全部损失。
5.8. 开发者同意接收来自我们发出的邮件、信息。
5.9. 开发者在开放平台注册成为开发者后，申请发布一个新应用时，开发者将得到一个针对该应用的唯一的App_key和App_secret。开发者同意通过开放平台提供的途径合法获取应用标识（App_key）及密钥（App_secret）。开发者对App_key和App_secret的机密负全部责任。开发者同意任何时候都不得使用其他开发者的App_key和App_secret，也不得将自己的App_key和App_secret透露给任何第三方。开发者同意在发现或怀疑他人未经授权使用其App_key或App_secret时立即通知我们。但我们对开发者的App_key和App_secret的所有使用情况，包括但不限于任何未经授权的访问、更改或者删除、破坏、损害、丢失或未能存储均不承担任何责任。
5.10. 开发者不得明示或暗示我们加入、赞助或认可开发者的应用，不得以其他任何方式造成他人混淆，引人误以为是我们提供的应用或与我们存在联系，包括但不限于在开发者应用名称中或顶级域名左侧的URL中使用甲方及/或甲方关联公司名称、甲方及/或甲方关联公司运营的业务品牌名称的任何变体、缩写或错误拼写。
6.  费用及保证金
6.1. 甲方有权就本协议项下服务收取服务费。如有收费项目，届时具体收费标准及结算方式等事项以相关规则、系统页面说明及/或双方约定（如有）为准。
6.2. 甲方有权要求乙方缴纳保证金，用于担保乙方对本协议的履行，具体保证金标准以相关协议规则、系统提示及/或双方另行约定（如有）为准。
6.3. 甲方有权随时根据开放平台运营情况、乙方账户使用情况、乙方违约情形及/或潜在风险等因素，单方调整乙方的保证金标准。如因保证金标准调整或其他原因，导致乙方的保证金余额低于其应缴存的保证金标准的，甲方有权要求乙方在指定期限内补足。若乙方未在指定期限内补足，则甲方有权中止/终止本协议项下的部分或全部服务，或者解除本协议。
6.4. 若乙方违反本协议、乙方与甲方及/或甲方的关联公司之间任何协议条款、相关法律法规或者乙方做出的任何陈述、保证、承诺，甲方有权自主决定扣除部分或全部保证金，乙方特此确认，甲方无需为此提前通知乙方或就该等扣款行为承担任何责任。
7.  应用产品在线交易
7.1. 开发者理解并同意，其在正式向用户提供应用的使用许可之前，应自行与用户单独签署相应的许可协议，并严格按照协议约定履行。我们不对应用的交易情况做出任何承诺、保证或担保。
7.2. 应用的描述：开发者提供的在开放平台上展示的文字描述、图画或照片，可以是a）对开发者合法拥有且开发者希望交易的应用的描述；或b）对用户正在寻找的应用的描述。开发者可以通过开放平台发布任一类应用描述，或者两种类型同时发布，条件是开发者必须取得我们的同意，并将该等应用描述归入正确的类目。我们不对应用描述的准确性和内容负责。
7.3. 开发者收费应用与用户订购
（1）   开发者基于开放平台开发的应用可以发布至第三方服务市场（以下简称“服务市场”，具体可发布的服务市场以系统实际支持为准）进行在线销售，开发者应按照其与用户达成的相关协议约定收取费用；
（2）   开发者通过服务市场销售应用的，还应遵守服务市场制定的相关流程并另行签署相关协议。
（3）   退款：用户支付费用后要求退款的，用户有权与开发者进行协商，开发者应当按照用户在订购应用时事先说明的退款方案或根据与用户的协商方案安排退款或按照服务市场相关规定处理。
（4）   开发者违反本协议约定、开放平台规则或服务市场相关协议规则规定的，我们有权从开放平台删除、屏蔽开发者提供的应用或限制其功能，此时可能造成用户订购的应用无法正常使用或正常提供服务。该等情形的发生属于开发者过错或过失，产生的所有责任和后果均由开发者独立承担。
（5）   用户使用开发者提供的应用和收费服务发生的任何纠纷应由开发者与用户自行协商解决，我们不承担任何责任。我们在用户与开发者产生纠纷时有权介入进行协调，开发者也应秉承为用户提供优质服务的理念为用户提供便利，但我们并不保证协调取得实际效果。
8.  保密条款
8.1. 乙方承诺，乙方对本协议（含附件）内容以及在谈判、磋商及履行本协议过程中获知或接触到的甲方及/或甲方的关联公司、相关合作方的任何信息、文件、数据、资料等（包括但不限于商业秘密、双方往来沟通记录、商业计划、财务数据、技术信息、业务数据、用户数据、人员信息、开发者账户系统中所有数据及信息等）（合称“保密信息”）承担保密义务，未经甲方事先书面同意，不得以任何形式（包括但不限于明示、暗示、直接或间接等）交付、披露、散布、转让或分发给任何第三方，也不得用作任何除本协议目的之外的其他用途。乙方同意采取措施保护保密信息，保密措施应高于乙方对其自有保密信息所采取保护措施的级别。
8.2. 对于合作过程中甲方提供的及/或从开放平台获取的保密信息，甲方有权随时要求乙方立即返还或者予以永久销毁、删除并向甲方提供已经返还或销毁、删除保密信息的书面确认。
8.3. 未经甲方事先书面同意，乙方不得擅自披露、使用、复制、转移或许可第三方使用甲方及/或甲方关联公司的名称、商标、标志、商业信息、技术及其他信息、资料。
8.4. 本协议项下保密条款永久有效，不因本协议被撤销、被宣告无效、失效、解除、中止、终止而失效。
8.5. 本条上述限制条款不适用于以下情形，但乙方应提供证明材料：
（1）   在签署本协议之时或之前，该保密信息已以合法方式属乙方所有；
（2）   任何已公开出版的或以其他形式处于公共领域的信息；
（3）   乙方在获得甲方提供的这些信息前通过其他合法途径已获得的信息，并且没有附加保密义务的限制；
（4）   乙方应法院、检察院或行政机关要求（通过询问、要求提供资料或文件、传唤、民事或刑事调查）而透露保密信息；在该等情形发生时，乙方应立即向甲方发出通知并做出必要说明。
8.6. 乙方充分知晓本保密条款对于甲方及/或甲方的关联公司意义重大，甲方及/或甲方的关联公司会因乙方、乙方关联方及/或乙方合作方的违约行为而遭受难以恢复的重大损害。乙方特此承诺，如乙方、乙方关联方及/或乙方合作方违反本保密条款的任何约定、承诺、保证、义务或责任的，甲方有权要求乙方按照a）人民币100万元，或b）乙方在本协议项下已产生的费用总额的30%，两者中较高的一项向甲方支付违约金，并要求乙方赔偿甲方损失。为免疑义，甲方行使前述权利不影响甲方在本协议其他条款项下的权利。
9.  知识产权条款
9.1. 未经甲方事先书面同意，乙方及乙方关联方不得擅自披露、使用、复制、转移或许可第三方使用甲方及甲方关联方的名称、商标、标志、商业信息、技术及其他资料。乙方及乙方关联方应当维护甲方、甲方关联方、甲方及其关联方旗下品牌的商业信誉和声誉，不得在公开渠道（包括但不限于社交软件、媒体平台、公开网站等，下同）发布任何甲方或甲方关联方的负面信息或发表任何有损甲方、甲方关联方声誉的言论。未经甲方书面授权，乙方及乙方关联方不得以甲方、甲方关联方或甲方及其关联方旗下品牌名义，或者以前述主体合作方的名义对外发布消息，包括但不限于在未经甲方书面授权的情况下，在任何渠道和场景发布、发表、传播、披露、引用、转载任何甲方、甲方关联方或甲方及其关联方旗下品牌的言论、文章、音频、视频、素材、图片、照片、信息、文件、数据等，或对外宣传系甲方及其关联方旗下品牌合作方，或与甲方及其关联方旗下品牌存在商业联合、许可使用、商业冠名、广告代言等联系。
9.2. 开放平台上由甲方或第三方权利人提供的内容，包括但不限于作品、图片、档案、资讯、资料、网站架构、网站画面安排、网页设计等，均由甲方或相应第三方权利人依法拥有其知识产权（包括但不限于商标权、专利权、著作权、商业秘密相关权益等），未经甲方或相应第三方权利人事先书面同意，开发者不得擅自使用、修改、复制、公开传播、改变、散布、发行或公开发表等。
9.3. 开放平台运营数据（包括但不限于用户针对开发者应用的使用数据）的全部权利均归属于甲方。开发者承诺在未经甲方事先书面许可的情形下，不得为任何目的擅自保存、使用或授权他人使用前述运营数据。
9.4. 根据本协议的条款和条件，甲方授予开发者有限的、非排他的、可随时终止的和不可再分发的许可，仅限于开发者在自己访问和使用开放平台开发、测试、显示其应用时，允许开发者访问甲方提供的或用户自身授权的用户信息，并允许其他用户访问开发者的应用；但甲方有权视情况限制、约束或禁止开发者或用户访问开发者的应用。
9.5. 开发者保留其创建的应用内容以及其中包括的所有权利、权属或权益，包括但不限于归属于开发者的知识产权（我们的知识产权除外）。开发者通过开放平台提交或发布应用，即表明开发者授予我们非排他的、完全给付并免费的全球性许可，允许我们使用、复制、再许可、重设格式、修改、删除、添加、公开显示、重现、分发和执行开发者应用，以及将其存储和缓存在我们指定服务器上，且开发者保证该等许可是合法有效的、不可撤回的。
9.6. 乙方保证拥有本协议所需的资质和权利，并承诺其提供的任何信息、资料、内容不侵犯他人知识产权及其他合法权益。因乙方提供的任何信息、资料、内容侵犯他人知识产权或其他合法权益而发生或引起的任何索赔、纠纷，均由乙方自行负责处理并独立承担责任；因此造成甲方损失的，乙方应赔偿甲方损失。
9.7. 乙方同意并保证，若乙方及/或其关联方注册与甲方、甲方关联方持有的相同或近似的商标、名称、标识、标志、微信公众号、域名、网页等，则应当在甲方或甲方关联方提出相关要求时，无偿将相关商标、名称、标识、标志、微信公众号、域名、网页等转让给甲方或甲方关联方。
9.8. 乙方充分知晓本知识产权条款对于甲方及/或甲方关联方的意义重大，甲方及/或甲方关联方会因乙方、乙方关联方及/或乙方合作方的违约行为而遭受难以恢复的重大损害。乙方特此承诺，如乙方、乙方关联方及/或乙方合作方违反本知识产权条款任何约定、承诺、保证、义务或责任的，甲方有权要求乙方按照a）人民币100万元；或b）乙方在本协议项下已产生的费用总额的30%，两者中较高的一项向甲方支付违约金，并要求乙方赔偿甲方损失。为免疑义，甲方行使前述权利不影响甲方在本协议其他条款项下的权利。
10. 反商业贿赂及利益冲突条款
10.1. 乙方向甲方特此承诺，乙方、乙方关联方、乙方或其关联方的管理人员、董事、法定代表人、股东、顾问、代理、雇员（含临时）、工作人员、服务人员、辅助乙方履行协议的义务人员及其他相关人员（以下统称“乙方人员”）自愿遵守本条款约定，不得通过甲方、甲方的关联公司、甲方及/或其关联公司的顾问、代理、雇员（含临时）、工作人员（以下统称“甲方人员”）或其密切关系人（指与当事人有密切个人或业务关系的任何人，包括但不限于当事人的配偶、亲属、情侣、师生、同学、朋友、同事、前同事、合伙人、投资人、顾问、律师、中介、代理人等，下同）牟利，如乙方人员为签署本协议或在本协议签署后实施了违反本条款规定的行为，依据本条款处理。
10.2. 乙方人员不得以任何名义向甲方人员或其密切关系人直接或间接地、明示或暗示地提议、许诺、同意、默认、追认、输送任何形式的利益，包括但不限于金钱物品、消费卡券、干股分红、有价证券、股权债权、金融产品、虚拟财产、礼品样品、回扣佣金、招待宴请、娱乐旅游、消费安排、财物借用、债务抵扣、费用减免、劳务服务、就业置业、就医就学、荣誉头衔、资格资质评定、特殊待遇等（以下简称“本条款下的利益”）。
10.3. 乙方人员不得以任何名义与甲方人员或其密切关系人发生任何形式的经济往来（包括但不限于借贷投资、借用租用、担保抵押等）或合作（包括但不限于入股、顾问、雇佣等）。
10.4. 乙方人员不得为甲方人员或其密切关系人寻求、获取、掩饰、隐瞒本条款下的利益提供任何形式的帮助，包括但不限于居间斡旋、托管代持、出借账户、销毁凭据、虚构事实、隐匿资产等行为及提供实施前述行为的便利条件。
10.5. 乙方人员不得寻求、获取因甲方人员或其密切关系人的个人关系或不当行为而产生的任何利益或竞争优势。
10.6. 乙方人员应（a）配合并出席甲方及甲方的关联公司的调查和访谈，并为此提供所有相关信息和协助（包括但不限于提供详细的相关账目和证明材料），（b）配合及协助甲方及/或甲方的关联公司的任何合规审计和调查。
（1）   如乙方人员拒绝配合，或拒绝按照甲方及/或甲方的关联公司的要求披露相关信息或材料，或在指定期限内未进行合理解释及有效举证，或经举证仍不能有效证明未有相关违约行为的，甲方有权直接判定乙方违反本条款约定，存在违约行为。
（2）   乙方保证，乙方人员在调查或访谈时提供的所有信息真实、合法、有效，不存在任何虚假内容。
（3）   乙方保证，调查、访谈或协助过程中，非经甲方及/或甲方的关联公司事先书面确认，乙方人员不会将任何相关的信息以任何形式泄露给第三方。
10.7. 乙方人员发现甲方人员或其密切关系人索取或收受本条款下的利益，应及时向甲方举报并提供相关证据。乙方举报后，甲方有权要求乙方通过甲方指定渠道提供详细信息和对应材料。
10.8. 利益冲突的报备。乙方必须主动披露任何可能出现利益冲突的情况，并自相关情况出现之日起三日内以书面形式报备至甲方，相关情况包括但不限于：
（1）     乙方人员与甲方或甲方关联公司离职人员或其密切关系人，以合伙、合作、入股、咨询顾问、代理、雇佣等任何形式进行合作的；
（2）     乙方人员与甲方人员（含已离职人员）之间存在其他利益关系、密切关系或个人关系的，包括但不限于债权债务关系、恋爱关系、（曾经）共事关系、好友关系、师生关系、同学关系等。
10.9. 乙方在此确认并保证，乙方、乙方关联方和乙方人员在与甲方或甲方的关联公司开展的全部已履约和未履约的、招投标过程中、全部历史和当前正在进行的合作中均不存在违反本反商业贿赂及利益冲突条款约定的情形。
10.10. 鉴于商业贿赂及利益冲突行为会严重破坏经营秩序，损害营商环境，甲方始终对此零容忍，乙方充分知悉违反本条的约定对甲方利益的严重损害程度，因此，乙方理解并确认：若乙方、乙方关联方或乙方人员违反本反商业贿赂及利益冲突条款的任何约定、承诺、保证、义务或责任的，甲方有权立即取消乙方投标/中标资格（如有），终止本协议及／或双方在其他协议下的合作，扣除全部保证金，不予结算全部款项，并要求乙方按照a）人民币50万元；或b）乙方、乙方关联方和乙方人员直接或间接输送本条款下的利益的价值的3倍；或c）本协议项下已产生的费用总额的30%，三者中较高的一项向甲方支付违约金，且乙方应赔偿甲方因此遭受的全部损失。乙方充分理解上述违约金性质为惩罚性违约金，在任何情况下，乙方均同意按照本条的约定全额支付违约金。如乙方、乙方关联方或乙方人员违约的情形涉嫌犯罪的，甲方有权依法将犯罪线索移交公安机关、司法机关处理，同时保留向乙方、乙方关联方和乙方人员主张民事责任的权利。本条约定的违约责任与本协议其他条款不一致的，以本条约定为准。
11. 关联关系条款
11.1. 关联关系的情形。甲方有权将具备关联关系的系统账户（指为使用甲方及/或甲方关联公司旗下产品或服务而注册的账户，下同）进行统一管理，形成关联圈。前述关联关系是指系统账户存在下列情形之一：
（1）   系统账户的入驻人、管理人、紧急联系人、退货信息、账户主体及主体信息等任一登录信息存在直接/间接交叉（若前述信息发生过变更，则包括变更前后的主体及相关信息，下同）；
（2）   系统账户绑定的提现账户（包括银行账户、支付账户等，下同）、与提现账户绑定的手机号码、费用缴纳/充值账户等任一信息存在直接/间接信息交叉；
（3）   系统账户的登录IP、登录设备号等任一信息存在直接/间接交叉；
（4）   存在其他类似性质的信息直接/间接交叉或关联。
11.2. 统一管理。甲方有权对关联圈内的系统账户进行统一管理，包括但不限于统一增加或扣减信誉值，统一扣划系统账户资金，统一中止/终止提供相关产品及服务等。
11.3. 关联账户的违规处理。若关联圈中的任一系统账户存在违反相关法律法规、本协议、规则、或者与甲方及/或甲方关联公司签署的任何其他协议的情形，甲方有权要求乙方对关联圈内各系统账户间的关联关系做出正式的书面解释，也有权无需通知直接判定各系统账户间的关联关系；同时，甲方有权自行或通知甲方关联公司、相关合作方对违规的系统账户及其关联账户统一采取以下各类措施中的一项或多项：
（1）   部分或全部商品（含应用、服务等，下同）屏蔽、降权、下架、禁售、删除；
（2）   部分或全部商品移除资源位、禁止上资源位、移除广告；
（3）   账户降级、商品禁止上新、禁止上架；
（4）   关闭或限制系统账户部分或全部功能、权限；
（5）   限制注销账户；
（6）   提高保证金标准、扣除部分或全部保证金；
（7）   限制系统账户资金提现；
（8）   直接扣划各系统账户资金冲抵违规系统账户应承担的违约金及其他款项、费用；
（9）   单方解除本协议，终止合作；
（10） 限制系统账户的注册主体使用其信息注册甲方及/或甲方关联公司旗下的任何产品或服务；
（11） 本协议及/或规则规定的或甲方认为应当采取的其他处理措施。
12. 期限和终止
12.1. 本协议期限自乙方接受本协议之日起至本协议依据相关条款约定终止之日止。但保密条款、知识产权条款、违约责任条款在本协议终止后将继续有效。
12.2. 甲方有权经提前3日通知乙方解除本协议而无需承担任何责任。
12.3. 出现下列情形之一的，甲方有权立即中止本协议且按有关规则进行处理：a）乙方违反本协议项下的任何约定、承诺或保证；b）乙方违反开放平台的任何规则规定。
12.4. 如开放者在本协议终止后再次直接或间接以他人名义注册或登录开放平台的，甲方一经发现即有权直接单方终止向该开发者提供服务。
12.5. 如乙方注册填写的联系方式失效，导致甲方无法与乙方取得联系的，甲方有权立即中止或终止提供服务。
12.6. 协议终止后的处理：
（1）   服务终止后，我们没有义务为开发者保留原账号中或与之相关的任何信息，也没有义务转发任何消息给开发者或用户或第三方，亦不就终止服务而对开发者或用户或任何第三方承担任何责任。
（2）   不论本协议项下服务因任何原因以任何方式终止，我们仍有权：a）保持或不保存该开发者的数据及以前的交易行为记录；b）对于开发者在服务终止前实施的违法或违约行为所导致的任何后果和责任，开发者应当完全独立承担，我们有权向开发者索赔；c）要求开发者立即删除其从开放平台获得的全部数据，包括但不限于用户数据、开放平台运营数据；此外我们有权基于数据安全考虑不经通知径行删除相关数据。
13. 违约责任
13.1. 如乙方违反相关法律法规、本协议、规则、或者乙方与甲方或甲方关联公司之间的任何协议约定，甲方有权视情况自行或通知甲方关联公司、相关合作方对乙方及/或其系统账户（指为使用甲方及/或甲方关联公司旗下产品或服务而注册的账户，下同）采取以下一项或多项处理措施：
（1）   部分或全部商品（含应用、服务等，下同）屏蔽、降权、下架、禁售、删除；
（2）   部分或全部商品移除资源位、禁止上资源位、移除广告；
（3）   账户降级、商品禁止上新、禁止上架；
（4）   关闭或限制系统账户部分或全部功能、权限；
（5）   中止或终止提供服务（包括开放平台API的调用）；
（6）   限制注销账户；
（7）   提高保证金标准、扣除部分或全部保证金；
（8）   限制系统账户资金提现；
（9）   要求乙方赔偿全部甲方损失；
（10） 直接扣划系统账户资金冲抵乙方应承担的违约金、赔偿金及其他款项、费用；
（11） 单方解除本协议，终止合作；
（12） 限制系统账户的注册主体使用其信息注册甲方及/或甲方关联公司旗下的任何产品或服务；
（13） 本协议及/或规则规定的或甲方认为应当采取的其他处理措施。
13.2. 如甲方根据其判断认为开发者账户存在异常活动，甲方有权限制该等账户的权限或功能，单方暂停或终止开发者使用相关服务和账户。
13.3. 双方一致同意，实际业务中甲方发现乙方违约可能会存在滞后性，乙方理解并确认甲方无论何时发现乙方存在或可能存在任何违约情形，均有权通知乙方存在或可能存在的违约行为及相应的违约赔偿金额，并要求乙方进行解释说明和相应举证。乙方应在收到甲方通知后3日内以电子邮件或双方约定的其他方式进行确认，如乙方有异议的应进行解释说明并提供甲方认可的真实、准确、充分的证据，否则乙方理解并确认以甲方主张的违约金、赔偿金金额为准。
13.4. 本协议所称的甲方损失（含直接损失和间接损失），包括但不限于直接经济损失、客户流失损失、机会损失、业务影响损失、管理成本、向第三方支付的经济补偿/赔偿/违约金、由此导致的行政罚款、商誉损失，以及甲方及甲方关联公司为降低损失、防止损失扩大、固定证据及因维权、追究乙方相关法律责任所支出的合理费用（包括但不限于交通差旅费用、保全费、保全保险费、公证费、调查取证费用、律师费用、评估费、鉴定费、审计费、诉讼费用、仲裁费用等）等。乙方行为造成甲方或甲方关联公司商誉受损的，乙方还应为甲方或甲方关联公司消除影响，消除影响的方式包括但不限于在公开发行的报刊、新闻媒体上刊登声明等。
13.5. 乙方理解并同意，本协议项下约定的各项违约金金额均为合理计算的甲方损失，是双方反复磋商的结果，乙方对上述违约责任约定的合理性充分理解且有预见，不以任何理由主张前述违约金过高而要求调整，如乙方违约的，乙方放弃申请要求调低违约金金额的权利。同时，如对应违约金金额不足以弥补甲方损失的，乙方应向甲方继续赔偿差额部分的损失。
13.6. 乙方违约行为的范围。乙方有义务对其履约行为、履约人员进行有效管理，乙方保证乙方及其代表、代理、受托人，或乙方及其关联方的董事、高级管理人员、股东、顾问、代理、雇员（含临时）、辅助乙方履行合同的义务人及其工作人员等相关人员均不会实施任何违反本协议的行为，前述主体实施的行为均视为乙方行为，若该等行为违反本协议约定的，则由乙方按协议的约定承担违约责任。
13.7. 乙方依据本协议向甲方承担违约责任的，并不免除乙方因其违约或其他行为应当向其他第三方承担的责任。
13.8. 乙方同时违反本协议及/或其他相关协议规则的，甲方按照本协议采取处理措施的，不影响甲方有权继续依据其他相关协议规则采取相应处理措施，乙方应同时按照各个协议规则等约定分别承担违约责任。
14. 有限责任
14.1. 对于开发、运营、支持和维护开发者应用，开发者应当独立承担所有的风险和后果。我们没有责任和义务对于通过开放平台发布的任何不准确或不正确的内容承担任何责任，无论该等不准确或不正确是由用户造成的，还是由于应用所使用的或与应用相连接的任何设备或程序所造成的。
14.2. 乙方明确理解和同意，本协议项下服务将按“现状”和按“可得到”的状态提供。我们会在现有技术的基础上尽最大努力提供相应的安全措施以保障服务安全和正常运行，但受限于现有技术、客观条件以及可能发生的不可抗力事件，我们在此明确声明对服务不作任何明示或暗示的保证，包括但不限于对服务的可使用性、没有错误或疏漏、持续性、准确性、可靠性、适用于某一特定用途。
14.3. 我们不对因下述任一情况而导致的任何损害赔偿承担责任，包括但不限于利润、商誉、使用、数据等方面的损失或其它无形损失的损害赔偿（无论我们是否已被告知该等损害赔偿的可能性）：
（1）   使用或未能使用本协议项下的服务（本14.3条项下简称“服务”）；
（2）   第三方未经批准的接入或第三方更改用户的传输数据或数据；
（3）   第三方对服务的声明或关于服务的行为，或非因我们的原因而引起的与服务有关的任何其他情形；
（4）   可能存在的计算机病毒、网络通讯故障、系统停机维护。
14.4. 在任何情况下，我们不对任何间接性、后果性、惩戒性、偶然性、特殊性或惩罚性的损害（包括但不限于开发者使用开放平台而遭受的利润损失等）承担责任，及时我们已被告知该等损失的可能性。
14.5. 我们对开发者承担的全部责任，始终不超过开发者在已经过的服务期限内因使用开放平台而支付给甲方的费用（如有）。
15. 法律适用与争议解决
15.1. 本协议的订立、效力、解释、履行及争议解决均适用中华人民共和国法律（仅为本协议之目的，不包括中国香港特别行政区、中国澳门特别行政区及中国台湾地区的法律）。
15.2. 甲乙双方同意，凡因本协议引起的或与本协议有关的任何争议，均应提交上海国际经济贸易仲裁委员会/上海国际仲裁中心（下称“仲裁委员会”）进行仲裁。任何一方提起仲裁的，在仲裁案件受理后至仲裁庭组成前，双方一致同意由仲裁委员会主任指定一名调解员对争议进行调解，除双方书面请求延长期限外，调解期间自调解员指定之日起算不应低于三个月，双方应全力配合调解员的调解工作，并尽最大努力化解纠纷、解决争议，在此期间内若双方均书面申请终止调解的，调解中止。双方同意调解期间内暂缓仲裁庭组成等仲裁程序，无需仲裁委员会再次征询双方意见；如调解期间内双方仍未达成调解的，双方争议应根据仲裁委员会仲裁规则继续推进解决。
15.3. 乙方认可甲方及其关联公司、相关合作方在其计算机信息系统中存储、生成的和另行收集的所有数据、资料、信息、文件（展示形式包括但不限于视频、音频、图表、EXCEL表格）真实、准确、完整，同意甲方在纠纷解决中将该等数据、资料、信息、文件直接提交并作为认定案件事实的合法有效且充分的证据，无需另行公证。
16. 通知及送达
16.1. 通知。本协议签订或履行过程中，甲方向乙方寄送的书面通知，在交邮后第五个自然日即视为送达，乙方指定邮寄地址为其身份证住址或住所地。除前述方式外，本协议项下甲方书面通知乙方的形式还包括但不限于甲方自行或委托甲方关联公司、相关合作方发布/发送公示、公告、弹窗、站内信、系统信息、向乙方发送电子邮件、手机短信、QQ消息和传真等电子方式。在采用电子方式进行通知的情况下，发送当日即视为送达。本协议项下乙方的联系信息（包括但不限于身份证住址、住所地、联系地址、联系人、联系电话、电子邮箱，下同）以乙方向服务市场及/或开放平台提供的为准。
16.2. 法律文书送达。对于因本协议或因本协议所规定事项引起或与之相关的任何纠纷，乙方声明认可以下内容：
（1） 司法机关及/或仲裁委员会可通过包括但不限于诉讼平台、上海国际仲裁中心数智化平台、手机短信、邮寄、电子邮件等便捷有效的方式向乙方送达包括但不限于起诉状副本、仲裁申请书副本、证据副本、举证通知书、应诉通知书、仲裁通知书、传票、判决书、裁定书、调解书、裁决书等法律文书，仲裁委员会调解阶段的材料亦可通过手机短信、邮寄、电子邮件等方式向乙方送达。乙方认可上述送达方式的有效性及合法性。通过诉讼平台或上海国际仲裁中心数智化平台送达的，有效送达的认定以适用的送达规则为准。以手机短信方式送达的，短信发送至乙方提供给服务市场及/或开放平台的手机号码即视为送达。以邮寄方式送达的，寄送至乙方提供给服务市场及/或开放平台的联系地址，签收或邮件退回之日即为送达之日。以电子邮件方式送达的，
（2） 乙方同意司法机关及/或仲裁委员会可采取以上一种或多种送达方式向其送达，采取多种方式送达的，送达时间以上述送达方式中最先送达的为准。
（3） 乙方确认的上述送达方式适用于争议解决的各个阶段（包括但不限于调解、仲裁和诉讼）。
16.3. 乙方保证提供的联系信息是真实、准确、有效的，，如联系信息变更应立即通过服务市场及/或开放平台更新或以书面方式告知甲方；如乙方提供的联系信息不准确，或乙方未及时更新或以书面方式告知变更后的联系信息，则向原联系信息送达的任何甲方通知及上述法律文书仍视为有效送达，乙方自行承担由此可能产生的所有损失及法律后果。
17. 其他事项
17.1. 未经甲方事先书面同意，乙方不得向第三方转让本协议项下的任何权利及/或义务。
17.2. 本协议是甲乙双方之间关于提供和使用本协议项下服务完整、唯一的约定，开放平台的任何工作人员与乙方及乙方人员之间的沟通、承诺与解释等均不构成对本协议内容的有效变更。
17.3. 双方签订本协议或其他在线协议后，一方因内部管理等原因需要签订纸质协议进行确认或存档的，双方可再行签订纸质协议，但不能因此视为双方存在两个合同关系，纸质协议的内容必须与在线签署的协议内容一致，协议的生效与履行依照在线签署的协议约定执行，在线签署的协议内容与纸质协议的约定不一致的，以前者的约定为准。
17.4. 无合伙或代理关系。除非本协议另有明确规定，本协议的任何内容均无意、亦不应被视为在任何一方之间建立任何合伙、合资、特许经营、销售代表或雇佣关系、或使任何一方成为另一方的代理人、或授权任何一方为或代表任何其他方作出或达成任何承诺。
17.5. 如果根据适用的法律认定本协议中的任何条款或者任何条款中的任何部分无效、违法或者不具有可执行性，这种无效、违法或者不具有可执行性不影响本协议中的任何其它条款或者这些条款中的任何其它部分的效力。
17.6. 本协议于2025年11月24日最新修订生效。
（本行以下无正文）

## 学习中心 / 协议中心 / 协议列表 / 服务市场服务协议（服务商版）V1.1

- 文档 ID：`156558085025`
- 更新时间：`2025-11-10T17:12:50.545000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=156558085025`

服务市场服务协议（服务商版）
（V1.1版本 发布日期：2025年11月17日）
签约须知：
《服务市场服务协议（服务商版）》（以下简称“本协议”）是由服务市场业务的运营方上海从鲸信息技术有限公司（以下简称“甲方”）与通过服务市场为商家提供应用产品及/或服务产品的服务商（以下简称“乙方”或“服务商”）达成的、关于乙方使用服务市场服务（以下简称“本服务”）的各项条款、条件和规则。
甲方在此特别提醒乙方认真阅读本协议各项条款（对于本协议中以加粗字体显示的内容应重点阅读），并请乙方审慎考虑是否接受本协议。如乙方在线接受或以甲方认可的其他方式签署本协议，或者实际使用本服务的，则表明乙方已充分阅读、理解并自愿接受本协议，同意受本协议各项条款约束。
本“签约须知”为本协议正文的组成部分。

1.  协议内容、变更及生效
1.1. 本协议包括协议正文、附件及所有甲方已经发布的或将来可能发布的与本服务有关的规则（包括但不限于保证金规则、违规处理规则及其他规则、规范等，以下合称“服务市场规则”）。所有附件及服务市场规则均为本协议不可分割的组成部分，与协议正文具有同等法律效力。协议正文、附件或服务市场规则之间不一致的，以发布在后的文件为准执行。
1.2. 甲方有权变更（包括但不限于制定、修订、废止）本协议正文、附件及/或服务市场规则，并进行公示，乙方应实时关注公示内容。如乙方不接受变更，应当立即停止使用本服务并书面通知甲方，本协议于甲方收到乙方书面通知之日起终止，甲方对于该等终止不负有任何违约责任或其他责任。如乙方继续使用本服务，或者未书面通知甲方终止协议的，即视为乙方接受前述变更事项，该等变更事项对乙方有约束力。
1.3. 乙方特此确认，自乙方注册开放平台账号之日起，在服务市场发生或与服务市场相关的所有行为、事件等均适用本协议（含服务市场规则等相关条款）的约定。
2.  定义
2.1. 服务市场，是指甲方为服务商和商家之间完成应用产品及/或服务产品等交易提供的在线交易市场。
2.2. 服务商，是指基于线上开放平台（简称“开放平台”）管理面向商家的服务产品或者进行应用开发（以甲乙双方另行签署的相关开放平台开发者协议或其他法律文件约定为准），并通过服务市场发布或在线销售应用产品及/或服务产品的法律实体。
2.3. 应用产品，是指服务商基于开放平台所开发，并在服务市场发布、向商家提供的各类软件，具体以服务市场页面展示为准。
2.4. 服务产品，是指服务商在服务市场发布、向商家销售的各种服务类产品，具体以服务市场页面展示为准。
2.5. 商家，是指在服务市场订购应用产品及/或服务产品的法律实体。
2.6. 某一主体的“关联公司”或“关联方”，是指由该主体控制、受同一实体控制或控制该主体的公司、组织或其他主体。前述“控制”是指直接或间接拥有的权力，从而通过行使表决权、合同或其他方式决定或影响某一方的管理或决策方向。
2.7. 相关合作方，是指向服务商或商家提供其他支持服务的第三方法律实体。
2.8. 乙方理解并同意，本协议第3.1款项下服务的实际提供方可能为甲方及/或甲方的关联公司，但该等情形不会影响本协议的效力和乙方依据本协议所享有的权利和承担的义务、责任。为免疑义，甲方作为第3.1款项下所涉服务的提供方，有权根据其关联公司的资源、人力、条件、能力等各方面因素自行安排实际为乙方提供本协议第3.1款项下服务的关联公司，但仍由甲方行使本协议项下权利，并独立承担本协议项下义务和责任。
3.  服务内容和收费
3.1. 甲方仅为服务商与商家达成交易提供网络经营场所、信息发布等服务（具体以实际页面为准）。
3.2. 甲方并非服务商与商家之间交易行为的参与方，且不对服务商及/或商家的任何口头、书面陈述或承诺，发布的信息及交易行为的真实性、合法性、准确性、及时性、有效性等作出任何明示或暗示的保证。
3.3. 甲方有权就本服务向服务商收取费用（如有），具体收费标准及结算方式等事项以服务市场规则、系统页面说明及/或双方约定（如有）为准；订单发生退款的，已收取的费用不做退还。
3.4. 乙方无条件并不可撤销地授权甲方及/或其关联方通知其相关合作方（包括但不限于第三方支付机构、合作银行等，下同）自服务商交易资金中扣除甲方应收取的费用，具体结算数据以服务市场、开放平台系统记录为准。
4.  保证金条款
4.1. 服务市场通用保证金标准为人民币2万元/类目，乙方应缴存的保证金根据其经营的类目数量累加。对于该等保证金，甲方无需向乙方支付任何利息及其他孳息。
4.2. 保证金缴存、补缴、赔付、扣除、退还等过程中所发生的银行/支付机构手续费等费用由乙方自行承担。
4.3. 乙方应当保证其用于缴存保证金的资金来源合法，并且乙方对该等资金依法享有处分权；若乙方保证金系由第三方代为支付的，乙方应当保证该第三方清楚知晓所支付款的性质、用途等情况且同意代为支付，并保证甲方及/或甲方的关联公司不会受到任何第三方就该等保证金主张任何权利或以任何理由要求返还。
4.4. 甲方有权随时根据某一类目的具体运营情况、乙方经营状况变化、违约情形、实际赔付情况、潜在风险等因素，单方调整保证金标准，如有调整，届时以服务市场规则及/或系统页面提示为准。
4.5. 因保证金标准调整或其他原因导致乙方保证金余额低于其应缴存的保证金标准的，乙方应在指定期限内补足，并同意授权甲方通知相关合作方可自乙方任何未结款项中扣划相应金额予以补足。乙方未在指定期限内补足，或者未结款项不足以补足保证金的，甲方有权解除本协议，终止提供服务。
4.6. 如乙方违反相关法律法规、本协议、服务市场规则之规定，或违反乙方对商家的承诺，或被商家申请维权、索赔的，甲方有权基于自身的独立判断并直接使用保证金对商家或其他受损方进行先行赔付，而无须就此承担责任。
4.7. 如乙方违反相关法律法规、本协议、服务市场规则、或者乙方与甲方、甲方的关联公司或相关合作方签署的其他任何协议条款的，甲方有权自主决定扣除部分或全部保证金。乙方特此确认，甲方无需为此提前通知乙方或就该等扣款行为承担任何责任。
4.8. 乙方理解并同意，本协议项下所有保证金的使用、赔付、扣除等不受服务市场的各类目保证金标准的限制，即乙方以其缴存的所有保证金总额为其在服务市场、开放平台的全部行为以及本协议约定的其他情形进行担保。
4.9. 服务商自主申请退出服务市场的，在服务商符合本协议及服务市场规则等规定条件的情况下，退出申请经甲方审核通过后，甲方将退还剩余的保证金余额（如有）。
4.10. 本协议有关保证金的内容与保证金规则内容存在不一致的，以后者为准。
5.  服务商入驻
5.1. 服务商保证其具有履行本协议，以及开展业务活动所需的行为能力及所有必要的资质和授权，保证其履行本协议的行为不违反任何对其适用的法律法规或对其具有约束力的协议、约定和安排。
5.2. 服务商应当按照系统流程申请入驻，甲方有权对服务商的入驻申请及相关资料进行审核，并自主决定是否准许服务商入驻。
5.3. 服务商应当按照服务市场相关规定在信息提交页面（页面具体名称以实际显示为准）提交相应的证明文件及联系人、联系地址、联系电话、联系邮箱等信息；前述证明文件、信息的具体要求可能会因为甲方、甲方关联公司、相关合作方提供的服务不同而不时调整，具体以信息提交页面展示为准。若前述相关证明文件或信息发生任何变更，服务商应当及时通知甲方进行更新。服务商提交的文件资料无法通过甲方、甲方关联公司、相关合作方审核的，可能会影响服务商使用本协议项下服务。
5.4. 甲方有权对服务商提供的证明文件及信息进行不定时的抽查，并有权根据法律法规或业务经营需要进一步要求服务商提供证明文件原件供核验或提供更多证明文件、信息。如服务商不能配合提供，则甲方有权立即中止或终止相关服务及/或本协议。
5.5. 服务商无条件并不可撤销地授权甲方、甲方关联公司及其相关合作方查询并核验服务商信息，包括但不限于身份信息、征信信息、联系信息等，并同意甲方、甲方关联公司与其相关合作方共享该等信息或其查询核验结果。
5.6. 服务商保证其提供的全部文件及信息全面、真实、准确、合法、有效。服务商提供虚假、过期、失效文件或信息，或者未及时通知并更新其文件或信息的，应自行承担全部法律责任；由此导致服务商不符合准入标准或不再具备履行本协议的能力的，甲方有权立即中止或终止本协议，因此给甲方或其他任何第三方造成损失的，服务商同意赔偿全部损失。
6.  服务市场管理规范
6.1. 服务商不得利用服务市场或甲方提供的相关服务从事任何违规、违法、犯罪活动，或者发布、传播任何违规、违法、犯罪应用或信息。
6.2. 服务商理解并同意，服务市场上的交易均由服务商自行与商家协商达成，服务商向商家提供应用产品及/或服务产品的，应当与商家签署相关软件许可、服务类产品订购等协议，并严格按照该等协议约定履行。
6.3. 服务商理解并确认，甲方并非服务商与商家之间交易的参与方，服务商应自行负责为商家提供安全、稳定、合法、有效的应用产品及/或服务产品，因应用产品及/或服务产品发生纠纷、处罚、诉讼等事项的，服务商应自行承担责任，并且有义务采取有效措施保证甲方及甲方的关联公司免责或者赔偿甲方及甲方的关联公司因此遭受的全部损失。
6.4. 服务商提供应用产品及/或服务产品并收费应当合法规范，必须自行或通过甲方在商家订购应用产品及/或服务产品之前显著提示应用产品及/或服务产品的适用性、事项内容、使用说明、收费标准、支付方式、退款规则、有效期等情况并征得商家同意，不得引诱、欺诈、误导商家进行不合理的交易。
6.5. 服务商应依法为商家开具正规发票，并依法缴纳相关税费。
6.6. 服务商应当自行为商家提供可靠的客户服务，解答商家疑问、处理争议或纠纷。
6.7. 服务商理解并同意，甲方有权根据服务市场运营情况、管理需要、服务商资质或服务质量等因素，调整服务市场开放类目、服务市场规则等，并有权基于此限制服务商行为或者对服务商的应用产品及/或服务产品采取提示、屏蔽、下架、删除等措施。
6.8. 因服务商所提供的应用产品及/或服务产品的交易、使用发生的任何争议，应由服务商和商家自行协商解决，甲方不就此承担任何责任，但服务商或商家均可以申请甲方介入调处。
6.9. 如服务商或商家申请甲方介入调处争议，则服务商与商家均认可并愿意履行甲方作为独立的第三方根据其所了解到的争议事实并依据本协议、服务市场规则等所做出的调处决定（包括但不限于调整相关订单的交易状态、判定将争议款项的全部或部分支付给交易一方或双方等）。在甲方的调处决定做出前，服务商可选择其他争议处理途径解决争议，届时甲方有权中止或终止调处。
6.10. 如服务商对甲方的调处决定不满意，仍有权采取其他争议处理途径解决争议，但通过其他争议处理途径未取得终局决定前，服务商仍应先履行甲方的调处决定。
6.11. 在服务商已经就某款应用产品及/或某项服务产品向商家收取费用的情形下，如发生下列任一情形：（1）本协议因服务商原因终止；（2）应用产品及/或服务产品因服务商原因被采取屏蔽、下架、删除等处理措施；或（3）服务商自行终止提供应用产品及/或服务产品的，服务商应当按照甲方要求处理结算及善后事宜。服务商应当本着维护商家权益的原则，对已经购买应用产品及/或服务产品且尚在服务期限内的商家提供合理的补偿。如服务商不能提供合理补偿或不能与商家达成善后处置方案的，则甲方有权自主判断并为商家提供补偿，该等补偿费用均由服务商承担。
6.12. 为维护服务市场经营秩序，甲方有权对服务商和商家之间的交易信息和服务情况进行抽查。服务商应当配合提供甲方要求的信息、资料并确保该等信息、资料真实、准确、完整、有效；如甲方向商家询问、了解相关交易信息和服务情况，服务商亦同意商家向甲方如实提供交易和服务相关的所有信息、资料。
7.  保密条款
7.1. 乙方承诺，乙方对本协议（含附件）内容以及在谈判、磋商及履行本协议过程中获知或接触到的甲方及/或甲方的关联公司、相关合作方的任何信息、文件、数据、资料等（包括但不限于商业秘密、双方往来沟通记录、商业计划、财务数据、技术信息、业务数据、用户数据、人员信息、开放平台账号中的所有数据及信息等）（合称“保密信息”）承担保密义务，未经甲方事先书面同意，不得以任何形式（包括但不限于明示、暗示、直接或间接等）交付、披露、散布、转让或分发给任何第三方，也不得用作任何除本协议目的之外的其他用途。乙方同意采取措施保护保密信息，保密措施应高于乙方对其自有保密信息所采取保护措施的级别。
7.2. 对于合作过程中甲方提供的及/或从服务市场获取的保密信息，甲方有权随时要求乙方立即返还或者予以永久销毁、删除并向甲方提供已经返还或销毁、删除保密信息的书面确认。
7.3. 未经甲方事先书面同意，乙方不得擅自披露、使用、复制、转移或许可第三方使用甲方及/或甲方关联公司的名称、商标、标志、商业信息、技术及其他信息、资料。
7.4. 本协议项下保密条款永久有效，不因本协议被撤销、被宣告无效、失效、解除、中止、终止而失效。
7.5. 本条上述限制条款不适用于以下情形，但乙方应提供证明材料：
（1）   在签署本协议之时或之前，该保密信息已以合法方式属乙方所有；
（2）   任何已公开出版的或以其他形式处于公共领域的信息；
（3）   乙方在获得甲方提供的这些信息前通过其他合法途径已获得的信息，并且没有附加保密义务的限制；
（4）   乙方应法院、检察院或行政机关要求（通过询问、要求提供资料或文件、传唤、民事或刑事调查）而透露保密信息；在该等情形发生时，乙方应立即向甲方发出通知并做出必要说明。
7.6. 乙方充分知晓本保密条款对于甲方及/或甲方的关联公司意义重大，甲方及/或甲方的关联公司会因乙方、乙方关联方及/或乙方合作方的违约行为而遭受难以恢复的重大损害。乙方特此承诺，如乙方、乙方关联方及/或乙方合作方违反本保密条款的任何约定、承诺、保证、义务或责任的，甲方有权要求乙方按照a）人民币100万元，或b）乙方在服务市场已产生的历史交易总额的30%，两者中较高的一项向甲方支付违约金，并要求乙方赔偿甲方损失。为免疑义，甲方行使前述权利不影响甲方在本协议其他条款项下的权利。
8.  知识产权条款
8.1. 未经甲方事先书面同意，乙方及乙方关联方不得擅自披露、使用、复制、转移或许可第三方使用甲方及甲方关联方的名称、商标、标志、商业信息、技术及其他资料。乙方及乙方关联方应当维护甲方、甲方关联方、甲方及其关联方旗下品牌的商业信誉和声誉，不得在公开渠道（包括但不限于社交软件、媒体平台、公开网站等）发布任何甲方或甲方关联方的负面信息或发表任何有损甲方、甲方关联方声誉的言论。未经甲方书面授权，乙方及乙方关联方不得以甲方、甲方关联方或甲方及其关联方旗下品牌名义，或者以前述主体合作方的名义对外发布消息，包括但不限于在未经甲方书面授权的情况下，在任何渠道和场景发布、发表、传播、披露、引用、转载任何甲方、甲方关联方或甲方及其关联方旗下品牌的言论、文章、音频、视频、素材、图片、照片、信息、文件、数据等，或对外宣传系甲方及/或其关联方旗下品牌合作方，或与甲方及/或其关联方旗下品牌存在商业联合、许可使用、商业冠名、广告代言等联系。
8.2. 乙方保证拥有本协议所需的资质和权利，并承诺其提供的任何信息、资料、内容不侵犯他人知识产权及其他合法权益。因乙方提供的任何信息、资料、内容侵犯他人知识产权或其他合法权益而发生或引起的任何索赔、纠纷，均由乙方自行负责处理并独立承担责任；因此造成甲方损失的，乙方应赔偿甲方损失。
8.3. 乙方理解并同意，服务市场运营数据的所有权、知识产权及相关衍生权利均归属于甲方，未经甲方事先书面同意，乙方不得为任何目的存储、使用、传输或授权他人使用该等数据。本协议所称服务市场运营数据，包括但不限于任何服务商或商家注册信息及操作数据、商家针对服务商应用产品及/或服务产品的交易数据及使用数据等。
8.4. 乙方保证对其发布、销售的应用产品及/或服务产品享有充分的权利或授权，并授权甲方为履行本协议目的免费使用相应知识产权及其他相关权利。
8.5. 对于乙方及乙方关联方因履行本协议需要向甲方提供的内容，包括但不限于作品、专利、商标、名称、特有标识、装潢、技术秘密、肖像、版式设计、图片、音频、视频等，乙方确认授权甲方为本协议项下目的使用其知识产权及其他相关权利，且乙方保证该等授权许可是合法有效的、免费的、非独家的、不可撤回的。
8.6. 乙方同意并保证，若乙方及/或其关联方注册与甲方、甲方关联方持有的相同或近似的商标、名称、标识、标志、微信公众号、域名、网页等，则应当在甲方或甲方关联方提出相关要求时，无偿将相关商标、名称、标识、标志、微信公众号、域名、网页等转让给甲方或甲方关联方。
8.7. 乙方充分知晓本知识产权条款对于甲方及/或甲方关联方的意义重大，甲方及/或甲方关联方会因乙方、乙方关联方及/或乙方合作方的违约行为而遭受难以恢复的重大损害。乙方特此承诺，如乙方、乙方关联方及/或乙方合作方违反本知识产权条款任何约定、承诺、保证、义务或责任的，甲方有权要求乙方按照a）人民币100万元；或b）乙方在服务市场已产生的历史交易总额的30%，两者中较高的一项向甲方支付违约金，并要求乙方赔偿甲方损失。为免疑义，甲方行使前述权利不影响甲方在本协议其他条款项下的权利。
9.  反商业贿赂及利益冲突条款
9.1. 乙方向甲方特此承诺，乙方、乙方关联方、乙方或其关联方的管理人员、董事、法定代表人、股东、顾问、代理、雇员（含临时）、工作人员、服务人员、辅助乙方履行协议的义务人员及其他相关人员（以下统称“乙方人员”）自愿遵守本条款约定，不得通过甲方、甲方的关联公司、甲方及/或其关联公司的顾问、代理、雇员（含临时）、工作人员（以下统称“甲方人员”）或其密切关系人（指与当事人有密切个人或业务关系的任何人，包括但不限于当事人的配偶、亲属、情侣、师生、同学、朋友、同事、前同事、合伙人、投资人、顾问、律师、中介、代理人等，下同）牟利，如乙方人员为签署本协议或在本协议签署后实施了违反本条款规定的行为，依据本条款处理。
9.2. 乙方人员不得以任何名义向甲方人员或其密切关系人直接或间接地、明示或暗示地提议、许诺、同意、默认、追认、输送任何形式的利益，包括但不限于金钱物品、消费卡券、干股分红、有价证券、股权债权、金融产品、虚拟财产、礼品样品、回扣佣金、招待宴请、娱乐旅游、消费安排、财物借用、债务抵扣、费用减免、劳务服务、就业置业、就医就学、荣誉头衔、资格资质评定、特殊待遇等（以下简称“本条款下的利益”）。
9.3. 乙方人员不得以任何名义与甲方人员或其密切关系人发生任何形式的经济往来（包括但不限于借贷投资、借用租用、担保抵押等）或合作（包括但不限于入股、顾问、雇佣等）。
9.4. 乙方人员不得为甲方人员或其密切关系人寻求、获取、掩饰、隐瞒本条款下的利益提供任何形式的帮助，包括但不限于居间斡旋、托管代持、出借账户、销毁凭据、虚构事实、隐匿资产等行为及提供实施前述行为的便利条件。
9.5. 乙方人员不得寻求、获取因甲方人员或其密切关系人的个人关系或不当行为而产生的任何利益或竞争优势。
9.6. 乙方人员应（a）配合并出席甲方及甲方的关联公司的调查和访谈，并为此提供所有相关信息和协助（包括但不限于提供详细的相关账目和证明材料），（b）配合及协助甲方及/或甲方的关联公司的任何合规审计和调查。
（1）   如乙方人员拒绝配合，或拒绝按照甲方及/或甲方的关联公司的要求披露相关信息或材料，或在指定期限内未进行合理解释及有效举证，或经举证仍不能有效证明未有相关违约行为的，甲方有权直接判定乙方违反本条款约定，存在违约行为。
（2）   乙方保证，乙方人员在调查或访谈时提供的所有信息真实、合法、有效，不存在任何虚假内容。
（3）   乙方保证，调查、访谈或协助过程中，非经甲方及/或甲方的关联公司事先书面确认，乙方人员不会将任何相关的信息以任何形式泄露给第三方。
9.7. 乙方人员发现甲方人员或其密切关系人索取或收受本条款下的利益，应及时向甲方举报并提供相关证据。乙方举报后，甲方有权要求乙方通过甲方指定渠道提供详细信息和对应材料。
9.8. 利益冲突的报备。乙方必须主动披露任何可能出现利益冲突的情况，并自相关情况出现之日起三日内以书面形式报备至甲方，相关情况包括但不限于：
（1）     乙方人员与甲方或甲方关联公司离职人员或其密切关系人，以合伙、合作、入股、咨询顾问、代理、雇佣等任何形式进行合作的；
（2）     乙方人员与甲方人员（含已离职人员）之间存在其他利益关系、密切关系或个人关系的，包括但不限于债权债务关系、恋爱关系、（曾经）共事关系、好友关系、师生关系、同学关系等。
9.9. 乙方在此确认并保证，乙方、乙方关联方和乙方人员在与甲方或甲方的关联公司开展的全部已履约和未履约的、招投标过程中、全部历史和当前正在进行的合作中均不存在违反本反商业贿赂及利益冲突条款约定的情形。
9.10. 鉴于商业贿赂及利益冲突行为会严重破坏经营秩序，损害营商环境，甲方始终对此零容忍，乙方充分知悉违反本条的约定对甲方利益的严重损害程度，因此，乙方理解并确认：若乙方、乙方关联方或乙方人员违反本反商业贿赂及利益冲突条款的任何约定、承诺、保证、义务或责任的，甲方有权立即取消乙方投标/中标资格（如有），终止本协议及／或双方在其他协议下的合作，扣除全部保证金，不予结算全部款项，并要求乙方按照a）人民币50万元；或b）乙方、乙方关联方和乙方人员直接或间接输送本条款下的利益的价值的3倍；或c）乙方在服务市场已产生的历史交易总额的30%，三者中较高的一项向甲方支付违约金，且乙方应赔偿甲方因此遭受的全部损失。乙方充分理解上述违约金性质为惩罚性违约金，在任何情况下，乙方均同意按照本条的约定全额支付违约金。如乙方、乙方关联方或乙方人员违约的情形涉嫌犯罪的，甲方有权依法将犯罪线索移交公安机关、司法机关处理，同时保留向乙方、乙方关联方和乙方人员主张民事责任的权利。本条约定的违约责任与本协议其他条款不一致的，以本条约定为准。
10. 关联关系条款
10.1. 关联关系的情形。甲方有权将具备关联关系的系统账户（指为使用甲方及/或甲方关联公司旗下产品或服务而注册的账户，下同）进行统一管理，形成关联圈。前述关联关系是指系统账户存在下列情形之一：
（1）   系统账户的入驻人、管理人、紧急联系人、退货信息、账户主体及主体信息等任一登录信息存在直接/间接交叉（若前述信息发生过变更，则包括变更前后的主体及相关信息，下同）；
（2）   系统账户绑定的提现账户（包括银行账户、支付账户等，下同）、与提现账户绑定的手机号码、费用缴纳/充值账户等任一信息存在直接/间接信息交叉；
（3）   系统账户的登录IP、登录设备号等任一信息存在直接/间接交叉；
（4）   存在其他类似性质的信息直接/间接交叉或关联。
10.2. 统一管理。甲方有权对关联圈内的系统账户进行统一管理，包括但不限于统一增加或扣减信誉值，统一扣划系统账户资金，统一中止/终止提供相关产品及服务等。
10.3. 关联账户的违规处理。若关联圈中的任一系统账户存在违反相关法律法规、本协议、服务市场规则、或者与甲方及/或甲方关联公司签署的任何其他协议的情形，甲方有权要求乙方对关联圈内各系统账户间的关联关系做出正式的书面解释，也有权无需通知直接判定各系统账户间的关联关系；同时，甲方有权自行或通知甲方关联公司、相关合作方对违规的系统账户及其关联账户统一采取以下各类措施中的一项或多项：
（1）   部分或全部商品（含应用产品、服务产品等，下同）屏蔽、降权、下架、禁售、删除；
（2）   部分或全部商品移除资源位、禁止上资源位、移除广告；
（3）   账户降级、商品禁止上新、禁止上架；
（4）   关闭或限制系统账户部分或全部功能、权限；
（5）   限制注销账户；
（6）   提高保证金标准、扣除部分或全部保证金；
（7）   限制系统账户资金提现；
（8）   直接扣划各系统账户资金冲抵违规系统账户应承担的违约金及其他款项、费用；
（9）   单方解除本协议，终止合作；
（10） 限制系统账户的注册主体使用其信息注册甲方及/或甲方关联公司旗下的任何产品或服务；
（11） 本协议及/或服务市场规则规定的或甲方认为应当采取的其他处理措施。
11. 违约责任
11.1. 如乙方违反相关法律法规、本协议、服务市场规则、或者乙方与甲方或甲方关联公司之间的任何协议约定，甲方有权视情况自行或通知甲方关联公司、相关合作方对乙方及/或其系统账户（指为使用甲方及/或甲方关联公司旗下产品或服务而注册的账户，下同）采取以下一项或多项处理措施：
（1）   部分或全部商品（含应用产品、服务产品等，下同）屏蔽、降权、下架、禁售、删除；
（2）   部分或全部商品移除资源位、禁止上资源位、移除广告；
（3）   账户降级、商品禁止上新、禁止上架；
（4）   关闭或限制系统账户部分或全部功能、权限；
（5）   限制注销账户；
（6）   提高保证金标准、扣除部分或全部保证金；
（7）   限制系统账户资金提现；
（8）   要求乙方赔偿全部甲方损失；
（9）   直接扣划系统账户资金冲抵乙方应承担的违约金、赔偿金及其他款项、费用；
（10） 单方解除本协议，终止合作；
（11） 限制系统账户的注册主体使用其信息注册甲方及/或甲方关联公司旗下的任何产品或服务；
（12） 本协议及/或服务市场规则规定的或甲方认为应当采取的其他处理措施。
11.2. 双方一致同意，实际业务中甲方发现乙方违约可能会存在滞后性，乙方理解并确认甲方无论何时发现乙方存在或可能存在任何违约情形，均有权通知乙方存在或可能存在的违约行为及相应的违约赔偿金额，并要求乙方进行解释说明和相应举证。乙方应在收到甲方通知后3日内以电子邮件或双方约定的其他方式进行确认，如乙方有异议的应进行解释说明并提供甲方认可的真实、准确、充分的证据，否则乙方理解并确认以甲方主张的违约金、赔偿金金额为准。
11.3. 本协议所称的甲方损失（含直接损失和间接损失），包括但不限于直接经济损失、客户流失损失、机会损失、业务影响损失、管理成本、向第三方支付的经济补偿/赔偿/违约金、由此导致的行政罚款、商誉损失，以及甲方及甲方关联公司为降低损失、防止损失扩大、固定证据及因维权、追究乙方相关法律责任所支出的合理费用（包括但不限于交通差旅费用、保全费、保全保险费、公证费、调查取证费用、律师费用、评估费、鉴定费、审计费、诉讼费用、仲裁费用等）等。乙方行为造成甲方或甲方关联公司商誉受损的，乙方还应为甲方或甲方关联公司消除影响，消除影响的方式包括但不限于在公开发行的报刊、新闻媒体上刊登声明等。
11.4. 乙方理解并同意，本协议项下约定的各项违约金金额均为合理计算的甲方损失，是双方反复磋商的结果，乙方对上述违约责任约定的合理性充分理解且有预见，不以任何理由主张前述违约金过高而要求调整，如乙方违约的，乙方放弃申请要求调低违约金金额的权利。同时，如对应违约金金额不足以弥补甲方损失的，乙方应向甲方继续赔偿差额部分的损失。
11.5. 乙方违约行为的范围。乙方有义务对其履约行为、履约人员进行有效管理，乙方保证乙方及其代表、代理、受托人，或乙方及其关联方的董事、高级管理人员、股东、顾问、代理、雇员（含临时）、辅助乙方履行合同的义务人及其工作人员等相关人员均不会实施任何违反本协议的行为，前述主体实施的行为均视为乙方行为，若该等行为违反本协议约定的，则由乙方按协议的约定承担违约责任。
11.6. 乙方依据本协议向甲方承担违约责任的，并不免除乙方因其违约或其他行为应当向商家或其他第三方承担的责任。
11.7. 乙方同时违反本协议及/或其他相关协议规则的，甲方按照本协议采取处理措施的，不影响甲方有权继续依据其他相关协议规则采取相应处理措施，乙方应同时按照各个协议规则等约定分别承担违约责任。
12. 有限责任
12.1. 乙方理解并同意，甲方仅能以普通或非专业人员的知识水平标准对乙方提交的材料进行鉴别，甲方对纠纷的调处、对知识产权维权投诉等事项的处理完全是基于乙方的委托或本协议约定、服务市场规则或相关法律法规规定，甲方无法保证纠纷或知识产权维权投诉等事项的处理结果符合乙方预期，也不对上述事项的处理结果及任何退款、赔付决定承担任何责任。乙方应保证其提交的材料及信息的真实性、合法性，并自行承担其自身、商家、权利人或其他任何第三方提供的信息或数据不实的风险和责任，如乙方因此遭受任何损失，乙方同意自行向受益人或致损方索赔。
12.2. 乙方理解并同意，鉴于现有技术水平和客观条件的限制，甲方会采取一切可能的技术手段保持本服务所涉的技术和信息的有效性、准确性、可靠性、及时性、稳定性、完整性，但甲方对此不作任何承诺或保证。
12.3. 不论在何种情况下，甲方均不对由于Internet连接故障，电脑、通讯或其他系统的故障，电力故障，罢工，劳动争议，暴乱，起义，骚乱，生产力或生产资料不足，火灾，洪水，风暴，爆炸，不可抗力，战争，政府行为，国际、国内法院的命令或第三方的不作为而造成的不能服务或延迟服务承担责任。
13. 期限和终止
13.1. 本协议期限自乙方接受本协议之日起至本协议依据相关条款约定终止之日止。但保密条款、知识产权条款、违约责任条款在协议终止后将继续有效。
13.2. 出现下列情形之一的，甲方有权单方解除本协议，并有权对服务商进行违约处理：
（1）   服务商违反相关法律法规、本协议及/或服务市场规则的；
（2）   服务商超过90天未登录服务市场的；
（3）   服务商未能按期足额向甲方支付保证金或任何应付的费用、款项；
（4）   服务商与甲方及/或甲方关联公司发生纠纷，或服务商行为可能影响甲方及/或甲方关联公司声誉、商誉的；
（5）   甲方认为应当解除本协议的其他情形。
13.3. 本协议终止后，甲方有权关闭乙方账户权限、下架乙方的全部应用产品及服务产品，并终止提供本服务。甲方有权保留与乙方相关的服务市场运营数据、应用数据等数据，但甲方没有为乙方保留该等数据的义务，亦不承担在协议终止后向乙方或任何第三方提供该等数据的义务，法律另有规定的除外。
13.4. 本协议终止并不影响乙方依据本协议或其与商家签署的其他协议而应向商家承担的任何义务和责任。
14. 法律适用与争议解决
14.1. 本协议的订立、效力、解释、履行及争议解决均适用中华人民共和国法律（仅为本协议之目的，不包括中国香港特别行政区、中国澳门特别行政区及中国台湾地区的法律）。
14.2. 甲乙双方同意，凡因本协议引起的或与本协议有关的任何争议，均应提交上海国际经济贸易仲裁委员会/上海国际仲裁中心（下称“仲裁委员会”）进行仲裁。任何一方提起仲裁的，在仲裁案件受理后至仲裁庭组成前，双方一致同意由仲裁委员会主任指定一名调解员对争议进行调解，除双方书面请求延长期限外，调解期间自调解员指定之日起算不应低于三个月，双方应全力配合调解员的调解工作，并尽最大努力化解纠纷、解决争议，在此期间内若双方均书面申请终止调解的，调解中止。双方同意调解期间内暂缓仲裁庭组成等仲裁程序，无需仲裁委员会再次征询双方意见；如调解期间内双方仍未达成调解的，双方争议应根据仲裁委员会仲裁规则继续推进解决。
14.3. 乙方认可甲方及其关联公司、相关合作方在其计算机信息系统中存储、生成的和另行收集的所有数据、资料、信息、文件（展示形式包括但不限于视频、音频、图表、EXCEL表格）真实、准确、完整，同意甲方在纠纷解决中将该等数据、资料、信息、文件直接提交并作为认定案件事实的合法有效且充分的证据，无需另行公证。
15. 通知及送达
15.1. 通知。本协议签订或履行过程中，甲方向乙方寄送的书面通知，在交邮后第五个自然日即视为送达，乙方指定邮寄地址为其身份证住址或住所地。除前述方式外，本协议项下甲方书面通知乙方的形式还包括但不限于甲方自行或委托甲方关联公司、相关合作方发布/发送公示、公告、弹窗、站内信、系统信息、向乙方发送电子邮件、手机短信、QQ消息和传真等电子方式。在采用电子方式进行通知的情况下，发送当日即视为送达。本协议项下乙方的联系信息（包括但不限于身份证住址、住所地、联系地址、联系人、联系电话、电子邮箱，下同）以乙方向服务市场及/或开放平台提供的为准。
15.2. 法律文书送达。对于因本协议或因本协议所规定事项引起或与之相关的任何纠纷，乙方声明认可以下内容：
（1） 司法机关及/或仲裁委员会可通过包括但不限于诉讼平台、上海国际仲裁中心数智化平台、手机短信、邮寄、电子邮件等便捷有效的方式向乙方送达包括但不限于起诉状副本、仲裁申请书副本、证据副本、举证通知书、应诉通知书、仲裁通知书、传票、判决书、裁定书、调解书、裁决书等法律文书，仲裁委员会调解阶段的材料亦可通过手机短信、邮寄、电子邮件等方式向乙方送达。乙方认可上述送达方式的有效性及合法性。通过诉讼平台或上海国际仲裁中心数智化平台送达的，有效送达的认定以适用的送达规则为准。以手机短信方式送达的，短信发送至乙方提供给服务市场及/或开放平台的手机号码即视为送达。以邮寄方式送达的，寄送至乙方提供给服务市场及/或开放平台的联系地址，签收或邮件退回之日即为送达之日。以电子邮件方式送达的，邮件发送至乙方提供给服务市场及/或开放平台的电子邮箱地址即视为送达。
（2） 乙方同意司法机关及/或仲裁委员会可采取以上一种或多种送达方式向其送达，采取多种方式送达的，送达时间以上述送达方式中最先送达的为准。
（3） 乙方确认的上述送达方式适用于争议解决的各个阶段（包括但不限于调解、仲裁和诉讼）。
15.3. 乙方保证提供的联系信息是真实、准确、有效的，如联系信息变更应立即通过服务市场及/或开放平台更新或以书面方式告知甲方；如乙方提供的联系信息不准确，或乙方未及时更新或以书面方式告知变更后的联系信息，则向原联系信息送达的任何甲方通知及上述法律文书仍视为有效送达，乙方自行承担由此可能产生的所有损失及法律后果。
16. 其他事项
16.1. 未经甲方事先书面同意，乙方不得向第三方转让本协议项下的任何权利及/或义务。
16.2. 本协议是甲乙双方之间关于提供和使用本协议项下服务完整、唯一的约定，服务市场的任何工作人员与乙方及乙方人员之间的沟通、承诺与解释等均不构成对本协议内容的有效变更。
16.3. 双方签订本协议或其他在线协议后，一方因内部管理等原因需要签订纸质协议进行确认或存档的，双方可再行签订纸质协议，但不能因此视为双方存在两个合同关系，纸质协议的内容必须与在线签署的协议内容一致，协议的生效与履行依照在线签署的协议约定执行，在线签署的协议内容与纸质协议的约定不一致的，以前者的约定为准。
16.4. 无合伙或代理关系。除非本协议另有明确规定，本协议的任何内容均无意、亦不应被视为在任何一方之间建立任何合伙、合资、特许经营、销售代表或雇佣关系、或使任何一方成为另一方的代理人、或授权任何一方为或代表任何其他方作出或达成任何承诺。
16.5. 如果根据适用的法律认定本协议中的任何条款或者任何条款中的任何部分无效、违法或者不具有可执行性，这种无效、违法或者不具有可执行性不影响本协议中的任何其他条款或者这些条款中的任何其他部分的效力。
16.6. 本协议于2025年11月24日最新修订生效。
（本行以下无正文）

## 学习中心 / 协议中心 / 协议列表 / Temu Partner Platform私隱政策聲明（中國香港）

- 文档 ID：`153393029619`
- 更新时间：`2025-07-22T15:00:21.685000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=153393029619`

Temu Partner Platform私隱政策聲明（中國香港）
（V2.0）

本私隱政策聲明（以下簡稱“本聲明”）闡述了在企業使用者（又稱“開發者”或“合作夥伴”）使用Temu Partner Platform（以下簡稱“開放平臺”）過程中，上海從鯨信息技術有限公司及其附屬公司（以下或稱“我們”）將如何根據《個人資料（私隱）條例》（香港法例第486章）（以下簡稱“《條例》”）收集、使用和披露可能涉及的企業代表人或被授權人員或其他實際使用我們服務的人員（以下合稱“您”）的個人資料，本聲明內個人資料一詞含有《條例》所解釋的意義。
我們遵守《條例》的責任及要求，對收集及/或儲存及/或傳送及/或使用的所有個人資料保密，並妥善保存。倘若個人以合法方式要求取得及/或修正我們所持有關於其本人的個人資料，我們可根據《條例》規定的時限及方式提供及/或修正上述資料。
A． 個人資料的收集
我們可能直接或間接地收集您的個人資料，範圍包括：
1. 您填寫的手機號碼、郵箱、您設置的帳號密碼及您收到的驗證碼；
2. 您選擇的合作夥伴類型，以及您填寫的合作夥伴名稱；
3. 開發者的註冊地，公司註冊證（副本，公司註冊號，公司名稱，發證日期），商業登記證（副本，登記證號，經營地址，經營有效期），銀行帳戶名，開戶證明副本，辦公地址，公司營業範圍，公司業務描述，已有網站/平臺網址；
4. 如您為企業用戶的董事，我們將通過企業用戶收集您的身份證件類型、有效身份證件副本、證件號及有效期、姓名；
5. 如您為企業用戶設定的管理員，我們將通過企業用戶收集您的有效身份證件副本、證件號及有效期、姓名、郵箱、電話並驗證您收到的驗證碼；
6. 當企業用戶通過開放平臺付款或收款時，我們將收集相關支付資訊和稅務資訊，比如卡號、電話號碼和地址；
7. 當企業使用者在開放平臺上產生交易時，我們會收集與帳號相關的交易信息，以及有關退款和投訴的資訊；
8. 當您使用客服支持相關功能時，我們會收集您與客服之間的溝通信息；
9. 當您使用開放平臺上可以能夠上傳、填寫內容/資訊等相關功能時，我們將收集您上傳或填寫的內容/資訊，比如圖片、視頻、音訊、評論、問題、消息或其他您在使用服務過程中生成、傳輸或以其他方式提供的內容或資訊；
10. 當您或您代表企業用戶在開放平臺參加促銷、調查或類似活動時，我們可能會收集您參加活動時提供的資訊，比如您的聯繫方式；
11. 設備資訊（如設備型號、作業系統資訊、語言設置、唯一識別碼）、日誌資訊（如您瀏覽的內容、您使用的功能、您提供或使用的應用程式以及您使用本服務各部分的時長）、大致的位置資訊（如IP地址）；
12. 當您在開放平臺進行人臉識別時，我們將收集您拍攝上傳的人臉視頻、人臉照片以及過程中採集到的其他資訊（如有）；
13. 我們從其他第三方（比如身份驗證服務方、活動聯合贊助商、政府機構或其他公開來源）獲取的您的個人資料，例如我們自身份驗證服務方獲取的您的人臉驗證結果。

B． 個人資料的使用
您的個人資料可能會被用於：
1. 註冊、登錄、維持和管理帳號；
2. 向您提供所需的功能及服務；
3. 改進、優化我們的服務，排除、修復故障；
4. 登記企業使用者的資訊，完成資質驗證，預防欺詐；
5. 協助企業用戶進行支付與結算；
6. 協助完成交易和履行訂單；
7. 提供客服支持，答覆您提出的問題或諮詢；
8. 驗證您的身份，通知您活動相關資訊；
9. 提高您使用我們的服務的安全性，保證您、其他用戶的人身財產安全，更準確地預防網路安全及欺詐等風險；
10. 判斷帳號及交易風險、驗證身份、檢測及防範安全事件，並依法採取必要的記錄、分析、審計、處置措施；
11. 履行我們的法律或合規義務，比如開展內部審計以確保符合《條例》以及其他適用法律的規定；
12. 經您同意或《條例》要求或准許的其他目的。
C． 個人資料的準確性
我們盡可能利用業內通用的做法和守則，核實您提供的資料，但請您注意，我們收集、使用及披露的個人資料的準確性很大程度上取決於您提供的資料的真實性和準確性，如果您發現您提供的資料有誤或需要更正，請您按照本聲明載明的方式聯繫我們。
D． 個人資料的披露
我們持有的您的個人資料將被嚴格保密，但我們可能為實現本聲明所載之目的將您的個人資料提供給以下各方：
1. 我們的附屬公司、控股公司、關聯公司，或由我們持有或與我們同屬一家控制公司的公司或聯營公司；
2. 與我們進行任何合併、收購、融資交易或者聯營的實體或者可能的實體；
3. 我們聘用的會計師/審計師/律師等專業顧問，以及與我們開展合作的代理、供應商及其他業務合作方（包括他們的雇員），比如為我們提供IT服務、身份驗證、短信發送、用戶支持等服務的供應商；
4. 為提供平臺支付、交易服務而接入的金融機構；
5. 您指定的第三方，或開放平臺的其他使用者；
6. 法律規定或授權的政府和監管機構、執法機構和其他組織。
E． Cookie及類似技術的使用
我們可能會採用各種技術收集和存儲相關資訊，包括使用小型資料檔案識別您的身份，以瞭解您的使用習慣，幫您省去重複輸入登錄資訊的步驟，或者協助判斷您的帳戶安全。這些資料檔案可能是Cookie，或您的瀏覽器或關聯應用程式提供的其他本機存放區（統稱“Cookie”）。
我們的某些服務可能只有通過使用Cookie才可得到實現。如果您的瀏覽器或瀏覽器附加服務允許，您可以修改對Cookie的接受程度或者拒絕開放平臺的Cookie，但拒絕開放平臺的Cookie在某些情況下可能會影響您安全訪問開放平臺和使用我們的服務。
您在訪問開放平臺或使用我們的服務過程中可能會存在一些電子圖像，稱為“單圖元GIF檔”、“網路beacon”或其他類似技術（統稱“網路beacon”），它可以協助網站計算瀏覽網頁的用戶或訪問某些cookie。我們可能會通過網路beacon收集您瀏覽網頁活動資訊，例如您訪問的頁面位址、您先前訪問的援引頁面的位址、您停留在頁面的時間、您的瀏覽環境及顯示設定等。
F． 安全措施和個人資料的保存
我們採取所有合理的措施包括技術上、行政上和實體的保護措施更好地保護由我們處理的您的個人資料免受損失、誤用和未獲授權下的訪問、披露、修改和毀壞。例如，在您的瀏覽器與“服務”之間交換資料時受SSL加密保護；我們同時對開放平臺網站提供https安全瀏覽模式；我們會使用加密技術確保資料的保密性；我們會使用受信賴的保護機制防止資料遭到惡意攻擊；我們會部署存取控制機制，確保只有授權人員才可訪問個人資訊；以及我們會舉辦安全和隱私保護培訓課程，加強員工對於保護個人資訊重要性的認識。
我們僅在本聲明所載之目的及根據《條例》和所有適用的監管要求的所需時間內保留您的個人資料。
G． 查閱及改正個人資料
根據《條例》的規定，您有權：
1. 確定我們是否持有關於您本人的個人資料，如我們持有的，您有權查閱該等資料，取得該等資料的副本；
2. 要求我們改正與您本人有關的、不準確的個人資料；
3. 要求我們不得將您的個人資料用於直接促銷目的；
4. 確定我們與個人資料有關的政策和做法。
如您希望提出個人資料查閱要求，請填寫“查閱資料要求表格”（您可通過以下連結下載：https://www.pcpd.org.hk/chinese/publications/files/Dformc.pdf），並連同有關的身份證明文件（申請人的香港身份證或護照副本），通過您使用開放平臺過程中註冊的通訊應用程式提交給我們，我們將盡力按照《條例》的規定處理並答覆。您可以通過上述查閱個人資料要求所得的資料，指出需要改正的資料。在我們考慮是否更改該指定資料前，您須提供能指出資料不準確的足夠證明及/或解釋。我們在接納要求改正的真實性及有效性後，會盡力依從《條例》予以回覆。
本聲明於2025年7月6日最新修訂生效。

## 学习中心 / 协议中心 / 协议列表 / Temu Partner Platform隐私政策

- 文档 ID：`154440569899`
- 更新时间：`2025-07-22T15:03:34.976000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=154440569899`

尊敬的用户：我们对《Temu Partner Platform隐私政策（中国内地）》进行了更新，此版本更新的内容主要是补充增加了Temu Partner Platform所收集的个人信息种类。

Temu Partner Platform隐私政策（中国内地）
（V2.0）

特别提示：
上海从鲸信息技术有限公司及其关联方（以下或称“我们”）非常注重保护企业用户（又称“开发者”或“合作伙伴”）使用Temu Partner Platform（以下简称“开放平台”）过程中可能涉及的企业法定代表人或被授权人员或其他实际使用我们服务的人员（以下合称“您”）的个人信息及隐私。鉴于企业用户或您在使用我们的产品和服务时，我们可能会收集和使用您的相关信息，为阐明个人信息收集、使用、共享、管理及保护的规则，特制定本《Temu Partner Platform隐私政策（中国内地）》（以下或称“本政策”）。
在企业用户或您使用我们的各项产品或服务前，请务必仔细阅读并透彻理解本政策（特别是加粗或下划线的内容），在确认充分理解并同意后再使用相关产品或服务。如对本政策有任何疑问，您可以通过本政策载明的联系方式与我们联系。
如您的个人信息系企业用户向我们提供，企业用户应确保在向我们提供您的个人信息前，已经按照相关法律法规事先获得您的同意（如需），且已充分告知您我们处理个人信息的目的、范围、方式等。如我们因业务运营而对外共享（包括跨境传输）、公开或其他方式处理您的个人信息并需要获取您的单独同意或履行其他法定义务的，企业用户应协助履行相应的法定义务。
如企业用户来自中国香港，则我们将根据《Temu Partner Platform私隐政策声明（中国香港）》 (https://agentpartner.temu.com/document?cataId=882537068463&docId=921334075984)处理您的个人信息，您可以点击前述链接进行查阅。
本政策将帮助您了解以下内容：
1.政策范围及修订
2.个人信息的收集和使用
3.Cookie及类似技术的使用
4.个人信息的共享、委托处理、转让和公开披露
5.个人信息的保护
6.个人信息的存储及相关权益
7.未成年人信息保护
8.其他
附录1：相关定义

1. 政策范围及修订
1.1. 本政策适用于我们向企业用户提供的开放平台相关的产品和服务（以下合称“服务”），包括但不限于开放平台的网页版等，以及随技术发展出现的新形态向您提供的各项产品和服务。如我们及/或关联公司的产品或服务中使用了开放平台的产品或服务（例如使用开放平台的账户可登录使用的），但未设置独立隐私政策的，则本政策同样适用于该部分产品或服务。
1.2. 您理解并同意，我们有权根据业务发展的需要单方修订本政策，并以修订后的版本完全替代修订前的版本。请您及时关注和了解本政策的修订情况，若您不同意修订后版本，您应立即停止使用我们提供的产品和服务，否则即视同您同意并完全接受修订后的版本。
2. 个人信息的收集和使用
我们在此特别提醒您，因我们向企业用户或您提供的产品和服务种类众多，且不同用户选择使用的具体产品或服务范围存在差异，故对应收集使用的个人信息类型、范围会有所区别，您个人信息的实际收集和使用情况请以企业用户或您所享受的产品和服务情况为准。
我们收集使用的个人信息中可能包含您的敏感个人信息（根据《个人信息保护法》规定，敏感个人信息是指一旦泄露或者非法使用，容易导致自然人的人格尊严受到侵害或者人身、财产安全受到危害的个人信息。敏感个人信息包括生物识别、宗教信仰、特定身份、医疗健康、金融账户、行踪轨迹等信息，以及不满十四周岁未成年人的个人信息）。例如，我们可能收集您的有效身份证件副本、人脸照片等敏感个人信息。我们处理您的敏感个人信息是出于为您提供相应功能或服务所必需。

2.1. 注册/登录账号
当您代表企业用户注册开放平台账号时，我们将收集您的手机号码、邮箱、您设置的账号密码并验证您收到的验证码，用于为企业用户创建平台账号。当您代表企业用户登录开放平台时，我们将收集账号对应的邮箱或手机号码并验证您注册时设置的账号密码，以便为企业用户登录平台。
2.2. 入驻认证
注册后，您需要完成入驻认证。我们会收集并验证您提交的信息，这些信息包括：
2.2.1.登记合作伙伴信息
当您代表企业用户登记合作伙伴信息时，我们将收集您选择的合作伙伴类型，以及您填写的合作伙伴名称，用于资质验证。
2.2.2.登记公司主体信息
当您登记开发者的公司主体信息时，我们将收集开发者的注册地公司营业执照副本、公司法定名称、统一社会信用代码、注册日期、注册资本、营业执照有效期、营业执照地址、公司营业范围、公司业务描述、已有网站/平台网址和服务资质信息，用于资质验证。
2.2.3.登记法定代表人信息
我们将通过企业用户收集您的身份证件类型、有效身份证件的副本、身份证件号码及有效期、姓名，用于资质验证。
2.2.4.登记管理员信息
如您为企业用户设定的管理员，我们将通过企业用户收集您的身份证件类型、有效身份证件副本、身份证件号码及有效期、姓名、邮箱、电话并验证您收到的验证码，用于资质验证。
2.2.5.人脸识别
为了核验您的真实身份，当您在开放平台进行人脸识别时，我们会收集您拍摄上传的人脸视频、人脸照片以及过程中采集到的其他信息（如有），并将您的姓名、身份证号和人脸照片提供给法律法规允许或政府机关授权的第三方进行比对核验以获取验证结果。

2.3. 支付与结算
当企业用户通过开放平台付款或收款时，我们将收集相关支付信息和税务信息，比如卡号、电话号码和地址，用于企业用户完成支付和结算。
2.4. 交易及履行订单
当企业用户在开放平台上产生交易时，我们会收集与账号相关的交易信息，以及有关退款和投诉的信息，以协助完成交易和履行订单。
2.5. 客戶服务
当您使用客服支持相关功能时，我们会收集您与客服之间的沟通信息，以了解您的需求，并为您提供相应支持。
2.6. 其他您上传、填写的内容/信息
当您使用开放平台上可以能够上传、填写内容/信息等相关功能时，我们将收集您上传或填写的内容/信息，比如图片、视频、音频、评论、问题、消息或其他您在使用服务过程中生成、传输或以其他方式提供的内容或信息，以便您使用相应功能或服务。
2.7. 参加活动
当您或您代表企业用户在开放平台参加促销、调查或类似活动时，我们可能会收集您参加活动时提供的信息，比如您的联系方式。
2.8. 优化产品与服务
我们可能为提供服务或改进服务质量的合理需要而收集您的其他信息，包括您与开放平台其他用户联系时提供的信息，以及您参与问卷调查时向我们发送的信息。我们可能会将来自我们某项服务的信息与来自我们其他服务的信息结合起来，以便为您提供服务、内容和建议。对于从您的各种设备上收集到的信息，我们可能会将它们进行关联，以便我们能在这些设备上为您提供一致的服务。我们进行本条款所述的产品与服务优化时仅使用您在我们系统内的信息。
2.9. 保障账户安全
为提高您使用我们的服务的安全性，保证您、其他用户的人身财产安全，更准确地预防网络安全及欺诈等风险，我们可能会通过您的账户信息、交易信息、设备信息（如设备型号、操作系统信息、语言设置、唯一标识符）、日志信息（如您浏览的内容、您使用的功能、您提供或支持的应用程序以及您使用本服务各部分的时长）等信息，来判断您的账户及交易风险、验证身份、检测及防范安全事件，并依法采取必要的记录、分析、审计、处置措施。
2.10. 来自第三方的信息
我们可能从其他第三方（比如身份验证服务方、活动联合赞助商、政府机构或其他公开来源）获取您的个人信息，如我们知晓收集和使用您信息的目的、方式等，超出了该等第三方已获得的授权范围，我们会自行或要求该第三方另行征得您的同意后再处理您的个人信息。
2.11. 其他个人信息使用规则
为向企业用户或您提供满意优质的服务，您理解并同意我们可能还会将您的个人信息用于下列用途：
2.11.1.向企业用户或您提供开放平台的各项服务，并维护、改进这些服务。
2.11.2.我们可能会使用您的个人信息以预防、发现、调查非法或违反与我们或其关联方协议、政策或规则的行为，以保护您、企业用户，或我们及关联方的合法权益。
2.11.3.我们会对我们的服务使用情况进行统计，并可能会与公众或第三方分享这些统计信息，以展示我们的产品或服务的整体使用趋势。但这些统计信息不包含您的任何身份识别信息。
2.11.4.邀请您或企业用户参与有关我们产品、服务的调查。
2.11.5.经您同意的或法律法规允许的其他用途。
2.12. 征得同意的例外
您充分知晓，根据适用的法律法规之规定，以下情形中，我们收集、使用您的个人信息无须征得您的同意：
2.12.1.为我们履行法定义务或法定职责所必需；
2.12.2.为订立、履行企业用户或您作为一方当事人的合同所必需；
2.12.3.为应对突发公共卫生事件，或者紧急情况下为保护自然人的生命健康和财产安全所必需；
2.12.4.依法在合理的范围内处理您自行公开或者其他已经合法公开的个人信息；
2.12.5.法律、行政法规规定的其他情形。
3. Cookie及类似技术的使用
3.1. 您理解并同意，为使您获得更轻松的访问体验，您访问开放平台或使用我们的服务时，我们可能会采用各种技术收集和存储相关信息，包括使用小型数据文件识别您的身份，以了解您的使用习惯，帮您省去重复输入登录信息的步骤，或者帮助判断您的账户安全。这些数据文件可能是Cookie，或您的浏览器或关联应用程序提供的其他本地存储（统称“Cookie”）。
3.2. 您理解并同意，我们的某些服务可能只有通过使用Cookie才可得到实现。如果您的浏览器或浏览器附加服务允许，您可以修改对Cookie的接受程度或者拒绝开放平台的Cookie，但拒绝开放平台的Cookie在某些情况下可能会影响您安全访问开放平台和使用我们的服务。
3.3. 您理解并同意，您在访问开放平台或使用我们的服务过程中可能会存在一些电子图像，称为“单像素GIF文件”、“网络beacon”或其他类似技术（统称“网络beacon”），它可以帮助网站计算浏览网页的用户或访问某些cookie。我们可能会通过网络beacon收集您浏览网页活动信息，例如您访问的页面地址、您先前访问的援引页面的位址、您停留在页面的时间、您的浏览环境及显示设定等。
4. 个人信息的共享、委托处理、转让和公开披露
4.1. 个人信息的共享
4.1.1.除以下情况外，我们不会将您的个人信息与其他个人、公司或组织共享：
1）履行法定义务所必需的共享：我们可能会根据法律法规规定、诉讼、争议解决的必要，或按行政、司法机关依法提出的要求，以及其他法定义务履行的必需，共享您的个人信息；
2）取得您同意的情况下共享：获得您的明确同意后，我们会与其他方共享您的个人信息；
3）为订立、履行您作为一方当事人的合同所必需的情况下的共享。
我们只会共享必要的个人信息，且受本政策中所声明目的的约束。请注意，您在使用我们产品和服务时自愿共享甚至公开分享的信息，可能会涉及您或他人的个人信息甚至敏感个人信息。请您更加谨慎地考虑并做出决定。
4.2. 个人信息的委托处理
我们可能会委托第三方或关联公司处理您的个人信息，以便其代表我们为您提供某些服务或履行职能，我们仅会在您同意的处理目的、方式、范围内，或基于法律规定的情形，在合法、正当的前提下委托其处理您的信息。
我们的第三方包括以下类型：
1）供应商、服务提供商和其他第三方。我们可能会将您的个人信息委托给支持开放平台运营的第三方处理，包括为我们提供基础设施技术服务、通讯服务、数据分析服务、安全服务、身份验证、客户服务等的供应商。
2）委托我们进行推广的第三方。有时我们会接受其他企业委托向使用我们产品/服务的用户群进行促销推广。我们可能会使用您的个人信息以及您的非个人信息集合形成的间接用户画像与该等企业共享，但我们仅会向该等企业提供推广的覆盖面和有效性的信息，而不会提供您的个人身份信息或者将这些信息进行汇总，以便提供该等信息并不会识别您个人。比如向该等企业提供不能识别个人身份的统计信息，以帮助其了解受众或顾客。
4.3. 个人信息的转让
除以下情况外，我们不会将您的个人信息转让给任何个人、公司或组织：
4.3.1.事先获得您明确的同意；
4.3.2.根据适用的法律、法规、法律程序的要求、行政或有权机关的强制性要求所必须时；
4.3.3.根据与您签署的相关协议或其他法律文件的约定；
4.3.4.涉及合作、联营、合并、收购、资产转让或其他类似交易时。
4.4. 个人信息的公开披露
我们非常重视保护您的个人信息，未经您同意，我们不会将其披露给无关的第三方，更不会将其公之于众，但因下列原因而披露的除外：
4.4.1.获得您明确同意或基于您的主动选择；
4.4.2.根据法律、法规的要求、强制性的行政执法或司法要求所必须提供您个人信息的情况下，我们可能会依据所要求的个人信息类型和披露方式公开披露您的个人信息；
4.4.3.其他依据法律规定或双方约定可以披露的情形。如果您严重违反法律法规或者我们相关协议、规则，或为保护开放平台其他用户或公众的人身财产安全免遭侵害，我们可能会披露您的个人信息，包括相关违规行为及我们对您采取的措施。
4.5. 征得同意的例外
您充分知晓，根据适用的法律法规之规定，以下情形中，我们共享、公开披露您的个人信息无须征得您的同意：
4.5.1.为我们履行法定义务或法定职责所必需；
4.5.2.为订立、履行企业用户或您作为一方当事人的合同所必需；
4.5.3.为应对突发公共卫生事件，或者紧急情况下为保护自然人的生命健康和财产安全所必需；
4.5.4.依法在合理的范围内处理您自行公开或者其他已经合法公开的个人信息；
4.5.5.法律、行政法规规定的其他情形。
5. 个人信息的保护
5.1. 数据安全措施
5.1.1.我们已使用符合业界标准的安全防护措施保护您或企业用户提供的个人信息，防止数据遭到未经授权访问、公开披露、使用、修改、损坏或丢失。我们会采取一切合理可行的措施，保护您的个人信息。例如，在您的浏览器与“服务”之间交换数据时受SSL加密保护；我们同时对开放平台网站提供https安全浏览模式；我们会使用加密技术确保数据的保密性；我们会使用受信赖的保护机制防止数据遭到恶意攻击；我们会部署访问控制机制，确保只有授权人员才可访问个人信息；以及我们会举办安全和隐私保护培训课程，加强员工对于保护个人信息重要性的认识。
5.1.2.我们会采取合理可行的措施以避免收集无关的个人信息。我们只会在达成本政策所述目的所需期限内保存您的个人信息，除非经您同意延长保留期或应法律法规的允许或要求。
5.2. 互联网并非绝对安全的环境，我们强烈建议您在使用我们提供的服务时不要使用其他第三方推荐的通信方式发送个人信息。您可以通过我们的服务建立联系和相互分享。当您通过我们的服务创建交流、交易或分享时，您可自主选择沟通、交易或分享的对象，作为能够看到您的交易内容、联络方式、交流信息或分享内容等相关信息的第三方。
5.3. 如您或您代表企业用户使用我们提供的服务进行网上交易，您可能会向交易对方或潜在的交易对方披露自己的个人信息，如联络方式或联系地址。请您妥善保护自己的个人信息，仅在必要情形下向他人提供。如您发现您的个人信息或者账户、密码发生泄露，请立即联络我们，以便我们根据您的申请采取相应措施。
5.4. 特别提醒您注意，您在使用我们服务时自愿共享甚至公开分享的信息，可能会涉及您或他人的个人信息甚至敏感个人信息。请您更加谨慎地考虑，是否在使用我们的服务时共享甚至公开分享相关信息。
5.5. 如上述，我们将使用各种安全技术、程序和制度防止个人信息的丢失、不当使用、未经授权的阅览或披露。但您充分理解并同意：由于技术的限制以及可能存在的各种恶意手段，在互联网行业，即便竭尽所能加强安全措施，也不可能始终保证信息百分之百的安全。
5.6. 在不幸发生个人信息安全事件后，我们将按照法律法规的要求向您告知：安全事件的基本情况和可能的影响、我们已采取或将要采取的处置措施、您可自主防范和降低风险的建议、对您的补救措施等。事件相关情况我们将以信函、电话、推送通知等方式告知您，难以逐一告知个人信息主体时，我们会采取合理、有效的方式发布公告。同时，我们还将按照监管部门要求，上报个人信息安全事件的处置情况。
6. 个人信息的存储及相关权益
6.1. 个人信息的存储
6.1.1.存储位置
我们在中华人民共和国境内运营中收集和产生的个人信息将全部被存储于中华人民共和国境内，但以下情形除外：
1）获得您的明确同意；
2）为完成本政策所述之目的，如跨境交易及相关服务等所必要；
3）适用的法律法规另有明确规定。
针对以上情形，我们会依据本政策及相关法律法规对您的个人信息提供保护。
6.1.2.存储期限
我们只会在达成本政策所述目的所需最短期限内保留您的个人信息，法律法规另有规定的除外。在超出保存期间后，我们会根据适用法律的要求删除您的个人信息或进行匿名化处理。
我们判断个人信息的存储期限主要依据以下标准并以其中较长者为准：
1）完成与企业用户相关的交易目的、维护相应交易及业务记录，以应对企业用户可能的查询或投诉；
2）保证我们为您或企业用户提供服务的安全和质量；
3）您是否同意更长的留存期间；
4）根据诉讼时效的相关需要；
5）是否存在关于保留期限的其他特别约定或法律法规规定。
6.2. 个人信息的查阅、复制
您有权查阅或复制您的个人信息，但法律法规另有规定。您可通过本政策载明的联系方式与我们联系，我们将根据“响应您的上述请求”中的相关安排向您提供。
6.3. 个人信息的更正、补充
当您发现您的个人信息有误或需要补充时，您可通过本政策载明的联系方式向我们提出更正、补充申请。
6.4. 个人信息的删除
在以下情形中，您可通过本政策载明的联系方式向我们提出删除个人信息的请求：
6.4.1.处理目的已实现、无法实现或者为实现处理目的不再必要；
6.4.2.我们停止提供服务，或者保存期限已届满；
6.4.3.您撤回同意；
6.4.4.我们违反法律、行政法规或者违反约定处理个人信息；
6.4.5.法律、行政法规规定的其他情形。
当我们协助您删除相关信息后，因适用的法律和安全技术限制，我们可能无法立即从备份系统中删除相应的信息，我们将安全地保存您的个人信息并限制对其任何进一步的处理，直到备份可以清除或实现匿名化。
6.5. 响应您的上述请求
为保障安全，您可能需要提供书面请求，或以其他方式证明您的身份。我们可能会先要求您验证自己的身份，然后再处理您的请求。我们将在十五个工作日内做出答复。对于您合理的请求，我们原则上不收取费用，但对多次重复、超出合理限度的请求，我们将视情况收取一定成本费用。对于那些无端重复、需要过多技术手段（例如，需要开发新系统或从根本上改变现行惯例）、给他人合法权益带来风险或者非常不切实际的请求，我们可能会予以拒绝。
6.6. 您理解并同意，在以下情形中，我们将无法响应您的请求：
1）与公共安全、公共卫生、重大公共利益有关的；
2）与犯罪侦查、起诉、审判和执行司法裁判、有关机关的命令等有关的；
3）有充分证据表明个人信息主体存在主观恶意或滥用权利的；
4）响应您的请求将导致您或其他个人、组织的合法权益受到严重损害的；
5）涉及商业秘密的；
6）在适用法律法规的范围内我们有权拒绝响应的。
7. 未成年人信息保护
我们的服务不面向18岁以下的未成年人（含儿童），我们不涉及处理未成年人的个人信息。
8. 其他
8.1. 条款的独立性
如果根据适用的法律认定本政策中的任何条款或者任何条款中的任何部分无效、违法或者不具有可执行性，这种无效、违法或者不具有可执行性不影响本政策中的任何其它条款或者这些条款中的任何其它部分的效力。
8.2. 联系我们
8.2.1.您对本政策或您的个人信息相关事宜有任何问题、意见或建议，请通过您使用本服务过程中注册的相应通讯软件联系我们。
8.3. 争议解决
一般情况下，我们将在十五个工作日内回复。如果您对我们的回复不满意，特别是我们的个人信息处理行为损害了您的合法权益，您还可以通过向被告住所地有管辖权的法院提起诉讼来寻求解决方案。
8.4. 生效日期
本政策于2025年7月6日最新修订生效。

附录1：相关定义
1. 个人信息：是指以电子或者其他方式记录的与已识别或者可识别的自然人有关的各种信息，不包括匿名化处理后的信息。
2. 敏感个人信息：是指一旦泄露或者非法使用，容易导致自然人的人格尊严受到侵害或者人身、财产安全受到危害的个人信息。敏感个人信息包括生物识别、宗教信仰、特定身份、医疗健康、金融账户、行踪轨迹等信息，以及不满十四周岁未成年人的个人信息。
3. 儿童：是指不满十四周岁的未成年人。
4. 去标识化：是指个人信息经过处理，使其在不借助额外信息的情况下无法识别特定自然人的过程。
5. 匿名化：是指个人信息经过处理无法识别特定自然人且不能复原的过程。
6. 设备信息，包括设备标识符（IMEI、IDFA、Android ID、IMSI、OAID、MEID及其他设备识别信息）、MAC地址、设备参数及系统信息（设备类型、设备型号、设备序列号、操作系统及硬件相关信息）、应用信息（移动应用列表、应用程序版本及其他应用相关信息）、设备网络环境信息（IP地址，WiFi信息，基站信息及其他网络相关信息）、设备所在位置相关信息（包括您授权的GPS位置信息以及WLAN接入点、蓝牙信息）以及传感器信息（包括加速度传感器、磁力传感器、重力传感器、压力传感器以及其他传感器信息）。具体以实际收集情况为准。
7. 日志信息：包括点击查看记录、浏览记录、分享历史，以及IP地址、浏览器类型、使用的语言、访问日期和时间、电信运营商等信息。具体以实际收集情况为准。
8. 关联公司：是指一方直接或间接控制、共同控制另一方，以及两方或两方以上受同一主体控制、共同控制的公司。前述“控制”是指，直接或间接拥有的权力，从而通过行使表决权、合同或其他方式决定或影响某一方的管理或决策方向。

## 学习中心 / 协议中心 / 规则列表 / 服务市场违规处理规则（服务商版）v1.1

- 文档 ID：`157600876092`
- 更新时间：`2025-11-10T17:16:15.773000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=157600876092`

服务市场违规处理规则（服务商版）
（V1.1版本 发布日期：2025年11月17日）
一、总则
1.鉴于双方共同致力营造服务市场良好的市场秩序，维护乙方、商家等各方的合法权益，乙方特此认可并同意本《服务市场违规处理规则（服务商版）》（以下简称“本规则”）。如无特别说明，本规则项下用语含义应与其在服务协议中具有相同含义。
2.本规则并入不时修订的《服务市场服务协议（服务商版）》（以下简称“服务协议”）并构成服务协议的一部分。甲方在此特别提醒乙方认真阅读本规则各项条款（对于本规则中以加粗字体显示的内容应重点阅读），并请乙方审慎考虑是否接受本规则。如乙方在线接受或以甲方认可的其他方式同意本规则，或实际使用服务市场服务的，则表明乙方已充分阅读、理解并自愿接受本规则，同意受本规则各项条款约束。
3.服务产品/应用产品描述，是指服务商在开放平台及服务市场的系统、详情页面、推广页面、其他页面、客服聊天工具等任何向商家展示的场景中，以文字、图片、音频、视频等形式，对所提供的服务产品/应用产品本身（包括但不限于价格、生产者、用途、性能、规格、使用方法、数量、瑕疵等）、品牌、交易附随资料、售后服务等信息所做的明示或暗示的描述。
4.服务产品/应用产品信息包括服务产品/应用产品描述、服务产品/应用产品自身的信息及其他服务产品/应用产品信息。
二、违规类型及违规处理
违规类型具体违规细项违规处理描述不规范服务商提供的服务产品/应用产品信息中出现虚假的免费相关内容（包括但不限于完全/部分免费或其他与免费相关的内容）。甲方有权采取以下处理措施：1、扣除服务商基础分2分；且2、针对违规相关的服务产品/应用产品限制本服务7日。描述不规范服务商提供的服务产品/应用产品信息涉及其他虚假宣传（包括但不限于夸大描述，滥用或过度承诺功能性、效果性的宣传，服务产品/应用产品描述与服务产品/应用产品本身不一致等）。甲方有权采取以下处理措施：1、扣除服务商基础分2分；且2、针对违规相关的服务产品/应用产品限制本服务7日。描述不规范服务商提供的服务产品/应用产品信息包含或可能包含淫秽、色情、不道德、欺诈、诽谤（包括商业诽谤）、暴力、恐吓或骚扰等内容。甲方有权采取以下处理措施：1、扣除服务商基础分2分；且2、针对违规相关的服务产品/应用产品限制本服务7日。描述不规范服务商提供的服务产品/应用产品信息不完善（例如缺少相关功能描述等）、不准确及/或不具体。甲方有权采取以下处理措施：1、扣除服务商基础分0.5分；且2、针对违规相关的服务产品/应用产品限制本服务3日。描述不规范服务商提供的服务产品/应用产品信息中的标题或内容重复堆砌相同或相似关键词。甲方有权采取以下处理措施：1、扣除服务商基础分0.5分；且2、针对违规相关的服务产品/应用产品限制本服务3日。描述不规范服务商提供的服务产品/应用产品信息中包含与服务产品/应用产品不相关的信息（包括但不限于第三方的广告信息等）。甲方有权采取以下处理措施：1、扣除服务商基础分1分；且2、针对违规相关的服务产品/应用产品限制本服务5日。描述不规范服务商提供的服务产品/应用产品信息中含有告知或诱导商家或其他第三方通过其他网址（包括但不限于服务市场以外的平台等）登录注册及/或使用的相关链接或说明。甲方有权采取以下处理措施：1、扣除服务商基础分2分；且2、针对违规相关的服务产品/应用产品限制本服务7日。描述不规范服务商实际提供的服务产品/应用产品信息中的关键信息（包括但不限于服务周期、服务内容、价格、售后服务等）与发布的页面不一致。甲方有权采取以下处理措施：1、扣除服务商基础分4分；且2、针对违规相关的服务产品/应用产品限制本服务10日。发布不规范服务商发布的服务产品/应用产品不属于服务市场/开放平台项下服务产品/应用产品。甲方有权采取以下处理措施：1、扣除服务商基础分1分；且2、针对违规相关的服务产品/应用产品永久限制本服务。发布不规范服务商重复发布相同或近似的服务产品/应用产品。甲方有权采取以下处理措施：1、扣除服务商基础分1分；且2、针对违规相关的服务产品/应用产品限制本服务5日。发布不规范服务商未选择正确的类目发布服务产品/应用产品。甲方有权采取以下处理措施：1、扣除服务商基础分1分；且2、针对违规相关的服务产品/应用产品限制本服务5日。发布不规范服务商未选择正确的类目发布服务产品/应用产品且情节严重的，包括但不限于：1、累积出现3次以上（含3次）未选择正确的类目发布服务产品/应用产品；2、在甲方已经明确告知违规但乙方仍不修改的；或3、在发布某一服务产品/应用产品或与之相似的服务产品/应用产品时再次未选择正确的类目的。甲方有权采取以下处理措施：1、扣除服务商基础分4分；且2、针对违规相关的服务产品/应用产品限制本服务10日。履约不规范服务商针对其提供的服务产品/应用产品，在履约过程中未经商家及甲方书面同意，进行分包或转包的。甲方有权采取以下处理措施：1、扣除服务商基础分3分；且2、针对违规相关的服务产品/应用产品限制本服务10日。履约不规范服务商有不正当竞争的行为（包括但不限于恶意评价、恶意造谣及/或利用服务市场或开放平台漏洞获得竞争优势等）。甲方有权采取以下处理措施：1、扣除服务商基础分3分；且2、针对违规相关的服务产品/应用产品限制本服务10日。履约不规范服务商伪造或篡改商家评论、留言等信息。甲方有权采取以下处理措施：1、扣除服务商基础分3分；且2、针对违规相关的服务产品/应用产品限制本服务10日。履约不规范服务商利用不当方式（包括但不限于 “好评返现”、“全5分返现”、“返现”、“免单”等）引导商家对服务产品/应用产品做出不客观的评价。甲方有权采取以下处理措施：1、扣除服务商基础分3分；且2、针对违规相关的服务产品/应用产品限制本服务10日。履约不规范服务商被投诉，且近30日内（以最新一次被投诉往前计算30日）甲方已经介入超过8次。甲方有权采取以下处理措施：1、扣除服务商基础分4分；且2、针对乙方的所有服务产品/应用产品限制本服务10日。履约不规范服务商被投诉，且近30日内（以最新一次被投诉往前计算30日）甲方已经介入超过12次。甲方有权采取以下处理措施：1、扣除服务商基础分10分；且2、针对乙方的所有服务产品/应用产品限制本服务30日。履约不规范服务商未及时处理商家投诉超过5日，或对商家及/或甲方咨询或反馈未响应超过2日。甲方有权采取以下处理措施：1、扣除服务商基础分4分；且2、针对乙方的所有服务产品/应用产品限制本服务10日。履约不规范服务产品/应用产品已因违规被采取处理措施，但服务商在被采取处理措施之日起30日内仍未纠正全部违规行为。甲方有权采取以下处理措施：1、扣除服务商基础分4分；且2、针对乙方的所有服务产品/应用产品限制本服务10日。履约不规范服务商无正当理由拒绝向商家提供服务产品/应用产品，且甲方介入3次仍无反馈的。甲方有权采取以下处理措施：1、扣除服务商基础分12分；且2、清退服务商且不再接受服务商入驻。履约不规范服务商存在虚假交易行为（如履约未完成，但告知已完成交易；或制造虚假订单等）。甲方有权采取以下处理措施：1、扣除服务商基础分3分；且2、针对违规相关的服务产品/应用产品限制本服务10日。履约不规范服务商引导或帮助商家违反服务市场相关的协议、规则、规定等。甲方有权采取以下处理措施：1、扣除服务商基础分3分；且2、针对违规相关的服务产品/应用产品限制本服务10日。履约不规范存在违反服务协议、其他服务市场规则（包括但不限于各类目相关的其他规则等）的情形。甲方有权采取以下处理措施：1、扣除服务商基础分3分；且2、针对违规相关的服务产品/应用产品限制本服务10日。履约不规范将应用系统高危端口、管理接口、源码目录等敏感信息对非服务商工作人员或非服务市场工作人员泄露。甲方有权采取以下处理措施：1、扣除服务商基础分10分；且2、针对乙方的所有的服务产品/应用产品限制本服务30日。履约不规范服务商未按照与商家之间的约定，擅自中止、终止提供服务产品/应用产品。甲方有权采取以下处理措施：1、扣除服务商基础分3分；且2、针对违规相关的服务产品/应用产品限制本服务10日。履约不规范服务商未按照与商家约定的时间交付服务产品/应用产品，给商家造成任何损失的（包括直接损失及/或间接损失）。甲方有权采取以下处理措施：1、扣除服务商基础分10分；2、针对违规相关的服务产品/应用产品限制本服务30日；且3、甲方有权要求服务商针对该违规情形按照2000元/次的标准支付违约金。履约不规范其他服务商未按照与商家之间的约定提供服务产品/应用产品的情形。甲方有权采取以下处理措施：1、扣除服务商基础分3分；且2、针对违规相关的服务产品/应用产品限制本服务10日。经营异常未经甲方同意，服务商出售、转让开放平台的账号。甲方有权采取以下处理措施：1、扣除服务商基础分12分；且2、清退服务商且不再接受服务商入驻。经营异常服务商提交的入驻资料、信息等造假。甲方有权采取以下处理措施：1、扣除服务商基础分12分；且2、清退服务商且不再接受服务商入驻。经营异常服务商的经营资质、资格、许可、备案等被取消、注销、取缔、过期、无效、异常、或暂时无法使用，或者服务商涉嫌犯罪/犯罪等情形发生后，继续在服务市场开展经营活动的。甲方有权采取以下处理措施：1、扣除服务商基础分12分；2、清退服务商且不再接受服务商入驻；且3、甲方有权要求服务商针对该违规情形按照5000元/次的标准支付违约金。资料报告类违规服务商出具的资料报告（包括但不限于报告、资质、证书、证明、认证、欧代/英代协议及/或其他文件，下同）存在任何虚假信息，或者存在任何不真实、不准确的信息等情形，不论商家是否向服务商承诺不在线上电商平台提交使用资料报告。甲方有权采取以下处理措施：1、扣除服务商基础分10分；2、针对违规相关的服务产品/应用产品限制本服务30日；且3、甲方有权要求服务商针对每份违规资料报告按照5000元/份的标准支付违约金。资料报告类违规服务商诱导商家或接受商家请求，修改、隐藏检测结果等情形，不论商家是否向服务商承诺不在线上电商平台提交使用资料报告。甲方有权采取以下处理措施：1、扣除服务商基础分10分；2、针对违规相关的服务产品/应用产品限制本服务30日；且3、甲方有权要求服务商针对每份违规资料报告按照3000元/份的标准支付违约金。资料报告类违规不论商家是否向服务商承诺不在线上电商平台提交使用资料报告：（1）检测项目不全、检测部位不全，且未提示商家适用法规规定的全部检测项目和检测部位的；（2）测试标准、测试年纪选错；或（3）报告结论错误。甲方有权采取以下处理措施：1、扣除服务商基础分10分；2、针对违规相关的服务产品/应用产品限制本服务30日；且3、甲方有权要求服务商针对每份违规资料报告按照3000元/份的标准支付违约金。侵权服务商未经权利人许可，擅自公开、使用或允许第三人使用商家或其他第三方的隐私信息，或有其他侵害商家或其他第三方隐私权的行为。甲方有权采取以下处理措施：1、扣除服务商基础分4分；且2、针对违规相关的服务产品/应用产品限制本服务10日。侵权服务商未经权利人许可，擅自公开、使用或允许第三人使用商家或其他第三方的其他保密信息（包括但不限于商业信息等）。甲方有权采取以下处理措施：1、扣除服务商基础分4分；且2、针对违规相关的服务产品/应用产品限制本服务10日。侵权服务商及/或服务商提供的服务产品/应用产品侵害或可能侵害商家或其他第三方享有的合法权利或权益（包括但不限于人身权利、财产权利、知识产权等）的其他情形。甲方有权采取以下处理措施：1、扣除服务商基础分3分；且2、针对违规相关的服务产品/应用产品限制本服务10日。其他违法/违规服务过程存在问题，但拒不向服务市场如实提供情形说明或拒不整改的。甲方有权采取以下处理措施：1、 扣除服务商基础分3分；2、针对违规相关的服务产品/应用产品限制本服务10日；且3、甲方有权要求服务商针对该违规情形按照2000元/次的标准支付违约金。其他违法/违规服务商提供的服务产品/应用产品信息存在违反广告相关的法律法规的情形。甲方有权采取以下处理措施：1、扣除服务商基础分1分；且2、针对违规相关的服务产品/应用产品限制本服务5日。其他违法/违规服务商提供的服务产品/应用产品信息包含或可能包含淫秽、色情、不道德、欺诈、诽谤（包括商业诽谤）、恐吓或骚扰等内容，且该等内容已经达到违反法律法规的程度。甲方有权采取以下处理措施：1、 扣除服务商基础分3分；且2、针对违规相关的服务产品/应用产品限制本服务10日其他违法/违规服务商提供的服务产品/应用产品信息存在违反其他法律法规的情形。甲方有权采取以下处理措施：1、扣除服务商基础分2分；且2、针对违规相关的服务产品/应用产品限制本服务7日。其他违法/违规服务商提供的服务产品/应用产品为相关法律法规所禁止的服务产品/应用产品。甲方有权采取以下处理措施：1、扣除服务商基础分3分；且2、针对违规相关的服务产品/应用产品永久限制本服务。其他违法/违规服务商有其他违反法律法规的情形。甲方有权采取以下处理措施：1、扣除服务商基础分2分；且2、针对违规相关的服务产品/应用产品限制本服务7日。其他违法/违规对商家、服务市场造成不良影响或损失的其他情形。甲方有权采取以下处理措施：1、扣除服务商基础分10分；2、针对违规相关的服务产品/应用产品限制本服务30日；且3、甲方有权要求服务商针对该违规情形按照2000元/次的标准支付违约金。备注：本表中的“限制本服务”是指包括但不限于甲方对相关服务产品/应用产品采取下架措施，在服务市场页面删除其相关信息。基于此，服务产品/应用产品将无法在服务市场列表展示且商家无法成功订购，但已订购该服务产品/应用产品且仍在有效期内的商家可以继续使用，到期后将无法续订；限制本服务以违规处理措施采取之日起算。在限制期满后服务商可重新发布。如某一服务产品/应用产品涉及多个违规，需进行多次限制本服务的，则限制本服务天数进行累加。
三、服务商退出
1.服务商可以按照系统页面提示或其他甲方接受的方式，发起退出申请。
2.服务商发起退出申请的，需满足以下全部条件：
（1）所有订单为已完成或者退款成功状态，不存在未处理完毕的售后，最后一笔订单所涉服务产品/应用产品已经完成且自完成之日起算已满30日；
（2）服务商所发布的服务产品/应用产品不存在未完结的退款纠纷、投诉处理等；
（3）服务商所发布的服务产品/应用产品不存在违反与甲方的任何协议及/或规则的情形，也不存在尚未处理完毕的违约违规行为；
（4）服务商不存在系统页面提示的其他需要处理的事项。
3.服务商在其退出申请受理期间，不得擅自停止提供服务产品/应用产品。
4.清退服务商,指要求服务商退出服务市场，服务商名下所有服务产品/应用产品清除，停止其服务的API调用（如有）。出现以下任一情形的，甲方有权采取清退措施：
（1）单个服务商在一个自然年内一次性或累计扣除基础分达到12分，以一月一日零时至十二月三十一日二十四时为一个自然年；
（2）根据本规则第二条，服务商被采取清退的处理措施；
（3）服务商存在违规行为，且违规情况特别严重、影响特别恶劣的。
四、附则
1.乙方理解并同意，本规则项下所涉违规判定、计算方式等信息、数据均以系统记录及/或甲方判定为准。本规则项下“日”均指“自然日”。
2.本规则项下同一违规情形可能存在属于多项违规细项的情况，若某一违规情形同时属于多项违规细项的，则甲方有权叠加采取相应的处理措施，也有权选择更重的处理措施进行处理。
3.经甲方判定服务商存在本规则规定的违规情形的，服务商如有异议，应在开放平台展示违规信息或甲方实际采取处理措施后（以较早者为准）【7】日内主动发起申诉并提供充分、有效的证明材料（如已经采取限制本服务处理措施的，则在申诉期间不予以解除），逾期未发起申诉或经甲方判定服务商提供的证明材料不充分/无效的，则均视为服务商认可甲方的判定结果并同意按照本规则条款规定承担相应责任。
4.乙方同时违反本规则、服务协议及/或其他服务市场规则时，甲方依据本规则采取相应处理措施的，不影响甲方依据服务协议及/或其他服务市场规则采取对应的处理措施的权利。
5.乙方知悉并特此确认本规则项下违约金（1）与甲方保护商家合法权益、避免乙方出现违规行为的正当利益相称而且是合理的、可预见的、非过度或过高，及/或（2）真实反映了甲方、甲方的关联公司及/或商家可能因乙方违规行为而承担的财务成本及损失，而且（3）不构成罚金。乙方知悉并确认该金额公平合理且有足够机会审阅并对此寻求独立法律咨询。为免疑义，甲方要求乙方支付违约金不影响甲方就乙方违约违规行为按照法律规定、服务协议及/或其他服务市场规则采取任何其他补救措施。
6.如服务商存在本规则规定的任一违规情形，或者违反本规则任何条款规定，服务商应当支付相应违约金及/或其他费用、款项的，甲方有权自行及/或通知甲方的关联公司、相关合作方以服务商的保证金/账户预留金额抵扣对应的违约金及/或其他费用、款项。
7.如服务商存在本规则规定的任一违规情形，或者违反本规则任何条款规定的，除采取本规则相应的处理措施外，甲方仍有权按照服务协议的约定采取相应的处理措施。
8. 甲方有权变更（包括但不限于制定、修订、废止）本规则，并进行公示，乙方应实时关注公示内容。如乙方不接受变更，应当立即停止使用本服务并书面通知甲方，服务协议及本规则于甲方收到乙方书面通知之日起终止，甲方对于该等终止不负有任何违约责任或其他责任；如乙方继续使用本服务，或者未书面通知甲方终止协议的，即视为乙方接受前述变更事项，该等变更事项对乙方有约束力。
9. 乙方认可甲方及其关联公司、相关合作方在其计算机信息系统中存储、生成的和另行收集的所有数据、资料、信息、文件（展示形式包括但不限于视频、音频、图表、EXCEL表格）真实、准确、完整，同意甲方在纠纷解决中将该等数据、资料、信息、文件直接提交并作为认定案件事实的合法有效且充分的证据，无需另行公证。
10.本规则未尽事宜，适用服务协议及/或其他服务市场规则等规定。如果本规则的任何具体规定与服务协议的任何条款存在冲突或不一致，则以本规则的具体规定为准。
11.本规则的签署、效力、解释、履行及争议解决，均适用服务协议规定的法律适用与争议解决条款。凡因本规则引起的或与本规则相关的任何争议，均依照服务协议的法律适用与争议解决条款的规定解决。
12.本规则于2025年11月24日最新修订生效。

## 学习中心 / 系统操作指南 / 系统操作指南 / 合作伙伴平台操作指南

- 文档 ID：`116694701939`
- 更新时间：`2024-12-03T16:21:39.275000+08:00`
- 链接：`https://agentpartner.temu.com/document?cataId=875198836203&docId=116694701939`

# 服务商入驻
## 一、账号注册
注册入口：https://partner.kuajingmaihuo.com/login
- 填写邮箱
- 设置密码
- 填写收到的邮箱验证码
- 完成注册
[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/01dd3b3f-5a05-470d-ac6e-e8ac7b97c371_2472x1176.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Dfb7abe4ec0d5cb61090ab4743911b7841d9c8e01
## 二、主体资质信息填写
- 选择合作伙伴类型，包含 商家服务商、电商软件服务商
[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/7fcb552e-430c-4126-b27a-843eb68f76e8_3820x1710.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D9382e1432aa11a5b44726ab87f5d6fe0273f577b
- 填写合作伙伴名称并选择主体类型，目前支持中国内地企业、中国香港企业
- 若选择中国内地企业，需要填写：
中国内地企业            需要填写的内容
营业执照
公司法定名称
统一社会信用代码
营业执照有效期
公司注册地址
公司经营范围
法人证件类型
法人身份证照
法人姓名
法人身份证号
法人身份证有效期
管理人身份证照
管理人姓名
管理人身份证号
身份证件有效期
管理人联系邮箱
管理人联系电话
短信验证码
公司官网[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/719ba153-7c91-4a21-9cfe-6e52433e2677_2458x1284.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Dc378f359ef7271d1d157d40808535cd6222ada57
[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/4fb9c988-92bf-4fe6-bc19-3b89b30880d2_2412x1376.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D4fe48b05d885ca0061bc395c7576ff9de6632003

- 若选择香港企业，需要填写：
中国香港企业            需要填写的内容
公司注册证相关信息
（注册证照、公司注册号、公司名称、发证日期）
商业登记证相关信息
（登记证照、登记号码、营业地址、登记证有效期）
银行账户名
开户证明
办公地址
公司经营范围
董事证件类型
董事身份证照
董事姓名
董事身份证号
董事身份证有效期
管理人身份证照
管理人姓名
管理人身份证号
身份证件有效期
管理人联系邮箱
管理人联系电话
短信验证码
公司官网[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/e8198181-6ec2-43d6-b695-9e0c54c5a67f_2462x1272.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D63a34df07eb0b96741819ac8b7aa8189157066dc[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/60048654-d8a5-412f-bbe6-6047f481a809_2386x1274.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D6e89572073fe45a9f721ad33b3f58b4c0c2b7c2c[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/2150baf4-1f1a-41ca-b263-95f9add4bc90_2382x1268.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Dd3cc997537fc7fcda2ffaa8957cbb02ff1f1d6a7[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/eb3c0285-86df-4ae4-96f2-56993bae0bca_2376x688.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D08fea442652fd87cbd0da77bee721fd581df77fd

- 正确填写以上信息后，管理人进行实名认证，需要使用手机扫描二维码，并根据手机页面提示，完成对应动作，直至手机上提示“实名认证通过”后完成认证，耐心等待平台审核结果。

## 三、申请经营服务类型
申请入口：https://partner.kuajingmaihuo.com/main/service-type-manage
- 提交经营服务类型相关资质
- 等待平台审核
- 审核通过
- 缴纳足额保证金（缴纳大于等于保证金阈值）
- 服务生效
经营服务类型申请[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/edfd1f1c-3ffd-4770-a48c-65beffc41636_3024x1180.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D0031bc0bdce0a3ca3fb89cb861fe32a1e5333956服务类型                                                            资质材料商品合规服务资质类型
CNAS、CMA、CPSC、FCC、CBTL
资质材料
资质ID 
实验室证明视频
[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/daf39436-fc60-43f6-a492-c5cfa2597607_1018x1146.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Dfad3d49b51aa939728204d58bdc417aee6e1faf9摄影服务作品集
公司场地证明视频[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/af5c1908-1518-4b8b-aed3-8a09e4cd0f4e_1178x896.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D62aed47de661fc782005e7d237ca69031f2403d6企业合规服务海外机构合作协议[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/68405893-4314-4c1a-a88d-1ca8c964b968_1176x826.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D3fd9dd08c24f9d91222615b1ce88977d1d956643

# 服务商信息修改
## 一、主体资质信息修改
修改入口：https://partner.kuajingmaihuo.com/settle
于资质修改页面进行相应信息的修改后并提交，待平台审核通过后生效。
[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/42d48e43-5207-49db-86b2-e270eb5fba12_3020x1428.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Dd883d497c32b22d91b95d1266bcf238865c38ddb
# 自主发布服务
## 一、创建服务
入口：https://partner.kuajingmaihuo.com/main/service-market-manage
- 点击 【创建服务】 进行服务创建
[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/9c9bfd7b-04bf-4f7c-ae99-5b9702edbe71_3020x1562.jpeg?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Dcf36033403ca0b5ff5e228c9b91fdaf0c13edb85
- 根据不同服务类型填写不同服务信息
服务类型表单内容截图示例商品合规 / 检测与认证服务服务信息
服务名称
国家/地区
认证类型
资质名称
服务描述
报告/证书语言
报告/证书形式
测试标准
认证项目
服务描述
服务主图
服务详情
服务规格
订购项目
预估最低价格
其他信息
客服手机号
客服邮箱

[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/f90017e4-2076-47e1-ab78-48497b2922ce_1592x1476.jpeg[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/89d373ac-5b4c-4091-8939-8f8942a8cf11_1610x1008.jpeg企业合规 / 商标及知产服务企业合规 / 税务及授权代理服务企业合规 / EPR生产者责任延伸服务服务信息
服务名称
国家/地区
认证类型
服务年限
服务描述
服务主图
服务详情
服务规格
订购项目
预估最低价格
其他信息
客服手机号
客服邮箱


[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/acddfd1b-e0bf-4394-9dac-d860ee5154da_1594x1478.jpeg[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/bf5b31c1-dea6-4223-8f36-6c825d2032c4_1578x700.jpeg摄影服务 / 摄影服务服务信息
服务名称
拍摄类型
拍摄类目
服务描述
服务主图
服务详情
服务规格
订购项目
预估最低价格
其他信息
客服手机号
客服邮箱

[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/f61f24da-3b2a-4d77-bf09-0e6643820fba_1590x1478.jpeg[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/7068e27b-a8df-470a-befe-4120806020f5_1598x540.jpeg摄影服务 / 视频拍摄服务
3.提交后静待平台审批，审批通过后服务将上架。
# 保证金充值
## 一、充值功能总结
- 保证金充值 及 余额查询
- 充值账单金额查询
- 充值失败，支持退款（目前还不支持保证金提现）
#### 1.充值方式
- 网银/银行转账
- 现金汇款

#### 2.充值及余额查询页面
[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/4dacf0de-ae13-45af-9ce9-d05acaee1c6e_2322x1038.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Decee91ddf8afc5fc084949d94fb9bd1b8ca10c85
#### 3.账单明细页面
[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/7196df51-39ec-41ce-9291-d87440363c86_2348x1050.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Dffd106fc54cca6cc44dd0dae4d537f5c93fa82bd
#### 4.充值失败退款入口
[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/3622de32-f159-4167-9ede-8ac9baaf2f15_2294x1010.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D33690ad8541f74a96fe1a5a87d83213df1353125
[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/cbebb5b8-2571-4460-b10f-dbf2011be040_2402x1106.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3Df3589718e3135a0d24c4da3364f8bfee9b285523
[image]  https://partner.kuajingmaihuo.com/supply-service-order-private/supply-basic-open-private/1f193481a40/1f914e16-e4f9-440c-92ea-b867c76ba031_2508x1076.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DmLHZRe7vh6409M8O6irQM5MoEfS69Cwa%26q-sign-time%3D1733213786%3B1733214386%26q-key-time%3D1733213786%3B1733214386%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D6e1bbbee456686940510cd89e629cbda6b0db6b9
