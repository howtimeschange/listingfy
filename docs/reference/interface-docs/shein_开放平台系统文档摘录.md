# SHEIN 开放平台系统文档摘录

- 抓取时间：2026-04-17T10:35:00.717716+08:00
- 文档数：55

## 开发入门 / 开发指南（必看）

- Page ID：`dad0d1c7-be76-4b03-a735-4e23f012bdd9`
- 路径：`https://open.sheincorp.com/documents/system/dad0d1c7-be76-4b03-a735-4e23f012bdd9`

## 
了解SHEIN开放平台

SHEIN是全球领先的时尚和生活方式在线零售商，致力于让“人人尽享时尚之美”。 SHEIN目前已形成SHEIN自营品牌+平台电商双引擎发展的独特模式，不断助力更多优质制造产品与品牌的国际化发展。卖家可通过SHEIN开展多种模式的电商活动。而SHEIN开放平台通过提供API，支持外部开发者以应用的形态集成API，为卖家提供多样化的电子商务解决方案。

## 

## 
开发者如何接入

您可以参考下方流程，成为SHEIN开发者，为卖家提供应用服务。

## 

## 
第1步：成为开发者

您可通过以下步骤成为开发者：

1、注册开发者账号

2、决定您的开发者资质类型

3、完成开发者资质认证

步骤详细说明：

1、注册开发者账号，
点击前往注册
。

2、根据您的业务场景，决定您的开发者类型。SHEIN开放平台目前有3类开发者类型：卖家自研、第三方软件服务商ISV、平台特邀。    

⚠️
注意：开发者资质一旦审核通过无法修改。一个开发者账号只支持一个资质类型。

开发者类型
​适用对象

卖家自研
如果您是SHEIN卖家的研发团队，只为其提供研发服务，请选择此项。

第三方软件服务商ISV
如果您提供的应用可提供给广大卖家使用，甚至可覆盖多国家地区，多业务模式，是工具类产品，请选择此项。例如ERP、图片处理工具等。

平台特邀
如果您是SHEIN平台特别邀请的开发者，请选择此项。普通开发者请不要选择此项。

3、完成开发者资质认证

根据您所选择的类型，提交对应的资质认证材料。不同类型审核所需时间不同。审核结果将以短信或邮件形式通知您，如有特殊情况请通过工单形式联系平台   

## 
第2步：创建应用

您可以通过以下步骤创建应用：

1、决定您的应用类型

2、创建应用提交信息

3、完成应用审核

    

步骤详细说明：

1、决定您的应用类型

应用类型实际对应的是
“应用服务的卖家在SHEIN的合作模式”
。目前应用有多种类型，不同类型的定义和影响详见下方。

 您在选择类型时，可依据自身的开发者资质进行选择：

- 
如果您是卖家自研开发者，请根据卖家在SHEIN的合作模式选择。如果卖家在平台中有多模式，则可创建多个应用，每个应用对应一种模式。比如卖家同时做SHEIN自营和自运营，那请创建两个应用，分别对应。

- 
如果您是第三方服务软件商ISV，请根据您想要服务的卖家类型进行选择。如果您期望服务多种模式的卖家，那可以创建多个应用，每个应用对应一种模式。

- 
如果您是平台特邀，请根据商务沟通结果进行选择。            

合作模式
合作模式描述

自运营
卖家入驻平台开店，自主负责选品、运营、履约配送、售后等所有环节。

全托管
卖家负责供货，包括推款、拍摄、备货至SHEIN仓库；SHEIN负责营销、履约等环节。

半托管
卖家备货在海外本地，需自行履约配送至消费者；SHEIN协助卖家运营店铺

SHEIN自营
通常是与SHEIN合作的OEM、ODM的卖家。卖家仅负责供货，SHEIN负责选品、采购、运营、履约配送、售后等。

POP
商家入驻开店，备货送到SHEIN仓，商家负责店铺运营，SHEIN负责履约环节。

平台目前有两种POP商家：

- 美国POP：仅销往美国，必定会关联1个全托店铺，店内商品从关联的全托店中搬品而来

- 跨境POP：可销往全球多站点，商品从本店内发布

2、创建应用提交信息

开发者资质审核通过后才可创建应用。通过控制台-应用管理进行应用创建。

提交应用信息时请再三确认信息正确，应用名称、图标、描述均将展示给卖家。目前应用信息在审核后不支持自主修改，需要联系平台修改。

 
           

  
    

3、完成应用审核

不同类型应用的审核耗时不同，审核结果将以短信或邮件形式通知您，如有特殊情况请通过工单形式联系平台。

⚠️
注意：审核期间，您的应用并未生效，无法获取有效的App ID和App Secret，无法正常接口。

## 

## 
第3步：测试应用

应用测试前，请确认您的应用已完成以下动作：

1、基于您的场景，确认应用需要的API、Webhook

2、订阅您需要的API，获得接口调用权限

3、订阅您需要的Webhook，获取事件消息推送

应用测试期间，您应该重点关注以下事项：

1、测试应用授权流程

2、验证签名规则

3、调用接口验证业务逻辑

⚠️友情提示：

平台会提供测试环境的店铺来辅助测试。应用审核通过后，可在控制台查看店铺密钥

     

应用测试前

1、如何确定您需要使用的API、Webhook

请参考
文档中心-解决方案
，他可以解答“针对某个具体场景，需要使用哪些接口，接口间如何调用”。

请注意解决方案中标记的合作模式，相同场景中不同合作模式的解决方案不同。

        

2、订阅您需要的API

应用可使用的API范围，由应用类型决定。可使用的API清单您可以在控制台-应用管理-某个应用详情-API权限包查看。大部分的权限包，在应用审核通过后会自动订阅。

异常情况：

    - 如果发现您需要的API在列表内，但没有标记已订阅，请点击申请权限包，平台审核通过后可获权限。

    - 如果发现您需要的API不在列表内，请通过工单和平台联系。

            

3、订阅您需要的Webhook

应用可使用的Webhook范围，由应用类型决定。可使用的Webhook清单您可以在控制台-应用管理-某个应用详情-Webhook设置查看。

Webhook订阅有两个步骤：

   - 您需要主动开启Webhook消息订阅

   - 您需要提供有效的回调地址，SHEIN会将您订阅的消息发到回调地址中。回调地址区分测试环境、线上环境，且提交后需平台审核，审核通过后生效。
点击查看Webhook接入文档。

                

应用测试要点

1、测试授权流程

应用需获得卖家授权才能获取卖家数据，因此授权是非常重要的流程。
点击查看授权流程的字段解说、代码示例

授权流程的两个关键点：拼接授权链接获得tempToken，通过tempToken获取openKeyId。但在应用测试阶段，您因为没有卖家店铺所以无法测试全流程。

您可以使用平台提供的授权测试工具验证
，工具中提供了模拟应用和店铺，可帮助您获取tempToken，您可以利用tempToken测试换取openKeyId的流程。

⚠️
注意：

    - 测试环境授权链接，使用的域名地址是：https://openapi-test01.sheincorp.cn/#/empower

    - 调用/open-api/auth/get-by-token接口时，生成签名所用的openKeyId和secretKey，请使用应用的APP_ID和APP_secretKey

            

2、验证签名规则

所有API的调用都需要签名入参，签名错误会导致调用失败，因此您需要验证签名规则准确无误。您可以使用签名规则页面中的计算工具进行验证。
点击查看签名规则的详细说明。

       

3、调用接口验证业务逻辑

应用测试阶段，请使用开平提供的测试店铺进行接口调用验证逻辑。

针对您的应用类型，已提供了对应模式的店铺信息，您可使用店铺的openKeyId和secretKey开展接口调用。

如需账号信息登录店铺后台，请联系邮箱openapi@shein.com或提交工单索取。

⚠️
注意：测试环境请使用以下域名调用接口：  https://openapi-test01.sheincorp.cn     

        

## 

## 
第4步：发布准备

应用正式引入卖家使用之前，请确认您的应用已完成以下动作：

1、您的IP地址已添加至白名单

2、线上环境的Webhook回调地址已审核通过

3、接口调用域名切换为线上域名

1、服务器IP地址已添加至白名单

您必须将应用服务的IP地址添加到IP白名单后，才能对线上环境的接口进行调用。

        

2、线上环境的Webhook回调地址已审核通过

如果您有订阅webook，请确保您已配置线上环境的消息回调地址，并且已经审核通过，否则您将无法收到授权卖家的消息通知。审核需要一定时间，请您预留空间。

        

3、接口调用域名切换为线上域名

线上环境调用接口使用的域名

自运营/半托管
全托管/自营/其他

https://openapi.sheincorp.com
https://openapi.sheincorp.cn

## 

## 
第5步：触达卖家授权应用

当您的应用完成上述4步后，您可通过自己的渠道触达卖家，将应用授权链接给到卖家，卖家通过链接登录
SHEIN卖家店铺主账号
后同意授权。卖家授权后，应用可以通过API获取卖家经营数据。

## 开发入门 / 开发者账号类型介绍

- Page ID：`9a4f4c71-96b2-467e-967b-6bc6315b3dbd`
- 路径：`https://open.sheincorp.com/documents/system/9a4f4c71-96b2-467e-967b-6bc6315b3dbd`

# 
开发者账号类型介绍

# 
1 账号类型概述

开发者在注册账号后，首先要完成的是账号类型的选择，以及账号的资质认证。因此请先阅读文档了解各类型的定位和差异，再开始账号资质认证。

账号资质认证审核通过后，不可修改账号类型。

类型名称
适合的开发者
此类型可申请的应用类型

卖家自研
SHEIN卖家，具备自主研发能力，需要同步数据至自研系统。
自运营、半托管、全托管、POP、SHEIN自营、其他

第三方服务软件商（ISV）
软件服务开发商，研发的系统可被多方商家使用，例如ERP。
自运营、半托管、全托管、POP、SHEIN自营、其他

平台特邀业务
平台特殊业务点对点邀请的开发者，例如认证仓。
自运营、半托管、全托管、POP、SHEIN自营、其他、认证仓

# 
2 各账号类型资质认证流程

## 
卖家自研

卖家自研类型需要使用SHEIN商家账号的信息进行验证。提供商家账号信息后，系统将自动验证，信息匹配即认证成功。需要提供的商家信息如下，均可通过商家后台找到。

## 
第三方服务软件商（ISV）

第三方服务软件商需要提交自身的公司主体信息和软件功能信息，以证明您有成熟的开发能力，并且您开发的内容和SHEIN商家诉求是一致的。需要提供的信息如下。

## 
平台特邀业务

平台特邀业务仅限认证仓、智能工具等，由平台侧邀约入驻的开发者可申请。需要提交自身的公司主体信息和软件功能信息，信息如下

## 开发入门 / 店铺授权应用手册

- Page ID：`2169474d-1d4a-41a9-b9fd-427f63f54a63`
- 路径：`https://open.sheincorp.com/documents/system/2169474d-1d4a-41a9-b9fd-427f63f54a63`
- 简介：为确保用户数据安全，开放平台提供了通过API授权获取密钥的方式，以避免数据泄漏

## 

## 
概述

为确保用户数据安全，开放平台提供了通过API授权获取密钥的方式，以避免数据泄漏。开发者在获得SHEIN商家的授权后，将能够获取密钥。该密钥主要用于访问用户的订单、商品等相关数据。

⚠️注意
：未经店铺授权，无法调用接口，因此开发者需引导用户先完成授权。

## 
API授权的好处

1、
数据安全性
：API授权可以确保只有经过认证的用户和应用能够访问敏感数据，从而有效减少数据泄漏的风险。

2、
 
降低人力成本
：开发者可以使用标准化的API接口，可以复用开发的应用程序，降低了人工介入和沟通成本，提升商家接入效率。

## 
API授权流程

### 

### 
 1、 
开发者拼接授权链接

开发者的授权链接需要包含域名、appid、重定向链接（需要base64编码）、state，具体说明如下：

字段
是否必填
描述
用途

Host
必填
生产环境：openapi-sem.sheincorp.com

测试环境：openapi-sem-test01.dotfashion.cn
决定了授权链接访问的目标服务器，从而确保请求能够正确指向系统环境（生产或测试）

appid
必填
开发者应用id
用于系统识别店铺授权给哪个应用

redirectUrl
必填
重定向地址的BASE64编码
用于访问开发者重定向页面，并将tempToken给开发者

state
必填
开发者自定义值
进入开发者设置的重定向页面，该参数将原样返回，以帮助开发者识别是谁进行了授权

⚠️注意：授权域名和调用域名不一致；redirectUrl、state需要增加“&”符号

链接示例：
https://
${Host}
/#/empower?appid=
${appid}
&redirectUrl=
${redirectUrl}
&state=
${state}

https://openapi-sem.sheincorp.com/#/empower?appid=F9D87342D803BA78E1EE49997162&redirectUrl=aHR0cHM6Ly93d3cuYmFpZHUuY29t&state=AUTH-SHEIN-1624700000000

前端实现URL拼接的示例：

const redirectUrl = window.btoa('https://www.xxx.com'); // 回调地址转 base64

const appid = 'F9D87342D803BA78E1EE49997162'; // 本次授权的 appid（必填）

const state = 'xxx'; // 按原样返回，没提供，则不返回

// 授权地址为（以测试环境为例）：各个环境拼接不同的域名即可
const testHost = 'openapi-sem-test01.dotfashion.cn'; // 测试环境

const empowerUrl = `https://${testHost}/#/empower?appid=${appid}&redirectUrl=${redirectUrl}&state=${state}`;

// 在新窗口打开这个地址：
window.open(empowerUrl);

Java实现URL拼接的示例：

 /**
 * 拼接后的重定向结果：https://openapi-sem.sheincorp.com/#/empower?appid=F9D87342D803BA78E1EE49997162&redirectUrl=aHR0cHM6Ly93d3cuYmFpZHUuY29t&state=AUTH-SHEIN-1624700000000
 * @param response
 * @throws IOException
 */
@ApiOperation(value = "应用授权", httpMethod = "POST")
@PostMapping(path = {"/authorizateTempDemo"})
public void authorizateTempDemo(HttpServletResponse response) throws IOException {
    // 跳转鉴权路径
    String authUrl = "https://openapi-sem.sheincorp.com/#/empower";

    // 以下是 GET 参数

    // 必填：跳转回来的地址（注意用 Base64 编码）
    String redirectUrl = Base64.getEncoder().encodeToString(
        "https://www.baidu.com".getBytes(StandardCharsets.UTF_8)
    );

    // SHEIN 门户的应用 appid（必填）
    String appid = "F9D87342D803BA78E1EE49997162";

    // 选填：自定义参数，可用于回调时的校验是否同一流程
    String state = "AUTH-SHEIN-" + System.currentTimeMillis();

    // 拼接 URL
    String url = authUrl
               + "?appid=" + appid
               + "&redirectUrl=" + redirectUrl
               + "&state=" + state;

    System.out.println(url);
    response.sendRedirect(url);
}

 

### 
2、店铺
授权应用流程

商家登录SHEIN卖家后台，点击开发者创建的授权链接进入授权页面

a、商家用店铺
主账号
登录卖家后台，后台链接：
SHEIN全球商家中心

b、商家进入授权页面；
登录后，找到并点击授权链接，以进入授权页面进行相关操作，点击授权按钮后商家会跳转到开发者提供的重定向页面

### 
3、
获取tempToken

用户授权应用后会重定向到开发者页面，并且跳转链接会带上平台返回的
tempToken和state数据

重定向链接示例：

http://openapi-platform-test01.sheincorp.cn/api_test/getByTokenMock?appid=10AF15E7DD802804E7140BE2D326D&tempToken=d1a506e0-d064-47ea-8b01-e56acdca2df2&state=OPENAPI
⚠️注意：tempToken在10分钟内有效，遇到tempToken过期，请引导商家重新授权。

### 
4、
获得店铺秘钥

开发者通过跳转网站获取tempToken后，后端需要调用接口
/open-api/auth/get-by-token
获取 openKeyId 与 secretKey 。

⚠️注意：

 ● 
调用/open-api/auth/get-by-token接口时，需要提供的【x-lt-signature】是通过开发者APP的APP id以及APP secret生成的！

 ● 
从/open-api/auth/get-by-token 接口返回的secretKey需要解密后才能用于生成签名。点击查看
生成签名规则

在进行 API 调用之前，开发者要确保使用正确的请求域名。不同的应用类型可能会使用不同的 API 域名

应用类型
正式环境
测试环境

传统平台/自主运营
https://openapi.sheincorp.com
https://openapi-test01.sheincorp.cn

半托管
https://openapi.sheincorp.com

代运营（简易平台/全托管）
https://openapi.sheincorp.cn

SHEIN自营
https://openapi.sheincorp.cn

其他
https://openapi.sheincorp.cn

⚠️注意：正式环境的应用不能使用测试环境的域名调用接口。测试环境和正式环境是两套独立的环境，数据不互通。

### 
5、 
secretKey密钥解密

目前，开放平台提供Java、PHP、C# 和 Python的加解密代码示例。

⚠️注意：以下代码示例中使用的 secretKey 均为虚构随机码，请务必替换成生产环境中获取到的secretKey

JAVA请求及解密示例：

package cn.dotfashion.soa.openapi.platform.controller.openapi;

import cn.dotfashion.soa.api.constant.ErrorCodeDefine;
import com.alibaba.fastjson.JSON;
import io.swagger.annotations.ApiOperation;
import org.apache.commons.codec.binary.Base64;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import java.io.Serializable;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;

public class ApiSignDemoUtil {

    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final String APPID = "在开发者门户中获取";
    private static final String APP_SECRET_KEY = "在开发者门户中获取";
    private static final Integer RANDOM_LENGTH = 5;
    private static final String ENCODING = "UTF-8";
    private static final String TEST_SERVER = "https://openapi-test01.sheincorp.cn";
    private static final String API_PATH = "/open-api/auth/get-by-token";

    @GetMapping(path = {"/getByTokenMock"})
    @ApiOperation(value = "更新用户信息", notes = "getByTokenMock")
    public Response getByTokenMock(String appid, String tempToken) throws Exception {
        Date date = new Date();
        String timestamp = String.valueOf(date.getTime());
        String signString = appid + "&" + timestamp + "&" + API_PATH;
        String randomKey = UUID.randomUUID().toString().substring(0, 5);
        String randomSecretKey = APP_SECRET_KEY + randomKey;
        String hashValue = ApiSignDemoUtil.hmacSha256(signString, randomSecretKey);
        String base64Value = ApiSignDemoUtil.base64Encode(hashValue);
        String signature = randomKey + base64Value;
        String url = TEST_SERVER + API_PATH;

        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Type", "application/json;charset=UTF-8");
        headers.put("x-lt-appid", appid);
        headers.put("x-lt-timestamp", timestamp);
        headers.put("x-lt-signature", signature);

        String responseStr = ApiSignDemoUtil.doPost(url, headers, "{\"tempToken\":\"" + tempToken + "\"}");
        System.out.println(responseStr);

        Response response = JSON.parseObject(responseStr, Response.class);
        String secretKey = response.getInfo().getSecretKey();
        String decryptSecretKey = AESTools.decrypt(secretKey, APP_SECRET_KEY);
        response.getInfo().setSecretKey(decryptSecretKey);
        return response;
    }

    public static String hmacSha256(String message, String secret) {
        String hash = "";
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256);
            mac.init(secretKey);
            byte[] bytes = mac.doFinal(message.getBytes());
            hash = byteArrayToHexString(bytes);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return hash;
    }

    private static String byteArrayToHexString(byte[] b) {
        StringBuilder hs = new StringBuilder();
        String tmp;
        for (int n = 0; b != null && n < b.length; n++) {
            tmp = Integer.toHexString(b[n] & 0xFF);
            if (tmp.length() == 1) {
                hs.append('0');
            }
            hs.append(tmp);
        }
        return hs.toString().toLowerCase();
    }

    public static String base64Encode(String data) {
        String result = "";
        if (StringUtils.isNotBlank(data)) {
            result = new String(Base64.encodeBase64(data.getBytes(StandardCharsets.UTF_8)), StandardCharsets.UTF_8);
        }
        return result;
    }

    public static String doPost(String url, Map<String, String> headers, String json) throws Exception {
        // 创建httpClient对象
        CloseableHttpClient httpClient = HttpClients.createDefault();
        // 创建http对象
        HttpPost httpPost = new HttpPost(url);

        /**
         * setConnectTimeout：设置连接超时时间，单位毫秒。
         * setConnectionRequestTimeout：设置从connect Manager(连接池)获取Connection 
         * 超时时间，单位毫秒。这个属性是新加的属性，因为目前版本是可以共享连接池的。
         * setSocketTimeout：请求获取数据的超时时间(即响应时间)，单位毫秒。
         * 如果访问一个接口，多少时间内无法返回数据，就直接放弃此次调用。
         */
        RequestConfig requestConfig = RequestConfig.custom().build();
        httpPost.setConfig(requestConfig);

        // 封装请求头
        if (headers != null) {
            Set<Map.Entry<String, String>> entrySet = headers.entrySet();
            for (Map.Entry<String, String> entry : entrySet) {
                httpPost.setHeader(entry.getKey(), entry.getValue());
            }
        }
        // 封装请求参数
        if (json != null) {
            httpPost.setEntity(new StringEntity(json, ENCODING));
        }
        try (CloseableHttpResponse httpResponse = httpClient.execute(httpPost)) {
            // 执行请求并获得响应结果
            return EntityUtils.toString(httpResponse.getEntity(), ENCODING);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    /**
     * AESTools
     */
    public static class AESTools {

        private static final Logger log = LoggerFactory.getLogger(AESTools.class);
        private static final String UTF_8 = "utf-8";
        private static final String KEY_ALGORITHM = "AES";
        private static final Integer BLOCK_LENGTH = 128;

        private static final String DEFAULT_CIPHER_ALGORITHM = "AES/CBC/PKCS5Padding";
        private static final String DEFAULT_KEY = "space-station-default-key";
        private static final String DEFAULT_IV_SEED = "space-station-default-iv";
        private static final Integer IV_LENGTH = 16;

        public static String encrypt(String content) {
            return encrypt(content, DEFAULT_KEY);
        }

        public static String encrypt(String content, String key) {
            return encrypt(content, key, DEFAULT_IV_SEED);
        }

        public static String encrypt(String content, String key, String ivSeed) {
            return encrypt(content, key, ivSeed, false);
        }

        public static String encrypt(String content, String key, String ivSeed, boolean useSecureRandom) {
            return encrypt(content, key, ivSeed, useSecureRandom, false);
        }

        public static String encrypt(
            String content, String key, String ivSeed, boolean useSecureRandom, boolean fillIvIntoResult) {
            if (content == null || content.length() == 0 || key == null || key.length() == 0 || ivSeed == null || ivSeed.length() == 0) {
                throw new IllegalArgumentException("加密内容/密钥/iv不能为空");
            }
            if (ivSeed.getBytes().length < IV_LENGTH) {
                throw new IllegalArgumentException("iv长度不能低于16 byte");
            }
            try {
                Cipher cipher = Cipher.getInstance(DEFAULT_CIPHER_ALGORITHM);
                byte[] byteContent = content.getBytes(UTF_8);
                byte[] ivSeedBytes = ivSeed.getBytes();
                byte[] ivBytes = new byte[16];
                System.arraycopy(ivSeedBytes, 0, ivBytes, 0, 16);
                IvParameterSpec ivSpec = new IvParameterSpec(ivBytes);

                cipher.init(Cipher.ENCRYPT_MODE, getSecretKey(key, useSecureRandom), ivSpec);

                byte[] result = cipher.doFinal(byteContent);
                byte[] mergeResult = fillIvIntoResult ? mergeBytes(ivBytes, result) : result;
                return java.util.Base64.getEncoder().encodeToString(mergeResult);
            } catch (Exception ex) {
                log.warn("AES加密失败:{}", ex);
            }
            return null;
        }

        public static String decrypt(String content) {
            return decrypt(content, DEFAULT_KEY, DEFAULT_IV_SEED);
        }

        public static String decrypt(String content, String key) {
            return decrypt(content, key, false);
        }

        public static String decrypt(String content, String key, boolean isIvSeedContentResult) {
            if (content == null || content.length() == 0 || key == null || key.length() == 0) {
                throw new IllegalArgumentException("密文和密钥不能为空");
            }
            if (!isIvSeedContentResult) {
                return decrypt(content, key, DEFAULT_IV_SEED);
            }
            int ivLength = IV_LENGTH;
            byte[] decode = java.util.Base64.getDecoder().decode(content);
            if (decode.length <= ivLength) {
                throw new IllegalArgumentException("错误的密文");
            }
            byte[] ivBytes = new byte[ivLength];
            byte[] realData = new byte[decode.length - ivLength];
            System.arraycopy(decode, 0, ivBytes, 0, ivLength);
            System.arraycopy(decode, ivLength, realData, 0, decode.length - ivLength);
            return decrypt(java.util.Base64.getEncoder().encodeToString(realData), key, ivBytes);
        }

        public static String decrypt(String content, String key, byte[] iv) {
            return decrypt(content, key, iv, false);
        }

        public static String decrypt(String content, String key, String iv) {
            if (iv == null || iv.getBytes().length < IV_LENGTH) {
                throw new IllegalArgumentException("iv长度不能低于16 byte");
            }
            byte[] ivSeedBytes = iv.getBytes();
            byte[] ivBytes = new byte[16];
            System.arraycopy(ivSeedBytes, 0, ivBytes, 0, 16);
            return decrypt(content, key, ivBytes, false);
        }

        public static String decrypt(String content, String key, byte[] iv, boolean useSecureRandom) {
            if (content == null || content.length() == 0 || key == null || key.length() == 0) {
                throw new IllegalArgumentException("密文和密钥不能为空");
            }
            try {
                Cipher cipher = Cipher.getInstance(DEFAULT_CIPHER_ALGORITHM);
                IvParameterSpec ivSpec = new IvParameterSpec(iv);
                cipher.init(Cipher.DECRYPT_MODE, getSecretKey(key, useSecureRandom), ivSpec);

                byte[] result = cipher.doFinal(java.util.Base64.getDecoder().decode(content));
                log.info("解密完成");
                return new String(result, "utf-8");
            } catch (Exception ex) {
                log.warn("AES解密失败:{}", ex);
            }
            return null;
        }

        private static SecretKeySpec getSecretKey(final String key, boolean randomKey) {
            try {
                if (randomKey) {
                    KeyGenerator kg = KeyGenerator.getInstance(KEY_ALGORITHM);
                    SecureRandom secureRandom = SecureRandom.getInstance("SHA1PRNG");
                    secureRandom.setSeed(key.getBytes());
                    kg.init(BLOCK_LENGTH, secureRandom);
                    SecretKey secretKey = kg.generateKey();
                    return new SecretKeySpec(secretKey.getEncoded(), KEY_ALGORITHM);
                } else {
                    return new SecretKeySpec(Arrays.copyOf(key.getBytes(UTF_8), 16), KEY_ALGORITHM);
                }
            } catch (Exception ex) {
                log.warn("AES生成加密秘钥失败:{}", ex);
                throw new RuntimeException("AES生成加密秘钥失败", ex);
            }
        }

        private static byte[] createIVBySeed(String seed) {
            try {
                SecureRandom secureRandom = SecureRandom.getInstance("SHA1PRNG");
                secureRandom.setSeed(seed.getBytes());
                byte[] iv = new byte[16];
                secureRandom.nextBytes(iv);
                return iv;
            } catch (Exception ex) {
                log.warn("AES生成加密秘钥失败:{}", ex);
                throw new RuntimeException("AES生成加密秘钥失败", ex);
            }
        }

        private static byte[] mergeBytes(byte[] data1, byte[] data2) {
            byte[] data3 = new byte[data1.length + data2.length];
            System.arraycopy(data1, 0, data3, 0, data1.length);
            System.arraycopy(data2, 0, data3, data1.length, data2.length);
            return data3;
        }
    }

    public static class Response implements Serializable {
        private String code;
        private String msg;
        private AuthResultVo info;

        public static Response buildSuccessResponseWithInfo(AuthResultVo info) {
            Response response = new Response();
            response.setInfo(info);
            response.setCode(ErrorCodeDefine.MessageCode.OK.getCode());
            response.setMsg(ErrorCodeDefine.MessageCode.OK.getMsg());
            return response;
        }

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getMsg() {
            return msg;
        }

        public void setMsg(String msg) {
            this.msg = msg;
        }

        public AuthResultVo getInfo() {
            return info;
        }

        public void setInfo(AuthResultVo info) {
            this.info = info;
        }

        public class AuthResultVo {
            private String secretKey;
            private String appid;
            private String openKeyId;
            private String state;

            public String getSecretKey() {
                return secretKey;
            }

            public void setSecretKey(String secretKey) {
                this.secretKey = secretKey;
            }

            public String getAppid() {
                return appid;
            }

            public void setAppid(String appid) {
                this.appid = appid;
            }

            public String getOpenKeyId() {
                return openKeyId;
            }

            public void setOpenKeyId(String openKeyId) {
                this.openKeyId = openKeyId;
            }

            public String getState() {
                return state;
            }

            public void setState(String state) {
                this.state = state;
            }
        }
    }
}

 

PHP加解密代码示例:

<?php

$data = "123456"; // 待加密的数据

$key = "0D8BD3F0AC9F12B0B6B6876527D0175F"; // 解密用的秘钥，应用管理页面上的 appSecretKey

$iv = "space-station-de"; // 固定 IV

$encrypted_data = base64_decode('IULL9EKxPobs/B+CED6flQ=='); // 待解密字段

// 解密示例
$decrypted_data = openssl_decrypt($encrypted_data, "AES-128-CBC", $key, OPENSSL_RAW_DATA, $iv);

// 加密示例
$encrypted_data1 = openssl_encrypt($data, "AES-128-CBC", $key, OPENSSL_RAW_DATA, $iv);

$base64_encoded = base64_encode($encrypted_data1); // 将二进制数据编码为 base64

// 输出加密后的结果
echo $base64_encoded . "\n";

// 输出解密后的结果
echo $decrypted_data;

 

C#加解密代码示例：

using System;
using System.Text;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.Security;

public class Program
{
    public static void Main()
    {
        var secretKey = "E547DCB619824189AD3A532546AE37F9";
        var appSecretKey = "698E4F20DFBA4B85B2291C2BCB7381C5";
        var encryptedsecretKey = "Um6W8uVjabRyt5zJI3hw/38ke8dvUq1o6Vkk1f/Gzjt+sWGeUpYBIFTk7/xVHhJy";

        var decryptedSecretKey = AESTools.Decrypt(encryptedsecretKey, appSecretKey);
        Console.WriteLine($"decryptedSecretKey {decryptedSecretKey} = secretkey {secretKey}");

        secretKey = "E547DCB619824189AD3A532546AE37F9";
        appSecretKey = "698E4F20DFBA4B85B2291C2BCB7381C5";
        encryptedsecretKey = AESTools.Encrypt(secretKey, appSecretKey);

        Console.WriteLine($"secretKey {secretKey} encrypted with {appSecretKey} = encryptedsecretKey {encryptedsecretKey}");

        decryptedSecretKey = AESTools.Decrypt(encryptedsecretKey, appSecretKey);
        Console.WriteLine($"decryptedSecretKey {decryptedSecretKey} = secretkey {secretKey}");
    }

    public static class AESTools
    {
        private static readonly string KEY_ALGORITHM = "AES";
        private static readonly int BLOCK_LENGTH = 128;
        private static readonly string DEFAULT_CIPHER_ALGORITHM = "AES/CBC/PKCS5Padding";
        private static readonly string DEFAULT_IV_SEED = "space-station-de";
        private static readonly int IV_LENGTH = 16;

        public static string Encrypt(string content, string key)
        {
            return Encrypt(content, key, DEFAULT_IV_SEED);
        }

        public static string Encrypt(string content, string key, string ivSeed)
        {
            if (string.IsNullOrEmpty(content) || string.IsNullOrEmpty(key))
            {
                throw new ArgumentException("text and key cannot be empty");
            }
            try
            {
                byte[] byteContent = Encoding.UTF8.GetBytes(content);
                var ivSeedBytes = Encoding.UTF8.GetBytes(ivSeed);
                if (ivSeedBytes == null || ivSeedBytes.Length < IV_LENGTH)
                {
                    throw new ArgumentException("iv cannot be shorter than 16 bytes");
                }
                byte[] ivBytes = new byte[16];
                Array.Copy(ivSeedBytes, 0, ivBytes, 0, 16);

                IBufferedCipher cipher = CipherUtilities.GetCipher(DEFAULT_CIPHER_ALGORITHM);
                cipher.Init(
                    true,
                    new ParametersWithIV(
                        ParameterUtilities.CreateKeyParameter(KEY_ALGORITHM, Encoding.UTF8.GetBytes(key.Substring(0, IV_LENGTH))),
                        ivBytes
                    )
                );
                byte[] encryptedBytes = cipher.DoFinal(byteContent);
                return Convert.ToBase64String(encryptedBytes);
            }
            catch (Exception ex)
            {
                // 可以根据需要添加错误处理逻辑
            }
            return null;
        }

        public static string Decrypt(string content, string key)
        {
            return Decrypt(content, key, DEFAULT_IV_SEED);
        }

        public static string Decrypt(string content, string key, string iv)
        {
            if (string.IsNullOrEmpty(content) || string.IsNullOrEmpty(key))
            {
                throw new ArgumentException("Encrypted text and key cannot be empty");
            }
            try
            {
                var ivSeedBytes = Encoding.Default.GetBytes(iv);
                if (ivSeedBytes == null || ivSeedBytes.Length < IV_LENGTH)
                {
                    throw new ArgumentException("iv cannot be shorter than 16 bytes");
                }
                byte[] ivBytes = new byte[16];
                Array.Copy(ivSeedBytes, 0, ivBytes, 0, 16);

                IBufferedCipher cipher = CipherUtilities.GetCipher(DEFAULT_CIPHER_ALGORITHM);

                byte[] toDecrypt = Convert.FromBase64String(content);
                cipher.Init(
                    false,
                    new ParametersWithIV(
                        ParameterUtilities.CreateKeyParameter(KEY_ALGORITHM, Encoding.UTF8.GetBytes(key.Substring(0, IV_LENGTH))),
                        ivBytes
                    )
                );
                byte[] plainBytes = cipher.DoFinal(toDecrypt);
                return Encoding.ASCII.GetString(plainBytes);
            }
            catch (Exception ex)
            {
                // 可以根据需要添加错误处理逻辑
            }
            return null;
        }
    }
}

### 

Python加解密代码示例：

# pip安装pycryptodome.
import base64
import logging
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from Crypto.Util.Padding import pad, unpad

UTF_8 = "utf-8"
KEY_ALGORITHM = "AES"
BLOCK_LENGTH = 128
DEFAULT_IV_SEED = "space-station-default-iv"
IV_LENGTH = 16

def encrypt(content, key, ivSeed=DEFAULT_IV_SEED, useSecureRandom=False, fillIvIntoResult=False):
    if not content or len(content) == 0 or not key or len(key) == 0 or not ivSeed or len(ivSeed) == 0:
        raise ValueError("content/key/ivSeed must be non-empty")
    if len(ivSeed.encode()) < IV_LENGTH:
        raise ValueError("ivSeed must be at least 16 bytes long")
    try:
        # create cipher.
        cipher = AES.new(get_secret_key(key, useSecureRandom), AES.MODE_CBC, get_iv(ivSeed))
        byte_content = content.encode(UTF_8)
        result = cipher.encrypt(pad(byte_content, AES.block_size))
        merge_result = result if not fillIvIntoResult else merge_bytes(get_iv(ivSeed), result)
        # Return via Base64 transcoding.
        base64_result = base64.b64encode(merge_result).decode(UTF_8)
        return base64_result
    except Exception as ex:
        logging.warning("AES encryption failed: %s", ex)
        return None

def get_secret_key(key, randomKey):
    try:
        if randomKey:
            # 这里的PKCS5Cipher和KeyGenerator并不是pycryptodome常用API，实际要注意替换
            from Crypto.Random import get_random_bytes as grb
            from Crypto.Cipher import PKCS5Cipher   # 仅为示例，需根据实际库调整
            kg = PKCS5Cipher.KeyGenerator(KEY_ALGORITHM)
            secure_random = get_random_bytes(16)
            kg.init(BLOCK_LENGTH, secure_random)
            secret_key = kg.generate_key()
            return secret_key.export_key()
        else:
            return key.encode(UTF_8)[:16]
    except Exception as ex:
        logging.warning("AES failed to generate encryption key: %s", ex)
        raise RuntimeError("AES failed to generate encryption key", ex)

def get_iv(ivSeed):
    ivSeedBytes = ivSeed.encode()
    ivBytes = bytearray(16)
    ivBytes[:] = ivSeedBytes[:16]
    return bytes(ivBytes)

def merge_bytes(data1, data2):
    data3 = bytearray(data1) + bytearray(data2)
    return bytes(data3)

def decrypt(content, key, iv=DEFAULT_IV_SEED, useSecureRandom=False):
    if not iv or len(iv.encode(UTF_8)) < IV_LENGTH:
        raise ValueError("ivSeed must be at least 16 bytes long")
    iv_seed_bytes = iv.encode(UTF_8)
    iv_bytes = bytearray(16)
    iv_bytes[:] = iv_seed_bytes[:16]
    if not content or not key:
        raise ValueError("Ciphertext and key cannot be empty")
    try:
        cipher = AES.new(get_secret_key(key, useSecureRandom), AES.MODE_CBC, iv_bytes)
        result = cipher.decrypt(base64.b64decode(content))
        return unpad(result, AES.block_size).decode(UTF_8)
    except Exception as ex:
        logging.warning("AES decryption failed: %s", ex)
        return None

# appSecretKey.
encryption_key = "14ABE7A4222647CB945DADC76740BA73"
data = "lr4JDSqQkRyZ2YAosX3ZRQ=="

decrypt_result = decrypt(data, encryption_key)
print(decrypt_result)

encrypt_result = encrypt(decrypt_result, encryption_key)
print(encrypt_result)

print(encrypt_result == data)

JavaScript请求及解密示例：

const crypto = require('crypto');
const fetch = require('node-fetch');

class AESTools {
    static UTF_8 = 'utf-8';
    static KEY_ALGORITHM = 'AES';
    static BLOCK_LENGTH_BITS = 128;
    static KEY_LENGTH_BYTES = 16;
    static IV_LENGTH_BYTES = 16;
    static DEFAULT_CIPHER_ALGORITHM = 'aes-128-cbc';
    static DEFAULT_KEY = 'space-station-default-key';
    static DEFAULT_IV_SEED = 'space-station-default-iv';

    /**
     * 从字符串密钥派生出16字节的 Buffer 密钥（截断或填充）
     * @param {string} key
     * @returns {Buffer} 16字节的密钥
     */
    static getSecretKey(key) {
        const keyBuf = Buffer.from(key, this.UTF_8);
        const result = Buffer.alloc(this.KEY_LENGTH_BYTES);
        keyBuf.copy(result, 0, 0, keyBuf.length);
        return result;
    }

    /**
     * 从字符串种子派生出16字节的 Buffer IV（初始化向量）
     * @param {string} ivSeed
     * @returns {Buffer} 16字节的IV
     */
    static getIV(ivSeed) {
        if (!ivSeed) {
            throw new Error('ivSeed 不能为空');
        }
        const ivBuf = Buffer.from(ivSeed, this.UTF_8);
        if (ivBuf.length < this.IV_LENGTH_BYTES) {
            throw new Error(`iv长度不能低于 ${this.IV_LENGTH_BYTES} byte`);
        }
        return ivBuf.slice(0, this.IV_LENGTH_BYTES);
    }

    /**
     * AES 解密操作
     * @param {string} content - Base64 编码的密文
     * @param {object} options - 解密选项
     * @param {string} [options.key=DEFAULT_KEY] - 解密密钥
     * @param {string} [options.ivSeed=DEFAULT_IV_SEED] - IV 种子 (当 isIvInContent=false 时使用)
     * @param {boolean} [options.isIvInContent=false] - 密文是否包含了 IV
     * @returns {string|null} 解密后的明文
     */
    static decrypt(content, { key = this.DEFAULT_KEY, ivSeed = this.DEFAULT_IV_SEED, isIvInContent = false } = {}) {
        if (!content || !key) {
            throw new Error('密文和密钥不能为空');
        }

        try {
            const keyBytes = this.getSecretKey(key);
            let ivBytes;
            let contentToDecrypt;

            if (isIvInContent) {
                const decodedBuf = Buffer.from(content, 'base64');
                if (decodedBuf.length <= this.IV_LENGTH_BYTES) {
                    throw new Error("错误的密文");
                }
                ivBytes = decodedBuf.slice(0, this.IV_LENGTH_BYTES);
                const realData = decodedBuf.slice(this.IV_LENGTH_BYTES);
                contentToDecrypt = realData.toString('base64');
            } else {
                ivBytes = this.getIV(ivSeed);
                contentToDecrypt = content;
            }

            const decipher = crypto.createDecipheriv(this.DEFAULT_CIPHER_ALGORITHM, keyBytes, ivBytes);

            let decrypted = decipher.update(contentToDecrypt, 'base64', this.UTF_8);
            decrypted += decipher.final(this.UTF_8);
            return decrypted;
        } catch (ex) {
            console.error("AES解密失败:", ex);
            return null;
        }
    }
}

/**
 * 计算 HMAC-SHA256 哈希值
 * @param {string} message - 待哈希的消息
 * @param {string} secret - 密钥
 * @returns {string} 十六进制格式的哈希字符串
 */
function hmacSha256(message, secret) {
    return crypto.createHmac('sha256', secret)
                 .update(message)
                 .digest('hex');
}

/**
 * 对字符串进行 Base64 编码
 * @param {string} data - 待编码的字符串
 * @returns {string} Base64 编码结果
 */
function base64Encode(data) {
    return Buffer.from(data, 'utf8').toString('base64');
}

/**
 * 发起 POST 请求
 * @param {string} url - 请求地址
 * @param {object} headers - 请求头
 * @param {string} jsonPayload - JSON 格式的请求体
 * @returns {Promise<string>} 响应体字符串
 */
async function doPost(url, headers, jsonPayload) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: jsonPayload
        });
        if (!response.ok) {
            console.error(`HTTP请求失败! 状态码: ${response.status}`);
        }
        return response.text();
    } catch(error) {
        console.error("doPost 请求异常:", error);
        return null;
    }
}

/**
 * @param {string} appid - 应用ID
 * @param {string} tempToken - 临时Token
 */
async function getByTokenMock(appid, tempToken) {
    const APP_SECRET_KEY = "在开发者门户中获取";
    const TEST_SERVER = "https://openapi-test01.sheincorp.cn";
    const API_PATH = "/open-api/auth/get-by-token";

    const timestamp = String(Date.now());
    const signString = `${appid}&${timestamp}&${API_PATH}`;

    const randomKey = crypto.randomBytes(16).toString('hex').substring(0, 5);
    const randomSecretKey = APP_SECRET_KEY + randomKey;

    const hashValue = hmacSha256(signString, randomSecretKey);
    const base64Value = base64Encode(hashValue);
    const signature = randomKey + base64Value;
    const url = TEST_SERVER + API_PATH;

    const headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'x-lt-appid': appid,
        'x-lt-timestamp': timestamp,
        'x-lt-signature': signature
    };
    const body = JSON.stringify({ tempToken });

    console.log("正在请求 URL:", url);
    const responseStr = await doPost(url, headers, body);
    if (!responseStr) {
        console.log("请求失败，未能获取响应。");
        return;
    }
    console.log("收到的原始响应:", responseStr);

    const response = JSON.parse(responseStr);
    const encryptedSecretKey = response.info.secretKey;
    
    const decryptedSecretKey = AESTools.decrypt(encryptedSecretKey, { key: APP_SECRET_KEY });
    
    response.info.secretKey = decryptedSecretKey;
    console.log("解密后的 Response:", JSON.stringify(response, null, 2));
    return response;
}

## 开发入门 / 签名规则

- Page ID：`856bd098-bcbc-459a-816e-e1ec2545568e`
- 路径：`https://open.sheincorp.com/documents/system/passwdrule`



## 开发入门 / API调用说明文档

- Page ID：`49b797df-016e-40eb-882b-ab9bbaa8c630`
- 路径：`https://open.sheincorp.com/documents/system/49b797df-016e-40eb-882b-ab9bbaa8c630`

## 
概述

本文档提供了接口的基本信息、调用方式、参数说明及示例，旨在帮助开发者顺利完成接口调用。

应用成功获取密钥后，开发者可以使用该密钥调用API接口，如您还未获取密钥，请参考文档《
店铺授权应用手册
》以获取详细流程。

⚠️注意：只有已
授权的接口才能调用API，开发者可前往
开发者后台
查看应用的接口权限。

## 
如何调用接口

### 
1、设置正确的API请求域名

在进行 API 调用之前，开发者要确保使用正确的请求域名。不同的应用类型可能会使用不同的 API 域名

应用类型
正式环境
测试环境

传统平台/自主运营
https://openapi.sheincorp.com
https://openapi-test01.sheincorp.cn

半托管
https://openapi.sheincorp.com

代运营（简易平台/全托管）
https://openapi.sheincorp.cn

SHEIN自营
https://openapi.sheincorp.cn

其他
https://openapi.sheincorp.cn

⚠️注意：
正式环境的应用不能使用测试环境的域名调用接口。测试环境和正式环境是两套独立的环境，数据不互通。

### 
2、设置请求头

在发送 API 请求时，不同的应用需要在请求头中传递以下四个参数：

参数
是否必填
说明

Content-Type
必填
application/json;charset=UTF-8

x-lt-openKeyId
必填
访问用户隐私数据时的唯一权限标识 openKeyIdopenkey通过授权流程获得，如还没有店铺密钥，可详看文档《店铺授权应用手册》

x-lt-timestamp
必填
请求时间戳（5分钟内有效），格式为时间转换为毫秒的值，也就是从1970年1月1日起至今的时间转换为毫秒，如：1583398764000

x-lt-signature
必填
接口签名，
生成签名规则

## 

### 
3、 
不同接口传参方式说明

开放平台根据接口特性，提供不同的传参方式，开发者需要仔细阅读 API 文档，以避免请求时出现错误。当前接口传参方式主要可以分为两种：

a、在调用域名后拼接查询参数

这种方式适用于 GET 请求，通过在 URL 中直接拼接查询参数来传递数据。例如
：

接口：
/open-api/order/purchase-order-infos

https://openapi-test01.sheincorp.cn/open-api/order/purchase-order-infos?pageNumber=1&pageSize=100&allocateTimeStart=2019-12-3100:00:00&allocateTimeEnd=2019-12-31 23:59:59
⚠️
注意：在此示例中：查询参数通过 & 连接；在拼接查询参数时，确保所有参数都是经过 URL 编码的，以防止特殊字符引起的问题

b、在body里面增加参数

对于某些 API 接口，特别是通过 POST 请求发送数据时，开发者可以选择将参数放在请求的 Body 中。这种方式适合于传递较大或复杂的数据结构（如 JSON 对象）。例如：

接口
/open-api/goods/query-attribute-template

{
    "product_type_id_list": [
        2512
    ]
}

### 
4、 输入结果示例

正确访问输出示例

{
    "code": "0",
    "msg": "OK",
    "info": {
        "success": true,
        "spu_name": "MM2412222464",
        "skc_list": [
            {
                "skc_name": "sMM24122224647569",
                "sku_list": [
                    {
                        "sku_code": "I7be1tn2tfoo",
                        "supplier_sku": "sc_eu20241127001ss241113986146541TEST2"
                    }
                ]
            }
        ],
        "version": "SPMP241222341208032",
        "pre_valid_result": null,
        "mcc_valid_result": null,
        "extra": {}
    },
    "bbl": null,
    "traceId": "3acb2f3aa7649de9"
}
错误输出示例

{
  "traceId": "612d85e0a88bdeec",
  "code": "spmp0001",
  "msg": "图片下载异常",
  "info": null,
  "bbl": null
}
⚠️注意：在遇到异常报错需要平台协助查询相关问题时，请提供近3天的traceid

## 开发入门 / 事件回调接入说明

- Page ID：`3b13b1c5-525a-4758-a2b1-056bde083e2c`
- 路径：`https://open.sheincorp.com/documents/system/3b13b1c5-525a-4758-a2b1-056bde083e2c`

## 
 1. Webhook适用范围

#### 
1.1 webhook使用场景

shein内部系统数据变更主动通知外部erp，如订单状态变更、商品审核通知、采购单信息变更等

#### 
1.2 webhook接入条件

       已认证的SHEIN开发者账号，并且注册了开发者应用

## 
 2. Webhook接入步骤

 a. 登录开发者后台，录入开发者提供正式环境和测试环境的回调地址，注意录入时校验地址有效性，超过1.5秒超时

 b. 保存开发者应用的app_id和app_sercetKey(开发者应用的id和应用密钥)，用于webhook校验签名（平台推送给ERP服务器后，ERP需生成有效签名，并返回2xx，shein判断2xx返回码为成功。建议接到请求后异步处理，避免接口超时导致判断为失败）

 c. 开发者在门户订阅所需的事件

 

## 
3. Webhook回调内容

#### 
a. Webhook请求类型

POST

#### 
b. Webhook请求头

请求头名称
类型
内容描述

x-lt-openKeyId
String
商家openkey

x-lt-eventCode
String
事件编码

x-lt-appid
String
开发者应用id

x-lt-timestamp
String
请求时间戳

x-lt-signature:
String
签名

Content-Type
String
application/json

#### 
  c. Webhook请求体

以form-data格式传参

名称
类型
内容描述

eventData
String
加密内容

webhook示例：
x-lt-openKeyId:603BF3306B8E4BA9BA5FFE0770680B6C
x-lt-timestamp:1683704169076
x-lt-signature:AcHSDMDkwZmU1ZTViNThjNDYxNWI3NTc4M2E1M2UzYjM3MzJkNGI4Y2NlMDM1OTI0Nzc1NGJjNzU5Zjc0ZmRhODdkYg==
x-lt-appid:F19202C54001A543486982AE392D
 x-lt-eventCode:order-change
 Content-Type:multipart/form-data
 

 

## 
 4. Webhook验证签名

webhook验证签名以应用的app_id和app_SercertKey用于生成签名，需要开发者手动复制保存到数据库

注意：这里用的不是通过getbytoken接口获取的openkey+sercretKey，平台在webhook设计之初，考虑可能存在非店铺维度的消息，因此webhook验证签名需要使用开发者应用维度的app_id和app_sercertKey，如发现签名错误，可参考门户文档【签名规则-签名计算工具】进行校验， 
https://open.sheincorp.com/documents/system/passwdrule
，再次提醒，生成webhook签名时需使用app的appid和app的sercertKey。验签方法参考java代码示例，同时平台后台也在sdk和postman文件中提供了签名生成的方法，供开发者使用。

 

## 
 5. Webhook解密步骤

 ● webhook数据以AES加密

 ● 默认IV为16位的"space-station-default-iv"

 ● 具体的解密方法参考java代码示例

## 
6. Webhook代码示例/code example 

SHEIN平台判断2xx返回码为ERP接收webhook消息成功，建议ERP系统在接收到Webhook消息后，立即异步处理并直接返回2xx（如200），以避免平台因响应超时而误判处理失败并发送失败通知邮件。

 
EventCallbackDemo.java
 

package cn.dotfashion.soa.openapiEvent.bussiness.event.demo;
import cn.dotfashion.soa.openapiEvent.utils.JsonUtil;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.binary.Base64;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import javax.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Random;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit; /** * @author Jumping.Li * @date 2019/6/20 10:55 */
@Slf4j public class EventCallbackDemo { /** * 商家openKey，用于识别erp用户 */
	public static final String X_LT_OPENKEY_ID = "x-lt-openKeyId"; /** * 时间戳请求头 */
	public static final String X_LT_TIMESTAMP = "x-lt-timestamp"; /** * 签名请求头 */
	public static final String X_LT_SIGNATURE = "x-lt-signature"; /** * 签名的appid请求头 */
	public static final String X_LT_KEY_EVENT_APP_ID = "x-lt-appid"; /** * 本地密钥（从数据库、配置中获取） */
	public static final String SECRET_KEY = "35BCFA6F4CD843B9B0083B18A38A7062";
	private ThreadPoolExecutor executor = new ThreadPoolExecutor(10, 10, 0 L, TimeUnit.SECONDS, new LinkedBlockingQueue < > (1024), new ThreadFactoryBuilder().setNameFormat("sync-common-pool-%d").build(), new ThreadPoolExecutor.DiscardPolicy()); /** * 接口示例 * @param request * @param eventData 来自form-data的加密数据 * @return */
	@PostMapping("/testOpenapiCallback") public boolean testOpenapiCallback(HttpServletRequest request, @RequestParam("eventData") String eventData) {
			Iterator < String > stringIterator = request.getHeaderNames().asIterator();
			HashMap < String, String > headerMap = new HashMap < > ();
			while (stringIterator.hasNext()) {
				String next = stringIterator.next();
				headerMap.put(next, request.getHeader(next));
			}
			log.info("收到openAPI-callback请求,header:{}", headerMap);
			boolean verifySign = EventCallbackDemo.verifySignForHttp(request, SECRET_KEY);
			log.info("收到openAPI-callback请求，密文message--{},签名结果-{}", eventData, verifySign);
			String decryptData = AESTools.decrypt(eventData, SECRET_KEY);
			executor.execute(() - > {
						log.info("收到openAPI-callback请求，解密decrypt--{}，开始处理业务代码", decryptData); //TODO 业务代码 handleRequest(decryptData); }); return verifySign; } private void handleRequest(String decryptData) { //TODO 业务代码 } /** * 有两种模式 * 普通接口用客户的openKey+secretKey签名 * 事件回调接口用erp的appid+secretKey签名 * * @param request * @param secretKey * @return */ public static boolean verifySignForHttp(HttpServletRequest request, String secretKey) { // 获取请求头 String openKey = null; if (request.getHeader(X_LT_KEY_EVENT_APP_ID) != null) { openKey = request.getHeader(X_LT_KEY_EVENT_APP_ID); } else { openKey = request.getHeader(X_LT_OPENKEY_ID); } String timestamp = request.getHeader(X_LT_TIMESTAMP); String signature = request.getHeader(X_LT_SIGNATURE); String requestPath = request.getRequestURI(); return ApiSignUtil.verifySign(signature, openKey, secretKey, requestPath, timestamp); } public static class ApiSignUtil { private static final String HMAC_SHA256 = "HmacSHA256"; private static final String AND = "&"; private static final int RANDOM_LENGTH = 5; static String hmacSha256(String message, String secret) { String hash = ""; try { Mac mac = Mac.getInstance(HMAC_SHA256); SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256); mac.init(secretKey); byte[] bytes = mac.doFinal(message.getBytes()); hash = byteArrayToHexString(bytes); } catch (NoSuchAlgorithmException | InvalidKeyException e) { log.error("HmacSHA256 error : {}", ExceptionUtils.getStackTrace(e)); } return hash; } private static String byteArrayToHexString(byte[] b) { StringBuilder hs = new StringBuilder(); String tmp; for (int n = 0; b != null && n < b.length; n++) { tmp = Integer.toHexString(b[n] & 0XFF); if (tmp.length() == 1) { hs.append('0'); } hs.append(tmp); } return hs.toString().toLowerCase(); } static String base64Encode(String data) { String result = ""; if (StringUtils.isNotBlank(data)) { result = new String(Base64.encodeBase64(data.getBytes(StandardCharsets.UTF_8)), StandardCharsets.UTF_8); } return result; } private static String randomString(int length) { String str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; int range = str.length(); Random random = ThreadLocalRandom.current(); StringBuffer sb = new StringBuffer(); for (int i = 0; i < length; ++i) { int number = random.nextInt(range); sb.append(str.charAt(number)); } return sb.toString(); } public static String signature(String apiKey, String timestamp, String requestPath, String secret) { return signature(apiKey, timestamp, requestPath, secret, randomString(RANDOM_LENGTH)); } public static String signature(String apiKey, String timestamp, String requestPath, String secret, String randomKey) { StringBuilder stringBuilder = new StringBuilder(); String signString = stringBuilder.append(apiKey).append(AND).append(timestamp).append(AND).append(requestPath).toString(); String secretKey = secret + randomKey; String hashValue = hmacSha256(signString, secretKey); return base64Encode(hashValue); } public static String createSignature(String loginName, String timestamp, String requestPath, String secret) { String randomKey = randomString(RANDOM_LENGTH); return randomKey + signature(loginName, timestamp, requestPath, secret, randomKey); } public static String createSignature(String loginName, String timestamp, String requestPath, String secret, String randomKey) { return randomKey + signature(loginName, timestamp, requestPath, secret, randomKey); } public static int getRandomLength() { return RANDOM_LENGTH; } public static boolean verifySign(String signature, String openKey, String secretKey, String requestPath, String timestamp) { String randomKey = signature.substring(0, RANDOM_LENGTH); String base64Value = createSignature(openKey, timestamp, requestPath, secretKey, randomKey); log.info("验证签名字段打印：{},{},{}---sign：{}", openKey, timestamp, requestPath, base64Value); if (signature.equals(base64Value)) { return true; } return false; } } /** * AES加解密工具 */ public static class AESTools { private static final Logger log = LoggerFactory.getLogger(AESTools.class); private static final String UTF_8 = "utf-8"; private static final String KEY_ALGORITHM = "AES"; private static final Integer BLOCK_LENGTH = 128; /** * 默认的加密算法 */ private static final String DEFAULT_CIPHER_ALGORITHM = "AES/CBC/PKCS5Padding"; /** * 默认密钥 */ private static final String DEFAULT_KEY = "space-station-default-key"; /** * 默认的IV生成seed */ private static final String DEFAULT_IV_SEED = "space-station-default-iv"; private static final Integer IV_LENGTH = 16; /** * 使用AES算法加密字符串 * * @param content 待加密的字符串 * @return 加密后的字符串 BASE64格式 */ public static String encrypt(String content) { return encrypt(content, DEFAULT_KEY); } /** * AES 加密操作 * * @param content 待加密内容 * @param key 加密密码 * @return 返回Base64转码后的加密数据 string */ public static String encrypt(String content, String key) { return encrypt(content, key, DEFAULT_IV_SEED); } /** * Encrypt string. * * @param content the content * @param key the key * @param ivSeed the iv seed * @return the string */ public static String encrypt(String content, String key, String ivSeed) { return encrypt(content, key, ivSeed, false); } /** * AES 加密操作 * * @param content 待加密内容 * @param key 加密密码 * @param ivSeed the ivSeed * @param useSecureRandom 是否对密钥使用随机算法 * @return 返回Base64转码后的加密数据 string */ public static String encrypt(String content, String key, String ivSeed, boolean useSecureRandom) { return encrypt(content, key, ivSeed, useSecureRandom, false); } /** * AES 加密操作 * * @param content 待加密内容 * @param key 加密密码 * @param ivSeed the ivSeed * @param useSecureRandom 是否对密钥使用随机算法 * @param fillIvIntoResult the fill iv into result * @return 返回Base64转码后的加密数据 string */ public static String encrypt(String content, String key, String ivSeed, boolean useSecureRandom, boolean fillIvIntoResult) { if (content == null || content.length() == 0 || key == null || key.length() == 0 || ivSeed == null || ivSeed.length() == 0) { throw new IllegalArgumentException("加密内容/密钥/iv不能为空"); } if (ivSeed.getBytes().length < IV_LENGTH) { throw new IllegalArgumentException("iv长度不能低于16 byte"); } try { // 创建密码器 Cipher cipher = Cipher.getInstance(DEFAULT_CIPHER_ALGORITHM); byte[] byteContent = content.getBytes(UTF_8); byte[] ivSeedBytes = ivSeed.getBytes(); //createIVBySeed(ivSeed); byte[] ivBytes = new byte[16]; System.arraycopy(ivSeedBytes, 0, ivBytes, 0, 16); IvParameterSpec ivSpec = new IvParameterSpec(ivBytes); // 初始化为加密模式的密码器 cipher.init(Cipher.ENCRYPT_MODE, getSecretKey(key, useSecureRandom), ivSpec); // 加密 byte[] result = cipher.doFinal(byteContent); byte[] mergeResult = fillIvIntoResult ? mergeBytes(ivBytes, result) : result; //通过Base64转码返回 return java.util.Base64.getEncoder().encodeToString(mergeResult); } catch (Exception ex) { log.warn("AES加密失败:{}", ex); } return null; } /** * AES 解密操作 * * @param content 待解密的字符串 BASE64格式 * @return 解密后的结果 string */ public static String decrypt(String content) { return decrypt(content, DEFAULT_KEY, DEFAULT_IV_SEED); } /** * Decrypt string. * * @param content the content * @param key the key * @return string */ public static String decrypt(String content, String key) { return decrypt(content, key, false); } /** * Decrypt string. * * @param content 待解密的字符串 BASE64格式 * @param key 密钥 * @param isIvSeedContentResult ivSeed是否在密文中 * @return 解密后的结果 string */ public static String decrypt(String content, String key, boolean isIvSeedContentResult) { if (content == null || content.length() == 0 || key == null || key.length() == 0) { throw new IllegalArgumentException("密文和密钥不能为空"); } if (!isIvSeedContentResult) { return decrypt(content, key, DEFAULT_IV_SEED); } int ivLength = IV_LENGTH; byte[] decode = java.util.Base64.getDecoder().decode(content); if (decode.length <= ivLength) { // 没有iv信息 throw new IllegalArgumentException("错误的密文"); } byte[] ivBytes = new byte[ivLength]; byte[] realData = new byte[decode.length - ivLength]; System.arraycopy(decode, 0, ivBytes, 0, ivLength); System.arraycopy(decode, ivLength, realData, 0, decode.length - ivLength); return decrypt(java.util.Base64.getEncoder().encodeToString(realData), key, ivBytes); } /** * AES 解密操作 * * @param content 待解密的字符串 BASE64格式 * @param key 密钥 * @param iv the iv * @return 解密后的结果 string */ public static String decrypt(String content, String key, byte[] iv) { return decrypt(content, key, iv, false); } /** * Decrypt string. * * @param content the content * @param key the key * @param iv the iv * @return the string */ public static String decrypt(String content, String key, String iv) { if (iv == null || iv.getBytes().length < IV_LENGTH) { throw new IllegalArgumentException("iv长度不能低于16 byte"); } byte[] ivSeedBytes = iv.getBytes(); byte[] ivBytes = new byte[16]; System.arraycopy(ivSeedBytes, 0, ivBytes, 0, 16); return decrypt(content, key, ivBytes, false); } /** * AES 解密操作 * * @param content 待解密的字符串 BASE64格式 * @param key 密钥 * @param iv the iv * @param useSecureRandom 是否对密钥使用随机算法 * @return 解密后的结果 string */ public static String decrypt(String content, String key, byte[] iv, boolean useSecureRandom) { if (content == null || content.length() == 0 || key == null || key.length() == 0) { throw new IllegalArgumentException("密文和密钥不能为空"); } try { //实例化 Cipher cipher = Cipher.getInstance(DEFAULT_CIPHER_ALGORITHM); IvParameterSpec ivSpec = new IvParameterSpec(iv); //使用密钥初始化，设置为解密模式 cipher.init(Cipher.DECRYPT_MODE, getSecretKey(key, useSecureRandom), ivSpec); //执行操作 byte[] result = cipher.doFinal(java.util.Base64.getDecoder().decode(content)); log.info("解密完成"); return new String(result, "utf-8"); } catch (Exception ex) { log.warn("AES解密失败:{}", ex); } return null; } /** * 生成加密秘钥 * * @return */ private static SecretKeySpec getSecretKey(final String key, boolean randomKey) { try { if (randomKey) { //返回生成指定算法密钥生成器的 KeyGenerator 对象 KeyGenerator kg = null; kg = KeyGenerator.getInstance(KEY_ALGORITHM); SecureRandom secureRandom = SecureRandom.getInstance("SHA1PRNG"); secureRandom.setSeed(key.getBytes()); //AES 要求密钥长度为 128 kg.init(BLOCK_LENGTH, secureRandom); //生成一个密钥 SecretKey secretKey = kg.generateKey(); // 转换为AES专用密钥 return new SecretKeySpec(secretKey.getEncoded(), KEY_ALGORITHM); } else { // 转换为AES专用密钥 return new SecretKeySpec(Arrays.copyOf(key.getBytes(UTF_8), 16), KEY_ALGORITHM); } } catch (Exception ex) { log.warn("AES生成加密秘钥失败:{}", ex); throw new RuntimeException("AES生成加密秘钥失败", ex); } } /** * 生成16位iv偏移量 * * @param seed * @return */ private static byte[] createIVBySeed(String seed) { try { SecureRandom secureRandom = SecureRandom.getInstance("SHA1PRNG"); secureRandom.setSeed(seed.getBytes()); byte[] iv = new byte[16]; secureRandom.nextBytes(iv); return iv; } catch (Exception ex) { log.warn("AES生成加密秘钥失败:{}", ex); throw new RuntimeException("AES生成加密秘钥失败", ex); } } /** * @param data1 * @param data2 * @return data1 与 data2拼接的结果 */ private static byte[] mergeBytes(byte[] data1, byte[] data2) { byte[] data3 = new byte[data1.length + data2.length]; System.arraycopy(data1, 0, data3, 0, data1.length); System.arraycopy(data2, 0, data3, data1.length, data2.length); return data3; } } }
 

## 
7. 消息文档/message

#### 
 
WebHook API DOC
 

## 
 8. SHEIN开放平台Webhook消息推送的IP地址

120.24.77.228

8.129.229.113

8.129.226.74

8.129.9.82

8.129.7.84

47.106.180.122

120.79.71.235

47.112.201.95

47.112.17.164

47.106.77.136

8.138.164.6

8.134.140.235

8.219.56.57

8.219.138.159

47.244.123.114

8.210.12.12

52.34.71.36

44.229.47.182

52.40.22.133

34.208.2.54

52.37.43.177

100.20.197.247

52.21.82.95

44.218.161.133

## 开发入门 / 测试工具介绍

- Page ID：`c6d9b460-0d53-4a3c-90f6-2713d11d43bd`
- 路径：`https://open.sheincorp.com/documents/system/c6d9b460-0d53-4a3c-90f6-2713d11d43bd`

# 
测试工具介绍

SHEIN开放平台为开发者提供了测试环境数据，以及多样的测试工具，协助开发者验证功能。

注意：平台不支持开发者自行创建测试环境应用、店铺，只可使用平台提供的固定测试应用、测试店铺进行测试。

## 
测试商家授权

工具地址：
https://open.sheincorp.com/backstage/applictions-test-tool/access
。

工具模拟了授权流程的所有环节，提供了应用、商家的信息，跟随工具的详细步骤完成从拼接授权链接到最终获取解密密钥的全过程。

## 
测试接口调用

工具地址： 
https://open.sheincorp.com/backstage/applictions-test-tool?module=shop
 

开发者请通过平台提供的测试环境密钥，调用测试环境接口，进行开发验证。

平台提供了多种类型的店铺，请根据您的实际业务选择合适的店铺进行数据的读写。调用测试环境接口时，请务必使用域名：
https://openapi-test01.sheincorp.cn
。

## 
测试商品发布

工具地址： 
https://open.sheincorp.com/backstage/pub-dev
 

商品发布是核心业务场景，但接口逻辑较复杂，因此平台提供商品发布调试工具，可辅助理解字段逻辑，生成正确的入参示例。

工具支持多种类型的店铺，关联不同的数据配置，请开发者根据实际业务场景选择合适的店铺开展调试。

进入调试后，可查看各入参字段的使用说明，从其他接口获取可用的入参值；发布商品后可生成格式正确的入参示例，真实的响应。

## 开发入门 / 常见名词说明

- Page ID：`4f5b2c46-839d-4dd2-80e5-65722a060759`
- 路径：`https://open.sheincorp.com/documents/system/4f5b2c46-839d-4dd2-80e5-65722a060759`

# 
常见名词说明

SNEIN业务、SHEIN开放平台中常见名词及其说明，名词按模块罗列展示。

# 
1. 账号及应用

开发者资质类型：
即开发者类型、开发者账号类型。开发者注册账号后，需要先完成资质类型认证，才可以创建应用。开发者资质类型有三种：卖家自研、第三方软件服务商（ISV）和平台特邀业务。不同资质类型的开发者对应可申请的应用类型范围不同。详情参考：
开发者账号类型介绍
。

卖家自研：
资质类型之一。卖家自研类型指开发者是SHEIN卖家，具备自主开发能力，需要同步数据至自研系统。详情参考：
开发者账号类型介绍
。

第三方软件服务商（ISV）：
资质类型之一。第三方软件服务商类型指开发者是软件服务开发商，研发的系统可被多方卖家使用，如ERP。详情参考：
开发者账号类型介绍
。

平台特邀业务：
资质类型之一。平台特邀业务类型适用于SHEIN平台点对点特别邀请的开发者，如认证仓。详情参考：
开发者账号类型介绍
。

应用：
由开发者创建，可调用 SHEIN 开放接口的载体。应用在获得接口权限、以及卖家授权后，开发者就能通过应用去读写卖家店铺的数据，对接SHEIN的多种业务场景。详情参考：
开发指南（必看）
。

应用类型：
即应用计划服务的卖家店铺合作模式。类型会决定应用可授权的卖家范围，以及可获取的接口权限。目前应用类型有：自运营、半托管、全托管、POP、SHEIN自营、认证仓和其他。详情参考：
应用类型介绍
。

自运营：
应用类型之一。旧称自主运营、传统平台，自运营模式指整个店铺的运营由卖家执行，即由卖家自主负责选品、定价、运营、订单履约配送、售后等环节。详情参考：
自运营模式接入指南
。

半托管：
应用类型之一。半托管模式指卖家负责提供商品，备货在海外本地，自行履约配送至消费者，SHEIN协助卖家运营店铺。详情参考：
半托管模式接入指南
。

全托管：
应用类型之一。旧称代运营、简易平台，全托管模式指卖家负责选品并备货至SHEIN仓库，由SHEIN负责营销、履约、售后等环节。详情参考：
全托管模式接入指南
。

POP：
应用类型之一。POP模式指卖家负责备货至SHEIN仓库，卖家负责店铺运营，SHEIN负责履约环节。详情参考
POP应用开放申请公告
。

SHEIN自营：
应用类型之一。SHEIN自营模式指SHEIN向卖家/工厂采购商品，由SHEIN负责销售全链路。卖家/工厂提供生产。详情参考：
应用类型介绍
。

认证仓：
应用类型之一。认证仓模式有专门的接口，认证仓应用可服务半托管类型的卖家。相关文档：
开发者账号类型介绍
。

其他：
应用类型之一。其他合作模式的应用只有部分特约接口权限。相关文档：
开发者账号类型介绍
。

# 
2. 授权

授权：
开发者创建的应用需经过卖家授权并获取店铺密钥后，才能通过API读写卖家店铺经营数据。详情参考：
店铺授权应用手册
。

tempToken：
商家通过授权链接同意授权后可从重定向的授权链接中获取tempToken，可理解为临时密钥。开发者需用临时密钥再去获取最终密钥（openKeyId 与 secretKey）。详情参考：
店铺授权应用手册
。

# 
3. 接口调用

openKeyId：
卖家授权后获取的卖家唯一标识，用于组装每次接口调用时所需的签名及请求头。详情参考：
店铺授权应用手册
。

secretKey：
卖家授权后获得的店铺密钥，用于组装每次接口调用时所需的签名。详情参考：
店铺授权应用手册
。

signature：
在SHEIN开放平台中，每次接口调用都需要进行签名验证，以确保请求的合法性和安全性。签名需要基于SHEIN的规则动态生成。详情参考：
签名规则
。

traceId：
接口请求的唯一跟踪标识。在遇到异常报错需要平台协助查询相关问题时，请提供近2天的traceId。相关文档：
API调用说明文档
。

# 
4. 商品

SPU：
标准产品单位，通常代表一个产品型号或款式，包含多种变体（如不同颜色、尺码）的商品集合。详情参考：
SPU商品详情查询
。

SKC：
在SPU维度上增加了主销售属性（通常为颜色）的产品变体，例如具有相同颜色但不同尺寸的商品集合。详情参考：
SPU商品详情查询
。

SKU：
在SPU维度上增加了主销售属性和次销售属性的产品变体，最小产品单元，区分每一个具体规格，如款式、颜色、尺寸等。SKU⊆SKC⊆SPU。详情参考：
SPU商品详情查询
。

主销售属性：
即SKC属性，或主规格属性。主销售属性有且只有1个，一般为颜色。详情参考：
商品属性
。

次销售属性：
即SKU属性，或次规格属性。次销售属性不是必填，若有则最多支持2个，一般为尺寸。详情参考：
商品属性
。

商品属性：
描述商品特性，帮助消费者在购买时了解商品详细情况，例如材质、成分、风格。详情参考：
商品属性
。

尺寸属性：
商品规格维度的尺码信息，如服装、鞋类等，提供有关不同尺码的详细信息，确保消费者能够找到合适的尺码。详情参考：
商品属性
。

商品分类：
即商品归属的分类，接口中常见字段名为"category_id"，使用的多为分类树的末级分类（叶子分类）。相关接口：
店铺查商品末级分类
。

商品类型：
可理解为商品可用属性的集合。接口中常见字段名为"product_type_id"。相关接口：
店铺查可选属性
。

部件：
套装产品中的最小商品单元，例如睡衣套装中，上衣或裤子都是一个部件。但目前开放平台商品接口不支持套装产品。

商品公文：
商家发布或编辑商品后，平台会进行商品数据审核，此审核单据称为商品公文。相关开放能力：
查询审核状态
、
商品审核通知
。

售价：
即销售价，消费者在购买商品时的价格，包括原价和特价。自运营、POP商家在发布商品时，通常提供售价。相关接口：
更新商品售价
。

供货价：
即成本价，半托管/全托管商家在发布商品时，通常提供供货价。商品的售价由平台决定。相关接口：
更新供货价
。

# 
5. 订单

客单：
消费者在SHEIN平台下单付款后生成的订单，涉及自运营和半托管应用。相关接口：
请求订单列表
。

# 
6. 采购

采购单：
即备货单，是SHEIN平台向卖家发出的备货订单，涉及SHEIN自营、全托管、POP、部分半托管商家。商家收到备货单后，需将商品按要求送至SHEIN仓库，仓库内商品产生的客单将有SHEIN进行履约。相关接口：
订单接口-获取采购单信息
。

## 解决方案 / 解决方案介绍

- Page ID：`efc12d67-1c00-452d-8907-30eecd93106a`
- 路径：`https://open.sheincorp.com/documents/system/efc12d67-1c00-452d-8907-30eecd93106a`

# 
解决方案介绍

解决方案目录中介绍了目前SHEIN开放接口可实现的业务场景。

本文章为汇总，每个场景在不同模式中会有些许差异，详细说明可在解决方案目录下找到。

​SHEIN解决方案汇总（更新于2025.06.23）

业务模块
可实现的业务场景

商品
发布商品

编辑商品

撤回商品发布/编辑

调整商品价格（售价、成本价）

调整商品上下架状态

查询商品（列表、详情）

管理商品合规（证书、环保、GPSR、实拍图)

打印商品标签（条码、环保标、合规标）

批量上传商品

客单（消费者订单）
查询订单（列表、详情）

客单发货（上传单号、上传发票、打印面单）

超限拆包（拆包、取消拆包）

客单商品缺货处理

退货单售后处理

采购单（平台备货订单）
查询采购单（普通备货单/JIT急采单，列表、详情）

采购单发货（查收货仓、选发货物流、打印面单）

库存
查询库存

更新库存

查询销量

商品定制
获取定制数据

生成定制任务

财务
查询财务单（列表、详情）

店铺
获取店铺/商家基本信息

## 解决方案 / 应用类型介绍

- Page ID：`26f9ca95-ba44-4da0-9024-90752ceecbec`
- 路径：`https://open.sheincorp.com/documents/system/26f9ca95-ba44-4da0-9024-90752ceecbec`

# 
应用类型介绍

# 

# 
1 应用类型概述

每个SHEIN应用会定义1个应用类型，应用类型对应的是应用会服务的商家业务类型。

当应用创建成功后，应用可获得此业务类型涉及的接口权限，此业务类型的商家可授权应用。一个SHEIN应用有且只能关联1个应用类型，如果开发者计划服务多个类型的商家，需要创建多个应用。

目前SHIEN提供的应用类型，以及对应的商家业务类型定义如下

请注意：创建应用时需确定应用类型，应用创建成功后无法修改类型，因此请仔细查看下方的类型介绍，明确您要创建的应用。

业务环节
自运营
半托管
全托管
POP
SHEIN自营

业务概述
平台模式。

商家入驻开店，自主负责选品、运营、履约配送、售后等环节
平台模式。

商家入驻开店，SHEIN协助运营店铺销售商品，商家跟踪管理订单
平台模式。

商家入驻开店，推款备货送到SHEIN仓， SHEIN负责营销、履约、售后、客服等环节
平台模式。

商家入驻开店，备货送到SHEIN仓，商家负责店铺运营，SHEIN负责履约环节。

平台目前有两种POP商家

- 美国POP：仅销往美国，必定会关联1个全托店铺，店内商品从关联的全托店中搬品而来

- 跨境POP：可销往全球多站点，商品从本店内发布

商家具体是哪类POP，可通过接口/open-api/openapi-business-backend/query-store-info的supplierBusinessMode确认。
自营模式（也称采销模式）。

SHEIN向商家/工厂采购商品，由SHEIN负责销售全链路。商家/工厂提供生产。

商品发布
商家提供商品信息、决定销售价
商家提供商品信息、定义成本价，平台定销售价
商家提供商品信息、定义成本价，平台定销售价
商家提供商品信息、决定销售价
由SHEIN选款/设计款式后，商家/工厂打样生产

店铺运营
商家可控制商品上下架，可随时调整商品售价
商家可控制商品上下架。平台控制商品售价
商家不感知运营，由平台决定商品上下架站点、控制商品售价
商家可控制商品上下架，可随时调整商品售价
商家不感知运营，由平台决定商品上下架站点、控制商品售价

订单管理
商家处理订单履约、售后流程
商家处理订单履约、售后流程
商家不感知订单管理。由SHEIN处理订单履约、售后流程
商家不感知订单管理。由SHEIN处理订单履约、售后流程
商家不感知订单管理。由SHEIN处理订单履约、售后流程

备货管理
商家无需备货（部分特殊商家需备货）
商家无需备货（部分特殊商家需备货）
商家需按平台要求，提前将货品备货到SHEIN仓库
商家需按平台要求，提前将货品备货到SHEIN仓库
商家需按平台要求，提前将货品备货到SHEIN仓库

注意：如需申请创建POP应用请提交工单，目前是非公开申请状态。

# 
2 各类型应用的接口差异

接口模块
自运营应用
半托管应用
全托管应用
POP应用
SHEIN自营应用

商品模块
商品发布接口，价格入参至"price_info_list"

更新价格使用更新售价接口

可使用商品上下架接口

其他商品接口均可使用
商品发布接口，价格入参至"cost_price"

更新价格使用更新成本价接口

可使用商品上下架接口

其他商品接口均可使用
商品发布接口，价格入参至"cost_price"

更新价格使用更新成本价接口

无法使用商品上下架接口

其他商品接口均可使用
商品发布接口 -- 所有POP商家目前不支持API发品

更新售价接口 -- 仅美国POP商家可调价，跨境POP不可以

可使用商品上下架接口

其他商品接口均可使用
无法使用开放平台中的商品模块接口

Feed模块
可使用
无法使用
无法使用
无法使用
无法使用

合规模块
可使用
可使用
可使用
可使用
无法使用

客单模块
可使用
可使用
无法使用
无法使用
无法使用

退后退款模块
可使用
可使用
无法使用
无法使用
无法使用

备货模块（采购单）
无法使用
无法使用

部分特殊SFS商家授权的应用可使用
可使用
可使用
可使用

库存模块
可使用
可使用
可使用
可使用
可使用

财务模块
可使用
可使用
可使用
可使用
无法使用

店铺模块
可使用
可使用
可使用
可使用
无法使用

# 
3 各类型应用接入指南

自运营应用接入指南

半托管应用接入指南

全托管应用接入指南

## 解决方案 / 自运营解决方案 / 自运营模式接入指南

- Page ID：`75b69837-b5f4-4f48-b444-8bf0d8b843be`
- 路径：`https://open.sheincorp.com/documents/system/75b69837-b5f4-4f48-b444-8bf0d8b843be`

# 
自运营模式接入指南

# 
1 模式说明

自运营模式（旧称自主运营、传统平台）下，整个店铺的运营由商家执行。

即由商家自主选品、定商品售价、定商品上架状态、负责订单的履约和售后，。

# 
2 创建应用

开发者需要先注册开发者账号、创建应用后才可开始正式对接，整体流程可参考文档
开发指南
。

- 
应用类型选择：自运营

- 
可授权的商家范围：自运营模式商家

# 

# 
3 对接业务接口、通知

开发者开发自运营模式应用时，常规情况下可以对接
商品、商品合规、客单、库存、财务
模块的接口。

开放平台基于业务场景提供了解决方案，即说明某个业务场景如何通过接口实现。下面会按业务模块维度，介绍自运营模式在各模块内可利用的解决方案、可对接的接口、通知。

## 
3.1 商品管理

自运营模式的商品特征

- 
商家提供销售价

- 
商家决定商品上架站点

- 
商家决定商品的上下架状态

- 
支持批量处理商品

解决方案名称
文档地址

商品发布
https://open.sheincorp.com/documents/system/99154fa1-77d5-4b48-9253-cfff1d2a60ce

商品属性
https://open.sheincorp.com/documents/system/424039e8-4657-454a-a4cb-781938a42622

商品图片
https://open.sheincorp.com/documents/system/4d96fc8f-4913-4211-8630-5d81e7fcc010

商品证书
https://open.sheincorp.com/documents/system/a4c9a5c4-75db-4f99-bbaf-0e47b34bda80

批量处理商品
https://open.sheincorp.com/documents/system/04fdafe8-9bb7-4fac-bf47-b1f45c859371

类型
接口名称
接口路径

API
商品发布
/open-api/goods/product/publishOrEdit

API
商品发布规范
/open-api/goods/query-publish-fill-in-standard

API
查询店铺分类树
/open-api/goods/query-category-tree

API
根据商品图片查询类目
/open-api/goods/image-category-suggestion

API
查询店铺可用属性
/open-api/goods/query-attribute-template

API
查询分类是否可自定义属性值
/open-api/goods/get-custom-attribute-permission-config

API
添加自定义属性值
/open-api/goods/add-custom-attribute-value

API
查询店铺站点和币种信息（新）
/open-api/goods/query-site-list

API
查询店铺站点和站点币种（旧）
/open-api/openapi-business-backend/site/query

API
图片链接转换
/open-api/goods/transform-pic

API
本地图片上传
/open-api/goods/upload-pic

API
查询店铺品牌列表
/open-api/goods/query-brand-list

API
查询商品审核
/open-api/goods/query-document-state

API
商品列表
/open-api/openapi-business-backend/product/query

API
spu查询
/open-api/goods/spu-info

API
更新商品售价
/open-api/openapi-business-backend/product/price/save

API
商品上下架
/open-api/goods/modify-skc-shelf

API
查询证书所需上传资料（新）
/open-api/goods/certificate/get-all-certificate-type-list-v2

API
查询商品证书要求和审核状态
/open-api/goods/get-certificate-rule

API
上传证书文件
/open-api/goods/upload-certificate-file

API
商品证书池创建/编辑
/open-api/goods/save-or-update-certificate-pool

API
店铺证书池创建/编辑
/open-api/goods/save-or-update-supplier-certificate

API
SKC绑定商品证书池
/open-api/goods/save-certificate-pool-skc-bind

API
创建Feed文件
/open-api/sem/feed/createFeedDocument

API
查询Feed文件
/open-api/sem/feed/getFeedDocument

API
上传Feed文件
/open-api/sem/feed/uploadDocumentContent

API
创建Feed任务
/open-api/sem/feed/createFeed

API
查看Feed任务
/open-api/sem/feed/getFeed

API
取消Feed任务
/open-api/sem/feed/cancelFeed

webook
商品接收通知
/product_document_receive_status_notice

webook
商品审核通知
/product_document_audit_status_notice

webook
商品涨价审批结果通知
/product_price_audit_status_notice

webook
商品价格异常通知
/product_prices_abnormal_notice

webook
商品上下架通知
/product_shelves_notice

webook
商品额度变动通知
/product_quota_change_notice

## 

## 

## 
3.2 商品合规

商品销往欧洲市场时，会需要使用合规能力，为商品提供环保标、GPSR标、实拍图等。

解决方案名称
文档地址

商品合规
https://open.sheincorp.com/documents/system/af751fbf-0a24-484a-98fe-377654bd62d7

类型
接口名称
接口路径

API
获取全量环保耗材信息（新）
/open-api/goods-quality/environmental-label-rule/material-quality-tree-v2

API
获取全量耗材类型和耗材材质信息
/open-api/goods-quality/environmental-label-rule/material-quality-tree

API
获取环保标配置规则
/open-api/goods-quality/environmental-label-rule/list

API
批量打印环保标
/open-api/goods-quality/environmental-label-rule/print

API
打印合规标签
/open-api/goods-compliance/label-print

API
查询代理公司列表
/open-api/goods-compliance/agency-list

API
查询SKC的代理公司绑定要求
/open-api/goods-compliance/skc-agency-detail

API
绑定SKC和代理公司
/open-api/goods-compliance/save-skc-agency

API
查询SKC的实拍图要求
/open-api/goods-compliance/skc-label-list

API
上传实拍图图片
/open-api/goods-compliance/upload-skc-label-picture

API
绑定SKC和实拍图
/open-api/goods-compliance/skc-save-label

webook
商品合规信息失效通知
/product_compliance_change_notice

## 

## 
3.3 客单管理

解决方案名称
文档地址

客单履约
https://open.sheincorp.com/documents/system/b86df826-638d-4128-9f5e-c7b20d8cf28e

超大包裹拆包
https://open.sheincorp.com/documents/system/7039b56b-69c7-43b1-a706-50d418d723e8

​客单退货退款
https://open.sheincorp.com/documents/system/949a61a4-bb8b-4683-922a-8755e079b394

类型
接口名称
接口路径

API
获取订单列表
/open-api/order/order-list

API
获取订单详情
/open-api/order/order-detail

API
导出地址
/open-api/order/export-address

API
订单发货渠道查询
/open-api/order/express-channel

API
获取快递公司信息
/open-api/order/express-infos

API
批量上传运单号
/open-api/order/import-batch-multiple-express

API
回传发票信息
/open-api/order/sync-invoice-info

API
打印面单接口
/open-api/order/print-express-info

API
确认无货
/open-api/order/confirm-no-stock

API
确认超限拆分包裹
/open-api/order/unpacking-group-confirm

API
取消超限拆分包裹
/open-api/order/unpacking-group-remove

API
获取退货单列表
/open-api/return-order/list

API
获取退货单详情
/open-api/return-order/details

API
退货单签收
/open-api/return-order/sign-return-order

webook
订单同步通知
/order_push_notice

webook
退货单同步通知
/return_order_push_notice

## 

## 

## 
3.4 库存

自运营模式的库存管理特征

- 
商家需维护自己的商家仓库列表

- 
按商家仓库维度管理商品库存信息

类型
接口名称
接口路径

API
商家仓库列表查询
/open-api/msc/warehouse/list

## 
3.5 财务

类型
接口名称
接口路径

API
查询对账单列表
/open-api/finance/get-check-order-list

API
查询对账单详情
/open-api/finance/get-check-order-detail

# 

# 
关联阅读

    
开发者接入指南

    
店铺授权指南

    
API调用指南

    
事件回调接入指南

## 解决方案 / 自运营解决方案 / 商品发布-自运营

- Page ID：`165b51da-c8dd-43b6-a885-4aed2c7fa582`
- 路径：`https://open.sheincorp.com/documents/system/165b51da-c8dd-43b6-a885-4aed2c7fa582`

商品发布 - 自运营模式

## 
 

# 
方案概述

## 
适用范围

本文档仅适合【应用类型=自运营】的应用。

 

## 
业务流程

本文档介绍商品发布/商品上传流程。主要包含4个阶段：发布准备、发布商品、等待平台审核、获取审核结果。

文档将会详细介绍，每个阶段所用接口、调用逻辑、调用注意事项。

 
 
 

 

## 
商品上传接口调用流程

 
 
 

 

#### 
 

## 
商品上传API&消息清单

API名称
API & 文档地址

查询商品发布字段规范
 
/open-api/goods/query-publish-fill-in-standard
 

查询店铺可用品牌
 
/open-api/goods/query-brand-list
 

查询店铺可售站点以及站点对应的币种&语种
/open-api/goods/query-site-list

查询店铺可用分类
 
/open-api/goods/query-category-tree
 

查询店铺可用属性
 
/open-api/goods/query-attribute-template
 

查询是否支持自定义属性值
 
/open-api/goods/get-custom-attribute-permission-config
 

添加自定义属性值
 
/open-api/goods/add-custom-attribute-value
 

转换图片成SHEIN可用的图片
 
/open-api/goods/transform-pic
 

本地图片上传
 
/open-api/goods/upload-pic
 

商品发布&编辑
 
/open-api/goods/product/publishOrEdit
 

查询商品审核状态
 
/open-api/goods/query-document-state
 

查询SPU商品详情
 
/open-api/goods/spu-info
 

 

消息名称
event_code & 文档地址

商品公文接收结果通知
 
/product_document_receive_status_notice
 

商品公文审批结果通知
 
/product_document_audit_status_notice

 

# 

# 

# 
商品上传详细步骤

## 
1、商品上传发布准备

自运营店铺在发布商品时，需提供的商品信息包括：

 ● 
品牌：商家可销售的品牌。商家先在商家后台创建，可通过API获取可售品牌。

 ● 
类目：商家可销售的类目。商家入驻后，平台会依据商家情况为其店铺分配可销售的类目，可通过API获取店铺的可售类目。

 ● 
属性：商品各维度属性，辅助买家全面了解商品。商品可用的属性，由平台决定，不同类目会有不同可用属性，可通过API获取。

 ● 
图片：商品图片由商家提供，可来自本地文件或线上链接，但需要将其转换成SHEIN平台的图片链接才可使用，可通过API完成转换。

 ● 
描述：商品描述由商家提供，当商品上架多个国家站点时，会需要提供多个语种的描述。

 ● 
售价：商品的销售价，由商家决定。当商品上架多个国家站点时，会需要提供多个币种的售价。

 ● 
销售站点：商家可售卖的SHEIN站点。商家入驻后，平台会依据商家情况决定其店铺商品可上架的站点。可通过API获取。

 ● 
库存：商品可销售的库存信息。商家先在商家后台维护仓库信息，在将商品库存维护到具体仓库。可通过API获取仓库信息。

接下来，会详细介绍如何开展发品准备工作。

 

### 

### 
1.1 获取商品发布规范

因市场政策、类目规则等因素，不同店铺、不同类目对商品发布会有不同要求，例如：某些非必填字段要求必填。同时平台的要求在不断变化，因此建议在每次发品之前，先查询发布规范，基于规范去要求商家提供信息，然后发布商品，可提升商家的发品效率。

如何获取

- 
通过接口：
/open-api/goods/query-publish-fill-in-standard

- 
使用说明：

- 
请求说明

- 
常规情况：大部分规范绑定在店铺维度，所以请求时只关注请求头即可

- 
特殊情况：当你要确认商品图片需要按什么要求提供时，需要关注请求体，提供"
category_id
"或"
spu_name
"。商品图片要求绑定在分类维度。

- 
返回说明

- 
"default_language"：商品默认语种；发布商品接口中商品名称多语言"
multi_language_name_list
"、商品描述多语言"
multi_language_desc_list
"中，
必须提供默认语种对应的内容。

- 
"
fill_in_standard_list
"：告知商品发布接口中时，哪些非必填的字段会变成必填。下方表格是两个接口中参数的映射关系。

- 
"picture_config_list"：告知商品图片上传要求。目前平台有多套图片要求，
请详细阅读文档：API支持上传SPU和SKU维度图片
。

"fill_in_standard_list"映射关系

发布规范接口中"field_key"枚举值
此枚举在商品发布接口中对应的入参字段

reference_product_link
competing_product_link 

proof_of_stock
proof_of_stock_list

shelf_require
shelf_require

brand_code
brand_code

skc_title
skc_title

minimum_stock_quantity
minimum_stock_quantity

stop_purchase
stop_purchase

mall_state
mall_state

product_detail_picture
site_detail_image_info_list

### 
1.2 获取可用品牌

获取商家可销售品牌，供商家选用。商家先在商家后台创建品牌，才可通过API获取品牌信息。

如何获取

 ● 
通过接口：
/open-api/goods/query-brand-list

 ● 
使用说明：店铺是否必传，请以
商品发布规范信息
为准。

#### 

### 
1.3 获取可用类目树

获取店铺可用的类目，供商家选用。同时，商品可用属性绑定在类目下，获取属性时也会用到类目信息。

类目介绍

 ● 
不同店铺可用的类目不同，SHEIN会根据店铺的售卖地区、类型等因素决定店铺可用类目。

 ● 
类目下有多层子类目，不同类目下的子类目层级数量不同。

 ● 
类目下最后一层称为【末级类目】，商品与【末级类目】关联，且一个商品只会关联一个【末级类目】。

如何获取类目树

 ● 
通过接口：
/open-api/goods/query-category-tree

 ● 
使用说明

     ○ 
返回说明

         ■ 
需关注【末级类目】的概念，因为大部分商品接口中使用的都是【末级类目】的"category_id"。【末级类目】的判定方式："
last_category
"=true

         ■ 
需关注字段"product_type_id"，仅末级类目中有值，可理解为某个末级分类的信息模板。在发布商品、查询可用属性中都会用到。

### 
1.4 获取类目下可用属性

获取此商品类目下可用的所有属性、属性值，供商家选用/填写。

属性介绍

 ● 
不同【末级类目】有不同的可用属性。

 ● 
SHEIN决定每个类目下的可用属性、以及每个属性下可用的属性值。部分属性支持添加自定义属性值，可通过接口确认：
/open-api/goods/get-custom-attribute-permission-config

如何获取属性

 ● 
通过接口：
/open-api/goods/query-attribute-template

 ● 
使用说明：

    ○ 
请求参数使用的是末级类目的"
product_type_id
"，不是"
category_id"；
支持批量查询。

    ○ 
接口会返回指定的末级类目下所有属性以及所有属性值（目前包括自定义属性，但后续可能不再返回，建议开发者自己保存一份数据）

如何使用属性

根据属性的信息，明确此属性在商品发布接口中如何使用。

 ● 
如何判断属性在商品发布接口中对应哪个入参？

     ○ 
可通过属性类型概念去判断。

     ○ 
属性类型需要通过多个属性信息联合判断。

属性类型
判断方式
此类型在商品发布接口中的传参

主销售属性
attribute_type=1 & attribute_label=1注意：1个商品只有1个主销售属性
skc_list -> sales_attribute

次销售属性
attribute_type=1 注意：主销售属性可以作为次销售属性；1个商品最多可以有2个次销售属性。
sku_list -> sales_attribute

商品属性
attribute_type=3/4
product_attribute_list

尺码表属性
attribute_type=2
size_attribute_list

 ● 
如何确定属性是否必填：通过"
attribute_status
"判断，
1-不填；2-选填；3-必填；不填代表历史存在过但已停用的属性，可不填。

 ● 
属性值的输入方式：通过"
attribute_mode
"判断。当输入方式为下拉选择时，可选内容来自于属性值"
attribute_value_info_list
"。当可选属性值中没有商家想要的内容，需要自定义属性值时，可参考下方流程：

     ○ 
先确定属性是否支持添加自定义属性值：
/open-api/goods/get-custom-attribute-permission-config

     ○ 
若支持添加，则通过接口添加属性值：
/open-api/goods/add-custom-attribute-value

     ○ 
添加成功后保存返回的属性值ID"
attribute_value_id
"，或通过接口再次查询可用属性（不推荐）：
/open-api/goods/query-attribute-template

### 

### 
1.5 将图片转换为SHEIN链接

通过API发布商品时提供的图片URL，必须为SHEIN可用的URL。需要提前将本地图片或在线URL转换为SHEIN URL后，再提交。

本地图片上传

 ● 
接口地址：
/open-api/goods/upload-pic

 ● 
上传之前，请先确认图片是否满足
SHEIN平台的图片规范
，不满足规范会转换失败。

外部在线链接转换

 ● 
接口地址：
/open-api/goods/transform-pic

 ● 
转换之前，请先确认图片是否满足
SHEIN平台的图片规范
，不满足规范会转换失败。

## 

### 
1.6 获取可售站点

SHEIN在全球有多个销售站点，商家入驻时SHEIN会评估店铺商品可销售的站点范围。商家发布商品时，可选择要上架至哪些站点，确认后需要提供每个站点对应币种的商品售价。

如何获取站点

 ● 
接口地址：
/open-api/goods/query-site-list

 ● 
使用说明：

     ○ 
店铺可售站点变化不频繁，周期性更新即可

     ○ 
商品可上架的站点范围 :"
site_status
"=1

     ○ 
商品如果上架至A站点，则一定要提供A站点币种的商品售价。其他可选择性提供的内容包括

         ■ 
A站点语种的商品描述，如果不提供，系统会根据默认语种内容进行翻译

### 
1.7 获取可用仓库信息

 ● 
通过接口：
/open-api/msc/warehouse/list

 ● 
使用说明：

         ○ 
商家仓库的信息，需要商家先在商家后台手动维护后，才可通过接口查询获取。

         ○ 
当商家有多个仓库时，创建商品或编辑商品库存时，都必须提供仓库id。

## 

## 
2、上传/发布商品

 ● 
发布商品接口：
/open-api/goods/product/publishOrEdit

 ● 
以下是自运营应用，在发布商品时会使用到的参数

字段
类型
是否必填 

发布新品场景
是否必填 

编辑商品场景
字段描述

brand_code
string
否
否
商品品牌。SHEIN内部生成的品牌CODE。 通过接口
【商品发布字段规范（含默认语种）】
查询是否该字段必填

category_id
int64
是
是
商品所属的末级类目id。 通过
【店铺查商品末级类目】
获取。

product_type_id
int64
是
是
商品所属的商品类型id。 末级分类对应的类型ID。 通过
【店铺查商品末级类目】
获取

source_system
string
否
否
固定为openapi

spu_name
string
否
是
商品的spuName。SHEIN内部生成的SPU唯一标识。 创建商品场景不用传，商品发布成功以后的场景必传。

suit_flag
string
否
否
商品是否为套装：1-是；0-否。

supplier_code
string
是
是
卖家SPU维度的货号。由卖家自定义。最多200个字符。

is_spu_pic
boolean
否
否
是否选择新版图片上传方案。 新版图片上传方案的详细信息，详细参考文档。

image_info >
object[]
否
否
SPU维度商品图片。 上传图片的要求，详细参考
文档
。

 image_group_code
string
否
是
图片组编码。由平台生成的编码。 创建商品场景不用传，商品发布成功以后的场景必传。

 image_info_list >
object[]
否
是
图片列表

 image_item_id
int64
否
是
图片唯一id。由平台生成。 创建商品场景不用传，商品发布成功以后的场景必传。

 image_sort
integer
是
是
图片排序序号。

 image_type
integer
是
是
图片类型：1-主图,2-细节图,5-方块图,6-色块图

 image_url
string
否
否
图片链接。链接必须转换成SHEIN链接。 可使用接口

## 解决方案 / 自运营解决方案 / 商品编辑-自运营

- Page ID：`8ca3c2b9-be6d-4d68-8166-5a25f57bad75`
- 路径：`https://open.sheincorp.com/documents/system/8ca3c2b9-be6d-4d68-8166-5a25f57bad75`

# 
商品编辑 - 自运营

# 

# 
1 确认商品能否被编辑

商品必须满足以下两个条件才可编辑：

1、商品SPU已发布且通过平台审核

      确认方式：若SPU能在
/open-api/goods/spu-info
中查询到结果，说明已通过审核。

      若SPU的首次发布没有审核通过，请基于新发布商品的调用逻辑，调整信息后重新发布。

2、商品当前没有其他进行中的审核流程

     确认方式：使用spuName查询接口
/open-api/goods/query-document-state
。当响应的skcList中，没有skc的
documentState=1/5，代表商品没有进行中的审核流程。参考的返回示例如下。

{
    "code": "0",
    "msg": "OK",
    "info": {
        "data": [
            {
                "spuName": "c250722589993",
                "version": "SPMP250724229942289",
                "skcList": [
                    {
                        "skcName": "sc25072258999337915",
                        "documentSn": "SPMPM1020250724001140",
                        "documentState": 2, //不可等于1或5
                        "failedReason": null
                    },
                    {
                        "skcName": "sc25072258999308304",
                        "documentSn": "SPMPM1020250724001141",
                        "documentState": 2,//不可等于1或5
                        "failedReason": null
                    }
                ]
            }
        ],
        "meta": {
            "count": 1,
            "customObj": null
        }
    },
    "bbl": null,
    "traceId": "5e0819423f8012b7"
}

# 
2 可编辑/不可编辑内容

编辑商品涉及到多个接口，每个接口都有各自可编辑、不可编辑的范围，具体见下表，每个接口的使用方式详见文档下方

接口信息
可编辑内容
不可编辑内容

商品发布&编辑

/open-api/goods/product/publishOrEdit
1、编辑已发布的SPU/SKC/SKU的以下信息

   商品标题、描述、品牌、包装重量

   商品分类、商品属性、尺码属性

   所有类型的商品图片

   所有类型的商品货号

2、在已发布的SPU下新增SKC或KU
不可编辑已发布SPU/SKC/SKU的以下信息

    商品销售价

    建议零售价

    商品主销售属性、次销售属性

    上架站点

    商品库存

更新商品销售价

/open-api/openapi-business-backend/product/price/save
商品在某个站点的销售价

商品在某个新上架站点的销售价
仅支持左侧内容

更新商品上架状态

/open-api/goods/modify-skc-shelf
商品在某站点的上架状态
仅支持左侧内容

更新商品库存

/open-api/gsp/goods/change-inventory
商品在某个仓库中的库存值
仅支持左侧内容

# 
3 商品发布&编辑

- 
接口地址：
/open-api/goods/product/publishOrEdit

- 
商品发布和编辑共用一个接口，因此这个接口在编辑商品可做到2个场景：
编辑已发布的SPU/SKC/SKU信息、在SPU下发布新的SKC/SKU

## 
3.1 编辑已发布的SPU/SKU/SKC信息

接口信息
可编辑内容
不可编辑内容

商品发布&编辑

/open-api/goods/product/publishOrEdit
1、编辑已发布的SPU/SKC/SKU的以下信息

   商品标题、描述、品牌、包装重量

   商品分类、商品属性、尺码属性

   所有类型的商品图片

   所有类型的商品货号

2、在已发布的SPU下新增SKC或KU
不可编辑已发布SPU/SKC/SKU的以下信息

    商品销售价

    建议零售价

    商品主销售属性、次销售属性

    上架站点

     商品库存

核心规则

- 
编辑场景中，入参中都必须有SPU（spu_name）、至少一个SKC（skc_list）、至少一个SKU（sku_list）

- 
编辑时，必须入参平台生成的对象唯一编码，例如spu_name、skc_name、sku_code、image_group_code等

- 
编辑时，并非所有商品信息都可编辑。拆分为可编辑字段、不可编辑字段进行说明

- 
可编辑字段：
编辑时入参的字段，全部按覆盖逻辑处理；若不给入参代表清空原值。
即若不给字段A则代表商品不需要字段A，字段A的值按清空处理；若给字段"filedA":"value1"，则代表fieldA会更新为value1。

- 
不可编辑字段：
编辑时不可在字段中给出入参，给了就会报错编辑失败
（大部分按这个逻辑走，个别字段除外，例如销售属性）

- 
下面是编辑场景下接口入参的使用说明（因篇幅问题，仅对需要关注的字段、对象进行说明）

字段名
字段名
字段名
​编辑时是否必填
值是否可被编辑
​值的数据来源
编辑说明

brand_code
部分情况必填
可编辑
/open-api/goods/spu-info：brandCode
不传字段时，按清空处理。

若原本有品牌，或要更新品牌，则必填。

category_id
必填
部分情况可编辑
/open-api/goods/spu-info：categoryId
一定条件下可编辑。

当新分类下的主&次销售属性包含了已发布SKC、SKU的销售属性时，可编辑。

product_type_id
必填
可编辑
/open-api/goods/spu-info：productTypeId

注意：此处一定要查询SPU中返回信息为准，平台有修改category_id和product_type_id间关联关系的情况。如果使用查询店铺分类树中获取的关系入参，会出现报错。
一定条件下可编辑。

若分类被更新时，此字段也需要更新为新分类对应的product type id

spu_name
必填
不可编辑
/open-api/goods/spu-info：spuName
提供平台生成值

supplier_code
​
​
必填
可编辑
/open-api/goods/spu-info：supplierCode
需注意此code全店唯一，不可重复

suit_flag
必填
不可编辑
无来源但API不支持套装，因此需给0
商品接口暂不支持套装信息，因此必须给0

is_spu_pic
部分情况必填
可编辑
/open-api/goods/spu-info：需基于已发布图片的组合情况判断
不传字段时，默认按false处理。若原本此字段需要更新为true，则字段必填。

image_info
部分情况必填
可编辑
/open-api/goods/spu-info：spuImageInfoList
不传字段时，按清空图片处理。

若原本有提供SPU图片或需要更新SPU图片时，必须给出完整的list数据；编辑时必须image_group_code，可以不提供image_item_id。

multi_language_desc_list
部分情况必填
可编辑
/open-api/goods/spu-info：productMultiDescList
不传字段时，按清空处理。

若原本有提供描述，或要更新描述，必须给出所有需要语种的描述。

multi_language_name_list
部分情况必填
可编辑
/open-api/goods/spu-info：productMultiNameList
不传字段时，保留原值。

若需要修改商品标题，则需要给出需要语种的名称，并且编辑时需带上所有已发布的SKC信息

product_attribute_list
部分情况必填
可编辑
/open-api/goods/spu-info：productAttributeInfoList

注意：productAttributeInfoList包含商品属性、销售属性。需ERP自行剔除其中的销售属性。销售属性可通过此接口的saleAttributeList的销售属性获取，剔除后就只剩商品属性
不传字段时，按清空处理。

若原本有提供属性或要更新属性，需要给出完整属性列表。注意如果更换了分类，则需要给新分类下的商品属性。

site_list
不可填
不可编辑
/open-api/goods/spu-info：shelfStatusInfoList
无法通过此接口修改商品的上架站点范围。

若商品需上架至新站点A，需先通过/open-api/openapi-business-backend/product/price/save为商品在新站点A定价，再通过/open-api/goods/modify-skc-shelf将商品上架至站点A。

若商品需要从站点B下架，需通过/open-api/goods/modify-skc-shelf处理

size_attribute_list
部分情况必填
可编辑
/open-api/goods/spu-info：dimensionAttributeInfoList
不传字段时，按清空处理。

若原本有提供属性或要更新属性，需给出完整属性列表。注意如果更换了分类，则需要给新分类下的属性。

sale_attribute_sort_list
部分情况必填
可编辑
无
不传字段时，按清空处理。

若原本有提供排序，需要给出完整列表。注意如果更换了分类，则需要给新分类下的属性。

skc_list
必填
部分可编辑
/open-api/goods/spu-info：skcInfoList
不论编辑信息还是发布新SKC，入参里都需要有skc list

image_info
部分情况必填
可编辑
/open-api/goods/spu-info：skcImageInfoList
不传字段时，按清空图片处理。

若原本有提供SKC图片，或需要更新SKC图片时，必须给出完整的list数据；编辑时必须image_group_code，可以不提供image_item_id。

sale_attribute
必填
不可编辑
/open-api/goods/spu-info：skcInfoList - attributeId skcInfoList - attributeValueId
已发布的SKC不可修改属性。

注意，若新发布SKC，则新SKC的属性ID需和已发布SKC保持一致，但属性值ID必须不同。

skc_name
必填
不可编辑
/open-api/goods/spu-info：skcName
可通过接口获取：/open-api/openapi-business-backend/product/query

supplier_code
必填
可编辑
/open-api/goods/spu-info：skcInfoList -supplierCode
需注意此code全店唯一，不可重复

skc_title
部分情况必填
可编辑
无来源
不传字段时，按清空处理。

若原本有提供名称，或要更新名称则需要填写

suggested_retail_price
不可填
不可编辑
/open-api/goods/spu-info：srpPriceInfo
编辑已发布SKC时不可提供此字段，会报错编辑失败

site_detail_image_info_list
部分情况必填
可编辑
/open-api/goods/spu-info：siteDetailImageInfoList
不传字段时，按清空图片处理。若原本有提供图片，或需要更新图片时，必须给出完整的list数据；编辑时必须image_group_code，可以不提供image_item_id。

proof_of_stock_list
部分情况必填
可编辑
/open-api/goods/spu-info：proofOfStockInfoList
不传字段时，按清空处理。若原本有提供信息，或要更新信息则需要填写

sku_list
必填
部分可编辑
/open-api/goods/spu-info：skuInfoList
即使不更新SKU信息，也需要在入参里体现至少一个已发布的SKU或新的SKU

height
必填
可编辑
/open-api/goods/spu-info：height
更新为编辑时提供的值

length
必填
可编辑
/open-api/goods/spu-info：length
更新为编辑时提供的值

width
必填
可编辑
/open-api/goods/spu-info：width
更新为编辑时提供的值

weight
必填
可编辑
/open-api/goods/spu-info：weight
更新为编辑时提供的值

mall_state
必填
可编辑
/open-api/goods/spu-info：mallState
更新为编辑时提供的值

sku_code
必填
不可编辑
/open-api/goods/spu-info：skcName
提供平台生成值，可通过接口获取：/open-api/openapi-business-backend/product/query

image_info
部分情况必填
可编辑
/open-api/goods/spu-info：skuImageInfoList
不传字段时，按清空处理。

若原本有提供或需要更新时，需给出完整的list数据；编辑时必须image_group_code，可以不提供image_item_id。

supplier_sku
必填
可编辑
/open-api/goods/spu-info：skuInfoList-supplierSku
更新为编辑时提供的值。需注意此code全店唯一，不可重复

competing_product_link
部分情况必填
可编辑
暂无来源
不传字段时，按清空处理。若原本有提供或需要更新时，需给值。

price_info_list
不可填
不可编辑
/open-api/goods/spu-info：priceInfoList
编辑已发布的SKC时不可提供此字段，会报错编辑失败。

更新价格通过/open-api/openapi-business-backend/product/price/save

sale_attribute_list
必填
不可编辑
/open-api/goods/spu-info：skuInfoList - saleAttributeList
已发布的SKU不可修改属性注意，若新发布SKU，则同SKC下多个SKU的属性ID需保持一致，但属性值ID必须不同。

stock_info_list
不可填
不可编辑
/open-api/stock/stock-query
编辑已发布的SKU时不可提供此字段，会报错编辑失败。

更新库存通过/open-api/gsp/goods/change-inventory

## 
3.2 已发布SPU下新增SKC/SKU

核心规则

- 
在SPU下发布新的SKC/SKU时，
新的skc_list或sku_list按照商品发布规则填写。
参考： 
https://open.sheincorp.com/documents/apidoc/detail/3001350
 

- 
发布新SKC/SKU时，入参中可以带上已发布的SKC（更新信息），也可以不带（入参里仅体现新发布信息）

## 
3.3 各场景请求示例

### 

### 
编辑已发布的SPU

//即使是编辑SPU信息，也要带上至少一个SKC/SKU

{
  "spu_name": "c250722589993",
  "category_id": 20039919,
  "product_type_id": 2147503231,
  "suit_flag": "0",
  "supplier_code": "5657545454",
  "is_spu_pic": "false",
  "multi_language_name_list": [
    {
      "language": "en",
      "name": "Bennie For Edit Product SKC 0722"
    }
  ],
  "product_attribute_list": [
    {
      "attribute_id": 2147484223,
      "attribute_value_id": 2147488193
    }
  ],
  "size_attribute_list":[
    {
      "attribute_id":7,
      "attribute_value_id":"",
      "attribute_extra_value":2,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":13
    },
    {
      "attribute_id":7,
      "attribute_value_id":"",
      "attribute_extra_value":1,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":889
    },
    {
      "attribute_id":15,
      "attribute_value_id":"",
      "attribute_extra_value":2,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":13
    },
    {
      "attribute_id":15,
      "attribute_value_id":"",
      "attribute_extra_value":1,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":889
    }
  ],
  "skc_list": [
    {
      "skc_name": "sc25072258999337915",
      "sale_attribute": {
        "attribute_id": 2147484187,
        "attribute_value_id": 544
      },
      "supplier_code": "5657545454",
      "image_info": {
        "image_group_code": "G2pl5myvhpnk",
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "sku_list": [
        {
          "sku_code": "I1gucul3mzte",          
          "supplier_sku": "1735345",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "stop_purchase": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 13
            }
          ]
          }
      ]
    }
  ]
}

### 

### 

### 
编辑已发布的SKC/SKU

{
  "spu_name": "c250722589993",
  "category_id": 20039919,
  "product_type_id": 2147503231,
  "suit_flag": "0",
  "supplier_code": "5657545454",
  "is_spu_pic": "false",
  "multi_language_name_list": [
    {
      "language": "en",
      "name": "Bennie For Edit Product SKC 0722"
    }
  ],
  "product_attribute_list": [
    {
      "attribute_id": 2147484223,
      "attribute_value_id": 2147488193
    }
  ],
  "size_attribute_list":[
    {
      "attribute_id":7,
      "attribute_value_id":"",
      "attribute_extra_value":2,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":13
    },
    {
      "attribute_id":7,
      "attribute_value_id":"",
      "attribute_extra_value":1,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":889
    },
    {
      "attribute_id":15,
      "attribute_value_id":"",
      "attribute_extra_value":2,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":13
    },
    {
      "attribute_id":15,
      "attribute_value_id":"",
      "attribute_extra_value":1,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":889
    }
  ],
  "skc_list": [
    {
      "skc_name": "sc25072258999337915",
      "sale_attribute": {
        "attribute_id": 2147484187,
        "attribute_value_id": 544
      },
      "supplier_code": "5657545454",
      "image_info": {
        "image_group_code": "G2pl5myvhpnk",
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "sku_list": [
        {
          "sku_code": "I1gucul3mzte",          
          "supplier_sku": "1735345",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "stop_purchase": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 13
            }
          ]
          },
          {
          "sku_code": "I1gucul2ajbl",          
          "supplier_sku": "1546456",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "stop_purchase": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 889
            }
          ]
        }
      ]
    },
    {
      "skc_name": "sc25072258999308304",
      "sale_attribute": {
        "attribute_id": 2147484187,
        "attribute_value_id": 536
      },
      "supplier_code": "5657545454",
      "image_info": {
        "image_group_code": "G7sxt97ah3t3",
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "sku_list": [
        {
          "sku_code": "I1gucul4l3a4",          
          "supplier_sku": "175685656",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "stop_purchase": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 889
            }
          ]
          },
          {
          "sku_code": "I1gucul5304n",          
          "supplier_sku": "145345",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "stop_purchase": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 13
            }
          ]
        }
      ]
    }
  ]
}

### 

### 

### 

### 
SPU下新增SKC/SKU且不带已发布SKC信息

{
  "spu_name": "c250722589993",
  "category_id": 20039919,
  "product_type_id": 2147503231,
  "suit_flag": "0",
  "supplier_code": "5657545454",
  "is_spu_pic": "false",
  "multi_language_name_list": [
    {
      "language": "en",
      "name": "Bennie For Edit Product SKC 0722 1530"
    }
  ],
  "multi_language_desc_list": [
    {
      "language": "en",
      "name": "Bennie For Edit Product SKC 0722 1530"
    }
  ],
  "product_attribute_list": [
    {
      "attribute_id": 2147484223,
      "attribute_value_id": 2147488193
    }
  ],
  "size_attribute_list":[
    {
      "attribute_id":7,
      "attribute_value_id":"",
      "attribute_extra_value":2,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":13
    },
    {
      "attribute_id":7,
      "attribute_value_id":"",
      "attribute_extra_value":1,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":889
    },
    {
      "attribute_id":15,
      "attribute_value_id":"",
      "attribute_extra_value":2,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":13
    },
    {
      "attribute_id":15,
      "attribute_value_id":"",
      "attribute_extra_value":1,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":889
    }
  ],
  "skc_list": [            //这个skc_list中只有新增的skc和sku信息
    {
    "sale_attribute": {
        "attribute_id": 2147484187,
        "attribute_value_id":2147488292
      },
      "supplier_code": "565fdf45454",
      "image_info": {
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "sku_list": [
        {
          "supplier_sku": "17353566745",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "stop_purchase": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 13
            }
          ],
          "price_info_list":[
            {
              "base_price":10.00,
              "special_price":9.00,
              "currency":"USD",
              "sub_site":"shein-us"
            }
          ],
          "stock_info_list":[
            {
              "inventory_num":100
            }
          ]
          },
          {  
          "supplier_sku": "154678768456",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "stop_purchase": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 889
            }    
          ],
          "price_info_list":[
            {
              "base_price":10.00,
              "special_price":9.00,
              "currency":"USD",
              "sub_site":"shein-us"
            }
          ],
          "stock_info_list":[
            {
              "inventory_num":100
            }
          ]
        }
      ]
    }
  ]
}
        
          
          
         

### 
SPU下新增SKC/SKU，同时编辑已发布SKC

{
  "spu_name": "c250722589993",
  "category_id": 20039919,
  "product_type_id": 2147503231,
  "suit_flag": "0",
  "supplier_code": "5657547854",
  "is_spu_pic": "false",
  "multi_language_name_list": [
    {
      "language": "en",
      "name": "Bennie For Edit Product SKC 0724 22"
    },
    {
      "language": "zh-cn",
      "name": "Bennie For Edit Product SKC 0724 22"
    }
  ],
  "multi_language_desc_list": [
    {
      "language": "en",
      "name": "Bennie For Edit Product SKC 0722 1530"
    }
  ],
  "product_attribute_list": [
    {
      "attribute_id": 2147484223,
      "attribute_value_id": 2147488193
    }
  ],
  "size_attribute_list":[
    {
      "attribute_id":7,
      "attribute_value_id":"",
      "attribute_extra_value":2,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":13
    },
    {
      "attribute_id":7,
      "attribute_value_id":"",
      "attribute_extra_value":1,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":889
    },
    {
      "attribute_id":15,
      "attribute_value_id":"",
      "attribute_extra_value":2,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":13
    },
    {
      "attribute_id":15,
      "attribute_value_id":"",
      "attribute_extra_value":1,
      "relate_sale_attribute_id":2147484186,
      "relate_sale_attribute_value_id":889
    }
  ],
  "skc_list": [          // 这个是新增的SKC/SKU
       {
    "sale_attribute": {
        "attribute_id": 2147484187,
        "attribute_value_id":2147488291
      },
      "supplier_code": "565fdf45454",
      "image_info": {
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "sku_list": [
        {
          "supplier_sku": "173554566745",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "stop_purchase": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 13
            }
          ],
          "price_info_list":[
            {
              "base_price":10.00,
              "special_price":9.00,
              "currency":"USD",
              "sub_site":"shein-us"
            }
          ],
          "stock_info_list":[
            {
              "inventory_num":100
            }
          ]
          },
          {  
          "supplier_sku": "154r4678745456",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "stop_purchase": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 889
            }    
          ],
          "price_info_list":[
            {
              "base_price":10.00,
              "special_price":9.00,
              "currency":"USD",
              "sub_site":"shein-us"
            }
          ],
          "stock_info_list":[
            {
              "inventory_num":100
            }
          ]
        }
      ]
    },{
      "skc_name": "sc25072258999337915",     // 这个是对已发布的SKC/SKU进行调整
    "sale_attribute": {
        "attribute_id": 2147484187,
        "attribute_value_id": 544
      },
      "supplier_code": "5657545454",
      "image_info": {
        "image_group_code": "G2pl5myvhpnk",
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "sku_list": [
        {
          "sku_code": "I1gucul3mzte",          
          "supplier_sku": "1735345",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "stop_purchase": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 13
            }
          ]
          },
          {
          "sku_code": "I1gucul2ajbl",          
          "supplier_sku": "1546456",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "stop_purchase": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 889
            }
          ]
        }
      ]
    },
    
    {
      "skc_name": "sc25072258999308304",
      "sale_attribute": {
        "attribute_id": 2147484187,
        "attribute_value_id": 536
      },
      "supplier_code": "5657545454",
      "image_info": {
        "image_group_code": "G7sxt97ah3t3",
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      }
      ,
      "sku_list": [
        {
          "sku_code": "I1gucul4l3a4",          
          "supplier_sku": "175685656",
          "height": "3",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "stop_purchase": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 889
            }
          ]
          },
          {
          "sku_code": "I1gucul5304n",          
          "supplier_sku": "145345",
          "height": "3",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 2,
          "stop_purchase": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 13
            }
          ]
        }
      ]
    }
  ]
}

# 
4 更新商品销售价

- 
接口地址：/open-api/openapi-business-backend/product/price/save

- 
此接口支持以下两个场景：

- 
商品在发布时若选择了A站点，后续又想要上架B站点，则需要先为商品在B站点设定销售价，然后再通过/open-api/goods/modify-skc-shelf上架至B站点。

- 
更新商品在某站点的价格，注意不可将价格更新为0。

接口信息
可编辑内容
不可编辑内容

更新商品销售价

/open-api/openapi-business-backend/product/price/save
商品在某个站点的销售价

商品在某个新站点的销售价
仅支持左侧内容

请求示例：

{
    "productPriceList":[
        {
            "productCode":"I6pm4j97ovv5",
            "currencyCode":"GBP",
            "shopPrice":80,
            "specialPrice":8,
            "site":"shein-uk" //sku新增上架站点 
        },
        {
            "productCode":"I6pm4j97ovv5",
            "currencyCode":"EUR",
            "shopPrice":80,
            "specialPrice":8,
            "site":"shein-fr" //更新sku在某个站点的售价
        }
    ]
}

# 
5 更新商品上下架状态

- 
接口地址：/open-api/goods/modify-skc-shelf

- 
商品若已上架A、B站点

- 
若需要将商品从A/B/A+B中下架，则可直接用此接口处理。

- 
若需将商品上架至C站点，请先确保商品在C站点有设定价格，有价格的情况下才可以上架。

接口信息
可编辑内容
不可编辑内容

更新商品上架状态

/open-api/goods/modify-skc-shelf
商品在某站点的上架状态
仅支持左侧内容

{
    "skc_site_info_list":[
        {
            "shelf_state":2,
            "site_list":["shein-uk","shein-fr"],
            "skc_name":"sd25072111416469171"
        }
    ]
}

## 
6 更新商品库存

- 
接口地址：/open-api/gsp/goods/change-inventory

- 
支持修改商品在指定仓库内的库存值，当店铺内有多个仓库时必须提供仓库信息。

接口信息
可编辑内容
不可编辑内容

更新商品库存

/open-api/gsp/goods/change-inventory
商品在某个仓库中的库存值（多仓库时必须给仓库id）
仅支持左侧内容

{
    "updateSkuInventoryQuantityRequests":[
        {
            "skuCode":"I6pm4j97ovv5",
            "warehouseCode":"PS2697156399",
            "changeInventoryQuantity":100
        }
    ]
}

## 解决方案 / 自运营解决方案 / 商品属性

- Page ID：`424039e8-4657-454a-a4cb-781938a42622`
- 路径：`https://open.sheincorp.com/documents/system/424039e8-4657-454a-a4cb-781938a42622`
- 简介：本文旨在帮助开发者们了解和熟悉在创建商品时需要必填的属性如何设置，以及平台的相关要求。

# 
商品属性

# 

# 
1 方案概述

- 
本文档适用于【应用类型=自运营/半托管/全托管/POP】的应用。

- 
商品属性会在商品发布/编辑场景中使用（即接口：/open-api/goods/product/publishOrEdit）。本文档会介绍商品属性的基础定义、获取方式、使用方式。

# 
2 商品属性结构

属性类型
​属性定义
是否必填
属性数量
商家后台的配置界面
​C端看到的属性界面

商品属性
描述商品特性，帮助消费者在购买时了解商品详细情况。例如材质、成分、风格、税务
需通过接口确认
支持0~多个

尺寸属性
商品规格维度的尺码信息，如服装、鞋类等，提供有关不同尺码的详细信息，确保消费者能够找到合适的尺码
需通过接口确认
支持0~多个

主销售属性（主规格）
​消费者在选购时选择的属性，一般为颜色
必填
有且只有1个

次销售属性（其他规格）
消费者在选购时选择的属性，例如尺寸和款式等
需通过接口确认
支持0~2个属性

# 

# 
3 商品属性使用方式

### 
3.1 获取可用的属性

- 
通过接口查询某个商品分类下可用的属性，以及属性下的属性值。接口地址：
/open-api/goods/query-attribute-template

- 
属性信息中包含2部分属性自身信息属性下可用的属性值列表：attribute_value_info_list

- 
以下是属性信息的代码示例，以及重要字段的说明

"attribute_infos": [
          {
            "attribute_id": 31,
            "attribute_name": "细节",
            "attribute_name_en": "Details",
            "attribute_remark_list": [1],
            "attribute_is_show": 1,
            "attribute_label": 0,
            "attribute_mode": 1,
            "attribute_input_num": 10,
            "attribute_status": 2,
            "attribute_type": 4,
            "attribute_value_info_list": [
              {
                "attribute_value_id": 501,
                "attribute_value": "珍珠",
                "attribute_value_en": "Pearls",
                "is_custom_attribute_value": false,
                "is_show": 1,
                "attribute_value_group_list": null
              }
             ],
            "site_title": null,
            "site_url": null,
            "skc_scope": null
         ]
字段归属
字段名
字段定义

属性
attribute_id
属性id

attribute_name
属性名称

attribute_is_show
属性是否会在买家商详页内显示。1-展示；2-不展示

attribute_type
属性种类。1-销售属性（覆盖主销售、次销售属性）；2-尺寸属性；3-成分属性；4-普通属性

attribute_label
是否为主销售属性。1-是；0-否

attribute_mode
属性值的录入方式。0: 手工填写参数；1:下拉多选;2:下拉单选(只针对销售属性);3:下拉单选；4:下拉列表+手工填写参数

attribute_input_num
多选属性的属性值数量上限（attribute_mode=1）。0代表无限制

attribute_status
判断属性是否必填 。1:属性不填（即属性不能被使用）; 2:属性选填; 3:属性必填

attribute_remark_list
属性的业务场景，对使用逻辑没有影响。1:重要,2:合规,3:质量,4:关务

属性值
attribute_value
属性值名称

attribute_value_id
属性值ID

is_show
属性值是否会在买家商详页内显示

is_custom_attribute_value
判断是否为商家自己添加的自定义属性值，true代表是，false代表否

### 
3.2 确认属性在商品发布接口的入参字段

商品发布接口中的属性字段
什么样的属性信息在此字段中入参

product_attribute_list：商品属性
attribute_type=3/4

​size_attribute_list：尺寸属性
attribute_type=2

​skc_list → sale_attribute：主销售属性
attribute_type=1 且 attribute_label=1

sku_list → sale_attribute_list​：次销售属性
attribute_type=1 且 attribute_label=1/0（主销售属性也可以入参到次销售属性中）

### 
3.3 确认属性是否必填

属性必填有3种情况

- 
商品的主销售属性必填：每个商品有且必须要有1个主销售属性，所以skc_list → sale_attribute中必须入参属性

- 
某个属性自身必填：基于政策或品类的要求，部分属性会要求商家必填。可通过attribute_status=3（属性必填）来判断，如果必填属性没有在入参中体现，商品发布会报错

- 
属性间关联必填基于合规的要求，当商品中填写了A属性，则B属性也要求必填（B属性原本可能是非必填）关联必填的规则，目前没有接口对外透出。在发布商品时，会通过报错体现，请引导商家按照报错提示调整。报错规范如下

### 
3.4 确认属性值的输入方式

属性值的输入方式主要依赖
attribute_mode字段，
但也有一些特殊情况，详见下方表格

判断方式
属性值的入参方式
​商家后台的操作界面

​attribute_mode=0（手工输入值）
由商家自定义属性值，仅支持录入正整数，尺码属性中常见。

在商品发布接口中，不需要入参attribute_value_id，将属性值入参至attribute_extra_value

"size_attribute_list": [

    {

      "attribute_id": 85,

      "attribute_extra_value": "100",

      "relate_sale_attribute_id": 87,

      "relate_sale_attribute_value_id": 1006040

    }

  ]

​​attribute_mode=1（下拉多选）
​下拉多选。商品属性中常见。

如果商家在属性A下选择多个属性值，在商品发布接口中，需要传多组attribute_id、attribute_value_id的数据。不可以在attribute_value_id中传数组。多选的上限值，通过attribute_input_num判断。

"product_attribute_list": [{

      "attribute_id": 31,

      "attribute_value_id": 501

    },

    {

      "attribute_id": 31,

      "attribute_value_id": 565

    }]

​​​attribute_mode=2（下拉单选，销售属性专用）
下拉单选。只有销售属性才会出现此输入类型。

​​​​attribute_mode=3（下拉单选）
下拉单选。商品属性中常见。

在商品发布接口中，某个attribute_id只能有一组数据

​attribute_mode=4（下拉多选+手工输入）
下拉多选+手工输入。商品属性中常见。

即在商品发布接口中，可传多组attribute_id、attribute_value_id、attribute_extra_value。

常见于数量+单位，例如属性值为单位（双/件），输入数值后，就组成N双。

​​​​​attribute_mode=4 （下拉多选+手工输入）且 attribute_type=3（成分属性）
这类成分属性比较特殊。常见于服装材质成分、日用品涂层成分等。

属性A下可以选属性值a,b,c，每个属性值需要手动输入正整数，
A下的a,b,c三者输入值需相加等于100
。业务上定义就是三者加起来是100%。

"product_attribute_list": [

    {

      "attribute_id": 1000105,

      "attribute_value_id": 63,

      "attribute_extra_value": "50"

    },

    {

      "attribute_id": 1000105,

      "attribute_value_id": 1000145,

      "attribute_extra_value": "50"

    }

  ]

### 
3.5 如何添加自定义属性值

如果平台提供的属性值无法满足需求，可尝试添加自定义属性值，具体流程如下：

- 
先确认属性是否可以添加自定义属性值：
/open-api/goods/get-custom-attribute-permission-config
。若属性的has_permission=1，则可以自定义属性值

- 
通过接口添加属性值：
/open-api/goods/add-custom-attribute-value
。记录下创建成功的attribute_value_id

- 
在商品发布接口中，使用创建好的attribute_value_id

### 
3.6 特别说明：尺码属性

场景
入参示例
商家后台操作界面

商品只有主销售属性时，尺码属性不用关联次销售属性
"size_attribute_list": [

    {

      "attribute_id": 85,

      "attribute_extra_value": "100"

    }

商品有次销售属性时，尺码属性需要关联次销售属性。尺码属性作为横轴，次销售属性作为纵轴，填写组合值。例如：尺码属性宽度，次销售属性尺寸=S/M/L，则会填写S的宽度、M的宽体、L的宽度
"size_attribute_list": [

    {

      "attribute_id": 85,

      "attribute_extra_value": "100",

      "relate_sale_attribute_id": 87,

      "relate_sale_attribute_value_id": 1006040

    }

## 解决方案 / 自运营解决方案 / 商品自定义属性值

- Page ID：`a0f9bf6a-bc89-4a6d-a25f-385cca93f866`
- 路径：`https://open.sheincorp.com/documents/system/a0f9bf6a-bc89-4a6d-a25f-385cca93f866`

# 
销售属性的自定义属性值新方案

# 
适用范围

- 
适用的应用类型：自运营、半托管、全托管、POP

- 
上述类型的应用均可使用新方案

- 
2025年12月1日后创建的应用，必须使用新方案

- 
2025年12月1日前创建的旧应用，可按需对接新方案

# 
新旧方案对比

对比项
旧方案
新方案

数据结构
销售属性的自定义属性值和分类绑定。

自定义属性值【例如：小码】如果想在多个分类下使用，则需在每个分类下创建attribute value id，然后一一对应放在对应分类下使用。

销售属性的自定义属性值和分类解绑，和商家绑定

自定义属性值【例如小码】创建一次后，可以在多个分类下使用。

接口调用流程
场景1：创建新的自定义属性值

查询商家的分类A下有哪些销售属性支持自定义属性值

→ 若支持，则在分类A下，为可自定义的属性创建自定义属性值，获取attribute_value_id

→ 发布/编辑分类A的商品时，在销售属性中下入参attribute_value_id

场景2：使用已创建的自定义属性值

查询店内全量可用属性值

→ 找到is_custom_attribute_value=true的attribute_value_id

→ 发布/编辑商品时，销售属性中入参获取的attribute_value_id
场景1：创建新的自定义属性值

查询商家的分类A下有哪些销售属性支持自定义属性值

→ 若支持，则发布/编辑分类A的商品时，可自定义的销售属性中入参自定义属性值的custom_attribute_value即可，不需要attribute_value_id

场景2：使用已创建的自定义属性值

和场景1相同的操作流程。

系统会对所有自定义属性值去重，即内容一致代表是同一个自定义属性值；且自定义属性值和分类不再关联。只要分类可自定义属性值，就可用店内所有自定义属性值。

商家自定义属性值数量上限
1万
3万

优劣
劣势：商家可用自定义属性值数量少；查询可用属性接口速度慢
优势：商家可用自定义属性值数量增加；查询可用属性接口速度加快

# 

# 
新方案对接方式

### 
1 对接流程

2025年12月1日前创建的应用，在新方案对接完成后，需要联系开放平台，告知上线的应用ID和上线时间。开放平台需要将您的应用进行配置，以确保使用应用的商家全部切换至新方案中。

### 
2 接入说明

#### 
第1步：查询销售属性是否支持自定义属性值
【重要】

- 
平台对于自定义属性值的功能管控颗粒度是【商家+分类+属性】，必须按此逻辑确认属性是否支持自定义属性值。

- 
例如商家1和商家2，均可使用分类A，；分类A下有两个销售属性，S1和S2。在平台的管控下可能出现以下情况

- 
商家1的分类A下的销售属性S1可自定义属性值，S2不可以

- 
商家2的分类A下，S1和S2都不可以自定义属性值

- 
请通过此接口来确认属性是否可自定义：
/open-api/goods/get-custom-attribute-permission-config

- 
"has_permission": 1，代表支持自定义属性值

Example

curl --location --request POST 'https://openapi-test01.sheincorp.cn/open-api/goods/get-custom-attribute-permission-config' \
--header 'x-lt-signature: test0ZWYwZGY5N2VjM2M1ZmNkOGI1NDU0M2VjMTM3NWNiNDk0ZjhmY2E3NThkM2NkMzdkM2VjYzEyNGY5Y2QzN2NhNQ==' \
--header 'x-lt-openKeyId: EED6AEEA6B4741EF94D29FED5A1CE76F' \
--header 'x-lt-timestamp: 1753841948096' \
--header 'language: en' \
--header 'User-Agent: Apifox/1.0.0 (https://apifox.com)' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--header 'Host: openapi-test01.sheincorp.cn' \
--header 'Connection: keep-alive' \
--data-raw '{
  "category_id_list": [
    20039881
  ]
}'

----------------------------------------------------------------------------

响应
{
    "code": "0",
    "msg": "OK",
    "info": {
        "data": [
            {
                "has_permission": 1,
                "last_category_id": 20039881,
                "attribute_id": 2147484187
            },
            {
                "has_permission": 1,
                "last_category_id": 20039881,
                "attribute_id": 2147484186
            }
        ],
        "meta": {
            "count": 2,
            "customObj": null
        }
    },
    "bbl": null,
    "traceId": "84de1e85727ee683"
}

#### 
第2步：发布/编辑商品时通过custom_attribute_value字段创建自定义属性值

- 
发布/编辑商品接口：/open-api/goods/product/publishOrEdit

- 
只有支持自定义属性值的销售属性，可以通过发布接口中custom_attribute_value字段创建自定义属性值。发布接口中涉及自定义属性值的入参字段
（红色加粗）
见下表，表格下方有请求、响应示例

​字段名
字段名
字段名
字段名
​字段类型
是否必填
字段描述

skc_list
object[]
是
skc列表

sale_attribute
是
skc销售属性

attribute_id
int64
是
销售属性ID

attribute_value_id
int64
否
销售属性值ID（平台提供值/通过添加自定义属性接口获取的值）

custom_attribute_value
string
否
商家的自定义销售属性值。

仅在销售属性ID支持自定义属性值时，才可在此字段内入参。

属性值要求：字符数50以内；支持半角符号，不可输入全角符号；不支持unicode，检验表达式可参考：String emojiPattern = "[\\uD83C-\\uDBFF\\uDC00-\\uDFFF\\u2600-\\u27ff]"

​language
string
否
自定义属性值的语种。

支持的语种：en、zh-cn、fr、es、it。如果ERP不传多语言内容，平台会做系统翻译。

sku_list
​
object[]
是
sku列表

​sale_attribute_list
object[]
是
销售属性列表

​
attribute_id
int64
是
销售属性ID

attribute_value_id
int64
否
销售属性值ID（平台提供值/通过添加自定义属性接口获取的值）

custom_attribute_value
string
否
商家的自定义销售属性值。

仅在销售属性ID支持自定义属性值时，才可在此字段内入参。

属性值要求：字符数50以内；支持半角符号，不可输入全角符号；不支持unicode，检验表达式可参考：String emojiPattern = "[\\uD83C-\\uDBFF\\uDC00-\\uDFFF\\u2600-\\u27ff]"

language
string
否
自定义属性值的语种。

支持的语种：en、zh-cn、fr、es、it。如果ERP不传多语言内容，平台会做系统翻译。

size_attribute_list
object[]
否
尺码属性列表

attribute_id
int64
是
属性ID

attribute_extra_value
string
否
属性值。尺码属性均为手动输入，在此入参。支持正数，最多2位小数

relate_sale_attribute_id
int64
否
关联的次销售属性ID（只可入参sku维度销售属性）

relate_sale_attribute_value
string
否
关联的次销售属性属性值。

自定义属性值的场景需要在此入参，入参内容必须和销售属性中填写的属性值一模一样。

relate_sale_attribute_value_id
int64
否
关联的次销售属性属性值。非自定义属性值场景在此入参

sale_attribute_sort_list
object[]
否
销售属性自定义排序

attribute_id
int64
是
属性名ID

in_order_attribute_value_id_list
int64[]
否
排好序的属性值ID列表。如果属性下无自定义属性值，可用这个字段。

in_order_attribute_value_list
object[]
否
排好序的属性值ID/自定义属性值备注列表。

如果属性下有自定义属性值，需用这个字段，属性值用哪个形式就入参下面的哪个字段，按排序输入即可。

attribute_value_id
int64
否
属性值ID

custom_attribute_value
string
否
自定义属性值的内容。入参内容必须和销售属性中填写的属性值一模一样
。

 {
  "category_id": 20039919,
  "product_type_id": 2147503231,
  "multi_language_name_list": [
    {
      "language": "en",
      "name": "name"
    }
  ],
  "supplier_code": "34543345655",
  "site_list": [
    {
      "main_site": "shein",
      "sub_site_list": [
        "shein-us"
      ]
    }
  ],
  "is_spu_pic": "false",
  "suit_flag": "0",
  "size_attribute_list":[
    {
      "attribute_id":" 7",
      "attribute_extra_value":11,
      "relate_sale_attribute_id":"2147484186",
      "relate_sale_attribute_value":"custom attribute value for SKU 0911"
    }
  ],
  "sale_attribute_sort_list":[
        {
          "attribute_id":"2147484187",
          "in_order_attribute_value_list":[
            {
              "custom_attribute_value":"custom attribute value for SKC 0911"
            },
            {
              "attribute_value_id":2147488295
            }
          ]
        },
                {
          "attribute_id":"2147484186",
          "in_order_attribute_value_list":[
            {
              "custom_attribute_value":"custom attribute value for SKU 0911"
            },
              {
              "attribute_value_id":2147488283
            }
          ]
        }
      ],
  "sample_info":{
    "sample_spec":{
        "main_spec":{
            "attribute_id":"2147484187",
            "attribute_value_name":"custom attribute value for SKC 0911"
        },
        "sub_spec_list":[
            {
                 "attribute_id": "2147484186",
                 "attribute_value_id":"2147488295"
            },
            {
                "attribute_id":"2147484186",
                "attribute_value_name":"custom attribute value for SKU 0911"
            }
        ]
    },
     "sample_judge_type":2,
     "reserve_sample_flag":2,
     "spot_flag":2
  },
  "skc_list": [
    {
      "sale_attribute": {
        "attribute_id": 2147484187,
        "custom_attribute_value":"custom attribute value for SKC 0911",
        "language":"en"
      },
      "image_info": {
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "site_detail_image_info_list": [
        {
          "image_info_list": [
            {
              "image_sort": 1,
              "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
            }
          ],
          "site_abbr_list": [
            "shein-us"
          ]
        }
      ],
      "proof_of_stock_list": [
        {
          "file_name": "fd",
          "type": "1",
          "url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
        }
      ],
      "sku_list": [
        {
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "custom_attribute_value":"custom attribute value for SKU 0911",
              "language":"en"
            }
          ],
          "price_info_list": [
            {
              "base_price": 334,
              "currency": "USD",
              "special_price": 35,
              "sub_site": "shein-us"
            }
          ],
          "stock_info_list": [
            {
              "inventory_num": 1
            }
          ],
          "supplier_sku": "36636565623",
          "mall_state": 1,
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1"
        }
      ],
      "supplier_code": "4564880035",
      "suggested_retail_price": {
        "currency": "USD",
        "price": 34
      }
    },
    {
      "sale_attribute": {
        "attribute_id": 2147484187,
        "attribute_value_id":"2147488295"
      },
      "image_info": {
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "site_detail_image_info_list": [
        {
          "image_info_list": [
            {
              "image_sort": 1,
              "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
            }
          ],
          "site_abbr_list": [
            "shein-us"
          ]
        }
      ],
      "proof_of_stock_list": [
        {
          "file_name": "fd",
          "type": "1",
          "url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
        }
      ],
      "sku_list": [
        {
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id":"2147488283"
            }
          ],
          "price_info_list": [
            {
              "base_price": 334,
              "currency": "USD",
              "special_price": 35,
              "sub_site": "shein-us"
            }
          ],
          "stock_info_list": [
            {
              "inventory_num": 1
            }
          ],
          "supplier_sku": "365650023",
          "mall_state": 1,
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1"
        }
      ],
      "supplier_code": "45667800835",
      "suggested_retail_price": {
        "currency": "USD",
        "price": 34
      }
    }
  ]
}

#### 
第3步：查询商品详情

- 
查询接口：/open-api/goods/spu-info

- 
商品的自定义销售属性值在此接口中，会给出属性值的内容以及value id。涉及字段包括：skcInfoList - attributeId、attributeMultiList、attributeValueId、attributeValueMultiListskuInfoList - saleAttributeListdimensionAttributeAdditionList -relateSaleAttributeValueId

{
    "code": "0",
    "msg": "OK",
    "info": {
        "spuName": "c250905438333",
        "categoryId": 20039919,
        "productTypeId": 2147503231,
        "brandCode": "",
        "supplierCode": "4545880035",
        "productMultiNameList": [
            {
                "productName": "Bennie For Custom Attribute 0905",
                "language": "en"
            }
        ],
        "productMultiDescList": [
            {
                "productDesc": "",
                "language": "en"
            }
        ],
        "productAttributeInfoList": [
            {
                "attributeId": 2147484186,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Size",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147488283,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "30*20",
                        "language": "en"
                    }
                ],
                "attributeValue": null
            },
            {
                "attributeId": 2147484187,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Color",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147488294,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "Mustard",
                        "language": "en"
                    }
                ],
                "attributeValue": null
            },
            {
                "attributeId": 2147484186,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Size",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147489739,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "custom attribute value for SKU",
                        "language": "en"
                    }
                ],
                "attributeValue": null
            }
        ],
        "dimensionAttributeInfoList": [
            {
                "attributeId": 7,
                "attributeMultiList": [
                    {
                        "attributeName": "Bag Width66 (1cm)",
                        "language": "en"
                    }
                ],
                "dimensionAttributeAdditionList": [
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147488283,
                        "additionValue": "1"
                    },
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147489739,
                        "additionValue": "2"
                    }
                ]
            },
            {
                "attributeId": 15,
                "attributeMultiList": [
                    {
                        "attributeName": "Bottoms Length (cm)",
                        "language": "en"
                    }
                ],
                "dimensionAttributeAdditionList": [
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147488283,
                        "additionValue": "1"
                    },
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147489739,
                        "additionValue": "2"
                    }
                ]
            },
            {
                "attributeId": 29,
                "attributeMultiList": [
                    {
                        "attributeName": "Cuff (cm)",
                        "language": "en"
                    }
                ],
                "dimensionAttributeAdditionList": [
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147488283,
                        "additionValue": "1"
                    },
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147489739,
                        "additionValue": "2"
                    }
                ]
            }
        ],
        "spuImageInfoList": null,
        "skcInfoList": [
            {
                "skcName": "sc25090543833308995",
                "supplierCode": "4545880035",
                "sampleInfo": {
                    "sampleCode": "",
                    "reserveSampleFlag": 0,
                    "spotFlag": 0,
                    "sampleJudgeType": 2
                },
                "productMultiNameList": [
                    {
                        "productName": "Bennie For Custom Attribute 0905",
                        "language": "en"
                    }
                ],
                "attributeId": 2147484187,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Color",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147489740,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "custom attribute value for SKC",
                        "language": "en"
                    }
                ],
                "skuInfoList": [
                    {
                        "skuCode": "I41m0y0swjql",
                        "supplierSku": "366485454623",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "366485454623",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147489739,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "custom attribute value for SKU",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 334.0,
                                "specialPrice": 35.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    },
                    {
                        "skuCode": "I41m1jlbevlc",
                        "supplierSku": "45345345",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "45345345",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147488283,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "30*20",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 33.0,
                                "specialPrice": 23.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    }
                ],
                "shelfStatusInfoList": [
                    {
                        "siteAbbr": "shein-us",
                        "shelfStatus": 1,
                        "lastShelfTime": "2025-09-05 14:00:06",
                        "firstShelfTime": "2025-09-05 14:00:06",
                        "lastUpdateTime": "2025-09-05 14:00:06",
                        "link": "https://us.shein.com/Bennie-For-Custom-Attribute-0905-p-54645646522692-cat-4913127337.html"
                    }
                ],
                "recycleInfoList": null,
                "skcImageInfoList": [
                    {
                        "groupCode": "G21ja2yef1mm",
                        "imageItemId": 2148036234,
                        "imageType": "MAIN",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 1
                    },
                    {
                        "groupCode": "G21ja2yef1mm",
                        "imageItemId": 2148036235,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 2
                    },
                    {
                        "groupCode": "G21ja2yef1mm",
                        "imageItemId": 2148036236,
                        "imageType": "SQUARE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 3
                    },
                    {
                        "groupCode": "G21ja2yef1mm",
                        "imageItemId": 2148036237,
                        "imageType": "PIECE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 4
                    }
                ],
                "siteDetailImageInfoList": null,
                "proofOfStockInfoList": [],
                "srpPriceInfo": {
                    "currency": "USD",
                    "srpPrice": 34.0
                }
            },
            {
                "skcName": "sc25090543833396934",
                "supplierCode": "4545880035",
                "sampleInfo": {
                    "sampleCode": "",
                    "reserveSampleFlag": 0,
                    "spotFlag": 0,
                    "sampleJudgeType": 2
                },
                "productMultiNameList": [
                    {
                        "productName": "Bennie For Custom Attribute 0905",
                        "language": "en"
                    }
                ],
                "attributeId": 2147484187,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Color",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147488295,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "Navy",
                        "language": "en"
                    }
                ],
                "skuInfoList": [
                    {
                        "skuCode": "I41m0y0syo5g",
                        "supplierSku": "3655435436523",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "3655435436523",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147488283,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "30*20",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 334.0,
                                "specialPrice": 35.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    },
                    {
                        "skuCode": "I41m1jlbh70p",
                        "supplierSku": "45345",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "45345",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147489739,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "custom attribute value for SKU",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 33.0,
                                "specialPrice": 23.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    }
                ],
                "shelfStatusInfoList": [
                    {
                        "siteAbbr": "shein-us",
                        "shelfStatus": 1,
                        "lastShelfTime": "2025-09-05 14:00:06",
                        "firstShelfTime": "2025-09-05 14:00:06",
                        "lastUpdateTime": "2025-09-05 14:00:06",
                        "link": "https://us.shein.com/Bennie-For-Custom-Attribute-0905-p-54645646522693-cat-4913127337.html"
                    }
                ],
                "recycleInfoList": null,
                "skcImageInfoList": [
                    {
                        "groupCode": "G21m0y2n7hfw",
                        "imageItemId": 2148036238,
                        "imageType": "MAIN",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 1
                    },
                    {
                        "groupCode": "G21m0y2n7hfw",
                        "imageItemId": 2148036239,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 2
                    },
                    {
                        "groupCode": "G21m0y2n7hfw",
                        "imageItemId": 2148036240,
                        "imageType": "SQUARE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 3
                    },
                    {
                        "groupCode": "G21m0y2n7hfw",
                        "imageItemId": 2148036241,
                        "imageType": "PIECE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 4
                    }
                ],
                "siteDetailImageInfoList": [
                    {
                        "imageGroupCode": "G41j8kjqvt7w",
                        "imageInfoList": [
                            {
                                "imageItemId": 1147541301,
                                "imageSort": 1,
                                "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
                            }
                        ],
                        "siteInfoList": [
                            {
                                "channel": "",
                                "mainSite": "shein",
                                "site": "shein-us"
                            }
                        ]
                    }
                ],
                "proofOfStockInfoList": [],
                "srpPriceInfo": {
                    "currency": "USD",
                    "srpPrice": 34.0
                }
            },
            {
                "skcName": "sc25090543833306711",
                "supplierCode": "4545880035",
                "sampleInfo": {
                    "sampleCode": "",
                    "reserveSampleFlag": 0,
                    "spotFlag": 0,
                    "sampleJudgeType": 2
                },
                "productMultiNameList": [
                    {
                        "productName": "Bennie For Custom Attribute 0905",
                        "language": "en"
                    }
                ],
                "attributeId": 2147484187,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Color",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147488294,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "Mustard",
                        "language": "en"
                    }
                ],
                "skuInfoList": [
                    {
                        "skuCode": "I41m1jlbjmfa",
                        "supplierSku": "5345354354",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "5345354354",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147489739,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "custom attribute value for SKU",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 33.0,
                                "specialPrice": 23.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    },
                    {
                        "skuCode": "I41m1jlbirjp",
                        "supplierSku": "435344545",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "435344545",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147488283,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "30*20",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 33.0,
                                "specialPrice": 23.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    }
                ],
                "shelfStatusInfoList": [
                    {
                        "siteAbbr": "shein-us",
                        "shelfStatus": 0,
                        "lastShelfTime": "2018-08-28 00:00:00",
                        "firstShelfTime": "1970-01-01 08:00:01",
                        "lastUpdateTime": "2025-09-05 14:16:27",
                        "link": "https://us.shein.com/Bennie-For-Custom-Attribute-0905-p-54645646522710-cat-4913127337.html"
                    }
                ],
                "recycleInfoList": null,
                "skcImageInfoList": [
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036302,
                        "imageType": "MAIN",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/a7/1757052939fe552dac89a2f5d12503e7afff826dbe_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/a7/1757052939fe552dac89a2f5d12503e7afff826dbe_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/a7/1757052939fe552dac89a2f5d12503e7afff826dbe.jpg",
                        "sort": 1
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036303,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/62/1757052939de92a781e416b49f1d299c1489a94d71_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/62/1757052939de92a781e416b49f1d299c1489a94d71_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/62/1757052939de92a781e416b49f1d299c1489a94d71.jpg",
                        "sort": 2
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036304,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/53/1757052939be6a4855caf38d4045211ca2fd081d59_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/53/1757052939be6a4855caf38d4045211ca2fd081d59_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/53/1757052939be6a4855caf38d4045211ca2fd081d59.jpg",
                        "sort": 3
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036305,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/df/1757052939abdf9d03aaeae017c715bbf69efef417_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/df/1757052939abdf9d03aaeae017c715bbf69efef417_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/df/1757052939abdf9d03aaeae017c715bbf69efef417.jpg",
                        "sort": 4
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036306,
                        "imageType": "SQUARE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/1e/175705293940f3cb182c3d04df3a2d17ca84c0b4d2_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/1e/175705293940f3cb182c3d04df3a2d17ca84c0b4d2_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/1e/175705293940f3cb182c3d04df3a2d17ca84c0b4d2.jpg",
                        "sort": 5
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036307,
                        "imageType": "PIECE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/p/pi/2025/09/05/65/175705293910d4d904ed8af6396c39f713758a10ef_thumbnail_405x552.png",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/p/pi/2025/09/05/65/175705293910d4d904ed8af6396c39f713758a10ef_thumbnail_220x293.png",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/p/pi/2025/09/05/65/175705293910d4d904ed8af6396c39f713758a10ef.png",
                        "sort": 6
                    }
                ],
                "siteDetailImageInfoList": null,
                "proofOfStockInfoList": [],
                "srpPriceInfo": {
                    "currency": "USD",
                    "srpPrice": 33.0
                }
            }
        ]
    },
    "bbl": null,
    "traceId": "d8d37306e13e15f6"
}

### 
3 测试店铺

测试调用域名：https://openapi-test01.sheincorp.cn

openKey：EED6AEEA6B4741EF94D29FED5A1CE76F

secretKey：35D01D988EBA46FB9D87CA066FFD1805

### 
4 常见FAQ

Q:：商家切换为新的属性方案后，无法从查询属性接口中获得自定义属性值的attribute value id，如需使用可以从哪里获取？

A：可以通过查询SPU详情接口/open-api/goods/spu-info获取，此接口中会返回自定义属性值的value id

## 解决方案 / 自运营解决方案 / 商品图片

- Page ID：`4d96fc8f-4913-4211-8630-5d81e7fcc010`
- 路径：`https://open.sheincorp.com/documents/system/4d96fc8f-4913-4211-8630-5d81e7fcc010`
- 简介：介绍商品发布、查询场景中的商品图片使用方式

# 
商品图片

# 
1 方案概述

## 
1.1 适用范围

本文档适用于所有类型的应用。

## 
1.2 业务说明

应用需要发布或编辑商品时，会使用到商品图片，可通过此文档确认图片上传、管理方式。

商品图片上传主要包含3个步骤：确认商品的图片上传要求、生成图片URL、将URL发布到商品中。

## 
1.3 调用概览

## 
1.4 API清单

API名称
API & 文档地址

查询商品发布字段规范
/open-api/goods/query-publish-fill-in-standard

转换图片成SHEIN可用的图片
/open-api/goods/transform-pic

本地图片上传
/open-api/goods/upload-pic

商品发布&编辑
/open-api/goods/product/publishOrEdit

查询商品
/open-api/goods/spu-info

# 
2 详细步骤

## 
2.1 商品图片方案概览

 
SHEIN的商品图片有新旧方案

    旧方案：仅支持SKC、SKU传图

    
新方案：支持SPU、SKC、SKU上传图片。但不同商品类目传图要求不同，因此新方案中又有多套方案

商品图片名称
旧方案
新方案A
新方案B
发布商品 接口中的图片类型
图片规格要求

SPU层
商品轮播图
X
选填，1张
必填，上限11张
单张时：1-主图，最多1张

多张时：1-主图，必传，最多1张

               2-细节图必传，最多10张
● 像素1340px*1785px；或宽高比例1:1，像素范围900px-2200px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

方形图
X
X
必填，1张
5-方块图
● 像素1200px*1200px 

● 格式JPG/JPEG/PNG

● 大小≤3MB

SKC层
主图
必填，1张
必填，1张
必填，1张
1-主图
● 像素1340px*1785px；或宽高比例1:1，像素范围900px-2200px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

细节图
必填，上限10张
必填，上限10张
X
2-细节图

方形图
必填，1张
必填，1张
X
5-方块图
● 宽高比例1:1，像素900*900~2200*2200 px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

色块图
单skc非必填

多skc必填
单skc非必填

多skc必填
单skc非必填

多skc必填
6-色块图
● 宽高比例1:1，像素80×80 px 

● 格式JPG/JPEG/PNG

● 大小≤3MB

站点详情图
非必填，最多10张
非必填，最多10张
非必填，最多10张
不需传类型
● 宽高比例3:4，像素大于900px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

SKU层
SKU图
选填，1张

若skc下有1个sku传图，则skc下所有sku都要传图
选填，1张

若skc下有1个sku传图，则skc下所有sku都要传图
选填，1张

若skc下有1个sku传图，则skc下所有sku都要传图
1-主图
● 像素1340px*1785px；或宽高比例1:1，像素范围900px-2200px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

## 
2.2 步骤1：确认商品图片上传要求

 ● 
接口地址：
/open-api/goods/query-publish-fill-in-standard

 ● 
通过接口获取商品的图片上传要求时

     ○ 
必需入参"category_id"，因为不同类目的图片要求不同

     ○ 
必须按商家维度查询上传要求，同类目下不同商家的图片要求不同

 ● 
根据返回参数确定图片要求，返回参数主要有2种形态

### 
旧方案判断方式

 ● 
当"picture_config_list"中只有1个"field_key": "switch_spu_picture"时，代表类目走旧方案传图，只在SKC维度传图即可。

 ● 
旧方案下，商品发布接口中的"is_spu_pic"需要传false

{
    "picture_config_list": [
        {
            "field_key": "switch_spu_picture",
            "is_true": false
        }
    ]
}

### 
新方案判断方式

 ● 
当"picture_config_list"中包含很多"field_key"时，代表类目走新方案传图。具体传什么图、传几张，需多个字段结合起来一起看，可参考下方表格。

   
 注意：2025年9月开始所有商品都支持上传SKU图片，此接口中不会再返回"field_key": "sku_image_detail_show", "field_key": "sku_image_detail_required",

 ● 
新方案下，商品发布接口中的"is_spu_pic"需要传true

新方案A返回示例：

{
    "picture_config_list": [
        {
            "field_key": "switch_spu_picture",
            "is_true": false
        },
        {
            "field_key": "spu_image_detail_show",
            "is_true": true
        },
        {
            "field_key": "spu_image_detail_required",
            "is_true": false
        },
        {
            "field_key": "spu_image_detail_single",
            "is_true": true
        },
        {
            "field_key": "spu_image_square_show",
            "is_true": false
        },
        {
            "field_key": "spu_image_square_required",
            "is_true": false
        },
        {
            "field_key": "skc_image_detail_show",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_required",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_single",
            "is_true": false
        },
        {
            "field_key": "skc_image_square_show",
            "is_true": true
        },
        {
            "field_key": "skc_image_square_required",
            "is_true": true
        }
    ]
}

新方案B的响应示例
{
    "picture_config_list": [
        {
            "field_key": "switch_spu_picture",
            "is_true": false
        },
        {
            "field_key": "spu_image_detail_show",
            "is_true": true
        },
        {
            "field_key": "spu_image_detail_required",
            "is_true": true
        },
        {
            "field_key": "spu_image_detail_single",
            "is_true": false
        },
        {
            "field_key": "spu_image_square_show",
            "is_true": true
        },
        {
            "field_key": "spu_image_square_required",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_show",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_required",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_single",
            "is_true": true
        },
        {
            "field_key": "skc_image_square_show",
            "is_true": false
        },
        {
            "field_key": "skc_image_square_required",
            "is_true": false
        }
    ]
}
字段名
字段说明
商品发布接口中的传图说明

switch_spu_picture
入参查询的SPU，当前是否已用新方案传图。

没有入参SPU时，此值都是false。
此字段在商品发布场景不用关注，编辑场景需关注。

spu_image_detail_show
spu轮播图是否展示
SPU轮播图，单张/多张的传图方式不同 

● 单张时，1-主图必传，最多1张

● 多张时，1-主图必传，最多1张；2-细节图必传，最多10张

spu_image_detail_required
spu轮播图否必填

spu_image_detail_single
spu轮播图是否单张

spu_image_square_show
spu方形图是否展示
SPU方形图，仅1张，所以无是否单张的字段 

● 必填时，5-方形图必传

spu_image_square_required
spu方形图是否必填

skc_image_detail_show
skc细节图是否展示
SKC细节图，单张/多张的传图方式不同

● 单张时，1-主图必传，最多1张

● 多张时，1-主图必传，最多1张；2-细节图必传，最多10张

skc_image_detail_required
skc细节图是否必填

skc_image_detail_single
skc细节图是否单张

skc_image_square_show
skc方形图是否展示
SKC方形图，仅1张，所以无是否单张的字段 

● 必填时，5-方形图必传

skc_image_square_required
skc方形图是否必填

## 
2.3 步骤2：获取图片URL

 ● 
所有上传的图片必须先转换成SHEIN的图片URL，提供两种方式：本地图片上传、转换在线图片

### 
本地图片上传

 ● 
接口地址：
/open-api/goods/upload-pic

 ● 
请求示例

--form 'image_type="2"' \ --form 'file=@"/Users/10027511/Documents/1068*455.png"
 ● 
返回示例

{
    "code": "0",
    "msg": "OK",
    "info": {
        "image_url": "http://imgdeal-test01.shein.com/images3_pi/2023/11/15/3c/17000397694031071724_square.jpg",
        "width": 1200,
        "height": 1200,
        "size": 363846,
        "image_hex_type": "jpg"
    },
    "bbl": null
}

### 
转换在线图片

 ● 
接口地址：
/open-api/goods/transform-pic

● 
接口限流为20次/秒，请注意控制调用频次

 ● 
请求示例

{
    "image_type": 2,
    "original_url": "http://imgdeal-test01.shein.com/images3_pi/2023/11/15/fe/17000325694031071724_square.jpg"
}
 ● 
返回示例

{
    "code": "0",
    "msg": "OK",
    "info": {
        "original": "http://imgdeal-test01.shein.com/images3_pi/2023/11/15/fe/17000325694031071724_square.jpg",
        "transformed": "https://imgdeal-test01.shein.com/images3_pi/2024/05/23/db/17164580272759534094.jpeg",
        "failure_reason": ""
    },
    "bbl": null
}

## 
2.4 步骤3：上传图片发布商品

 ● 
商品发布中上传图片，主要关注以下字段

     ● 
is_spu_pic：
是否为新方案传图，true=新方案；false=旧方案

     ● 
image_info：此对象在SPU、SKU、SKC都有，且对象下的字段逻辑一致，字段逻辑见下方表格。具体什么层级传多少图，按步骤2中获取的图片要求传图即可。

字段
字段
字段
说明

image_info

image_group_code
图片组编码，由SHEIN生成。商品发布场景不用传，编辑场景要传

image_info_list
图片列表

image_type
图片类型：1-主图,2-细节图,5-方块图,6-色块图

image_sort
图片序号：主图必须排序为1，其他依次排序

image_item_id
图片唯一id，由SHEIN生成。商品发布场景不用传，编辑场景要传

image_url
图片链接

## 
2.5 其他场景：查询商品图片

 ● 
接口地址：
/open-api/goods/spu-info

 ● 
查询接口返回的图片类型是
"string"
，查询返回的枚举值 和 上传图片的枚举值对应关系如下所示

商品发布接口的图片类型
商品查询详情的图片类型

1-主图
MAIN

2-细节图
DETAIL

5-方块图
SQUARE

6-色块图
PIECE

 ● 查询的返回示例

{
    "spuImageInfoList": [
        {
            "groupCode": "G140qbzchcil",
            "imageItemId": 2147609257,
            "imageType": "MAIN",
            "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/05/21/1b/17162749351136466060_square_thumbnail_405x552.jpeg",
            "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/05/21/1b/17162749351136466060_square_thumbnail_220x293.jpeg",
            "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/05/21/1b/17162749351136466060_square.jpeg",
            "sort": 1
        }
    ]
}

# 
3 关联阅读

    
商品发布-全托管

    
商品发布-半托管

    
商品发布-自运营

## 解决方案 / 自运营解决方案 / 商品证书

- Page ID：`a4c9a5c4-75db-4f99-bbaf-0e47b34bda80`
- 路径：`https://open.sheincorp.com/documents/system/a4c9a5c4-75db-4f99-bbaf-0e47b34bda80`
- 简介：该解决方案用于上传商品证书，适用于管理自主运营、代运营和半托管商家的证书管理

# 
商品证书

# 
1 方案概述

## 
适用范围

- 
本文档适用于【应用类型=自运营/半托管/全托管/POP】的应用。

- 
商品证书解决的是商品在海外市场中销售时，遇到的合规/法务问题。

## 
业务说明

部分商品在销售到海外时，需提供商品的资质证书或者检测报告，用于证明商品质量符合市场当地要求。例如销售至欧洲的儿童玩具，需提供玩具检测报告。

因此SHEIN在商品发布时，会基于商品信息要求商家提供相关证书。若商家无法提供证书，商品会有无法正常销售的风险。

SHEIN中的商品合规信息主要有以下3类。此解决方案中的接口可覆盖证书报告、自符声明这两类（在下文中用商品证书来指代），责任/代理公司需使用另一套接口实现，详见
方案

- 
证书报告：由机构或公开组织提供的证明或报告，用于证明商品质量符合当地要求。

- 
自符声明：销售婴童、玩具类商品的卖家，可签署声明协议，确保商品符合美国法规要求。

- 
责任/代理公司：销售至欧洲、美国、英国的商品需申报代理公司，代理公司可理解为销售资质的一种，商品需和代理公司绑定，否则可能影响销售。

商品证书的基础概念

- 
SHEIN管理了多种证书类型，比如燃烧检测报告、化妆品重金属报告等。每个证书类型需要提供什么信息都由平台决定。

- 
店铺内可上传多个证书，同类型的证书也可上传多个。每上传一个证书就会生成一个证书池（虽然名为证书池，但一个证书池内只有一个证书）

- 
每个商品需要提供的证书类型由平台决定，可能是0个，也可能是多个，商家需按要求为商品绑定对应类型的证书。

## 
调用概览

# 
2 详细步骤

## 
2.1 确认商品需绑定哪些类型的证书

SHEIN会根据商品信息和销售市场来判定，商品是否需要提供证书、需要提供哪些类型的证书。这个信息可通过接口查询：
/open-api/goods/get-certificate-rule
，此接口的使用方式有2种，参考下方

方式1：查询某SPU缺失哪些证书

- 
使用场景：商品发布成功后生成SPU A，查询SPU A需绑定的证书类型，明确他当前缺失的证书类型。若必填证书是缺失状态，则引导商家补充对应证书，否则会影响商品上下架状态。

- 
入参：必需提供"spuName"

- 
出参：先找到缺失状态的证书类型：certificateMissStatus=true再判断缺失的证书类型是否为必传，若必传则建议商家补充证书：isRequired=true最后明确必传且缺失的证书类型的类型id，去查询证书类型需要哪些信息，最终创建证书：certificateTypeId其他情况：当某类型证书的certificateMissStatus=false时，代表SPU已绑定此类证书，会在出参中的certificatePoolList字段中看到绑定证书池的具体内容

方式2：查询某商品分类的证书绑定要求

- 
使用场景：在商品发布前预先让商家创建证书，基于商品分类可查到分类维度的证书要求。

- 
入参：必需提供"categoryId"

- 
出参：确认证书类型的管控站点范围：mergeSiteInfoList。若需要精确知道此店铺在此分类下需提供哪些证书，需要先查询店铺可上架站点范围，将两个站点范围匹配后得出最终需上传找到要求的证书类型的类型id，去查询证书类型需要哪些信息，最终创建证书：certificateTypeId

## 
2.2 查询证书所需材料&创建证书

创建某类型的证书之前，需先查询此类型证书需要提交哪些信息。

此部分会说明，创建接口、查询接口之间的出入参关系。适用于普通/自符证书、商品/店铺维度证书。

- 
通过接口查询证书材料：
/open-api/goods/certificate/get-all-certificate-type-list-v2
。接口会返回平台所有证书类型的信息，找到你需要的证书类型certificateTypeId

- 
确认此类型证书的适用范围：

- 
certificateDimensioncertificateDimension=1，即适用部分商品，商品维度证书，创建证书时需使用接口：
/open-api/goods/save-or-update-certificate-pool

- 
certificateDimension=2，即适用全部商品，店铺维度证书，创建证书时需使用接口：
/open-api/goods/save-or-update-supplier-certificate

- 
根据证书材料要求开始创建证书，证书信息主要有2部分

- 
证书文件

- 
即报告或证明的图片/PDF文件内容。每个证书都有且必须提供1个证书文件。

- 
创建证书接口中，文件入参字段名

- 
certificateUrl，需要通过接口上传文件后获取：
/open-api/goods/upload-certificate-file

- 
certificateUrlName，由开发者自定义值

- 
证书字段

- 
即证书相关的描述信息。不同证书类型所需要的证书字段不同。

- 
创建证书接口中，证书字段相关入参字段名如下

- 
certificateRelationInfoList：字段列表

- 
certificateRelationNameId：即字段名ID，取查询接口中 presetInfoList → presetId

- 
certificateRelationValueId：即字段的值的ID值。当字段的输入方式inputType=1/2（从可选项中选择）时，将选择的ID值入参至此，取查询接口中 presetInfoList → presetValueList → presetValueId

- 
certificateRelationValue：即字段的值。当字段的输入方式inputType=3/4（自定义值场景）时，需要将自定义值入参至此。

- 
otherCertificateRelationInfoList：其他字段列表（拆分2个字段列表，没有实际业务意义，开发者不用关注，只要根据下方逻辑入参即可）

- 
certificateRelationNameId：即字段名ID，取查询接口中 otherPresetInfoList → presetId

- 
certificateRelationValueId：

- 
当otherPresetInfoList - sourceFrom=SRM（一套特殊的检测结构列表数据）时，取查询接口中的 srmDetectionAgencyList - detectionAgencyId（检测机构id）

- 
当otherPresetInfoList - sourceFrom≠SRM时，当字段的输入方式inputType=1/2时，取查询接口中 otherPresetInfoList → presetValueList → presetValueId

- 
certificateRelationValue

- 
当otherPresetInfoList - sourceFrom=SRM时，取查询接口中的 srmDetectionAgencyList - laboratoryId（实验室id）

- 
当otherPresetInfoList - sourceFrom≠SRM时，当字段的输入方式inputType=3/4（自定义值场景）时，需要将值入参至此。

- 
创建成功后会生成一个证书池certificatePoolId，后续证书池需要和SKC绑定。（虽然名称为池，但实际一个证书池中只有一个证书）。

### 
不同场景的入参示例

创建店铺维度证书

curl --location --request POST 'https://openapi.sheincorp.com/open-api/goods/save-or-update-supplier-certificate' \
--header 'x-lt-signature: test' \
--header 'x-lt-openKeyId: test' \
--header 'x-lt-timestamp: 1751010644959' \
--header 'language: zh-cn' \
--header 'Content-Type: application/json' \
--header 'Host: openapi.sheincorp.com' \
--data-raw '{
    "certificateTypeId": 135,
    "certificateUrl": "https://pqms-1259571579.cos.ap-nanjing.myqcloud.com/gpc202401111845086.jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240111T020804Z&X-Amz-SignedHeaders=host&X-Amz-Expires=431999&X-Amz-Credential=AKIDIPGrBE0VjgOpztXu1sSmqnY5NPBiz1nJ/20240111/ap-nanjing/s3/aws4_request&X-Amz-Signature=b4d6b45148b51c934bed41e0547b7c586737d7bf71061dc4475eabfe77f420a3", // 此值通过/open-api/goods/upload-certificate-file获取
    "certificateUrlName": "16952760533746985150.jpeg"  // 此值自定义
}'

创建商品维度证书 — 不涉及srm检测机构

curl --location --request POST 'https://openapi.sheincorp.com/open-api/goods/save-or-update-certificate-pool' \
--header 'x-lt-signature: test' \
--header 'x-lt-openKeyId: test' \
--header 'x-lt-timestamp: 1751459666380' \
--header 'language: zh-cn' \
--header 'Content-Type: application/json' \
--header 'Host: openapi.sheincorp.com' \
--data-raw '{
  "certificateRelationInfoList": [
    {
      "certificateRelationNameId": 175,
      "certificateRelationValue": "2025-01-01 00:00:00",
      "certificateRelationValueId": ""
    }
  ],
  "certificateTypeId": 21,
  "certificateUrl": "https://lt-pqms.oss-cn-shenzhen.aliyuncs.com/gpc2913387912766705664.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20250702T123051Z&X-Amz-SignedHeaders=host&X-Amz-Expires=432000&X-Amz-Credential=LTAI5tKvGuVMaYLBaMkpkiBr/20250702/oss-cn-shenzhen/s3/aws4_request&X-Amz-Signature=bdf3d7c5ebc2ee7df574fd144773639dcdc231b0e036d675138e8905e11daf7b",
  "certificateUrlName": "test.jpeg",
  "otherCertificateRelationInfoList": []
}'

创建商品维度证书 — 涉及srm检测机构

curl --location --request POST 'https://openapi.sheincorp.com/open-api/goods/save-or-update-certificate-pool' \
--header 'x-lt-signature: test' \
--header 'x-lt-openKeyId: test' \
--header 'x-lt-timestamp: 1751459491635' \
--header 'language: zh-cn' \
--header 'Content-Type: application/json' \
--header 'Host: openapi.sheincorp.com' \
--data-raw '{
  "certificateRelationInfoList": [
    {
      "certificateRelationNameId": 175,
      "certificateRelationValue": "2025-01-01 00:00:00",
      "certificateRelationValueId": ""
    }
  ],
  "certificateTypeId": 7,
  "certificateUrl": "https://lt-pqms.oss-cn-shenzhen.aliyuncs.com/gpc2913387912766705664.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20250702T123051Z&X-Amz-SignedHeaders=host&X-Amz-Expires=432000&X-Amz-Credential=LTAI5tKvGuVMaYLBaMkpkiBr/20250702/oss-cn-shenzhen/s3/aws4_request&X-Amz-Signature=bdf3d7c5ebc2ee7df574fd144773639dcdc231b0ut036d675138e8905e11daf7b",
  "certificateUrlName": "pdf",
  "otherCertificateRelationInfoList": [
    {
      "certificateRelationNameId": 183,
      "certificateRelationValue": "4000515", //取查询证书材料接口中的 srmDetectionAgencyList - laboratoryId（实验室id）
      "certificateRelationValueId": "2380882" // 取查询证书材料接口中的 srmDetectionAgencyList - detectionAgencyId（检测机构id）
    }
  ]
}'

## 
2.3 绑定商品和证书

店铺维度的证书池会自动和商品绑定，只有商品维度证书需要手动绑定。

证书池需和SKC进行绑定，因此若SPU需要绑定A、B两个类型的证书，则SPU下的所有SKC都需要操作绑定。绑定时提交

curl --location --request POST 'https://openapi.sheincorp.com/open-api/goods/save-certificate-pool-skc-bind' \
--header 'x-lt-signature: test' \
--header 'x-lt-openKeyId: test' \
--header 'x-lt-timestamp: 1751010761337' \
--header 'language: zh-cn' \
--header 'Content-Type: application/json' \
--header 'Host: openapi.sheincorp.com' \
--data-raw '{
  "skcCertificatePoolRelationList": [
    {
      "spuName": "s2409195445",
      "skcName": "ss24091954454649",
      "certificatePoolIdList": [
        9867,
        9817
      ]
    },
    {
      "spuName": "s2409199897",
      "skcName": "ss24091998977394",
      "certificatePoolIdList": [
        9867,
        9817
      ]
    }
  ]
}'

## 
2.4 确认绑定的审核结果

绑定证书后，SHEIN平台会对本次绑定进行审核。审核结果可通过接口查询：
/open-api/goods/get-certificate-rule

- 
入参：提供商品spuName、绑定的证书池certificatePoolId

- 
出参：通过certificatePoolList - auditStatus判断审批结果

- 
查询接口的维度是SPU，但审核维度是SKC。当SPU下有多个SKC时，只有当SKC全部审核通过时，SPU维度才会返回审核通过。

## 解决方案 / 自运营解决方案 / 商品合规

- Page ID：`af751fbf-0a24-484a-98fe-377654bd62d7`
- 路径：`https://open.sheincorp.com/documents/system/af751fbf-0a24-484a-98fe-377654bd62d7`

# 
商品合规

# 
方案概述

- 
若商品需销往欧盟、美国、英国等地区，商家需按当地要求提供相关证明。此方案会介绍如何将证明提供给平台。

- 
此方案适用于所有类型的应用。

# 
业务流程

目前API层支持2个合规场景：

- 
商品绑定代理公司：可覆盖GPSR欧盟责任人、美国代理、英国代理、制造商

- 
商品上传标签实拍图：可覆盖欧洲的环保、GPSR等标签要求

# 
调用概览

类型
名称
文档

API
查询代理公司列表
/open-api/goods-compliance/agency-list

API
查询SKC的代理公司绑定要求
/open-api/goods-compliance/skc-agency-detail

API
绑定SKC和代理公司
/open-api/goods-compliance/save-skc-agency

API
查询SKC的实拍图要求
/open-api/goods-compliance/skc-label-list

API
打印合规标签
/open-api/goods-compliance/label-print

API
上传实拍图图片
/open-api/goods-compliance/upload-skc-label-picture

API
绑定SKC和实拍图
/open-api/goods-compliance/skc-save-label

# 
具体场景

## 
商品绑定代理公司

步骤1：查询已申报的代理公司

- 
目前API不支持申报代理公司，需商家先通过商家后台手动完成申报。

- 
通过接口可查询到商家已申报的代理公司信息，接口地址：
/open-api/goods-compliance/agency-list

- 
代理公司相关的重要字段和规则：

- 
哪些代理公司是有效的，可以和商品绑定的？agencyStatus=0，且applyStatus=1/2的代理公司

字段名
字段说明

agencyId
代理公司ID。

后续商品绑定代理公司时会使用。

agencyType
代理公司类型：0-欧盟责任人；1-英国代理；2-美国代理；3-制造商。

后续商品绑定代理公司时会使用。

agencyStatus
代理公司的协议生效状态：0-生效中，1-已过期，2-未生效。

applyStatus
代理公司申报状态：0-待补充；1-待审核（商家后台此状态会展示申报成功）；2-申报成功；3-审核失败。

coveredProductRange
代理公司可覆盖的商品范围：1-全部商品；2-部分商品。

范围=“全部商品”时，系统会默认所有SKC都绑定该公司，即有新增发品不需要再次单独绑定；

范围=““部分商品”时，需要商家自行绑定SKC和公司的关系。

步骤2：查询商品需要绑定哪些类型的代理公司

- 
不是所有商品都需要绑定代理公司，需绑定公司的商品可能需绑定多个类型的代理公司。平台会根据商品类目、销售地区等信息，判断出哪些商品需要绑定哪些类型的代理公司。商家需按要求提供，若无法及时提供，会导致商品无法上架或被强制下架。

- 
通过接口可查询到哪些商品需要绑定哪些代理公司，以及当前商品的公司绑定状态，接口地址：
/open-api/goods-compliance/skc-agency-detail

- 
建议将商品必须绑定的代理公司全部绑定，以避免商品异常，操作方法如下：

- 
入参：
查询商品有哪些必要绑定信息：isRequired=1

- 
出参：

- 
找到SKC下未绑定或绑定失败的代理公司，稍后进行绑定：reviewState=1/3

- 
确认SKC需要绑定的代理公司类型agencyType，然后从步骤1中获得的已申报的代理公司中，找到相同type且有效的agencyId

步骤3：绑定商品和代理公司

- 
通过接口绑定，接口地址：
/open-api/goods-compliance/save-skc-agency

- 
绑定时使用的agencyId、agencyType，需要从步骤1中获取。

## 
商品上传标签实拍图

步骤1：查询商品的实拍图上传要求

- 
实拍图上传的是商品实物图片、商品包装上贴标的图片。图片中需要体现出各地区对参数、环保、GPSR相关要求的信息要素。

- 
不是所有商品都需要上传实拍图，需传图的商品在实拍图中需要展示的信息有很多类型。上传图片后系统会扫描图片自动识别信息，若图片中未包含指定信息的话，实拍图绑定失败，会导致商品无法上架或被强制下架。

- 
通过接口可查询到哪些商品需要在实拍图中体现哪些信息元素，以及当前商品的实拍图绑定状态，接口地址：
/open-api/goods-compliance/skc-label-list

- 
建议将商品必须绑定的信息要素全部拍摄并上传，以避免商品异常，操作方法如下

- 
入参：
查询商品有哪些必要绑定信息：isRequired=1

- 
出参：

- 
找到SKC下实拍图中未绑定成功的信息，稍后进行绑定：reviewState=0/3。注意：reviewState=1是待审核，此状态在商家后台展示为申报成功。实拍图是异步审核，所以上传后展示申报成功，异步发现失败后才变成失败状态。可对接消息通知及时发现审核失败。

- 
确认SKC需要在实拍图中体现的信息，将他们都打印成标签：labelName

步骤2：打印商品标签

- 
基于SKC，打印出SKC可打印的所有标签。平台会预设一批标签模板，如果预设模板不符合预期，商家需通过商家后台手动绘制标签模板，然后再通过API打印。

- 
打印接口地址：
/open-api/goods-compliance/label-print

步骤3：上传实拍图图片

- 
标签打印后贴到商品包装上，拍摄实拍图后需先上传图片。实拍图有单独的图片上传API，请不要使用商品发布中的图片上传接口。

- 
上传图片接口地址：
/open-api/goods-compliance/upload-skc-label-picture

步骤4：绑定商品和实拍图

- 
实拍图绑定在SKC维度。每个SKC可绑定多张实拍图，最多15张。图片长宽均不能超过8000px、大小不超过10M，支持png/jpeg/jpg格式。

- 
绑定接口：
/open-api/goods-compliance/skc-save-label

## 

## 
监听商品绑定的合规信息失效

- 
此消息目前可监听的场景

- 
SKC绑定的代理公司失效：主要由代理公司自身失效导致，如代理有效期到期。失效后，和代理公司有绑定关系的SKC均会发出失效的通知。

- 
SKC上传的实拍图失效：主要由于实拍图审核失败导致，实拍图非实时审核。

- 
消息地址： 
https://open.sheincorp.com/documents/msgdoc/detail/3001095
 

complianceTypeId
信息类型

1
欧盟代理公司

3
实拍图

## 解决方案 / 自运营解决方案 / 合规证书-警告语

- Page ID：`105b8e3e-5e33-43fe-8848-a9e54fe7c7ea`
- 路径：`https://open.sheincorp.com/documents/system/105b8e3e-5e33-43fe-8848-a9e54fe7c7ea`

# 
合规证书-警告语

# 

# 
1、方案概述

### 
适用范围

服务欧洲、英国市场商家的自运营、半托管、全托管类型应用，可对接此解决方案。

警告语证书覆盖范围

- 
站点：欧盟、英国

- 
品类：目前主要为婴童用品类商品

上述范围内的商品，若没有提供必传的警告语证书，可能会无法上架。

# 
2、调用说明

### 
填写规则介绍

警告语内容由平台预先配置，基于商家选择的商品信息自动生成，商家无法自行输入警告语内容。

例如图片中的【母婴喂养用品警告语】。商家需要选产品属性，若他选了【玻璃容器】，则提示内容（警告语）字段中会自动出现和【玻璃容器】关联的所有警告语（可能是1个或多个）。同时产品属性字段中的值，可能存在互斥。

### 
第1步：查询警告语填写规则

- 
调用接口：
/open-api/goods-compliance/query-warning-certificate-rules

- 
接口返回的是所有需商家手动操作的警告语证书。平台中还有自动的警告语证书，无需商家处理，这类证书不会返回。此接口建议每周调用一次，确保获取平台最新的配置数据。

- 
出参使用说明

字段名
字段名
字段名
字段名
字段名
说明

certificateTypeId
证书类型ID

certificateTypeCode
证书类型Code，唯一编码。后续查询、更新SKC警告语时均会使用。

certificateTypeName
证书类型名称

presetInfo​
证书字段信息

isEnabled
字段信息是否启用。0-禁用；1-启用

​
presetFields
​
​
字段详情

​
fieldCode
​
字段Code，唯一编码。

​
fieldName
​
字段名称，支持返回多语言。

​
fieldType
​
字段值的输入方式。

0=多选;1=单选;2=手动输入（实际上还是多选）

​
fieldSort
​
字段排序。

重要：排序值最大的字段是警告语字段，警告语字段逻辑和常规字段不同。

isEnabled
字段是否启用。0-禁用；1-启用

presetFieldValues
​
字段值信息

fieldValueId
​
字段值ID，唯一编码。

fieldValue
​
字段值名称，支持返回多语言。

valueSort
字段值排序

​isEnabled
字段值是否启用。0-禁用；1-启用

exclusionFieldValueIds
​
常规字段专用，互斥的字段值列表。

若常规字段值A下有互斥值B、C，则当商家选A时，BC均不能选。

mappingPaths
警告语字段专用，警告语组装规则

fieldValueIds
警告语关联的常规字段值fieldValueId列表。

若警告语值a关联了常规字段值A、B，则当商家选了A或B中的任意值时，警告语字段中都需要传入a。

### 
查询SKC的警告语绑定情况

- 
调用接口：
/open-api/goods-compliance/query-skc-warning-status

- 
入参重点：接口必须入参分页信息、证书类型编码certificateTypeCodes。目前平台没有警告语证书的标识，只能通过具体的certificateTypeCode来识别哪些是警告语，因此建议先查询警告语填写规则接口，获取到全量的警告语证书code，将他们入参至此以确保查出的结果全是警告语的绑定数据。

- 
出参重点：需关注一下2个字段isRequired：是否必传。必传证书建议上传，否则会影响上架。reviewState：证书审核状态。若审核驳回，建议重新上传，否则会影响上架。

### 
更新SKC的警告语

- 
调用接口：
/open-api/goods-compliance/update-skc-warning-certificate

- 
此接口覆盖创建、更新场景。支持对多个SKC进行相同警告语证书的批量更新。

- 
入参重点

- 
警告语证书中所有的字段均需要入参，包括警告语字段。

- 
警告语字段的值需要完全匹配商家对于常规字段的选择结果，否则会更新失败。

- 
警告语字段的fieldType通常是2（手动输入），但实际在API入参中，入参方式是多选，即fieldValues中需要提供fieldValueId

- 
下面是一个警告语证书的构建示例

查询警告语填写规则-出参
更新SKC的警告语-入参

{

    "certificateTypeId": 754,

    "certificateTypeCode": "PlaypenWMWAttr",

    "certificateTypeName": "Game Bed Warning",

    "presetInfo": {

        "isEnabled": 1,

        "presetFields": [

            {

                "fieldName": "产品属性",

                "fieldType": 0,

                "fieldCode": "PAWA1",

                "fieldSort": 0,

                "isEnabled": 1,

                "presetFieldValues": [

                    {

                        "fieldValueId": 2455,

                        "fieldValue": "玻璃容器",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": null,

                        "valueSort": 0,

                        "isEnabled": 1

                    },

                    {

                        "fieldValueId": 2458,

                        "fieldValue": "产品带奶嘴",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": null,

                        "valueSort": 1,

                        "isEnabled": 1

                    }

                ]

            },

            {

                "fieldName": "警告语",

                "fieldType": 2,

                "fieldCode": "WAContent",

                "fieldSort": 1,

                "isEnabled": 1,

                "presetFieldValues": [

                    {

                        "fieldValueId": 2457,

                        "fieldValue": "警告语：使用本产品时必须有成人监护.",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": [

                            {

                                "fieldValueIds": [

                                    2455

                                ]

                            },

                            {

                                "fieldValueIds": [

                                    2458

                                ]

                            }

                        ],

                        "valueSort": 0,

                        "isEnabled": 1

                    },

                    {

                        "fieldValueId": 2456,

                        "fieldValue": "警告：严禁将喂食奶嘴用作安抚奶嘴。",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": [

                            {

                                "fieldValueIds": [

                                    2455

                                ]

                            },

                            {

                                "fieldValueIds": [

                                    2458

                                ]

                            }

                        ],

                        "valueSort": 1,

                        "isEnabled": 1

                    },

                    {

                        "fieldValueId": 2454,

                        "fieldValue": "警告：玻璃容器可能破裂。",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": [

                            {

                                "fieldValueIds": [

                                    2455

                                ]

                            }

                        ],

                        "valueSort": 2,

                        "isEnabled": 1

                    }

                ]

            }

        ]

    }

}

{

    "certificateTypeCode": "PlaypenWMWAttr",

    "fieldList": [

        {

            "fieldCode": "PAWA1",    // 常规字段：产品属性

            "fieldValues": [

                {

                    "fieldValueId": 2458   //即属性值：产品带奶嘴

                }

            ]

        },

        {

            "fieldCode": "WAContent",     // 警告语字段

            "fieldValues": [

                {

                    "fieldValueId": 2457     // 此警告语值的mappingPaths中包含2458产品带奶嘴，所以需要入参此值

                },

                {

                    "fieldValueId": 2456      // 此警告语值的mappingPaths中包含2458产品带奶嘴，所以需要入参此值

                }

            ]

        }

    ],

    "skcNames": [

        "s24102107079376"

    ]

}

## 解决方案 / 自运营解决方案 / 商品批量处理

- Page ID：`04fdafe8-9bb7-4fac-bf47-b1f45c859371`
- 路径：`https://open.sheincorp.com/documents/system/04fdafe8-9bb7-4fac-bf47-b1f45c859371`

## 
背景概要：

SHEIN 开放平台的 Feed API 允许批量发布和更新产品列表。卖家或开发者可以通过 Feed API 以更程序化的方式发布或修改大量产品信息。该 API 支持批量数据的导入和导出（JSON文件），满足开发者一次性处理大规模商品数据的需要，其中 JSON 文件最大支持 100MB。

## 

## 
Feed实现场景：

功能点
说明
Feed_Type
上线情况

商品发布/商品更新
新增或编辑商品；主要场景有新增skc/sku（复色加码）、更新商品图片、更新名称/标题、类目变更等
PRODUCT_LISTING
目前已上线

更新商品库存和价格
更新商品的库存/价格
POST_PRODUCT_PRICING_QUATITY_DATA
目前已上线

更新商品库存
更新商品的库存
UPDATE_PRODUCT_SELLABLE_STOCK
目前已上线

更新商品状态
更新商品的上下架（以SKC为维度）
MODIFY_PRODUCT_SKC_SHELF
目前已上线

如果你有任何Feed相关的API问题或者需求，欢迎联系 
nerowang@shein.com

## 
Feed业务流程：

## 
Feed API 调用流程：

Feed API总共包含5个API接口，以下是ERP调用SHEIN Feed API的推荐流程：

调用接口前准备
：调用Feed接口之前，
ERP 需要完成以下准备工作
：

     a) 
获取长期密钥，该密钥用于调用Feed API接口；开发者可查询店铺授权相关文档：
店铺授权文档

     b) 
【建议】获取商品发布要求模板

            商家运营进入SHEIN商家后台下载商品发布模板；
不同类目所需信息各不相同，请访问以下链接获取适用的模板

            后台地址：
https://sellerhub.shein.com/#/spmp/commdities/batchAdd

     c) 
确保字段映射

         ● 
ERP 需做好业务字段与 SHEIN 平台字段的映射。

         ● 
例如，若运营想发布一件黑色衣服，ERP 需要获取 SHEIN 平台销售属性的 ID，如：颜色的 ID 为 27；黑色的 ID 为 112，开发者通过接口获取这些 ID，并按照平台要求的 JSON 格式设置相关参数，属性传参示例：

{
	"attributeId": 27, //27代表销售属性为颜色
	"attributeValueId": 112 //112代表销售属性值为黑色
}
        有关更多商品发布流程的详细信息，请查看
商品解决方案

步骤一：创建Feed文件

通过调用
/open-api/sem/feed/createFeedDocument
接口，创建JSON文件，
平台目前仅支持“application/json”格式
。返回参数会显示JSON的文件的名称及
用于上传feed内容的接口URL。

 

步骤二：上传Feed文件内容（JSON内容）

通过调用
/open-api/sem/feed/uploadDocumentContent
接口，将商家的商品信息根据业务要求转化成JSON格式，并更新到指定的JSON文件中。

步骤三：校验Feed文档是否上传成功（不是必须接的）

通过调用
/open-api/sem/feed/getFeedDocument
接口，获取JSON文件信息，该步骤主要是用于检查是否已经成功上传文件内容。

步骤四：创建Feed任务

 
通过调用
/open-api/sem/feed/createFeed
接口，平台根据入参的Feed处理类型（feedType）对指定的JSON文件进行处理。

 ● 
例如，若希望上传商品，则在创建Feed的时候设置处理文件方式，即"feedType": "PRODUCT_LISTING"。创建成功后，SHEIN平台将调用商品发布接口，将商品信息同步到SHEIN平台

 ● 
目前平台支持的Feed任务类型，以及版本值

任务类型
feedType
version

商品发布/商品更新
PRODUCT_LISTING
传V2

更新商品价格
POST_PRODUCT_PRICING_DATA
传V1

更新商品库存
UPDATE_PRODUCT_SELLABLE_STOCK
传V1

更新商品状态
MODIFY_PRODUCT_SKC_SHELF
传V1

SHEIN 接收请求并根据Feed类型开始处理JSON文件，接口result字段会返回查询结果数据的标识。通过标识，ERP可以在
/open-api/sem/feed/getFeed
接口查看文件的状态和文件处理结果。

步骤五：获取Feed处理结果文件（重要）

调用
/open-api/sem/feed/getFeed
 可以查看
Feed的任务状态和
处理结果。
处理结果的 URL 可以通过 
resultDocumentUrl
 获取

Feed 状态的枚举值：

 ● 
IN_QUEUE：排队中；说明文件在等待处理中；仅该状态的Feed任务可以取消

 ● 
IN_PROGRESS：进行中；说明文件正在处理中

 ● 
FATAL：致命错误；说明文件验证失败

 ● 
DONE：
完成；说明文件已经处理完毕，
返回处理的JSON文件，ERP可通过url获取
。

获取文件处理结果的关键字段示例： 
"resultDocumentUrl": "https://ssmp-openapi.oss-cn-shenzhen.aliyuncs.com/openapi-sem/2024-10-25/21613915_10_359_17298584717301157959690244.json?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=LTAI5tRoCW5YFGVY6MxxWKBM%2F20241102%2Fcn-shenzhen%2Fs3%2Faws4_request&X-Amz-Date=20241102T005904Z&X-Amz-Expires=1800&X-Amz-SignedHeaders=host&X-Amz-Signature=bfbc1fd2d2c042df5e1915cf422a440ec0b64a2916b35a902243cfcdf54ca7df"
 ● 
CANCELLED：已取消；说明Feed任务已被取消

## 
接口出入参说明：

### 
1、创建Feed文件：

接口地址：
/open-api/sem/feed/createFeedDocument

入参：

{
	"contentType": "application/json"
}
出参：

{
	"code": "0",
	"msg": "OK",
	"info": {
		"result": {
			"feedDocumentId": "openapi-sem/2024-11-01/38109445_10_424_173046915600848a506224cce4.json",
			"url": "http://openapi-test01.sheincorp.cn/open-api/sem/feed/uploadDocumentContent" //上传文件的接口地址，该接口地址不会变更
		}
	},
	"bbl": null,
	"traceId": "619963d53fadcc21"
}

### 
2、
上传Feed文件：

接口地址：
/open-api/sem/feed/uploadDocumentContent

查询参数：在接口中增加参数，请求参数不在body里面，示例如下：

/open-api/sem/feed/uploadDocumentContent?feedDocumentId=MzgxMDk0NDVfMTBfNDI0XzE3MzM1NDQxMzkyMTY=.json
出参：

{
	"code": "0",
	"msg": "OK",
	"info": null,
	"bbl": null,
	"traceId": "ff4ab44d11bd319d"
}
关于JSON的示例，请查看本文目录《JSON示例》，注意：每个JSON文件最大100M；

### 
3、
验证Feed文件是否上传成功：

接口地址：
/open-api/sem/feed/getFeedDocument

查询参数：在接口中增加参数，请求参数不在body里面，示例如下：

/open-api/sem/feed/getFeedDocument?feedDocumentId=MzgxMDk0NDVfMTBfNDI0XzE3MzM1NDQxMzkyMTY=.json
出参：

{
	"code": "0",
	"msg": "OK",
	"info": {
		"result": {
			"feedDocumentId": "MzgxMDk0NDVfMTBfNDI0XzE3MzM1NDQxMzkyMTY=.json",
			"url": "https://ssmp-openapi.oss-cn-shenzhen.aliyuncs.com/MzgxMDk0NDVfMTBfNDI0XzE3MzM1NDQxMzkyMTY%3D.json?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=LTAI5tRoCW5YFGVY6MxxWKBM%2F20241207%2Fcn-shenzhen%2Fs3%2Faws4_request&X-Amz-Date=20241207T063926Z&X-Amz-Expires=1800&X-Amz-SignedHeaders=host&X-Amz-Signature=f4f7d126bad44e6a3d195f938fbb51d24e455bd242976cb0c350b6e028b41ec1"
		}
	},
	"bbl": null,
	"traceId": "e81b64a20c0419d9"
}
⚠️注意：
url是1小时有效，如超时请重新调用接口获取

## 
4、
创建Feed任务：

接口地址：
/open-api/sem/feed/createFeed

入参：

{
	"feedDocumentId": "MzgxMDk0NDVfMTBfNDI0XzE3MzM1NDQxMzkyMTY=.json",
	"feedType": "PRODUCT_LISTING",
	"version": "V2" //PRODUCT_LISTING传"V2"，其它类型传"V1"
}
出参：

{
	"code": "0",
	"msg": "OK",
	"info": {
		"result": 1865289089032323072
	},
	"bbl": null,
	"traceId": "5ec8a3225d111eca"
}

## 
 5、 
获取Feed文件：

接口地址：
/open-api/sem/feed/getFeed

入参：form-data

key
Value

feed_id
1849789420770537472

出参：

{
	"code": "0",
	"msg": "OK",
	"info": {
		"result": {
			"feedId": 1849789420770537472,
			"feedType": "PRODUCT_LISTING",
			"createdTime": "2024-10-25 20:25:40",
			"processingStatus": "CANCELLED",
			"processingStartTime": "2024-12-07 14:56:01",
			"processingEndTime": "2024-12-07 14:56:02",
			"resultFeedDocumentId": "MzgxMDk0NDVfMTBfNDI0XzE3MzM1NDQxMzkyMTY=.json",
			"resultDocumentUrl": "https://ssmp-openapi.oss-cn-shenzhen.aliyuncs.com/openapi-sem/2024-10-25/21613915_10_359_17298584717301157959690244.json?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=LTAI5tRoCW5YFGVY6MxxWKBM%2F20241102%2Fcn-shenzhen%2Fs3%2Faws4_request&X-Amz-Date=20241102T005904Z&X-Amz-Expires=1800&X-Amz-SignedHeaders=host&X-Amz-Signature=bfbc1fd2d2c042df5e1915cf422a440ec0b64a2916b35a902243cfcdf54ca7df"
		}
	},
	"bbl": null,
	"traceId": "4b1404e5bc8ce847"
}
⚠️注意：
url是1小时有效，如超时请重新调用接口获取

## 
6、
取消FEED任务：

接口地址：
/open-api/sem/feed/cancelFeed

入参：form-data

key
Value

feedId
1865289089032323072

出参：

{
	"code": "openapi-sem031011",
	"msg": "feed in wrong status",
	"info": null,
	"bbl": null,
	"traceId": "aef8df7efdbf4231"
}

## 
JSON示例：

### 
商品发品 示例如下： 

feedType: PRODUCT_LISTING

1、示例说明

{
  "processKey": "spu 1",
  "data": {
    "categoryId": "6110", // 必填；通过店铺可用类目接口获取
    "brandCode": "254p8", // 必填；通过店铺可用品牌接口获取
    "productDescList": [
      {
        "language": "en",
        "productDesc": "100% Cotton. Design: Alien, Floral, Logo, Swirl. 100% Officially Licensed. Characters: Hamm."
      }
    ],
    "productNameList": [
      {
        "language": "en",
        "productName": "Floral All-Over Print Bucket Hat (Multicolored)"
      }
    ],
    "productAttributeList": [
      {
        "attributeExtraValue": "1",
        "attributeId": 1000411,
        "attributeValueId": 1002451
      },
      {
        "attributeId": 160,
        "attributeValueId": 278
      }
    ], // 商品属性（attribute_type=4），attribute_status=3说明该字段为必填属性
    "sizeAttributeList": [
      {
        "attributeExtraValue": "10",
        "attributeId": 55,
        "relateSaleAttributeId": 87,
        "relateSaleAttributeValueId": 474
      },
      {
        "attributeExtraValue": "10",
        "attributeId": 66,
        "relateSaleAttributeId": 87,
        "relateSaleAttributeValueId": 474
      },
      {
        "attributeExtraValue": "10",
        "attributeId": 77,
        "relateSaleAttributeId": 87,
        "relateSaleAttributeValueId": 474
      },
      {
        "attributeExtraValue": "10",
        "attributeId": 88,
        "relateSaleAttributeId": 87,
        "relateSaleAttributeValueId": 474
      },
      {
        "attributeExtraValue": "10",
        "attributeId": 100,
        "relateSaleAttributeId": 87,
        "relateSaleAttributeValueId": 474
      }
    ],
    "skcList": [
      {
        "imageInfo": {
          "imageInfoList": [
            {
              "imageSort": 1,
              "imageType": 1,
              "imageUrl": "https://img.ltwebstatic.com/images3_spmp/2024/09/12/a6/1726084468befe998faa365a4d368cdc7d0fbe9585_square.jpg"
            },
            {
              "imageSort": 2,
              "imageType": 2,
              "imageUrl": "https://img.ltwebstatic.com/images3_spmp/2024/09/12/d9/1726084480c2809c20fb0602705de389c61b167457_square.jpg"
            },
            {
              "imageSort": 3,
              "imageType": 5,
              "imageUrl": "https://img.ltwebstatic.com/images3_spmp/2024/09/12/12/1726084473fd78f2e1a3eb674df8547bfcafa12e37.jpg"
            },
            {
              "imageSort": 4,
              "imageType": 6,
              "imageUrl": "https://img.ltwebstatic.com/images3_spmp/2024/09/12/14/1726084485254337bece6bee7189ea62a8ceccb712.jpg"
            }
          ]
        },
        "mainSaleAttribute": {
          "mainAttributeId": 27,
          "mainAttributeValueId": 447
        }, // 主销售属性（attribute_type=1，attribute_label=true），通过店铺可用属性获取
        "skuList": [
          {
            "mallState": 1, // 商城可销售，建议默认传1
            "height": "20",
            "productPriceList": [
              {
                "sellPrice": 50,
                "specialPrice": 48.5,
                "sellSite": "shein-us"
              }
            ],
            "saleAttributeList": [
              {
                "attribute_id": 87,
                "attribute_value_id": 474
              }
            ], // SKU属性，需通过接口获取相关属性id和属性值id
            "productStockList": [
              {
                "inventoryNum": 1000
              }
            ],
            "supplierSku": "I22e6q11ha0t",
            "weight": "10",
            "width": "10",
            "length": "10"
          }
        ]
      }
    ],
    "supplierCode": "Merchant Item Number01"
  }
}

2、字段说明

字段
描述
是否必填
备注

brandCode
店铺可用品牌
非必填
可通过店铺可用品牌接口获得

categoryId
店铺可用类目
必填
可通过店铺可用类目接口获得

productDescList
商品描述信息
必填
必传默认语种和商品描述默认语种通过商品发布字段规范获得

language
语种
必填

productDesc
商品描述
必填

productNameList
商品名称信息
必填
必传默认语种和商品名称默认语种通过商品发布字段规范获得

language
语种
必填

productName
商品名称
必填

productAttributeList
商品属性
根据接口判断是否必填
通过店铺可用属性接口获取商品属性信息如果接口表明商品属性必填，则发品需要传商品属性和属性值。商品属性：attribute_type=4属性值填写方式：根据attribute_mode判断；0: 手工填写参数；1:下拉列表选择(可多选);3:下拉列表选择(单选)4:下拉列表+手工填写参数

attributeExtraValue
自定义属性值
根据接口判断是否必填
attribute_mode=0或者4时要传参

attributeId
属性id
根据接口判断是否必填
通过店铺可用属性接口获取商品属性id当attribute_type=4时，数组中的attribute_id为商品属性id

attributeValueId
属性值id
根据接口判断是否必填
属性id下attribute_mode=1或者3时，需要查属性id下的可用属性值id进行传参

sizeAttributeList
尺码表属性
根据接口判断是否必填
通过店铺可用属性接口获取尺码表属性信息如果接口表明尺码表属性必填，则发品需要传尺码表属性和属性值。尺码表属性：attribute_type=2属性值填写方式：根据attribute_mode判断；0: 手工填写参数；1:下拉列表选择(可多选);3:下拉列表选择(单选)4:下拉列表+手工填写参数

attributeExtraValue
自定义属性值
根据接口判断是否必填
attribute_mode=0或者4时要传参

attributeId
属性id
根据接口判断是否必填
通过店铺可用属性接口获取尺码表属性id当attribute_type=2时，数组中的attribute_id为尺码表属性id

attributeValueId
属性值id
根据接口判断是否必填
属性id下attribute_mode=1或者3时，需要查属性id下的可用属性值id进行传参

relateSaleAttributeId
尺码表关联的销售属性
根据接口判断是否必填
即secondaryAttributeId；比如尺寸

relateSaleAttributeValueId
尺码表关联的销售属性值
根据接口判断是否必填
即secondaryAttributeValueId；比如S码

skcList
SKC信息
必填

imageInfo
图片列表
必填
图片上传规则，请看FAQ

imageInfoList
必填

imageSort
图片序号，不允许重复
必填

imageType
图片类型
必填
1-主图,2-细节图（最多10张）,5-方块图,6-色块图(色块图单skc非必填，多skc必填)

imageUrl
图片链接
必填
平台图片链接，不允许外部链接，通过图片链接转换接口将外部链接图片转平台图片

mainSaleAttribute
主销售属性信息
必填
通过店铺可用属性接口获取主销售属性id当attribute_type=1，attribute_label=1时，数组中的attribute_id为主销售属性id

mainAttributeId
主销售属性ID
必填
示例：27；代表颜色

mainAttributeValueId
主销售属性值ID
必填
示例：112；代表黑色

skuList
SKU信息
必填

height
高度-单位厘米
必填

length
长度-单位厘米
必填

width
宽度-单位厘米
必填

weight
重量-单位克
必填

mallState
销售状态
必填
SKU商城销售状态 1：在售/2：停售建议传1；如果传2，平台不会保存该sku的库存数量，库存数量会在商家后台显示为空

productPriceIList
SKU价格信息
必填

sellPrice
销售价格
必填

specialPrice
特价
非必填

sellSite
销售站点
必填
销售站点，可以通过查询站点和币种接口获取

saleAttributeList
次销售属性信息
非必填
通过店铺可用属性接口获取主销售属性id当attribute_type=1时，数组中的attribute_id可以是次销售属性id已在skc维度上传的属性，属性值，在sku维度不重复上传

attribute_id
次销售属性ID
非必填
示例：87；代表尺码

attribute_value_id
次销售属性值ID
非必填
示例：568；代表S

productStockIList
商品库存信息
必填

inventoryNum
商品总库存数
必填
商品总库存数，可以为0，审核失败的sku需要传库存，审核成功的sku不需要传库存；

merchantWarehouseId
商家仓库ID
必填
一个店铺有多个仓库，则该字段必填，可通过【商家仓库列表查询】API获取

supplierSku
商家SKU
必填
最多200个字符，一个商家sku只能对应一个平台sku；商家sku属于店铺唯一，不得重复

proofOfStockUrl
商品
条件必填
可通过【商品发布字段规范】接口确认是否必传

fileName
文件名称
条件必填

type
文件类型
条件必填
支持image、PDF格式文件，大小不超过3M，图片/文件总数不超过1个

url
链接
条件必填

supplierCode
商家货号
必填

 

### 
编辑商品示例如下：

feedType: PRODUCT_LISTING

1、示例说明

[
  {
    "processKey": "spu 1", // 行位符
    "data": {
      "categoryId": "6110", // 必填；通过店铺可用类目接口获取
      "brandCode": "254p8", // 必填；通过店铺可用品牌接口获取
      "productDescList": [
        {
          "language": "en",
          "productDesc": "100% Cotton. Design: Alien, Floral, Logo, Swirl. 100% Officially Licensed. Characters: Hamm."
        }
      ],
      "productNameList": [
        {
          "language": "en",
          "productName": "Floral All-Over Print Bucket Hat (Multicolored)"
        }
      ],
      "productAttributeList": [
        {
          "attributeExtraValue": "1",
          "attributeId": 1000411,
          "attributeValueId": 1002451
        },
        {
          "attributeId": 160,
          "attributeValueId": 278
        }
      ], // 商品属性（attribute_type=4），其中 attribute_status=3 表示为必填属性
      "sizeAttributeList": [
        {
          "attributeExtraValue": "10",
          "attributeId": 55,
          "relateSaleAttributeId": 87,
          "relateSaleAttributeValueId": 474
        },
        {
          "attributeExtraValue": "10",
          "attributeId": 66,
          "relateSaleAttributeId": 87,
          "relateSaleAttributeValueId": 474
        },
        {
          "attributeExtraValue": "10",
          "attributeId": 77,
          "relateSaleAttributeId": 87,
          "relateSaleAttributeValueId": 474
        },
        {
          "attributeExtraValue": "10",
          "attributeId": 88,
          "relateSaleAttributeId": 87,
          "relateSaleAttributeValueId": 474
        },
        {
          "attributeExtraValue": "10",
          "attributeId": 100,
          "relateSaleAttributeId": 87,
          "relateSaleAttributeValueId": 474
        }
      ],
      "skcList": [
        {
          "imageInfo": { 
            // 图片上传规范：https://open.sheincorp.com/en/documents/faq-detail/4
            "imageInfoList": [
              {
                "imageSort": 1,
                "imageType": 1,
                "imageUrl": "https://img.ltwebstatic.com/images3_spmp/2024/09/12/a6/1726084468befe998faa365a4d368cdc7d0fbe9585_square.jpg"
              },
              {
                "imageSort": 2,
                "imageType": 2,
                "imageUrl": "https://img.ltwebstatic.com/images3_spmp/2024/09/12/d9/1726084480c2809c20fb0602705de389c61b167457_square.jpg"
              },
              {
                "imageSort": 3,
                "imageType": 5,
                "imageUrl": "https://img.ltwebstatic.com/images3_spmp/2024/09/12/12/1726084473fd78f2e1a3eb674df8547bfcafa12e37.jpg"
              },
              {
                "imageSort": 4,
                "imageType": 6,
                "imageUrl": "https://img.ltwebstatic.com/images3_spmp/2024/09/12/14/1726084485254337bece6bee7189ea62a8ceccb712.jpg"
              }
            ]
          },
          "mainSaleAttribute": {
            "mainAttributeId": 27,
            "mainAttributeValueId": 447
          }, // 主销售属性，通过店铺属性接口获取（attribute_type=1，attribute_label=true）
          "skuList": [
            {
              "mallState": 1, // 商城可销售，建议默认传1
              "height": "20",
              "productPriceList": [
                {
                  "sellPrice": 50,
                  "specialPrice": 48.5,
                  "sellSite": "shein-us"
                }
              ],
              "skuCode": "SKU identifier generated by the platform", // 平台生成 SKU 标识符
              "saleAttributeList": [
                {
                  "attribute_id": 87,
                  "attribute_value_id": 474
                }
              ], // SKU 属性，每个店铺的可用属性和属性值需要通过接口获取
              "productStockList": [
                {
                  "inventoryNum": 1000
                }
              ],
              "supplierSku": "I22e6q11ha0t",
              "weight": "10",
              "width": "10",
              "length": "10"
            }
          ]
        }
      ],
      "supplierCode": "Merchant Item Number01", // 商家编号
      "spuName": "SPU identifier generated by the platform" // 平台生成 SPU 标识符
    }
  }
]

2、字段说明

字段
描述
是否必填
备注

spuName
平台生成的SPU Name
必填

brandCode
店铺可用品牌
非必填
可通过店铺可用品牌接口获得

categoryId
店铺可用类目
必填
可通过店铺可用类目接口获得

productDescList
商品描述信息
必填
必传默认语种和商品描述默认语种通过商品发布字段规范获得

language
语种
必填

productDesc
商品描述
必填

productNameList
商品名称信息
必填
必传默认语种和商品名称默认语种通过商品发布字段规范获得

language
语种
必填

productName
商品名称
必填

productAttributeList
商品属性
根据接口判断是否必填
通过店铺可用属性接口获取商品属性信息如果接口表明商品属性必填，则发品需要传商品属性和属性值。商品属性：attribute_type=4属性值填写方式：根据attribute_mode判断；0: 手工填写参数；1:下拉列表选择(可多选);3:下拉列表选择(单选)4:下拉列表+手工填写参数

attributeExtraValue
自定义属性值
根据接口判断是否必填
attribute_mode=0或者4时要传参

attributeId
属性id
根据接口判断是否必填
通过店铺可用属性接口获取商品属性id当attribute_type=4时，数组中的attribute_id为商品属性id

attributeValueId
属性值id
根据接口判断是否必填
属性id下attribute_mode=1或者3时，需要查属性id下的可用属性值id进行传参

sizeAttributeList
尺码表属性
根据接口判断是否必填
通过店铺可用属性接口获取尺码表属性信息如果接口表明尺码表属性必填，则发品需要传尺码表属性和属性值。尺码表属性：attribute_type=2属性值填写方式：根据attribute_mode判断；0: 手工填写参数；1:下拉列表选择(可多选);3:下拉列表选择(单选)4:下拉列表+手工填写参数

attributeExtraValue
自定义属性值
根据接口判断是否必填
attribute_mode=0或者4时要传参

attributeId
属性id
根据接口判断是否必填
通过店铺可用属性接口获取尺码表属性id当attribute_type=2时，数组中的attribute_id为尺码表属性id

attributeValueId
属性值id
根据接口判断是否必填
属性id下attribute_mode=1或者3时，需要查属性id下的可用属性值id进行传参

relateSaleAttributeId
尺码表关联的销售属性
根据接口判断是否必填
即secondaryAttributeId；比如尺寸

relateSaleAttributeValueId
尺码表关联的销售属性值
根据接口判断是否必填
即secondaryAttributeValueId；比如S码

skcList
SKC信息
必填

imageInfo
图片列表
必填
图片上传规则，请看FAQ

imageInfoList
必填

imageSort
图片序号，不允许重复
必填

imageType
图片类型
必填
1-主图,2-细节图（最多11张）,5-方块图,6-色块图(色块图单skc非必填，多skc必填)

imageUrl
图片链接
必填
平台图片链接，不允许外部链接，通过图片链接转换接口将外部链接图片转平台图片

mainSaleAttribute
主销售属性信息
必填
通过店铺可用属性接口获取主销售属性id当attribute_type=1，attribute_label=1时，数组中的attribute_id为主销售属性id

mainAttributeId
主销售属性ID
必填
示例：27；代表颜色

mainAttributeValueId
主销售属性值ID
必填
示例：112；代表黑色

skuList
SKU信息
必填

height
高度-单位厘米
必填

length
长度-单位厘米
必填

width
宽度-单位厘米
必填

weight
重量-单位克
必填

mallState
销售状态
必填
SKU商城销售状态 1：在售/2：停售建议传1；如果传2，平台不会保存该sku的库存数量，库存数量会在商家后台显示为空

productPriceIList
SKU价格信息
必填
SKU审核通过后不用传，否则报错SKU审核失败需要重新传，否则报错

sellPrice
销售价格
必填

specialPrice
特价
非必填

sellSite
销售站点
必填
销售站点，可以通过查询站点和币种接口获取

saleAttributeList
次销售属性信息
非必填
通过店铺可用属性接口获取主销售属性id当attribute_type=1时，数组中的attribute_id可以是次销售属性id已在skc维度上传的属性，属性值，在sku维度不重复上传

attribute_id
次销售属性ID
非必填
示例：87；代表尺码

attribute_value_id
次销售属性值ID
非必填
示例：568；代表S

productStockIList
商品库存信息
必填
SKU审核通过后不用传，否则报错SKU审核失败需要重新传，否则报错

inventoryNum
商品总库存数
必填
商品总库存数，可以为0，审核失败的sku需要传库存，审核成功的sku不需要传库存；

merchantWarehouseId
商家仓库ID
必填
一个店铺有多个仓库，则该字段必填，可通过【商家仓库列表查询】API获取

supplierSku
商家SKU
必填
最多200个字符，一个商家sku只能对应一个平台sku；商家sku属于店铺唯一，不得重复

skuCode
平台生成的SKU Code
必填

proofOfStockUrl
商品
条件必填
可通过【商品发布字段规范】接口确认是否必传

fileName
文件名称
条件必填

type
文件类型
条件必填
支持image、PDF格式文件，大小不超过3M，图片/文件总数不超过1个

url
链接
条件必填

supplierCode
商家货号
必填

 

 

### 
修改价格示例如下：

feedType: POST_PRODUCT_PRICING_DATA

1、示例说明：

[
  {
    "processKey": "A", // 标志位，用于区分处理逻辑
    "data": {
      "productPriceList": [ 
        // 最多可以传 100 组数据，相当于一次调用的数组上限
        {
          "currencyCode": "EUR", // 货币代码，表明使用欧元
          "productCode": "I93kazd5qs11", // 产品唯一编码
          "site": "shein-fr", // 销售站点
          "shopPrice": 10 // 店铺价格
        },
        {
          "currencyCode": "EUR",
          "productCode": "I93kazd5qb31",
          "site": "shein-fr",
          "shopPrice": 20
        }
      ]
    }
  },
  {
    "processKey": "B", // 第二个标志位
    "data": {
      "productPriceList": [
        {
          "currencyCode": "EUR",
          "productCode": "I63dv4eq7u8z",
          "site": "shein-fr",
          "shopPrice": 30
        }
      ]
    }
  }
]

[{
	"info": {
		"code": "0",
		"msg": "OK",
		"info": {
			"data": [{
				"success": false,
				"status": 0,
				"message": "Product I93kazd5qb31 needs to be reviewed and the price cannot be modified.",
				"productCode": "I93kazd5qb31"
			}, {
				"site": "shein-fr",
				"success": false,
				"status": 0,
				"message": "该商品为简易平台款商品:I93kazd5qs11不允许调整SKC/SKU：I93kazd5qs11 的价格!",
				"productCode": "I93kazd5qs11"
			}],
			"meta": {
				"count": 2
			}
		}
	},
	"processKey": "A"
}, {
	"info": {
		"code": "0",
		"msg": "OK",
		"info": {
			"data": [{
				"site": "shein-fr",
				"success": false,
				"status": 0,
				"message": "该商品为简易平台款商品:I63dv4eq7u8z不允许调整SKC/SKU：I63dv4eq7u8z 的价格!",
				"productCode": "I63dv4eq7u8z"
			}],
			"meta": {
				"count": 1
			}
		}
	},
	"processKey": "B"
}]

2、字段说明：

字段
描述
是否必填
备注

currencyCode
商品的币种
必填
可以通过查询站点和币种接口获取

productCode
平台生成的SKU CODE
必填
仅审核通过的SKU可以修改价格；审核通过的SKU可以通过商品详情接口获取；审核结果可以通过webhook 或查询接口获取；

shopPrice
店铺售价
必填

specialPrice
特价
非必填
特价不得高于店铺售价

site
站点
必填
销售站点，可以通过查询站点和币种接口获取

riseReason
涨价理由
必填
涨价时必填,枚举:1-商品成本上涨,2-物流履约费用上涨,3-活动结束恢复价格,4-其他,5-物流履约费用上涨（物流规则调整）

### 
 

### 
修改库存示例如下：

feedType: UPDATE_PRODUCT_SELLABLE_STOCK

1、示例说明：

[
  {
    "processKey": "A", // 标志位，用于区分处理逻辑
    "data": {
      "updateSkuInventoryQuantityRequests": [
        {
          "changeInventoryQuantity": 1001, // 更新库存数量
          "skuCode": "I93kazd5qs11" // SKU 唯一编码
        },
        {
          "changeInventoryQuantity": 2002,
          "skuCode": "I93kazd5qb31"
        }
      ]
    }
  },
  {
    "processKey": "B", // 第二个标志位
    "data": {
      "updateSkuInventoryQuantityRequests": [
        {
          "changeInventoryQuantity": 3003,
          "skuCode": "I63dv4eq7u8z"
        }
      ]
    }
  }
]

[{
	"info": {
		"code": "0",
		"msg": "OK"
	},
	"processKey": "A"
}, {
	"info": {
		"code": "0",
		"msg": "OK"
	},
	"processKey": "B"
}]

2、字段说明：

字段
描述
是否必填
备注

updateSkuInventoryQuantityRequests
sku库存信息
必填
最多1次调用100个SKU

changeInventoryQuantity
商品的总库存
必填

skuCode
平台审核通过的SKU
必填
仅限审核通过的SKU可以修改库存；审核失败的SKU不可用

warehouseCode
仓库id
非必填
如果店铺有多个仓库则必传，可通过商家仓库列表接口获得

### 
 

### 
商品上下架示例如下：

feedType: MODIFY_PRODUCT_SKC_SHELF

1、示例说明：

[
  {
    "processKey": "A", // 标志位，用于区分处理逻辑
    "data": {
      "skcSiteInfoList": [
        {
          "skcName": "sMM24121367639354", // SKC 唯一名称
          "shelfState": 2, // 上架状态：2 表示待上架
          "siteList": [
            "shein-fr" // 销售站点
          ]
        },
        {
          "skcName": "sMM24121386450293",
          "shelfState": 2, // 上架状态：2 表示待上架
          "siteList": [
            "shein-fr"
          ]
        }
      ]
    }
  },
  {
    "processKey": "B", // 第二组数据逻辑
    "data": {
      "skcSiteInfoList": [
        {
          "skcName": "sMM24121387000824", // SKC 唯一名称
          "shelfState": 2, // 上架状态：2 表示待上架
          "siteList": [
            "shein-fr"
          ]
        }
      ]
    }
  }
]

[{
	"info": {
		"msg": "OK",
		"code": "0",
		"bbl": "null",
		"info": {
			"successCount": "2",
			"totalCount": "2",
			"failureResults": [],
			"failureCount": "0"
		}
	},
	"processKey": "A"
}, {
	"info": {
		"msg": "OK",
		"code": "0",
		"bbl": "null",
		"info": {
			"successCount": "1",
			"totalCount": "1",
			"failureResults": [],
			"failureCount": "0"
		}
	},
	"processKey": "A"
}]

2、字段说明：

字段
描述
是否必填
备注

skcSiteInfoList
上下架站点信息
必填
1次调用最多支持100条数据

skcName
平台生成并且商品审核通过的SKC
必填

shelfState
上下架操作；1.上架,2.下架
必填

siteList
需要修改的商品站点
必填
销售站点，可以通过查询站点和币种接口获取

## 解决方案 / 自运营解决方案 / ERP订单履约方案

- Page ID：`b86df826-638d-4128-9f5e-c7b20d8cf28e`
- 路径：`https://open.sheincorp.com/documents/system/b86df826-638d-4128-9f5e-c7b20d8cf28e`
- 简介：该解决方案适用于具有系统对接能力、有订单履约需求的开发者

## 
一、方案介绍

### 
1.1、业务介绍

该解决方案适用于具有系统对接能力
、有订单履约需求的开发者
。

自运营和半托管店铺模式的自研商家、ISV或其他开发者可以通过此解决方对接SHEIN订单管理服务

适合接入该解决方案的应用类型：

1. 自运营应用

2. 半托管应用

### 
1.2、概念和名词说明

概念&名词
​说明

自运营
由商家定价，商家无需备货到SHIEN，订单由商家负责履约的合作模式

半托管
由SHEIN定价，商家无需备货到SHIEN，订单由商家负责履约的合作模式

在线下单
商家使用SHIEN合作物流发货，简称在线下单

认证仓
商家使用平台认证的仓库，订单生成后由SHEIN平台发送订单至认证仓发货

SFS订单
SHEIN履约服务（SHEIN Fulfillment Service，简称SFS），由商家将货物提前存放到SHEIN仓库，消费者下单后，由SHEIN进行打包发货的服务，该流程无需ERP介入。常见于巴西市场卖家。

## 
二、订单状态说明

### 
2.1、订单状态

### 
2.2、订单状态说明

状态
​订单状态枚举值
状态描述
状态说明

Pending
orderStatus = 1
订单待处理
已付款的订单会变更为此状态，订单状态为Pending（1）时，商家可以对订单执行履约操作

To Be Shipped
orderStatus = 2
订单待发货
不同的履约方式会触发该状态变更：

1、调用导出地址接口，并且入参"handleType"

2、调用在线下单接口，会将状态变更为 To Be Shipped{2}）

To Be Shipped by SHEIN
​orderStatus = 3
待SHIEIN发货
当订单为SHEIN履约的订单，且等待发货的时候，订单会切换到此状态

To Be Picked Up
orderStatus = 7
订单待揽收
除已经退款商品之外，订单中有至少一个商品上传了物流单号信息时，订单变更为待揽收状态。不同的履约方式会触发该状态变更：

1、完成运单号上传

2、完成面单打印

Shipped
orderStatus = 4
订单已发货
除已经退款商品之外，订单中有至少一个商品有揽收信息时，订单变更为待揽收状态。SHEIN平台打通了各个物流商，检测到货物被揽收将更新状态为订单已发货

Delivered
orderStatus = 5
订单已签收
当所有需要发货的商品的物流单号均已签收时，订单变更为此状态。SHEIN平台会检测物流单号的状态是否已签收，请上传正确的物流单号。

Refunded
orderStatus = 6
订单已退款
订单维度和商品维度都有退款状态，具体说明如下：

1、整单的订单状态：所有商品都退款

2、商品的订单状态(newGoodsStatus)：消费者对商品进行退款

3、商品的订单状态(newGoodsStatus)：商家将订单中的单个商品设置为确认无货

      a、当状态为订单待发货（To Be Shipped{2}），商家设置商品无货，商品订单状态将更新为Refund{6}

      b、当状态为订单待揽收（To Be Picked Up{7}），商家设置商品无货，商品订单状态将更新为Refund{6}

## 
三、订单履约说明

### 
3.1、订单履约方式

### 
3.2、履约方式说明

履约方式
履约方式定义说明
是否备货到平台仓
判断方式

商家自行发货（商家导出地址发货）
商家导出订单发货地址，自行委托第三方物流服务商发货
否
不备货到平台：stockMode=3； 订单可选物流包含商家自发货：optionalLogisticsLis=[2]；

平台合作物流发货
商家选择物流发货（在线下单）
平台提供的合作物流商，商家通过平台向物流商在线下单并发货
否
不备货到平台：stockMode=3； 订单可选物流支持在线下单：optionalLogisticsLis=[1]；orderPlaceType = 2

平台指定物流发货
平台指定物流服务商，从商家仓收取货件发货
否
不备货到平台：stockMode=3； 仅支平台合作物流发货：optionalLogisticsLis=[1]；orderPlaceType = 1

SHEIN认证仓发货
商家使用平台认证的仓库，订单生成后由平台发送至认证仓发货，开发者无需处理
否
订单类型，orderType = 5，表示认证仓订单，且库存模式为不备货到平台，stockMode=3；

SFS模式发货
商家将货物提前存放到SHEIN仓库，消费者下单后，由SHEIN物流商揽收并发货，该流程无需开发者介入。
是
库存模式为备货到SHEIN仓库stockMode = 2；

### 
3.3、订单异常处理

订单详情中【
printOrderStatus】表示订单当前是否可处理
，
当订单详情中【printOrderStatus = 2】时，表示订单不可处理，此时需要重点关注【unProcessReason】字段，根据不同情况处理异常订单：

unProcessReason值
解释说明
处理方式

1、5、7、8
系统处理中，请稍后重试
请在30分钟后重新获取订单详情，更新订单状态后处理订单

2
订单存在问题，客服正在核实处理
等客服处理完后，重新拉取订单详情

4
订单未生成包裹/预报失败
订单异常，需要商家后台联系客服处理

3、13
巴西订单需要同步发票
巴西订单需要先上传巴西发票，再进行订单处理

10、11
商家没有设置仓库地址，一般会提示：请到卖家后台设置仓库地址
联系商家配置仓库地址，然后重新调订单详情接口

12
订单是拆包的订单，同时ERP系统还未操作拆单
需要调用API确认拆包或取消拆包

6、9
商品库存为0，可以看到此时storageTag=2
1、 如果有货，则补充库存，消除无货的标签；2、 如果无货，则调用商品无货接口；

## 
四、接口清单

### 
4.1、接口列表

接口名称
接口地址
​接口说明

查询订单列表
/open-api/order/order-list
查询店铺的订单列表

查询订单详情
/open-api/order/order-detail
查询订单详情

导出地址发货
/open-api/order/export-address
商家自行发货，导出订单的发货地址，自行委托第三方物流服务商发货

上传运单接口
/open-api/order/import-batch-multiple-express
商家自行发货，发货完成后上传运单号，标记订单为已发货。

查询商家可用发货渠道
/open-api/order/express-channel
查询商家维度的可用发货渠道

物流在线下单接口
/open-api/gsp/place-express-order
商家使用SHIEN平台合作物流发货，通过此接口创建物流订单

查询在线下单结果
/open-api/gsp/chack-express-order
查询SHIEN平台合作物流发货下单结果

查询店铺可用物流信息
/open-api/gsp/order-mapping-channels
查询店铺维度的可用物流信息

切换导出地址发货
/open-api/gsp/switch-self-shipping
切换发货方式为到出地址发货

打印面单接口
/open-api/order/print-express-info
用于打印面单

回传发票信息
/open-api/order/sync-invoice-info
用户上传发票信息，主要在巴西市场的订单使用

查询物流轨迹
/open-api/gsp/logistics-track
用于查询订单的物流轨迹，物流信息

确认无货接口
/open-api/order/confirm-no-stock
当商品无货无法发货时，调用此接口进行确认无货处理。

确认超限拆分包裹
/open-api/order/unpacking-group-confirm
当订单包裹超限时，需要商家确认是否拆分包裹

取消超限拆分包裹
/open-api/order/unpacking-group-remove
用于取消超限拆分包裹

### 
4.2、webhook列表

​接口名称（拟变更名称）
接口地址
​接口说明

订单状态同步通知
/order_push_notice
订单状态变更时，通过webhook发送通知

在线下单结果通知
/logistics_order_result_notice
在线下单结果通知，有结果时通过webhook发送通知

CTE开票状态通知
/invoice_status_notice
CTE开票状态通知，常用于巴西市场

## 
五、接口调用说明

### 
5.1、商家自行发货（导出地址发货）

商家自行发货，即商家自己导出订单地址，联系物流承运商发货。发货后，由商家上传运单号。

支持该履约类型的范围如下：

商家类型
国家

自运营
美国、欧洲、墨西哥

半托管
所有国家

商家自履约订单状态流转：

商家自履约
接口调用流程：

商家自履约
接口调用流程说明：

- 
获取订单列表：/open-api/order/order-list

- 
获取订单详情：/open-api/order/order-detail

- 
监听订单状态变更webhook：/order_push_notice

- 
判断订单发货方式：

- 
如果订单可选物流包含商家自发货：optionalLogisticsLis = [2]，则订单支持商家导出地址发货；

- 
判断订单是否异常（printOrderStatus是否等于1）：

- 
printOrderStatus等于1为正常订单，则继续完成第6步；

- 
不等于1为异常，请查看unProcessReason字段，进行订单异常处理。

- 
如订单无异常，则导出地址：/open-api/order/export-address

- 
商家导出地址后，自行预约物流上面揽收；

- 
物流揽收后生成运单号。

- 
获取店铺可用物流：/open-api/order/express-channel

- 
调用上传运单号接口：/open-api/order/import-batch-multiple-express

### 
5.2、SHEIN合作物流发货（在线下单发货）

SHEIN合作物流发货，即商家使用SHEIN合作物流商进行发货，这种情况下需要区分“商家选择物流商（在线下单）”和“SHEIN指定物流商”两种方式。以下主要阐述商家使用“SHEIN合作物流发货”，“商家选择物流商（在线下单）”的履约流程。

支持该履约类型的范围如下：

商家类型
国家

自运营
美国、欧洲

半托管
美国、欧洲、中东

在线下单发货订单状态流转：

在线下单发货接口调用流程：

在线下单发货接口调用流程说明：

- 
获取订单列表：/open-api/order/order-list

- 
获取订单详情：/open-api/order/order-detail

- 
监听订单状态变更webhook：/order_push_notice

- 
判断订单发货方式：

- 
如果订单可选物流包含商家自发货：optionalLogisticsLis = [1]，则订单支持SHEIN合作物流发货；

- 
如果orderPlaceType = 2，则表示订单支持商家自选物流，可以使用在线下单功能；

- 
如果orderLogisticsType = 1，则表示商家已选择平台合作物流发货，后续请使用在线下单方式完成订单履约。

- 
判断订单是否异常（printOrderStatus是否等于1）：

- 
printOrderStatus等于1为正常订单，则继续完成第6步；

- 
不等于1为异常，请查看unProcessReason字段，进行订单异常处理。

- 
在线下单流程：

- 
查询商家仓库地址：/open-api/gsp/warehouse-address，获取仓库地址编码（warehouseAddressCode）

- 
查询仓库地址编码（warehouseAddressCode），查询可用物流渠道/open-api/order/express-channel

- 
判断可用物流渠道：平台合作物流列表（platformLogisticsChannels），如果有返回物流渠道则可以使用在线下单

- 
如果没有返回物流渠道，则表示当前仓库地址无法使用在线下单；

- 
查询订单可用物流信息：/open-api/gsp/order-mapping-channels

- 
获取物流价格

- 
获取渠道预判请求ID（preRequestId）

- 
商家选择物流商，并调用在线下单接口：/open-api/gsp/place-express-order

- 
需要传入preRequestId，expressChannelCode，以及包裹明细；

- 
调用成功后得到运单包裹号（deliveryNo），下单请求id（placeRequestId）；

- 
监听在线下单结果：/logistics_order_result_notice

- 
查看物流单下单结果：/open-api/gsp/chack-express-order

- 
如果handleResult = 1，则物流商确认中，请稍后重新查询结果；

- 
如果handleResult = 2，则代表下单成功，可以打印免单进行发货；

- 
如果handleResult = 3，则代表下单失败，可以重新在线下单，或者切换为商家导出地址发货

- 
如物流单无异常，则调用打印面单接口；/open-api/order/print-express-info

### 
5.3、平台指定物流发货

履约场景
​文档链接

平台指定物流履约（墨西哥市场）
平台指定物流履约（墨西哥市场）

平台指定物流履约（巴西市场）
平台指定物流履约（巴西市场）

### 
5.4、其它履约场景说明

履约场景
文档链接

订单换货场景
订单换货场景说明

订单退款退货场景
客单退货退款服务

订单超限拆包场景
订单超限拆包场景

## 

## 
六、常见问题说明

1.  
订单列表接口里返回的时间字段对应的是什么时间？这个和后台所看到的时间是否存在差异？

所有接口内返回的时间是北京时间（GMT+8），商家后台所看到的时间是经过后台导航栏所配置的时区转换后所示，暂无夏令时处理。

2.  
为什么导出地址信息后，订单状态还是待处理（Pending{1}）？

导出地址信息接口里需指定handletype=2的入参获取地址信息才会导致订单状态变为“待发货”。

3.  
上传运单接口里的expressCode和expressIdCode分别如何理解？

expressCode：运单号，可以理解为tracking number

expressIdCode：SHEIN平台设置的渠道商名称，不同市场可用渠道商名称不同，由于名称可能会变更，建议每周更新一次；

expressIdCode根据店铺可用物流商接口获取：

https://open.sheincorp.com/en/documents/apidoc/detail/3000363-2000001

4.  
商品必须具体满足哪些条件才可以上传运单成功?

商品状态（newGoodsStatus）是待发货（To Be Shipped{2}）、待揽收（To Be Picked Up{7}）

换货状态（goodsExchangeTag）是未换货{1}或者换来商品{3}

库存状态（stockMode）=3, 备货在商家仓

5.  
订单详情返回信息中有“goodsId”和“productId”，两者有何差异?

没有差异，字段命名不同。⚠️注意：同种商品多件，每一件商品的goodsId不同

6.  
上传运单号（
/open-api/order/import-batch-multiple-express
）后，接口返回code=0，但订单状态没有改变？

请关注是否接口返回信息中的info不为空，上传运单会存在部分商品成功，部分失败的情况，此时接口返回code=0，但info里会体现商品部分维护失败的原因。

7.  
为什么订单状态=“待处理”，但依然无法进行导出地址？

除订单状态外，还需结合订单详情字段中的“打单状态（printOrderStatus）”、打单状态（printOrderStatus）=1才能导出地址

8.  
发货前，若商家发现某个商品（SKU）库存无货而无法履约时，怎么办？

调用确认无货接口，对订单商品（SKU）进行确认无货处理，操作后商品订单状态将更新为【已退款】

9.  在线下单和导出地址两种履约方式如何切换：

订单状态为待处理状态（orderStatus=1），
打单状态（
printOrderStatus
）=1，且订单状态在“
待发货”之前可以切换履约方式。

## 解决方案 / 自运营解决方案 / 平台指定物流履约（墨西哥市场）

- Page ID：`e2cc7bc5-c043-4c9c-95f6-13b7fe040994`
- 路径：`https://open.sheincorp.com/documents/system/e2cc7bc5-c043-4c9c-95f6-13b7fe040994`

# 
平台指定物流履约（墨西哥市场）

### 
1、SHEIN合作物流发货

SHEIN合作物流发货，即商家使用SHEIN合作物流商进行发货，这种情况下需要区分“商家选择物流商”和“SHEIN指定物流商”两种方式。以下主要阐述商家使用“SHEIN合作物流发货”，“平台指定物流发货”的履约流程。

支持该履约类型的范围如下：

商家类型
国家

自运营
墨西哥

半托管
墨西哥

### 
2、订单状态流转

​

### 
3、接口调用流程

接口调用流程说明：

- 
获取订单列表：
/open-api/order/order-list

- 
获取订单详情：
/open-api/order/order-detail

- 
监听订单状态变更webhook：
/order_push_notice

- 
判断订单发货方式：

- 
如果订单可选物流包含平台指定物流发货：optionalLogisticsLis=[1]；

- 
且orderPlaceType = 1，则该订单为平台指定物流发货。

- 
判断订单是否异常（printOrderStatus是否等于1）；

- 
printOrderStatus等于1为正常订单，则继续完成第6步；

- 
不等于1为异常，请查看unProcessReason字段，进行订单异常处理。

- 
如订单无异常，则调用打印面单接口；
/open-api/order/print-express-info

- 
打印面单后，订单状态变更为“待揽收”；

- 
物流揽收后，订单状态变更为“已发货”；

- 
物流签收后，订单状态变更为“已签收‘，订单履约结束。

## 解决方案 / 自运营解决方案 / 平台指定物流履约（巴西市场）

- Page ID：`14ea81f8-7c58-4111-9cc9-ecdf23541493`
- 路径：`https://open.sheincorp.com/documents/system/14ea81f8-7c58-4111-9cc9-ecdf23541493`

# 
平台指定物流履约（巴西市场）

### 
1、SHEIN合作物流发货

根据当地政府要求，巴西企业卖家需要为订单开具发票。巴西企业卖家需要通过ERP系统完成开票流程，并将开票信息传送回SHEIN。因此，在SHEIN的履约流程中，巴西市场和其他市场的操作流程将有所不同。

支持该履约类型的范围如下：

商家类型
国家

自运营
巴西

半托管
巴西

### 
2、订单状态流转

### 
3、接口调用流程

接口调用流程说明：

- 
获取订单列表：
/open-api/order/order-list

- 
获取订单详情：
/open-api/order/order-detail

- 
监听订单状态变更webhook：
/order_push_notice

- 
判断订单发货方式：

- 
如果订单可选物流
包含
平台指定物流发货：optionalLogisticsLis=[1]；

- 
且orderPlaceType = 1，则该订单为平台指定物流发货；

- 
如果salesSite = shein-br，则为巴西市场订单。

- 
判断订单是否异常（printOrderStatus是否等于1）；

- 
printOrderStatus等于1为正常订单，则继续完成第6步；

- 
不等于1为异常，请查看unProcessReason字段，进行订单异常处理。

- 
如订单无异常，则导出地址：
/open-api/order/export-address

- 
商家导出地址后，自行预约物流上面揽收；

- 
物流揽收后生成运单号。

- 
上传发票：
/open-api/order/sync-invoice-info

- 
上传发票成功后，需要查询订单printOrderStatus是否为可处理状态；

- 
如果订单为可处理状态，则调用打印面单接口。

- 
则调用打印面单接口；
/open-api/order/print-express-info

- 
打印面单后，订单状态变更为“待揽收”；物流揽收后，订单状态变更为“已发货”；

- 
物流签收后，订单状态变更为“已签收‘，订单履约结束。

## 解决方案 / 自运营解决方案 / 超限拆包服务

- Page ID：`7039b56b-69c7-43b1-a706-50d418d723e8`
- 路径：`https://open.sheincorp.com/documents/system/7039b56b-69c7-43b1-a706-50d418d723e8`
- 简介：本方案适用于具有系统对接能力的卖家，基于API/消息的形式对接平台揽收的客单

## 
一、 
业务方案

### 
 1、 
适用范围

本方案适用于具有系统对接能力的卖家，基于API/消息的形式对接平台履约的第三方开发者和卖家。

### 
 2、 
内容概述

本方案围绕平台履约（揽收）的客单履约场景：平台揽收的订单存在由于商品数量过多导致包裹超大，超重等问题导致物流承运商无法发货。巴西和非巴西地区的ERP流程不一致，商家需根据实际情况接入，整体接口架构如下：

API/Notice
Link&path

查询订单列表
/open-api/order/order-list

查询订单详情
/open-api/order/order-detail

打印面单
/open-api/order/print-express-info

确认无货
/open-api/order/confirm-no-stock

上传巴西发票
/open-api/order/sync-invoice-info

确认拆包
/open-api/order/unpacking-group-confirm

取消拆包
/open-api/order/unpacking-group-remove

消息通知
order_push_notice

### 
3、 
方案介绍

#### 
3-1、流程概述

接口调用流程：

1、webhook收到新订单信息（仅限开通webhook的开发者）

2、拉取订单列表接口（
SHEIN Developer Platform
），获取订单详情（
SHEIN Developer Platform
）

3、 
识别需要确认超限拆包的订单

根据订单字段判断：

     a) 
isOverLimitOrder=1，该订单是超限订单

     b) 
isOverLimitOrder=2，该订单不是超限订单

 4、 
ERP给到商家确认拆包或取消拆包，完成发货（
注意，一旦确认或取消不能回滚操作
）

     a) 
如果是巴西卖家，确认拆包后操作如下：

         i) 
巴西订单确认拆包的情况下，使用拆包分组号上传发票信息

         ii) 
上传发票后，使用该订单详情接口（
SHEIN Developer Platform
）的出参「
orderNo
」和「
packageNo
」作为打印面单的入参，完成面单打印
SHEIN Developer Platform

     b) 
如果是巴西卖家，取消拆包后操作如下： 

         i) 
巴西订单取消拆包的情况下，使用订单号上传发票信息

         ii) 
上传发票后，重新调用订单详情接口（
SHEIN Developer Platform
），获取新的订单详情入参「
orderNo
」和「
packageNo
」作为打印面的入参，完成面单打印
SHEIN Developer Platform

     c) 
如果是非巴西卖家，确认拆包后操作如下：

         i) 
使用该订单详情接口（
SHEIN Developer Platform
）的出参「
orderNo
」和「
packageNo
」作为打印面单的入参，完成面单打印
SHEIN    Developer Platform

     d) 
如果是非巴西卖家，取消拆包后操作如下： 

         i) 
重新调用订单详情接口（
SHEIN Developer Platform
），获取新的订单详情入参「
orderNo
」和「
packageNo
」作为打印面的入参，完成面单打印
SHEIN Developer Platform

#### 
3-2、流程详细介绍

#### 
超限拆包服务-最佳实践

## 
二、FAQ 

1、卖家反馈ERP展示订单与GSP订单列表对比有数量差异？

在当前同步逻辑下，由于订单从SHEIN通过
/open-api/order/order-list
接口同步至ERP会有一定的时间间隔，具体间隔取决于ERP调用该接口的频率，因此建议ERP
至少半小时
调用一次订单列表接口获取增量订单。

2、接口里涉及的时间对应的是什么时间？为什么会和后台所看到的存在差异？

所有接口内返回的时间是北京时间（GMT+8），商家后台所看到的时间是经过后台导航栏所配置的时区转换后所示，暂无夏令时处理。

 3、 
/open-api/order/order-list
 报错：请求参数异常,请刷新重试

注意是否为时间戳格式不正确，正确格式为：yyyy-MM-dd HH:mm:ss
 

 4、 
一定要确认是否拆包后才能进行上传发票，打印面单等操作？

是的

 5、 
怎么理解拆包分组号和包裹号？

拆包分组号是用于记录预拆包且和发票挂钩，即使后面订单的包裹号发生改变了，拆包分组号也保持不变，发票信息也保持不变

 6、 
一旦确认或取消系统拆包，操作不可逆？

是的

 7、 
卖家什么时候需要取消拆包？

订单有商品缺货，卖家取消部分商品后卖家认为订单商品没有超限；卖家判断订单不拆包也能履约，例如商品维护的信息不准确导致的系统误判；

 8、 
卖家如何判断会不会超限？后续会考虑开放查询接口？

 
现在暂不支持

 9、 
卖家可以自行拆包吗？后续会考虑开放

现在暂不支持

10、超限拆包，多少阈值触发超限拆包？

这个是业务配置的，目前是60*60*40cm的包裹会触发

11、SHEIN自动处理拆包，这个规则是什么？

无需关注，调用订单详情接口，返回数据中已经有拆好的包裹信息

12、取消超限拆包的影响？

接口没有影响，业务可能导致承运商不揽件，比如商家多件商品包裹为100cm，未拆包裹的情况有可能导致平台承运商拒绝揽收

13、关于发货地址，可以支持1个订单拆包，多个揽收地址发货吗？

不允许，1个订单只绑定1个仓库

14、是否支持商家自己选择哪些商品在某个包裹

不可以

15、是否有测试店铺和测试订单可以调用

这个需要跟内部协商，还在沟通中

如有疑问，可邮件联系nerowang@shein.com

## 解决方案 / 自运营解决方案 / 客单退货退款服务

- Page ID：`949a61a4-bb8b-4683-922a-8755e079b394`
- 路径：`https://open.sheincorp.com/documents/system/949a61a4-bb8b-4683-922a-8755e079b394`
- 简介：适用于商家通过OpenAPI管理退货单

# 
一、 
业务方案

## 
 1、 
适用范围

本方案适用于具有系统对接的卖家，基于API/消息的形式对接客单退货退款服务。

## 
 2、 
内容概述

本方案围绕客单退货退款场景：支持拉取退货退款列表及详情、确认退货签收等功能，商家可自行按需接入，整体接口架构如下：

注：具体每个API/消息实际应用场景见方案介绍部分

API/Notice
Link&path

Get return list 
/open-api/return-order/list

Get return detail
/open-api/return-order/details

Sign the return
/open-api/return-order/sign-return-order

## 
 3、 
订单状态流转图

状态{状态代码}
状态描述

Already Applied{2}
申请中售后单

Closed{1}
系统自动关闭的售后单

Cancel{3}
会员取消的售后单

Waiting for transit in SHEIN warehouse{8}
待SHEIN仓中转

Pending handover{7}
待交接

Delivered{6}
退货单已妥投

Received{5}
退货单已全部签收

Completed{9}
已完成

## 
 4、 
方案介绍

### 
4-1、流程概述

基本流程：

 1、 
拉取新增退货退款单（支持新增退货退款单通知）

 2、 
获取新增退货退款单详情

 3、 
物流商派送退货商品

 4、 
签收退货商品同步到平台

### 
4-2、流程详细介绍

#### 
平台揽收客单退货退款-最佳实践

# 
 二、 
FAQ

1、接口里涉及的时间对应的是什么时间？为什么会和后台所看到的存在差异？

所有接口内返回的时间是北京时间（GMT+8），商家后台所看到的时间是经过后台导航栏所配置的时区转换后所示，暂无夏令时处理。

2、
/open-api/return-order/list
 报错：请求参数异常,请刷新重试

注意是否为时间戳格式不正确，正确格式为：yyyy-MM-dd HH:mm:ss

3、该接口的QPS多少？

每个店铺限制QPS=5/s

 4、 
卖家一直不签收系统会自动签收吗？

会的，自动签收时间会根据不同国家地区不一样

 5、 
接口获取的退货退款单都是客诉处理结果吗？

售前是由客服处理，卖家接收处理的结果反馈，确认退货到仓的签收

# 

#

## 解决方案 / 自运营解决方案 / 订单换货场景说明

- Page ID：`14b4ecf0-8e51-4cfc-bdcb-d4bd26c8e9ae`
- 路径：`https://open.sheincorp.com/documents/system/14b4ecf0-8e51-4cfc-bdcb-d4bd26c8e9ae`

# 
订单换货场景说明  

## 
一、场景说明

在遇到商品无货或买家买错，包裹运输中途破损，丢件，买家收到货不满意等场景平台支持换货的操作

处理节点
处理节点订单状态
申请换货场景
​是否生成换货订单
处理

发货前换货​
待处理
商品缺货，平台联系买家进行换货
​​否​
如果选择换货，在原订单上会新增换货后的商品，即在订单上会看到被换商品（2）和换来商品（3）如果选择退款，那么​直接取消商品或取消订单

待处理
买家买错，订单待处理的状态，买家申请换货

待处理
商家确认无货，联系买家选择退款或是换货

​待揽收、待发货
商家确认无货，联系买家选择退款或是换货
是​
如果选择换货，原订单上的商品会被标记为被换商品（2），新换货单上的商品会标记为换来商品（3）如果选择退款，那么​直接取消商品或取消订单

待处理
买家取消换货
/
订单上会看到买家下单的商品由被换货（2）更新成未换货（1），换来商品（3）更新成删除换货（4）

发货后换货
已发货（已妥投买家），已签收，已报损，已拒收
买家不满意等进行换货重发
​是
买家发起的商品
会在新的换货订单中标记为换来商品（3），原订单上的商品会被标记为被换商品（2）

已发货（未妥投买家）
丢包，破损
是
物流包裹下所有商品
都会在新的换货订单中标记为换来商品（3），原订单上的商品会被标记为被换商品（2）

## 
二、接口清单

### 
接口列表

接口名称
接口地址
​接口说明

查询订单列表
/open-api/order/order-list
支持获取换货订单

查询订单详情
/open-api/order/order-detail
支持查询换货订单详情

### 
Webhook列表

接口名称
接口地址
​接口说明

订单状态变更通知
/order_push_notice
订单发生换货时会通过消息通知

## 
三、接口参数说明

场景
接口
参数
原订单
换货订单

不生成换货订单
/open-api/order/order-detail
orderNo
原订单号
不生成换货订单

orderType
1：正常订单

goodsExchangeTag
1：未换货商品且订单未发货，需要履约2：被换商品，不需要履约3：换来商品且订单未发货，需要履约4：删除换货，不需要履约

beExchangeEntityId
换来商品会有对应的被换商品goodsId

billNo
​ info.billNo=原订单号

生成换货订单
/open-api/order/order-detail
orderNo
原订单号
换货单号（orderType=2的即为换货单）

orderType
1：正常订单
2：换货订单

goodsExchangeTag
1：未换货商品，需要履约2：被换商品，不需要履约3：换来商品，需要履约4：删除换货，不需要履约
1：未换货商品且订单未发货，需要履约2：被换商品，不需要履约3：换来商品且订单未发货，需要履约4：删除换货，不需要履约

beExchangeEntityId
​
原订单上被换商品的goodsId

billNo
​ info.billNo=原订单号
​ info.billNo=原订单号

## 
四、换货订单接口调用说明

1.订阅订单状态变更通知：
/order_push_notice

   订单发生换货时会触发推送消息

2.请求订单列表：
/open-api/order/order-list

   从接口可以获取到一段时间内的订单和换货订单

3.请求订单详情：
/open-api/order/order-detail

   订单号、换货单号都支持获取订单详情

## 
五、常见问题说明

1.为什么原单号和换货单的单号是一样的呢？

单号虽然展示相同，但是换货单会增加展示一个换货订单标识，同时你可以查看到新的履约单号

​

2.如何确保能及时拉取到换货单呢？

可以订阅订单同步通知（/order_push_notice），产生订单换货时会推送消息。

3.怎么知道换货单号与原订单的对应关系？

/open-api/order/order-detail接口换货单号中info.billNo=原订单号

4.为什么换过货的订单状态仍然是正常状态而不是换货订单，即orderType=1？

换过货的原订单会展示orderType=1，生成的新换货单状态才会是换货订单，即orderType=2

5.换货订单如何履约？

在履约场景，需要入参
orderNo的都更换成换货单号履约即可，
换货订单的发货流程与普通订单发货一致。

## 解决方案 / 半托管解决方案 / 半托管模式接入指南

- Page ID：`3609ce46-f50e-49ef-8314-d9ea0172fa1e`
- 路径：`https://open.sheincorp.com/documents/system/3609ce46-f50e-49ef-8314-d9ea0172fa1e`

# 
半托管模式接入指南

# 
1 模式说明

半托管模式下，商家负责提供商品，备货在海外本地，自行履约配送至消费者，SHEIN协助卖家运营店铺。

# 
2 创建应用

开发者需要先注册开发者账号、创建应用后才可开始正式对接，整体流程可参考文档
开发指南
。

- 
应用类型选择：半托管

- 
可授权的商家范围：半托管模式商家、墨西哥地区的全托管模式商家

# 
3 对接业务接口、通知

开发者开发半托管模式应用时，常规情况下可以对接
商品、商品合规、客单、库存、财务
模块的接口。

开放平台基于业务场景提供了解决方案，即说明某个业务场景如何通过接口实现。下面会按业务模块维度，介绍半托管模式在各模块内可利用的解决方案、可对接的接口、通知。

## 
3.1 商品

半托管模式的商品特征

- 
商家提供成本价

- 
商家可随时控制商品的上下架状态

解决方案名称
文档地址

商品发布
https://open.sheincorp.com/documents/system/115a679e-f21f-44e1-84db-466a5d0730eb

商品属性
https://open.sheincorp.com/documents/system/424039e8-4657-454a-a4cb-781938a42622

商品图片
https://open.sheincorp.com/documents/system/4d96fc8f-4913-4211-8630-5d81e7fcc010

商品证书
https://open.sheincorp.com/documents/system/a4c9a5c4-75db-4f99-bbaf-0e47b34bda80

类型
接口名称
接口路径

API
商品发布
/open-api/goods/product/publishOrEdit

API
商品发布规范
/open-api/goods/query-publish-fill-in-standard

API
查询店铺分类树
/open-api/goods/query-category-tree

API
根据商品图片查询类目
/open-api/goods/image-category-suggestion

API
查询店铺可用属性
/open-api/goods/query-attribute-template

API
查询分类是否可自定义属性值
/open-api/goods/get-custom-attribute-permission-config

API
添加自定义属性值
/open-api/goods/add-custom-attribute-value

API
查询店铺站点和币种信息（新）
/open-api/goods/query-site-list

API
查询店铺站点和站点币种（旧）
/open-api/openapi-business-backend/site/query

API
图片链接转换
/open-api/goods/transform-pic

API
本地图片上传
/open-api/goods/upload-pic

API
查询店铺品牌列表
/open-api/goods/query-brand-list

API
查询商品审核
/open-api/goods/query-document-state

API
商品列表
/open-api/openapi-business-backend/product/query

API
spu查询
/open-api/goods/spu-info

API
更新商品供货价
/open-api/goods/update-cost

API
商品上下架
/open-api/goods/modify-skc-shelf

API
查询证书所需上传资料（新）
/open-api/goods/certificate/get-all-certificate-type-list-v2

API
查询商品证书要求和审核状态
/open-api/goods/get-certificate-rule

API
上传证书文件
/open-api/goods/upload-certificate-file

API
商品证书池创建/编辑
/open-api/goods/save-or-update-certificate-pool

API
店铺证书池创建/编辑
/open-api/goods/save-or-update-supplier-certificate

API
SKC绑定商品证书池
/open-api/goods/save-certificate-pool-skc-bind

webook
商品接收通知
/product_document_receive_status_notice

webook
商品审核通知
/product_document_audit_status_notice

webook
商品上下架通知
/product_shelves_notice

webook
商品额度变动通知
/product_quota_change_notice

## 
3.2 商品合规

商品销往欧洲市场时，会需要使用合规能力，为商品提供环保标、GPSR标、实拍图等。

解决方案名称
文档地址

商品合规
https://open.sheincorp.com/documents/system/af751fbf-0a24-484a-98fe-377654bd62d7

类型
接口名称
接口路径

API
获取全量环保耗材信息（新）
/open-api/goods-quality/environmental-label-rule/material-quality-tree-v2

API
获取全量耗材类型和耗材材质信息
/open-api/goods-quality/environmental-label-rule/material-quality-tree

API
获取环保标配置规则
/open-api/goods-quality/environmental-label-rule/list

API
批量打印环保标
/open-api/goods-quality/environmental-label-rule/print

API
打印合规标签
/open-api/goods-compliance/label-print

API
查询代理公司列表
/open-api/goods-compliance/agency-list

API
查询SKC的代理公司绑定要求
/open-api/goods-compliance/skc-agency-detail

API
绑定SKC和代理公司
/open-api/goods-compliance/save-skc-agency

API
查询SKC的实拍图要求
/open-api/goods-compliance/skc-label-list

API
上传实拍图图片
/open-api/goods-compliance/upload-skc-label-picture

API
绑定SKC和实拍图
/open-api/goods-compliance/skc-save-label

webook
商品合规信息失效通知
/product_compliance_change_notice

## 

## 
3.3 客单管理

解决方案名称
文档地址

客单履约
https://open.sheincorp.com/documents/system/b86df826-638d-4128-9f5e-c7b20d8cf28e

超大包裹拆包
https://open.sheincorp.com/documents/system/7039b56b-69c7-43b1-a706-50d418d723e8

​客单退货退款
https://open.sheincorp.com/documents/system/949a61a4-bb8b-4683-922a-8755e079b394

类型
接口名称
接口路径

API
获取订单列表
/open-api/order/order-list

API
获取订单详情
/open-api/order/order-detail

API
导出地址
/open-api/order/export-address

API
订单发货渠道查询
/open-api/order/express-channel

API
获取快递公司信息
/open-api/order/express-infos

API
批量上传运单号
/open-api/order/import-batch-multiple-express

API
回传发票信息
/open-api/order/sync-invoice-info

API
打印面单接口
/open-api/order/print-express-info

API
确认无货
/open-api/order/confirm-no-stock

API
确认超限拆分包裹
/open-api/order/unpacking-group-confirm

API
取消超限拆分包裹
/open-api/order/unpacking-group-remove

API
获取退货单列表
/open-api/return-order/list

API
获取退货单详情
/open-api/return-order/details

API
退货单签收
/open-api/return-order/sign-return-order

webook
订单同步通知
/order_push_notice

webook
退货单同步通知
/return_order_push_notice

## 

## 

## 
3.4 库存

半托管模式的库存管理特征

- 
商家需维护自己的商家仓库列表

- 
按商家仓库维度管理商品库存信息

类型
接口名称
接口路径

API
商家仓库列表查询
/open-api/msc/warehouse/list

API
查询库存
/open-api/stock/stock-query

API
修改库存接口
/open-api/gsp/goods/change-inventory

## 
3.5 财务

类型
接口名称
接口路径

API
查询对账单列表
/open-api/finance/get-check-order-list

API
查询对账单详情
/open-api/finance/get-check-order-detail

# 

# 

# 
4 关联阅读

开发者接入指南

店铺授权指南

API调用指南

事件回调接入指南

## 解决方案 / 半托管解决方案 / 商品发布-半托管

- Page ID：`115a679e-f21f-44e1-84db-466a5d0730eb`
- 路径：`https://open.sheincorp.com/documents/system/115a679e-f21f-44e1-84db-466a5d0730eb`

商品发布 - 半托管模式

## 
 

# 
方案概述

## 
适用范围

本文档仅适合【应用类型=半托管】的应用。

 

## 
业务流程

本文档介绍商品发布/商品上传流程。主要包含4个阶段：发布准备、发布商品、等待平台审核、获取审核结果。

文档将会详细介绍，每个阶段所用接口、调用逻辑、调用注意事项。

 
 
 

 

## 
商品上传接口调用流程

 
 
 

 

#### 
 

## 
商品上传API&消息清单

API名称
API & 文档地址

查询商品发布字段规范
 
/open-api/goods/query-publish-fill-in-standard
 

查询店铺可用品牌
 
/open-api/goods/query-brand-list
 

查询店铺可售站点以及站点对应的币种&语种
/open-api/goods/query-site-list

查询店铺可用分类
 
/open-api/goods/query-category-tree
 

查询店铺可用属性
 
/open-api/goods/query-attribute-template
 

查询是否支持自定义属性值
 
/open-api/goods/get-custom-attribute-permission-config
 

添加自定义属性值
 
/open-api/goods/add-custom-attribute-value
 

转换图片成SHEIN可用的图片
 
/open-api/goods/transform-pic
 

本地图片上传
 
/open-api/goods/upload-pic
 

商品发布&编辑
 
/open-api/goods/product/publishOrEdit
 

查询商品审核状态
 
/open-api/goods/query-document-state
 

查询SPU商品详情
 
/open-api/goods/spu-info
 

 

消息名称
event_code & 文档地址

商品公文接收结果通知
 
/product_document_receive_status_notice
 

商品公文审批结果通知
 
/product_document_audit_status_notice

 

# 

# 

# 
商品上传详细步骤

## 
1、商品上传发布准备

半托管店铺在发布商品时，需提供的商品信息包括：

 ● 
品牌：商家可销售的品牌。商家先在商家后台创建，可通过API获取可售品牌。

 ● 
类目：商家可销售的类目。商家入驻后，平台会依据商家情况为其店铺分配可销售的类目，可通过API获取可售类目。

 ● 
属性：商品各维度属性，辅助买家全面了解商品。商品可用的属性，由平台决定，不同类目会有不同可用属性，可通过API获取。

 ● 
图片：商品图片由商家提供，可来自本地文件或线上链接，但需要将其转换成SHEIN平台的图片链接才可使用，可通过API完成转换。

 ● 
描述：商品描述由商家提供，当商品上架多个国家站点时，会需要提供多个语种的描述。

 ● 
成本价：半托管店铺提供商品时只需要提供成本价，销售价由平台决定。

 ● 
销售站点：商家可售卖的SHEIN站点。商家入驻后，平台会依据商家情况决定其店铺商品可上架的站点。可通过API获取。

 ● 
库存：商品可销售的库存信息。商家先在商家后台维护仓库信息，在将商品库存维护到具体仓库。可通过API获取仓库信息。

 

### 

### 
1.1 获取商品发布规范

因市场政策、类目规则等因素，不同店铺、不同类目对商品发布会有不同要求，例如：某些非必填字段要求必填。同时平台的要求在不断变化，因此建议在每次发品之前，先查询发布规范，基于规范去要求商家提供信息，然后发布商品，可提升商家的发品效率。

如何获取

- 
通过接口：
/open-api/goods/query-publish-fill-in-standard

- 
使用说明：

- 
请求说明

- 
常规情况：大部分规范绑定在店铺维度，所以请求时只关注请求头即可

- 
特殊情况：当你要确认商品图片需要按什么要求提供时，需要关注请求体，提供"
category_id
"或"
spu_name
"。商品图片要求绑定在分类维度。

- 
返回说明

- 
"default_language"：商品默认语种；发布商品接口中商品名称多语言"
multi_language_name_list
"、商品描述多语言"
multi_language_desc_list
"中，
必须提供默认语种对应的内容。

- 
"
fill_in_standard_list
"：告知商品发布接口中时，哪些非必填的字段会变成必填。下方表格是两个接口中参数的映射关系。

- 
"picture_config_list"：告知商品图片上传要求。目前平台有多套图片要求，
请详细阅读文档：API支持上传SPU和SKU维度图片
。

"fill_in_standard_list"映射关系

发布规范接口中"field_key"枚举值
此枚举在商品发布接口中对应的入参字段

reference_product_link
competing_product_link 

proof_of_stock
proof_of_stock_list

shelf_require
shelf_require

brand_code
brand_code

skc_title
skc_title

minimum_stock_quantity
minimum_stock_quantity

stop_purchase
stop_purchase

mall_state
mall_state

### 
1.2 获取可用品牌

获取商家可销售品牌，供商家选用。商家先在商家后台创建品牌，才可通过API获取品牌信息。

如何获取

 ● 
通过接口：
/open-api/goods/query-brand-list

 ● 
使用说明：海外市场发布商品必须提供品牌，否则会影响C端展示；其他店铺是否必传，请以
商品发布规范信息
为准。

#### 

### 
1.3 获取可用类目树

获取店铺可用的类目，供商家选用。同时，商品可用属性绑定在类目下，获取属性时也会用到类目信息。

类目介绍

 ● 
不同店铺可用的类目不同，SHEIN会根据店铺的售卖地区、类型等因素决定店铺可用类目。

 ● 
类目下有多层子类目，不同类目下的子类目层级数量不同。

 ● 
类目下最后一层称为【末级类目】，商品与【末级类目】关联，且一个商品只会关联一个【末级类目】。

如何获取类目树

 ● 
通过接口：
/open-api/goods/query-category-tree

 ● 
使用说明

     ○ 
返回说明

         ■ 
需关注【末级类目】的概念，因为大部分商品接口中使用的都是【末级类目】的"category_id"。【末级类目】的判定方式："
last_category
"=true

         ■ 
需关注字段"product_type_id"，仅末级类目中有值，可理解为某个末级分类的信息模板。在发布商品、查询可用属性中都会用到。

### 
1.4 获取类目下可用属性

获取此商品类目下可用的所有属性、属性值，供商家选用/填写。

属性介绍

 ● 
不同【末级类目】有不同的可用属性。

 ● 
SHEIN决定每个类目下的可用属性、以及每个属性下可用的属性值。部分属性支持添加自定义属性值，可通过接口确认：
/open-api/goods/get-custom-attribute-permission-config

如何获取属性

 ● 
通过接口：
/open-api/goods/query-attribute-template

 ● 
使用说明：

    ○ 
请求参数使用的是末级类目的"
product_type_id
"，不是"
category_id"；
支持批量查询。

    ○ 
接口会返回指定的末级类目下所有属性以及所有属性值（目前包括自定义属性，但后续可能不再返回，建议开发者自己保存一份数据）

如何使用属性

根据属性的信息，明确此属性在商品发布接口中如何使用。

 ● 
如何判断属性在商品发布接口中对应哪个入参？

     ○ 
可通过属性类型概念去判断。

     ○ 
属性类型需要通过多个属性信息联合判断。

属性类型
判断方式
此类型在商品发布接口中的传参

主销售属性
attribute_type=1 & attribute_label=1注意：1个商品只有1个主销售属性
skc_list -> sales_attribute

次销售属性
attribute_type=1 注意：主销售属性可以作为次销售属性；1个商品最多可以有2个次销售属性。
sku_list -> sales_attribute

商品属性
attribute_type=3/4
product_attribute_list

尺码表属性
attribute_type=2
size_attribute_list

 ● 
如何确定属性是否必填：通过"
attribute_status
"判断，
1-不填；2-选填；3-必填；不填代表历史存在过但已停用的属性，可不填。

 ● 
属性值的输入方式：通过"
attribute_mode
"判断。当输入方式为下拉选择时，可选内容来自于属性值"
attribute_value_info_list
"。当可选属性值中没有商家想要的内容，需要自定义属性值时，可参考下方流程：

     ○ 
先确定属性是否支持添加自定义属性值：
/open-api/goods/get-custom-attribute-permission-config

     ○ 
若支持添加，则通过接口添加属性值：
/open-api/goods/add-custom-attribute-value

     ○ 
添加成功后保存返回的属性值ID"
attribute_value_id
"，或通过接口再次查询可用属性（不推荐）：
/open-api/goods/query-attribute-template

### 

### 
1.5 将图片转换为SHEIN链接

通过API发布商品时提供的图片URL，必须为SHEIN可用的URL。需要提前将本地图片或在线URL转换为SHEIN URL后，再提交。

本地图片上传

 ● 
接口地址：
/open-api/goods/upload-pic

 ● 
上传之前，请先确认图片是否满足
SHEIN平台的图片规范
，不满足规范会转换失败。

外部在线链接转换

 ● 
接口地址：
/open-api/goods/transform-pic

 ● 
转换之前，请先确认图片是否满足
SHEIN平台的图片规范
，不满足规范会转换失败。

## 

## 

## 
2、上传/发布商品

 ● 
发布商品接口：
/open-api/goods/product/publishOrEdit

 ● 
以下是半托管应用，在发布商品时会使用到的参数

字段
类型
是否必填 

发布新品场景
是否必填 

编辑商品场景
字段描述

brand_code
string
否
否
商品品牌。SHEIN内部生成的品牌CODE。 通过接口
【商品发布字段规范（含默认语种）】
查询是否该字段必填

category_id
int64
是
是
商品所属的末级类目id。 通过
【店铺查商品末级类目】
获取。

product_type_id
int64
是
是
商品所属的商品类型id。 末级分类对应的类型ID。 通过
【店铺查商品末级类目】
获取

source_system
string
否
否
固定为openapi

spu_name
string
否
是
商品的spuName。SHEIN内部生成的SPU唯一标识。 创建商品场景不用传，商品发布成功以后的场景必传。

suit_flag
string
否
否
商品是否为套装：1-是；0-否。

supplier_code
string
是
是
卖家SPU维度的货号。由卖家自定义。最多200个字符。

is_spu_pic
boolean
否
否
是否选择新版图片上传方案。 新版图片上传方案的详细信息，详细参考文档。

image_info >
object[]
否
否
SPU维度商品图片。 上传图片的要求，详细参考
文档
。

 image_group_code
string
否
是
图片组编码。由平台生成的编码。 创建商品场景不用传，商品发布成功以后的场景必传。

 image_info_list >
object[]
否
是
图片列表

 image_item_id
int64
否
是
图片唯一id。由平台生成。 创建商品场景不用传，商品发布成功以后的场景必传。

 image_sort
integer
是
是
图片排序序号。

 image_type
integer
是
是
图片类型：1-主图,2-细节图,5-方块图,6-色块图

 image_url
string
否
否
图片链接。链接必须转换成SHEIN链接。 可使用接口
【图片链接转换】
或
【本图片上传】
转换为SHEIN链接。

multi_language_desc_list >
object[]
是
是
商品描述的多语言列表。 商品的默认语种以及对应的描述，必传。

 language
string
是
是
语种缩写。缩写：

 name
string
是
是
描述文本，最大5000字符

multi_language_name_list >
object[]
是
是
商品名称的多语言列表。 商品的默认语种以及名称，必传。默认语种可通过

## 解决方案 / 半托管解决方案 / 商品编辑-半托管

- Page ID：`512f42f9-80c5-4753-b23d-c8fdf648a1a4`
- 路径：`https://open.sheincorp.com/documents/system/512f42f9-80c5-4753-b23d-c8fdf648a1a4`

# 
商品编辑-半托管

## 

# 
1 确认商品能否编辑

商品必须满足以下两个条件才可编辑：

1、商品SPU已发布且通过平台审核

      确认方式：若SPU能在
/open-api/goods/spu-info
中查询到结果，说明已通过审核。

      若SPU的首次发布没有审核通过，请基于新发布商品的调用逻辑，调整信息后重新发布。

2、商品当前没有其他进行中的审核流程

     确认方式：使用spuName查询接口
/open-api/goods/query-document-state
。当响应的skcList中，没有skc的
documentState=1/5，代表商品没有进行中的审核流程。参考的返回示例如下。

{
    "code": "0",
    "msg": "OK",
    "info": {
        "data": [
            {
                "spuName": "c250722589993",
                "version": "SPMP250724229942289",
                "skcList": [
                    {
                        "skcName": "sc25072258999337915",
                        "documentSn": "SPMPM1020250724001140",
                        "documentState": 2, //不可等于1或5
                        "failedReason": null
                    },
                    {
                        "skcName": "sc25072258999308304",
                        "documentSn": "SPMPM1020250724001141",
                        "documentState": 2,//不可等于1或5
                        "failedReason": null
                    }
                ]
            }
        ],
        "meta": {
            "count": 1,
            "customObj": null
        }
    },
    "bbl": null,
    "traceId": "5e0819423f8012b7"
}

# 
2 可编辑/不可编辑内容

编辑商品涉及到多个接口，每个接口都有各自可编辑、不可编辑的范围见下表，每个接口的使用方式详见文档3

接口信息
可编辑内容
不可编辑内容

商品发布&编辑

/open-api/goods/product/publishOrEdit
1、编辑已发布的SPU/SKC/SKU的以下信息：

商品标题、描述、品牌、包装重量

商品分类、商品属性、尺码属性

所有类型的商品图片

所有类型的商品货号

2、在已发布的SPU下新增SKC或SKU
不可编辑已发布SPU/SKC/SKU的以下信息

商品供货价；

建议零售价；

商品主销售属性、次销售属性；

商品库存；

上架站点

更新商品供货价

/open-api/goods/update-cost
商品在所有站点的供货价
仅支持左侧内容

更新商品上架状态

/open-api/goods/modify-skc-shelf
商品在某站点的上架状态
仅支持左侧内容

更新商品库存

/open-api/gsp/goods/change-inventory
商品在某个仓库中的库存值
仅支持左侧内容

# 
3 商品发布&编辑接口

- 
接口地址：
/open-api/goods/product/publishOrEdit

- 
商品发布和编辑共用一个接口，因此这个接口在编辑商品可做到2个场景：
编辑已发布的SPU/SKC/SKU信息、在SPU下发布新的SKC/SKU

## 
3.1 编辑已发布的SPU/SKU/SKC信息

接口信息
可编辑内容
不可编辑内容

商品发布&编辑

/open-api/goods/product/publishOrEdit
1、编辑已发布的SPU/SKC/SKU的以下信息：

商品标题、描述、品牌、包装重量

商品分类、商品属性、尺码属性

所有类型的商品图片

所有类型的商品货号

2、在已发布的SPU下新增SKC或KU
不可编辑已发布SPU/SKC/SKU的以下信息

商品供货价；

建议零售价；

商品主销售属性、次销售属性；

商品库存；

上架站点

核心规则

- 
编辑场景中，入参中都必须有SPU（spu_name）、至少一个SKC（skc_list）、至少一个SKU（sku_list）

- 
编辑时，必须入参平台生成的对象唯一编码，例如spu_name、skc_name、sku_code、image_group_code等

- 
编辑时，并非所有商品信息都可编辑，拆分为可编辑字段、不可编辑字段进行说明

- 
可编辑字段：
编辑时入参的字段，全部按覆盖逻辑处理
。即若不给字段A则代表商品不需要字段A，字段A的值按清空处理；若给字段"filedA":"value1"，则代表fieldA会更新为value1。

- 
不可编辑字段：
编辑时不可在字段中给出入参，给了就会报错编辑失败
（大部分按这个逻辑走，个别字段除外，例如销售属性）

- 
下面是编辑场景下接口入参的使用说明（因篇幅问题，仅对需要关注的字段、对象进行说明）

字段名
字段名
字段名
​编辑时是否必填
是否可被编辑
​数据来源
编辑说明

brand_code
部分情况必填
可编辑
/open-api/goods/spu-info：brandCode
不传字段时，按清空处理。若原本有品牌，或要更新品牌，则需要填写

category_id
必填
可编辑
/open-api/goods/spu-info：categoryId
一定条件下可编辑。当新分类下的主&次销售属性包含了已发布SKC、SKU的销售属性时，可编辑

product_type_id
必填
可编辑
/open-api/goods/spu-info：productTypeId

注意：此处一定要查询SPU中返回信息为准，平台有修改category_id和product_type_id间关联关系的情况。如果使用查询店铺分类树中获取的关系入参，会出现报错。
当分类被编辑时，此字段也需要更新为新分类对应的product type id

spu_name
必填
不可编辑
/open-api/goods/spu-info：spuName
提供平台生成值，可通过接口获取：/open-api/openapi-business-backend/product/query

supplier_code
必填
可编辑
/open-api/goods/spu-info：supplierCode
需注意此code全店唯一，不可重复

suit_flag
必填
不可编辑
无来源但API不支持套装，因此需给0
商品接口暂不支持套装信息，因此必须给0

is_spu_pic
部分情况必填
可编辑
/open-api/goods/spu-info：需基于已发布图片的组合情况判断
不传字段时，默认按false处理。若原本此字段需要更新为true，则字段必填。

image_info
部分情况必填
可编辑
/open-api/goods/spu-info：spuImageInfoList
不传字段时，按清空图片处理。若原本有提供SPU图片，或需要更新SPU图片时，必须给出完整的list数据；编辑时必须image_group_code，可以不提供image_item_id。

multi_language_desc_list
部分情况必填
可编辑
/open-api/goods/spu-info：productMultiDescList
不传字段时，按清空处理。若原本有提供描述，或要更新描述，必须给出所有语种的描述。

multi_language_name_list
部分情况必填
可编辑
/open-api/goods/spu-info：productMultiNameList
不传字段时，保留原值。若需要修改商品标题，则需要给出所有语种的名称，并且编辑时需带上所有已发布的SKC信息，SKC带数方式见下方2

product_attribute_list
部分情况必填
可编辑
/open-api/goods/spu-info：productAttributeInfoList

注意：productAttributeInfoList包含商品属性、销售属性。需ERP自行剔除其中的销售属性。销售属性可通过此接口的saleAttributeList的销售属性获取，剔除后就只剩商品属性
不传字段时，按清空处理

若原本有提供属性或要更新属性，需要给出完整属性列表。注意如果更换了分类，则需要给新分类下的商品属性。

site_list
不可填
不可编辑
/open-api/goods/spu-info：shelfStatusInfoList
无法通过此接口修改商品的上架站点范围。

若商品需要上架至新的站点，需要先通过/open-api/openapi-business-backend/product/price/save为商品在新站点A定价，再通过/open-api/goods/modify-skc-shelf将商品上架至站点A

若商品需要从站点B下架，需通过/open-api/goods/modify-skc-shelf处理

size_attribute_list
部分情况必填
可编辑
/open-api/goods/spu-info：dimensionAttributeInfoList
不传字段时，按清空处理

若原本有提供属性或要更新属性，需要给出完整属性列表。注意如果更换了分类，则需要给新分类下的属性。

sale_attribute_sort_list
部分情况必填
可编辑
无
不传字段时，按清空处理

若原本有提供排序，需要给出完整列表。注意如果更换了分类，则需要给新分类下的属性。

skc_list
必填
部分可编辑
/open-api/goods/spu-info：skcInfoList
不论编辑信息还是发布新SKC，入参里都需要有skc list

image_info
部分情况必填
可编辑
/open-api/goods/spu-info：skcImageInfoList
不传字段时，按清空图片处理。

若原本有提供SKC图片，或需要更新SKC图片时，必须给出完整的list数据；编辑时必须image_group_code，可以不提供image_item_id。

sale_attribute
必填
不可编辑
/open-api/goods/spu-info：skcInfoList - attributeId skcInfoList - attributeValueId
已发布的SKC不可修改属性

skc_name
必填
不可编辑
/open-api/goods/spu-info：skcName
可通过接口获取：/open-api/openapi-business-backend/product/query

supplier_code
必填
可编辑
/open-api/goods/spu-info：skcInfoList -supplierCode
需注意此code全店唯一，不可重复

skc_title
部分情况必填
可编辑
无来源
不传字段时，按清空处理。若原本有提供名称，或要更新名称则需要填写

suggested_retail_price
不可填
不可编辑
/open-api/goods/spu-info：srpPriceInfo
编辑时不可提供此字段，会报错编辑失败

site_detail_image_info_list
部分情况必填
可编辑
/open-api/goods/spu-info：siteDetailImageInfoList
不传字段时，按清空图片处理。

若原本有提供图片，或需要更新图片时，必须给出完整的list数据；编辑时必须image_group_code，可以不提供image_item_id。

proof_of_stock_list
部分情况必填
可编辑
/open-api/goods/spu-info：proofOfStockInfoList
不传字段时，按清空处理。

若原本有提供信息，或要更新信息则需要填写

shelf_way
必填
不可编辑
无来源
编辑已发布SKC时需传值但不可编辑，即使传值也不会生效

hope_on_sale_date
部分情况必填
不可编辑
无来源
编辑已发布SKC时需传值但不可编辑，即使传值也不会生效

sku_list
必填
部分可编辑
/open-api/goods/spu-info：skuInfoList
即使不更新SKU信息，也需要在入参里体现至少一个已发布的SKU或新的SKU

height
必填
可编辑
/open-api/goods/spu-info：height
更新为编辑时提供的值

length
必填
可编辑
/open-api/goods/spu-info：length
更新为编辑时提供的值

width
必填
可编辑
/open-api/goods/spu-info：width
更新为编辑时提供的值

weight
必填
可编辑
/open-api/goods/spu-info：weight
更新为编辑时提供的值

mall_state
必填
可编辑
/open-api/goods/spu-info：mallState
更新为编辑时提供的值

sku_code
必填
不可编辑
/open-api/goods/spu-info：skcName
提供平台生成值，可通过接口获取：/open-api/openapi-business-backend/product/query

image_info
部分情况必填
可编辑
/open-api/goods/spu-info：skuImageInfoList
不传字段时，按清空处理。

若原本有提供或需要更新时，需给出完整的list数据；编辑时必须image_group_code，可以不提供image_item_id。

supplier_sku
必填
可编辑
/open-api/goods/spu-info：skuInfoList-supplierSku
更新为编辑时提供的值。需注意此code全店唯一，不可重复

competing_product_link
部分情况必填
可编辑
暂无来源
不传字段时，按清空处理。若原本有提供或需要更新时，需给值。

cost_info
不可填
不可编辑
/open-api/goods/spu-info：costInfoList
编辑时不可提供此字段，会报错编辑失败。更新供货价通过/open-api/goods/update-cost

sale_attribute_list
必填
不可编辑
/open-api/goods/spu-info：skuInfoList - saleAttributeList
已发布的SKU不可修改属性

stock_info_list
不可填
不可编辑
/open-api/stock/stock-query
编辑时不可提供此字段，会报错编辑失败。更新库存通过/open-api/gsp/goods/change-inventory

## 
3.2 新增SPU下的SKC/SKU

核心规则

- 
在SPU下发布新的SKC/SKU时，
新的skc_list或sku_list按照商品发布规则填写即可。

- 
发布新SKC/SKU时，入参中可以带上已发布的SKC（更新信息），也可以不带（入参里仅体现新发布信息）

## 
3.3 各场景请求示例

### 

### 
编辑已发布的SPU/SKC/SKU

//即使是编辑SPU信息，也要带上至少一个SKC/SKU

{
  "spu_name": "c250804281025",
  "category_id": 20039919,
  "product_type_id": 2147503231,
  "suit_flag": "0",
  "supplier_code": "4545",
  "is_spu_pic": "false",
  "multi_language_name_list": [
    {
      "language": "en",
      "name": "Bennie For Edit Product SKC 0804"
    },
    {
      "language": "zh-cn",
      "name": "Bennie For Edit Product SKC 0804"
    }
  ],
  "multi_language_desc_list": [
    {
      "language": "en",
      "name": "Bennie For Edit Product SKC 0804"
    }
  ],
  "product_attribute_list": [
    {
      "attribute_id": 2147484223,
      "attribute_value_id": 2147488193
    }
  ],
  "site_list":[
    {
      "main_site":"shein",
      "sub_site_list":["shein-jp"]
    }
  ],
  "skc_list": [
      {
      "skc_name": "sc25080428102519199",
      "sale_attribute": {
        "attribute_id": 2147484187,
        "attribute_value_id": 2147488295
      },
      "supplier_code": "4545",
      "shelf_way":1,
      "image_info": {
        "image_group_code": "G4s4k5w68s54",
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "sku_list": [
        {
          "sku_code": "I4s62c6w43jx",          
          "supplier_sku": "434",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 13527168
            }
          ]
          }
      ]
    }
  ]
}
        

### 

### 

### 

### 
SPU下新增SKC/SKU，同时编辑已发布SKC

{
  "spu_name": "c250804281025",
  "category_id": 20039919,
  "product_type_id": 2147503231,
  "suit_flag": "0",
  "supplier_code": "4545",
  "is_spu_pic": false,
  "multi_language_name_list": [
    {
      "language": "en",
      "name": "Bennie For Edit Product SKC 0804"
    },
    {
      "language": "zh-cn",
      "name": "Bennie For Edit Product SKC 0804"
    }
  ],
  "multi_language_desc_list": [
    {
      "language": "en",
      "name": "Bennie For Edit Product SKC 0804"
    }
  ],
  "product_attribute_list": [
    {
      "attribute_id": 2147484223,
      "attribute_value_id": 2147488193
    }
  ],
  "site_list": [
    {
      "main_site": "shein",
      "sub_site_list": ["shein-jp"]
    }
  ],
  "skc_list": [  
    {                             //这是新增的SKC
      "sale_attribute": {
        "attribute_id": 2147484187,
        "attribute_value_id": 2147488292
      },
      "supplier_code": "45454545",
      "shelf_way": 2,
      "hope_on_sale_date": "2025-08-25 00:00:00",
      "image_info": {
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "sku_list": [
        {
          "supplier_sku": "434998",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id": 13
            }
          ],
          "cost_info": {
            "cost_price": 2,
            "currency": "CNY"
          },
          "stock_info_list": [
            {
              "inventory_num": 100,
              "supplier_warehouse_id": "PS7448683004"
            }
          ]
        }
      ]
    },
    {                              //这是编辑已有SKC
      "skc_name": "sc25080428102519199",
      "sale_attribute": {
        "attribute_id": 2147484187,
        "attribute_value_id": 2147488295
      },
      "supplier_code": "4545",
      "shelf_way": 2,
      "hope_on_sale_date": "2025-08-21 00:00:00",
      "image_info": {
        "image_group_code": "G4s4k5w68s54",
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }

# 
4 更新商品供货价

- 
接口地址：/open-api/goods/update-cost

- 
此接口支持场景：更新商品在所有站点中的供货价（半托管商品在多个站点中供货价、币种相同）

{
    "spu_name": "xS25121523423",
    "skc_info_list": [
        {
            "skc_name": "sf24112312321581",
            "sku_info_list": [
                {
                    "cost": "10.55",
                    "currency": "EUR",
                    "sku_code": "I1231281em4e"
                },
                {
                    "cost": "10.55",
                    "currency": "EUR",
                    "sku_code": "I12312311ew4e"
                },
                {
                    "cost": "10.55",
                    "currency": "EUR",
                    "sku_code": "I122211281ef4e"
                }
            ]
        }
    ]
}

# 

# 

# 

# 
5 更新商品上下架状态

- 
接口地址：/open-api/goods/modify-skc-shelf

- 
商品若已上架A站点，后续又想要上架B站点，则需要先为B站点的商家仓内维护商品库存，然后再通过/open-api/goods/modify-skc-shelf上架至B站点。

{
    "skc_site_info_list":[
        {
            "shelf_state":2,
            "site_list":["shein-uk","shein-fr"],
            "skc_name":"sd25072111416469171"
        }
    ]
}

# 
6 更新商品库存

- 
接口地址：/open-api/gsp/goods/change-inventory

- 
支持修改商品在指定仓库内的库存值，当店铺内有多个仓库时必须提供仓库信息。

{
    "updateSkuInventoryQuantityRequests":[
        {
            "skuCode":"I6pm4j97ovv5",
            "warehouseCode":"PS2697156399",
            "changeInventoryQuantity":100
        }
    ]
}

## 解决方案 / 半托管解决方案 / 商品属性

- Page ID：`424039e8-4657-454a-a4cb-781938a42622`
- 路径：`https://open.sheincorp.com/documents/system/424039e8-4657-454a-a4cb-781938a42622`
- 简介：本文旨在帮助开发者们了解和熟悉在创建商品时需要必填的属性如何设置，以及平台的相关要求。

# 
商品属性

# 

# 
1 方案概述

- 
本文档适用于【应用类型=自运营/半托管/全托管/POP】的应用。

- 
商品属性会在商品发布/编辑场景中使用（即接口：/open-api/goods/product/publishOrEdit）。本文档会介绍商品属性的基础定义、获取方式、使用方式。

# 
2 商品属性结构

属性类型
​属性定义
是否必填
属性数量
商家后台的配置界面
​C端看到的属性界面

商品属性
描述商品特性，帮助消费者在购买时了解商品详细情况。例如材质、成分、风格、税务
需通过接口确认
支持0~多个

尺寸属性
商品规格维度的尺码信息，如服装、鞋类等，提供有关不同尺码的详细信息，确保消费者能够找到合适的尺码
需通过接口确认
支持0~多个

主销售属性（主规格）
​消费者在选购时选择的属性，一般为颜色
必填
有且只有1个

次销售属性（其他规格）
消费者在选购时选择的属性，例如尺寸和款式等
需通过接口确认
支持0~2个属性

# 

# 
3 商品属性使用方式

### 
3.1 获取可用的属性

- 
通过接口查询某个商品分类下可用的属性，以及属性下的属性值。接口地址：
/open-api/goods/query-attribute-template

- 
属性信息中包含2部分属性自身信息属性下可用的属性值列表：attribute_value_info_list

- 
以下是属性信息的代码示例，以及重要字段的说明

"attribute_infos": [
          {
            "attribute_id": 31,
            "attribute_name": "细节",
            "attribute_name_en": "Details",
            "attribute_remark_list": [1],
            "attribute_is_show": 1,
            "attribute_label": 0,
            "attribute_mode": 1,
            "attribute_input_num": 10,
            "attribute_status": 2,
            "attribute_type": 4,
            "attribute_value_info_list": [
              {
                "attribute_value_id": 501,
                "attribute_value": "珍珠",
                "attribute_value_en": "Pearls",
                "is_custom_attribute_value": false,
                "is_show": 1,
                "attribute_value_group_list": null
              }
             ],
            "site_title": null,
            "site_url": null,
            "skc_scope": null
         ]
字段归属
字段名
字段定义

属性
attribute_id
属性id

attribute_name
属性名称

attribute_is_show
属性是否会在买家商详页内显示。1-展示；2-不展示

attribute_type
属性种类。1-销售属性（覆盖主销售、次销售属性）；2-尺寸属性；3-成分属性；4-普通属性

attribute_label
是否为主销售属性。1-是；0-否

attribute_mode
属性值的录入方式。0: 手工填写参数；1:下拉多选;2:下拉单选(只针对销售属性);3:下拉单选；4:下拉列表+手工填写参数

attribute_input_num
多选属性的属性值数量上限（attribute_mode=1）。0代表无限制

attribute_status
判断属性是否必填 。1:属性不填（即属性不能被使用）; 2:属性选填; 3:属性必填

attribute_remark_list
属性的业务场景，对使用逻辑没有影响。1:重要,2:合规,3:质量,4:关务

属性值
attribute_value
属性值名称

attribute_value_id
属性值ID

is_show
属性值是否会在买家商详页内显示

is_custom_attribute_value
判断是否为商家自己添加的自定义属性值，true代表是，false代表否

### 
3.2 确认属性在商品发布接口的入参字段

商品发布接口中的属性字段
什么样的属性信息在此字段中入参

product_attribute_list：商品属性
attribute_type=3/4

​size_attribute_list：尺寸属性
attribute_type=2

​skc_list → sale_attribute：主销售属性
attribute_type=1 且 attribute_label=1

sku_list → sale_attribute_list​：次销售属性
attribute_type=1 且 attribute_label=1/0（主销售属性也可以入参到次销售属性中）

### 
3.3 确认属性是否必填

属性必填有3种情况

- 
商品的主销售属性必填：每个商品有且必须要有1个主销售属性，所以skc_list → sale_attribute中必须入参属性

- 
某个属性自身必填：基于政策或品类的要求，部分属性会要求商家必填。可通过attribute_status=3（属性必填）来判断，如果必填属性没有在入参中体现，商品发布会报错

- 
属性间关联必填基于合规的要求，当商品中填写了A属性，则B属性也要求必填（B属性原本可能是非必填）关联必填的规则，目前没有接口对外透出。在发布商品时，会通过报错体现，请引导商家按照报错提示调整。报错规范如下

### 
3.4 确认属性值的输入方式

属性值的输入方式主要依赖
attribute_mode字段，
但也有一些特殊情况，详见下方表格

判断方式
属性值的入参方式
​商家后台的操作界面

​attribute_mode=0（手工输入值）
由商家自定义属性值，仅支持录入正整数，尺码属性中常见。

在商品发布接口中，不需要入参attribute_value_id，将属性值入参至attribute_extra_value

"size_attribute_list": [

    {

      "attribute_id": 85,

      "attribute_extra_value": "100",

      "relate_sale_attribute_id": 87,

      "relate_sale_attribute_value_id": 1006040

    }

  ]

​​attribute_mode=1（下拉多选）
​下拉多选。商品属性中常见。

如果商家在属性A下选择多个属性值，在商品发布接口中，需要传多组attribute_id、attribute_value_id的数据。不可以在attribute_value_id中传数组。多选的上限值，通过attribute_input_num判断。

"product_attribute_list": [{

      "attribute_id": 31,

      "attribute_value_id": 501

    },

    {

      "attribute_id": 31,

      "attribute_value_id": 565

    }]

​​​attribute_mode=2（下拉单选，销售属性专用）
下拉单选。只有销售属性才会出现此输入类型。

​​​​attribute_mode=3（下拉单选）
下拉单选。商品属性中常见。

在商品发布接口中，某个attribute_id只能有一组数据

​attribute_mode=4（下拉多选+手工输入）
下拉多选+手工输入。商品属性中常见。

即在商品发布接口中，可传多组attribute_id、attribute_value_id、attribute_extra_value。

常见于数量+单位，例如属性值为单位（双/件），输入数值后，就组成N双。

​​​​​attribute_mode=4 （下拉多选+手工输入）且 attribute_type=3（成分属性）
这类成分属性比较特殊。常见于服装材质成分、日用品涂层成分等。

属性A下可以选属性值a,b,c，每个属性值需要手动输入正整数，
A下的a,b,c三者输入值需相加等于100
。业务上定义就是三者加起来是100%。

"product_attribute_list": [

    {

      "attribute_id": 1000105,

      "attribute_value_id": 63,

      "attribute_extra_value": "50"

    },

    {

      "attribute_id": 1000105,

      "attribute_value_id": 1000145,

      "attribute_extra_value": "50"

    }

  ]

### 
3.5 如何添加自定义属性值

如果平台提供的属性值无法满足需求，可尝试添加自定义属性值，具体流程如下：

- 
先确认属性是否可以添加自定义属性值：
/open-api/goods/get-custom-attribute-permission-config
。若属性的has_permission=1，则可以自定义属性值

- 
通过接口添加属性值：
/open-api/goods/add-custom-attribute-value
。记录下创建成功的attribute_value_id

- 
在商品发布接口中，使用创建好的attribute_value_id

### 
3.6 特别说明：尺码属性

场景
入参示例
商家后台操作界面

商品只有主销售属性时，尺码属性不用关联次销售属性
"size_attribute_list": [

    {

      "attribute_id": 85,

      "attribute_extra_value": "100"

    }

商品有次销售属性时，尺码属性需要关联次销售属性。尺码属性作为横轴，次销售属性作为纵轴，填写组合值。例如：尺码属性宽度，次销售属性尺寸=S/M/L，则会填写S的宽度、M的宽体、L的宽度
"size_attribute_list": [

    {

      "attribute_id": 85,

      "attribute_extra_value": "100",

      "relate_sale_attribute_id": 87,

      "relate_sale_attribute_value_id": 1006040

    }

## 解决方案 / 半托管解决方案 / 商品自定义属性值

- Page ID：`a0f9bf6a-bc89-4a6d-a25f-385cca93f866`
- 路径：`https://open.sheincorp.com/documents/system/a0f9bf6a-bc89-4a6d-a25f-385cca93f866`

# 
销售属性的自定义属性值新方案

# 
适用范围

- 
适用的应用类型：自运营、半托管、全托管、POP

- 
上述类型的应用均可使用新方案

- 
2025年12月1日后创建的应用，必须使用新方案

- 
2025年12月1日前创建的旧应用，可按需对接新方案

# 
新旧方案对比

对比项
旧方案
新方案

数据结构
销售属性的自定义属性值和分类绑定。

自定义属性值【例如：小码】如果想在多个分类下使用，则需在每个分类下创建attribute value id，然后一一对应放在对应分类下使用。

销售属性的自定义属性值和分类解绑，和商家绑定

自定义属性值【例如小码】创建一次后，可以在多个分类下使用。

接口调用流程
场景1：创建新的自定义属性值

查询商家的分类A下有哪些销售属性支持自定义属性值

→ 若支持，则在分类A下，为可自定义的属性创建自定义属性值，获取attribute_value_id

→ 发布/编辑分类A的商品时，在销售属性中下入参attribute_value_id

场景2：使用已创建的自定义属性值

查询店内全量可用属性值

→ 找到is_custom_attribute_value=true的attribute_value_id

→ 发布/编辑商品时，销售属性中入参获取的attribute_value_id
场景1：创建新的自定义属性值

查询商家的分类A下有哪些销售属性支持自定义属性值

→ 若支持，则发布/编辑分类A的商品时，可自定义的销售属性中入参自定义属性值的custom_attribute_value即可，不需要attribute_value_id

场景2：使用已创建的自定义属性值

和场景1相同的操作流程。

系统会对所有自定义属性值去重，即内容一致代表是同一个自定义属性值；且自定义属性值和分类不再关联。只要分类可自定义属性值，就可用店内所有自定义属性值。

商家自定义属性值数量上限
1万
3万

优劣
劣势：商家可用自定义属性值数量少；查询可用属性接口速度慢
优势：商家可用自定义属性值数量增加；查询可用属性接口速度加快

# 

# 
新方案对接方式

### 
1 对接流程

2025年12月1日前创建的应用，在新方案对接完成后，需要联系开放平台，告知上线的应用ID和上线时间。开放平台需要将您的应用进行配置，以确保使用应用的商家全部切换至新方案中。

### 
2 接入说明

#### 
第1步：查询销售属性是否支持自定义属性值
【重要】

- 
平台对于自定义属性值的功能管控颗粒度是【商家+分类+属性】，必须按此逻辑确认属性是否支持自定义属性值。

- 
例如商家1和商家2，均可使用分类A，；分类A下有两个销售属性，S1和S2。在平台的管控下可能出现以下情况

- 
商家1的分类A下的销售属性S1可自定义属性值，S2不可以

- 
商家2的分类A下，S1和S2都不可以自定义属性值

- 
请通过此接口来确认属性是否可自定义：
/open-api/goods/get-custom-attribute-permission-config

- 
"has_permission": 1，代表支持自定义属性值

Example

curl --location --request POST 'https://openapi-test01.sheincorp.cn/open-api/goods/get-custom-attribute-permission-config' \
--header 'x-lt-signature: test0ZWYwZGY5N2VjM2M1ZmNkOGI1NDU0M2VjMTM3NWNiNDk0ZjhmY2E3NThkM2NkMzdkM2VjYzEyNGY5Y2QzN2NhNQ==' \
--header 'x-lt-openKeyId: EED6AEEA6B4741EF94D29FED5A1CE76F' \
--header 'x-lt-timestamp: 1753841948096' \
--header 'language: en' \
--header 'User-Agent: Apifox/1.0.0 (https://apifox.com)' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--header 'Host: openapi-test01.sheincorp.cn' \
--header 'Connection: keep-alive' \
--data-raw '{
  "category_id_list": [
    20039881
  ]
}'

----------------------------------------------------------------------------

响应
{
    "code": "0",
    "msg": "OK",
    "info": {
        "data": [
            {
                "has_permission": 1,
                "last_category_id": 20039881,
                "attribute_id": 2147484187
            },
            {
                "has_permission": 1,
                "last_category_id": 20039881,
                "attribute_id": 2147484186
            }
        ],
        "meta": {
            "count": 2,
            "customObj": null
        }
    },
    "bbl": null,
    "traceId": "84de1e85727ee683"
}

#### 
第2步：发布/编辑商品时通过custom_attribute_value字段创建自定义属性值

- 
发布/编辑商品接口：/open-api/goods/product/publishOrEdit

- 
只有支持自定义属性值的销售属性，可以通过发布接口中custom_attribute_value字段创建自定义属性值。发布接口中涉及自定义属性值的入参字段
（红色加粗）
见下表，表格下方有请求、响应示例

​字段名
字段名
字段名
字段名
​字段类型
是否必填
字段描述

skc_list
object[]
是
skc列表

sale_attribute
是
skc销售属性

attribute_id
int64
是
销售属性ID

attribute_value_id
int64
否
销售属性值ID（平台提供值/通过添加自定义属性接口获取的值）

custom_attribute_value
string
否
商家的自定义销售属性值。

仅在销售属性ID支持自定义属性值时，才可在此字段内入参。

属性值要求：字符数50以内；支持半角符号，不可输入全角符号；不支持unicode，检验表达式可参考：String emojiPattern = "[\\uD83C-\\uDBFF\\uDC00-\\uDFFF\\u2600-\\u27ff]"

​language
string
否
自定义属性值的语种。

支持的语种：en、zh-cn、fr、es、it。如果ERP不传多语言内容，平台会做系统翻译。

sku_list
​
object[]
是
sku列表

​sale_attribute_list
object[]
是
销售属性列表

​
attribute_id
int64
是
销售属性ID

attribute_value_id
int64
否
销售属性值ID（平台提供值/通过添加自定义属性接口获取的值）

custom_attribute_value
string
否
商家的自定义销售属性值。

仅在销售属性ID支持自定义属性值时，才可在此字段内入参。

属性值要求：字符数50以内；支持半角符号，不可输入全角符号；不支持unicode，检验表达式可参考：String emojiPattern = "[\\uD83C-\\uDBFF\\uDC00-\\uDFFF\\u2600-\\u27ff]"

language
string
否
自定义属性值的语种。

支持的语种：en、zh-cn、fr、es、it。如果ERP不传多语言内容，平台会做系统翻译。

size_attribute_list
object[]
否
尺码属性列表

attribute_id
int64
是
属性ID

attribute_extra_value
string
否
属性值。尺码属性均为手动输入，在此入参。支持正数，最多2位小数

relate_sale_attribute_id
int64
否
关联的次销售属性ID（只可入参sku维度销售属性）

relate_sale_attribute_value
string
否
关联的次销售属性属性值。

自定义属性值的场景需要在此入参，入参内容必须和销售属性中填写的属性值一模一样。

relate_sale_attribute_value_id
int64
否
关联的次销售属性属性值。非自定义属性值场景在此入参

sale_attribute_sort_list
object[]
否
销售属性自定义排序

attribute_id
int64
是
属性名ID

in_order_attribute_value_id_list
int64[]
否
排好序的属性值ID列表。如果属性下无自定义属性值，可用这个字段。

in_order_attribute_value_list
object[]
否
排好序的属性值ID/自定义属性值备注列表。

如果属性下有自定义属性值，需用这个字段，属性值用哪个形式就入参下面的哪个字段，按排序输入即可。

attribute_value_id
int64
否
属性值ID

custom_attribute_value
string
否
自定义属性值的内容。入参内容必须和销售属性中填写的属性值一模一样
。

 {
  "category_id": 20039919,
  "product_type_id": 2147503231,
  "multi_language_name_list": [
    {
      "language": "en",
      "name": "name"
    }
  ],
  "supplier_code": "34543345655",
  "site_list": [
    {
      "main_site": "shein",
      "sub_site_list": [
        "shein-us"
      ]
    }
  ],
  "is_spu_pic": "false",
  "suit_flag": "0",
  "size_attribute_list":[
    {
      "attribute_id":" 7",
      "attribute_extra_value":11,
      "relate_sale_attribute_id":"2147484186",
      "relate_sale_attribute_value":"custom attribute value for SKU 0911"
    }
  ],
  "sale_attribute_sort_list":[
        {
          "attribute_id":"2147484187",
          "in_order_attribute_value_list":[
            {
              "custom_attribute_value":"custom attribute value for SKC 0911"
            },
            {
              "attribute_value_id":2147488295
            }
          ]
        },
                {
          "attribute_id":"2147484186",
          "in_order_attribute_value_list":[
            {
              "custom_attribute_value":"custom attribute value for SKU 0911"
            },
              {
              "attribute_value_id":2147488283
            }
          ]
        }
      ],
  "sample_info":{
    "sample_spec":{
        "main_spec":{
            "attribute_id":"2147484187",
            "attribute_value_name":"custom attribute value for SKC 0911"
        },
        "sub_spec_list":[
            {
                 "attribute_id": "2147484186",
                 "attribute_value_id":"2147488295"
            },
            {
                "attribute_id":"2147484186",
                "attribute_value_name":"custom attribute value for SKU 0911"
            }
        ]
    },
     "sample_judge_type":2,
     "reserve_sample_flag":2,
     "spot_flag":2
  },
  "skc_list": [
    {
      "sale_attribute": {
        "attribute_id": 2147484187,
        "custom_attribute_value":"custom attribute value for SKC 0911",
        "language":"en"
      },
      "image_info": {
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "site_detail_image_info_list": [
        {
          "image_info_list": [
            {
              "image_sort": 1,
              "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
            }
          ],
          "site_abbr_list": [
            "shein-us"
          ]
        }
      ],
      "proof_of_stock_list": [
        {
          "file_name": "fd",
          "type": "1",
          "url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
        }
      ],
      "sku_list": [
        {
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "custom_attribute_value":"custom attribute value for SKU 0911",
              "language":"en"
            }
          ],
          "price_info_list": [
            {
              "base_price": 334,
              "currency": "USD",
              "special_price": 35,
              "sub_site": "shein-us"
            }
          ],
          "stock_info_list": [
            {
              "inventory_num": 1
            }
          ],
          "supplier_sku": "36636565623",
          "mall_state": 1,
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1"
        }
      ],
      "supplier_code": "4564880035",
      "suggested_retail_price": {
        "currency": "USD",
        "price": 34
      }
    },
    {
      "sale_attribute": {
        "attribute_id": 2147484187,
        "attribute_value_id":"2147488295"
      },
      "image_info": {
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "site_detail_image_info_list": [
        {
          "image_info_list": [
            {
              "image_sort": 1,
              "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
            }
          ],
          "site_abbr_list": [
            "shein-us"
          ]
        }
      ],
      "proof_of_stock_list": [
        {
          "file_name": "fd",
          "type": "1",
          "url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
        }
      ],
      "sku_list": [
        {
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id":"2147488283"
            }
          ],
          "price_info_list": [
            {
              "base_price": 334,
              "currency": "USD",
              "special_price": 35,
              "sub_site": "shein-us"
            }
          ],
          "stock_info_list": [
            {
              "inventory_num": 1
            }
          ],
          "supplier_sku": "365650023",
          "mall_state": 1,
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1"
        }
      ],
      "supplier_code": "45667800835",
      "suggested_retail_price": {
        "currency": "USD",
        "price": 34
      }
    }
  ]
}

#### 
第3步：查询商品详情

- 
查询接口：/open-api/goods/spu-info

- 
商品的自定义销售属性值在此接口中，会给出属性值的内容以及value id。涉及字段包括：skcInfoList - attributeId、attributeMultiList、attributeValueId、attributeValueMultiListskuInfoList - saleAttributeListdimensionAttributeAdditionList -relateSaleAttributeValueId

{
    "code": "0",
    "msg": "OK",
    "info": {
        "spuName": "c250905438333",
        "categoryId": 20039919,
        "productTypeId": 2147503231,
        "brandCode": "",
        "supplierCode": "4545880035",
        "productMultiNameList": [
            {
                "productName": "Bennie For Custom Attribute 0905",
                "language": "en"
            }
        ],
        "productMultiDescList": [
            {
                "productDesc": "",
                "language": "en"
            }
        ],
        "productAttributeInfoList": [
            {
                "attributeId": 2147484186,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Size",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147488283,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "30*20",
                        "language": "en"
                    }
                ],
                "attributeValue": null
            },
            {
                "attributeId": 2147484187,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Color",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147488294,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "Mustard",
                        "language": "en"
                    }
                ],
                "attributeValue": null
            },
            {
                "attributeId": 2147484186,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Size",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147489739,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "custom attribute value for SKU",
                        "language": "en"
                    }
                ],
                "attributeValue": null
            }
        ],
        "dimensionAttributeInfoList": [
            {
                "attributeId": 7,
                "attributeMultiList": [
                    {
                        "attributeName": "Bag Width66 (1cm)",
                        "language": "en"
                    }
                ],
                "dimensionAttributeAdditionList": [
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147488283,
                        "additionValue": "1"
                    },
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147489739,
                        "additionValue": "2"
                    }
                ]
            },
            {
                "attributeId": 15,
                "attributeMultiList": [
                    {
                        "attributeName": "Bottoms Length (cm)",
                        "language": "en"
                    }
                ],
                "dimensionAttributeAdditionList": [
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147488283,
                        "additionValue": "1"
                    },
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147489739,
                        "additionValue": "2"
                    }
                ]
            },
            {
                "attributeId": 29,
                "attributeMultiList": [
                    {
                        "attributeName": "Cuff (cm)",
                        "language": "en"
                    }
                ],
                "dimensionAttributeAdditionList": [
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147488283,
                        "additionValue": "1"
                    },
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147489739,
                        "additionValue": "2"
                    }
                ]
            }
        ],
        "spuImageInfoList": null,
        "skcInfoList": [
            {
                "skcName": "sc25090543833308995",
                "supplierCode": "4545880035",
                "sampleInfo": {
                    "sampleCode": "",
                    "reserveSampleFlag": 0,
                    "spotFlag": 0,
                    "sampleJudgeType": 2
                },
                "productMultiNameList": [
                    {
                        "productName": "Bennie For Custom Attribute 0905",
                        "language": "en"
                    }
                ],
                "attributeId": 2147484187,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Color",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147489740,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "custom attribute value for SKC",
                        "language": "en"
                    }
                ],
                "skuInfoList": [
                    {
                        "skuCode": "I41m0y0swjql",
                        "supplierSku": "366485454623",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "366485454623",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147489739,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "custom attribute value for SKU",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 334.0,
                                "specialPrice": 35.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    },
                    {
                        "skuCode": "I41m1jlbevlc",
                        "supplierSku": "45345345",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "45345345",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147488283,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "30*20",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 33.0,
                                "specialPrice": 23.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    }
                ],
                "shelfStatusInfoList": [
                    {
                        "siteAbbr": "shein-us",
                        "shelfStatus": 1,
                        "lastShelfTime": "2025-09-05 14:00:06",
                        "firstShelfTime": "2025-09-05 14:00:06",
                        "lastUpdateTime": "2025-09-05 14:00:06",
                        "link": "https://us.shein.com/Bennie-For-Custom-Attribute-0905-p-54645646522692-cat-4913127337.html"
                    }
                ],
                "recycleInfoList": null,
                "skcImageInfoList": [
                    {
                        "groupCode": "G21ja2yef1mm",
                        "imageItemId": 2148036234,
                        "imageType": "MAIN",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 1
                    },
                    {
                        "groupCode": "G21ja2yef1mm",
                        "imageItemId": 2148036235,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 2
                    },
                    {
                        "groupCode": "G21ja2yef1mm",
                        "imageItemId": 2148036236,
                        "imageType": "SQUARE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 3
                    },
                    {
                        "groupCode": "G21ja2yef1mm",
                        "imageItemId": 2148036237,
                        "imageType": "PIECE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 4
                    }
                ],
                "siteDetailImageInfoList": null,
                "proofOfStockInfoList": [],
                "srpPriceInfo": {
                    "currency": "USD",
                    "srpPrice": 34.0
                }
            },
            {
                "skcName": "sc25090543833396934",
                "supplierCode": "4545880035",
                "sampleInfo": {
                    "sampleCode": "",
                    "reserveSampleFlag": 0,
                    "spotFlag": 0,
                    "sampleJudgeType": 2
                },
                "productMultiNameList": [
                    {
                        "productName": "Bennie For Custom Attribute 0905",
                        "language": "en"
                    }
                ],
                "attributeId": 2147484187,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Color",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147488295,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "Navy",
                        "language": "en"
                    }
                ],
                "skuInfoList": [
                    {
                        "skuCode": "I41m0y0syo5g",
                        "supplierSku": "3655435436523",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "3655435436523",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147488283,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "30*20",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 334.0,
                                "specialPrice": 35.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    },
                    {
                        "skuCode": "I41m1jlbh70p",
                        "supplierSku": "45345",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "45345",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147489739,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "custom attribute value for SKU",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 33.0,
                                "specialPrice": 23.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    }
                ],
                "shelfStatusInfoList": [
                    {
                        "siteAbbr": "shein-us",
                        "shelfStatus": 1,
                        "lastShelfTime": "2025-09-05 14:00:06",
                        "firstShelfTime": "2025-09-05 14:00:06",
                        "lastUpdateTime": "2025-09-05 14:00:06",
                        "link": "https://us.shein.com/Bennie-For-Custom-Attribute-0905-p-54645646522693-cat-4913127337.html"
                    }
                ],
                "recycleInfoList": null,
                "skcImageInfoList": [
                    {
                        "groupCode": "G21m0y2n7hfw",
                        "imageItemId": 2148036238,
                        "imageType": "MAIN",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 1
                    },
                    {
                        "groupCode": "G21m0y2n7hfw",
                        "imageItemId": 2148036239,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 2
                    },
                    {
                        "groupCode": "G21m0y2n7hfw",
                        "imageItemId": 2148036240,
                        "imageType": "SQUARE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 3
                    },
                    {
                        "groupCode": "G21m0y2n7hfw",
                        "imageItemId": 2148036241,
                        "imageType": "PIECE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 4
                    }
                ],
                "siteDetailImageInfoList": [
                    {
                        "imageGroupCode": "G41j8kjqvt7w",
                        "imageInfoList": [
                            {
                                "imageItemId": 1147541301,
                                "imageSort": 1,
                                "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
                            }
                        ],
                        "siteInfoList": [
                            {
                                "channel": "",
                                "mainSite": "shein",
                                "site": "shein-us"
                            }
                        ]
                    }
                ],
                "proofOfStockInfoList": [],
                "srpPriceInfo": {
                    "currency": "USD",
                    "srpPrice": 34.0
                }
            },
            {
                "skcName": "sc25090543833306711",
                "supplierCode": "4545880035",
                "sampleInfo": {
                    "sampleCode": "",
                    "reserveSampleFlag": 0,
                    "spotFlag": 0,
                    "sampleJudgeType": 2
                },
                "productMultiNameList": [
                    {
                        "productName": "Bennie For Custom Attribute 0905",
                        "language": "en"
                    }
                ],
                "attributeId": 2147484187,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Color",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147488294,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "Mustard",
                        "language": "en"
                    }
                ],
                "skuInfoList": [
                    {
                        "skuCode": "I41m1jlbjmfa",
                        "supplierSku": "5345354354",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "5345354354",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147489739,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "custom attribute value for SKU",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 33.0,
                                "specialPrice": 23.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    },
                    {
                        "skuCode": "I41m1jlbirjp",
                        "supplierSku": "435344545",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "435344545",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147488283,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "30*20",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 33.0,
                                "specialPrice": 23.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    }
                ],
                "shelfStatusInfoList": [
                    {
                        "siteAbbr": "shein-us",
                        "shelfStatus": 0,
                        "lastShelfTime": "2018-08-28 00:00:00",
                        "firstShelfTime": "1970-01-01 08:00:01",
                        "lastUpdateTime": "2025-09-05 14:16:27",
                        "link": "https://us.shein.com/Bennie-For-Custom-Attribute-0905-p-54645646522710-cat-4913127337.html"
                    }
                ],
                "recycleInfoList": null,
                "skcImageInfoList": [
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036302,
                        "imageType": "MAIN",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/a7/1757052939fe552dac89a2f5d12503e7afff826dbe_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/a7/1757052939fe552dac89a2f5d12503e7afff826dbe_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/a7/1757052939fe552dac89a2f5d12503e7afff826dbe.jpg",
                        "sort": 1
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036303,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/62/1757052939de92a781e416b49f1d299c1489a94d71_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/62/1757052939de92a781e416b49f1d299c1489a94d71_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/62/1757052939de92a781e416b49f1d299c1489a94d71.jpg",
                        "sort": 2
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036304,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/53/1757052939be6a4855caf38d4045211ca2fd081d59_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/53/1757052939be6a4855caf38d4045211ca2fd081d59_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/53/1757052939be6a4855caf38d4045211ca2fd081d59.jpg",
                        "sort": 3
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036305,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/df/1757052939abdf9d03aaeae017c715bbf69efef417_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/df/1757052939abdf9d03aaeae017c715bbf69efef417_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/df/1757052939abdf9d03aaeae017c715bbf69efef417.jpg",
                        "sort": 4
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036306,
                        "imageType": "SQUARE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/1e/175705293940f3cb182c3d04df3a2d17ca84c0b4d2_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/1e/175705293940f3cb182c3d04df3a2d17ca84c0b4d2_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/1e/175705293940f3cb182c3d04df3a2d17ca84c0b4d2.jpg",
                        "sort": 5
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036307,
                        "imageType": "PIECE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/p/pi/2025/09/05/65/175705293910d4d904ed8af6396c39f713758a10ef_thumbnail_405x552.png",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/p/pi/2025/09/05/65/175705293910d4d904ed8af6396c39f713758a10ef_thumbnail_220x293.png",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/p/pi/2025/09/05/65/175705293910d4d904ed8af6396c39f713758a10ef.png",
                        "sort": 6
                    }
                ],
                "siteDetailImageInfoList": null,
                "proofOfStockInfoList": [],
                "srpPriceInfo": {
                    "currency": "USD",
                    "srpPrice": 33.0
                }
            }
        ]
    },
    "bbl": null,
    "traceId": "d8d37306e13e15f6"
}

### 
3 测试店铺

测试调用域名：https://openapi-test01.sheincorp.cn

openKey：EED6AEEA6B4741EF94D29FED5A1CE76F

secretKey：35D01D988EBA46FB9D87CA066FFD1805

### 
4 常见FAQ

Q:：商家切换为新的属性方案后，无法从查询属性接口中获得自定义属性值的attribute value id，如需使用可以从哪里获取？

A：可以通过查询SPU详情接口/open-api/goods/spu-info获取，此接口中会返回自定义属性值的value id

## 解决方案 / 半托管解决方案 / 商品图片

- Page ID：`4d96fc8f-4913-4211-8630-5d81e7fcc010`
- 路径：`https://open.sheincorp.com/documents/system/4d96fc8f-4913-4211-8630-5d81e7fcc010`
- 简介：介绍商品发布、查询场景中的商品图片使用方式

# 
商品图片

# 
1 方案概述

## 
1.1 适用范围

本文档适用于所有类型的应用。

## 
1.2 业务说明

应用需要发布或编辑商品时，会使用到商品图片，可通过此文档确认图片上传、管理方式。

商品图片上传主要包含3个步骤：确认商品的图片上传要求、生成图片URL、将URL发布到商品中。

## 
1.3 调用概览

## 
1.4 API清单

API名称
API & 文档地址

查询商品发布字段规范
/open-api/goods/query-publish-fill-in-standard

转换图片成SHEIN可用的图片
/open-api/goods/transform-pic

本地图片上传
/open-api/goods/upload-pic

商品发布&编辑
/open-api/goods/product/publishOrEdit

查询商品
/open-api/goods/spu-info

# 
2 详细步骤

## 
2.1 商品图片方案概览

 
SHEIN的商品图片有新旧方案

    旧方案：仅支持SKC、SKU传图

    
新方案：支持SPU、SKC、SKU上传图片。但不同商品类目传图要求不同，因此新方案中又有多套方案

商品图片名称
旧方案
新方案A
新方案B
发布商品 接口中的图片类型
图片规格要求

SPU层
商品轮播图
X
选填，1张
必填，上限11张
单张时：1-主图，最多1张

多张时：1-主图，必传，最多1张

               2-细节图必传，最多10张
● 像素1340px*1785px；或宽高比例1:1，像素范围900px-2200px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

方形图
X
X
必填，1张
5-方块图
● 像素1200px*1200px 

● 格式JPG/JPEG/PNG

● 大小≤3MB

SKC层
主图
必填，1张
必填，1张
必填，1张
1-主图
● 像素1340px*1785px；或宽高比例1:1，像素范围900px-2200px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

细节图
必填，上限10张
必填，上限10张
X
2-细节图

方形图
必填，1张
必填，1张
X
5-方块图
● 宽高比例1:1，像素900*900~2200*2200 px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

色块图
单skc非必填

多skc必填
单skc非必填

多skc必填
单skc非必填

多skc必填
6-色块图
● 宽高比例1:1，像素80×80 px 

● 格式JPG/JPEG/PNG

● 大小≤3MB

站点详情图
非必填，最多10张
非必填，最多10张
非必填，最多10张
不需传类型
● 宽高比例3:4，像素大于900px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

SKU层
SKU图
选填，1张

若skc下有1个sku传图，则skc下所有sku都要传图
选填，1张

若skc下有1个sku传图，则skc下所有sku都要传图
选填，1张

若skc下有1个sku传图，则skc下所有sku都要传图
1-主图
● 像素1340px*1785px；或宽高比例1:1，像素范围900px-2200px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

## 
2.2 步骤1：确认商品图片上传要求

 ● 
接口地址：
/open-api/goods/query-publish-fill-in-standard

 ● 
通过接口获取商品的图片上传要求时

     ○ 
必需入参"category_id"，因为不同类目的图片要求不同

     ○ 
必须按商家维度查询上传要求，同类目下不同商家的图片要求不同

 ● 
根据返回参数确定图片要求，返回参数主要有2种形态

### 
旧方案判断方式

 ● 
当"picture_config_list"中只有1个"field_key": "switch_spu_picture"时，代表类目走旧方案传图，只在SKC维度传图即可。

 ● 
旧方案下，商品发布接口中的"is_spu_pic"需要传false

{
    "picture_config_list": [
        {
            "field_key": "switch_spu_picture",
            "is_true": false
        }
    ]
}

### 
新方案判断方式

 ● 
当"picture_config_list"中包含很多"field_key"时，代表类目走新方案传图。具体传什么图、传几张，需多个字段结合起来一起看，可参考下方表格。

   
 注意：2025年9月开始所有商品都支持上传SKU图片，此接口中不会再返回"field_key": "sku_image_detail_show", "field_key": "sku_image_detail_required",

 ● 
新方案下，商品发布接口中的"is_spu_pic"需要传true

新方案A返回示例：

{
    "picture_config_list": [
        {
            "field_key": "switch_spu_picture",
            "is_true": false
        },
        {
            "field_key": "spu_image_detail_show",
            "is_true": true
        },
        {
            "field_key": "spu_image_detail_required",
            "is_true": false
        },
        {
            "field_key": "spu_image_detail_single",
            "is_true": true
        },
        {
            "field_key": "spu_image_square_show",
            "is_true": false
        },
        {
            "field_key": "spu_image_square_required",
            "is_true": false
        },
        {
            "field_key": "skc_image_detail_show",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_required",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_single",
            "is_true": false
        },
        {
            "field_key": "skc_image_square_show",
            "is_true": true
        },
        {
            "field_key": "skc_image_square_required",
            "is_true": true
        }
    ]
}

新方案B的响应示例
{
    "picture_config_list": [
        {
            "field_key": "switch_spu_picture",
            "is_true": false
        },
        {
            "field_key": "spu_image_detail_show",
            "is_true": true
        },
        {
            "field_key": "spu_image_detail_required",
            "is_true": true
        },
        {
            "field_key": "spu_image_detail_single",
            "is_true": false
        },
        {
            "field_key": "spu_image_square_show",
            "is_true": true
        },
        {
            "field_key": "spu_image_square_required",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_show",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_required",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_single",
            "is_true": true
        },
        {
            "field_key": "skc_image_square_show",
            "is_true": false
        },
        {
            "field_key": "skc_image_square_required",
            "is_true": false
        }
    ]
}
字段名
字段说明
商品发布接口中的传图说明

switch_spu_picture
入参查询的SPU，当前是否已用新方案传图。

没有入参SPU时，此值都是false。
此字段在商品发布场景不用关注，编辑场景需关注。

spu_image_detail_show
spu轮播图是否展示
SPU轮播图，单张/多张的传图方式不同 

● 单张时，1-主图必传，最多1张

● 多张时，1-主图必传，最多1张；2-细节图必传，最多10张

spu_image_detail_required
spu轮播图否必填

spu_image_detail_single
spu轮播图是否单张

spu_image_square_show
spu方形图是否展示
SPU方形图，仅1张，所以无是否单张的字段 

● 必填时，5-方形图必传

spu_image_square_required
spu方形图是否必填

skc_image_detail_show
skc细节图是否展示
SKC细节图，单张/多张的传图方式不同

● 单张时，1-主图必传，最多1张

● 多张时，1-主图必传，最多1张；2-细节图必传，最多10张

skc_image_detail_required
skc细节图是否必填

skc_image_detail_single
skc细节图是否单张

skc_image_square_show
skc方形图是否展示
SKC方形图，仅1张，所以无是否单张的字段 

● 必填时，5-方形图必传

skc_image_square_required
skc方形图是否必填

## 
2.3 步骤2：获取图片URL

 ● 
所有上传的图片必须先转换成SHEIN的图片URL，提供两种方式：本地图片上传、转换在线图片

### 
本地图片上传

 ● 
接口地址：
/open-api/goods/upload-pic

 ● 
请求示例

--form 'image_type="2"' \ --form 'file=@"/Users/10027511/Documents/1068*455.png"
 ● 
返回示例

{
    "code": "0",
    "msg": "OK",
    "info": {
        "image_url": "http://imgdeal-test01.shein.com/images3_pi/2023/11/15/3c/17000397694031071724_square.jpg",
        "width": 1200,
        "height": 1200,
        "size": 363846,
        "image_hex_type": "jpg"
    },
    "bbl": null
}

### 
转换在线图片

 ● 
接口地址：
/open-api/goods/transform-pic

● 
接口限流为20次/秒，请注意控制调用频次

 ● 
请求示例

{
    "image_type": 2,
    "original_url": "http://imgdeal-test01.shein.com/images3_pi/2023/11/15/fe/17000325694031071724_square.jpg"
}
 ● 
返回示例

{
    "code": "0",
    "msg": "OK",
    "info": {
        "original": "http://imgdeal-test01.shein.com/images3_pi/2023/11/15/fe/17000325694031071724_square.jpg",
        "transformed": "https://imgdeal-test01.shein.com/images3_pi/2024/05/23/db/17164580272759534094.jpeg",
        "failure_reason": ""
    },
    "bbl": null
}

## 
2.4 步骤3：上传图片发布商品

 ● 
商品发布中上传图片，主要关注以下字段

     ● 
is_spu_pic：
是否为新方案传图，true=新方案；false=旧方案

     ● 
image_info：此对象在SPU、SKU、SKC都有，且对象下的字段逻辑一致，字段逻辑见下方表格。具体什么层级传多少图，按步骤2中获取的图片要求传图即可。

字段
字段
字段
说明

image_info

image_group_code
图片组编码，由SHEIN生成。商品发布场景不用传，编辑场景要传

image_info_list
图片列表

image_type
图片类型：1-主图,2-细节图,5-方块图,6-色块图

image_sort
图片序号：主图必须排序为1，其他依次排序

image_item_id
图片唯一id，由SHEIN生成。商品发布场景不用传，编辑场景要传

image_url
图片链接

## 
2.5 其他场景：查询商品图片

 ● 
接口地址：
/open-api/goods/spu-info

 ● 
查询接口返回的图片类型是
"string"
，查询返回的枚举值 和 上传图片的枚举值对应关系如下所示

商品发布接口的图片类型
商品查询详情的图片类型

1-主图
MAIN

2-细节图
DETAIL

5-方块图
SQUARE

6-色块图
PIECE

 ● 查询的返回示例

{
    "spuImageInfoList": [
        {
            "groupCode": "G140qbzchcil",
            "imageItemId": 2147609257,
            "imageType": "MAIN",
            "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/05/21/1b/17162749351136466060_square_thumbnail_405x552.jpeg",
            "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/05/21/1b/17162749351136466060_square_thumbnail_220x293.jpeg",
            "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/05/21/1b/17162749351136466060_square.jpeg",
            "sort": 1
        }
    ]
}

# 
3 关联阅读

    
商品发布-全托管

    
商品发布-半托管

    
商品发布-自运营

## 解决方案 / 半托管解决方案 / 商品证书

- Page ID：`a4c9a5c4-75db-4f99-bbaf-0e47b34bda80`
- 路径：`https://open.sheincorp.com/documents/system/a4c9a5c4-75db-4f99-bbaf-0e47b34bda80`
- 简介：该解决方案用于上传商品证书，适用于管理自主运营、代运营和半托管商家的证书管理

# 
商品证书

# 
1 方案概述

## 
适用范围

- 
本文档适用于【应用类型=自运营/半托管/全托管/POP】的应用。

- 
商品证书解决的是商品在海外市场中销售时，遇到的合规/法务问题。

## 
业务说明

部分商品在销售到海外时，需提供商品的资质证书或者检测报告，用于证明商品质量符合市场当地要求。例如销售至欧洲的儿童玩具，需提供玩具检测报告。

因此SHEIN在商品发布时，会基于商品信息要求商家提供相关证书。若商家无法提供证书，商品会有无法正常销售的风险。

SHEIN中的商品合规信息主要有以下3类。此解决方案中的接口可覆盖证书报告、自符声明这两类（在下文中用商品证书来指代），责任/代理公司需使用另一套接口实现，详见
方案

- 
证书报告：由机构或公开组织提供的证明或报告，用于证明商品质量符合当地要求。

- 
自符声明：销售婴童、玩具类商品的卖家，可签署声明协议，确保商品符合美国法规要求。

- 
责任/代理公司：销售至欧洲、美国、英国的商品需申报代理公司，代理公司可理解为销售资质的一种，商品需和代理公司绑定，否则可能影响销售。

商品证书的基础概念

- 
SHEIN管理了多种证书类型，比如燃烧检测报告、化妆品重金属报告等。每个证书类型需要提供什么信息都由平台决定。

- 
店铺内可上传多个证书，同类型的证书也可上传多个。每上传一个证书就会生成一个证书池（虽然名为证书池，但一个证书池内只有一个证书）

- 
每个商品需要提供的证书类型由平台决定，可能是0个，也可能是多个，商家需按要求为商品绑定对应类型的证书。

## 
调用概览

# 
2 详细步骤

## 
2.1 确认商品需绑定哪些类型的证书

SHEIN会根据商品信息和销售市场来判定，商品是否需要提供证书、需要提供哪些类型的证书。这个信息可通过接口查询：
/open-api/goods/get-certificate-rule
，此接口的使用方式有2种，参考下方

方式1：查询某SPU缺失哪些证书

- 
使用场景：商品发布成功后生成SPU A，查询SPU A需绑定的证书类型，明确他当前缺失的证书类型。若必填证书是缺失状态，则引导商家补充对应证书，否则会影响商品上下架状态。

- 
入参：必需提供"spuName"

- 
出参：先找到缺失状态的证书类型：certificateMissStatus=true再判断缺失的证书类型是否为必传，若必传则建议商家补充证书：isRequired=true最后明确必传且缺失的证书类型的类型id，去查询证书类型需要哪些信息，最终创建证书：certificateTypeId其他情况：当某类型证书的certificateMissStatus=false时，代表SPU已绑定此类证书，会在出参中的certificatePoolList字段中看到绑定证书池的具体内容

方式2：查询某商品分类的证书绑定要求

- 
使用场景：在商品发布前预先让商家创建证书，基于商品分类可查到分类维度的证书要求。

- 
入参：必需提供"categoryId"

- 
出参：确认证书类型的管控站点范围：mergeSiteInfoList。若需要精确知道此店铺在此分类下需提供哪些证书，需要先查询店铺可上架站点范围，将两个站点范围匹配后得出最终需上传找到要求的证书类型的类型id，去查询证书类型需要哪些信息，最终创建证书：certificateTypeId

## 
2.2 查询证书所需材料&创建证书

创建某类型的证书之前，需先查询此类型证书需要提交哪些信息。

此部分会说明，创建接口、查询接口之间的出入参关系。适用于普通/自符证书、商品/店铺维度证书。

- 
通过接口查询证书材料：
/open-api/goods/certificate/get-all-certificate-type-list-v2
。接口会返回平台所有证书类型的信息，找到你需要的证书类型certificateTypeId

- 
确认此类型证书的适用范围：

- 
certificateDimensioncertificateDimension=1，即适用部分商品，商品维度证书，创建证书时需使用接口：
/open-api/goods/save-or-update-certificate-pool

- 
certificateDimension=2，即适用全部商品，店铺维度证书，创建证书时需使用接口：
/open-api/goods/save-or-update-supplier-certificate

- 
根据证书材料要求开始创建证书，证书信息主要有2部分

- 
证书文件

- 
即报告或证明的图片/PDF文件内容。每个证书都有且必须提供1个证书文件。

- 
创建证书接口中，文件入参字段名

- 
certificateUrl，需要通过接口上传文件后获取：
/open-api/goods/upload-certificate-file

- 
certificateUrlName，由开发者自定义值

- 
证书字段

- 
即证书相关的描述信息。不同证书类型所需要的证书字段不同。

- 
创建证书接口中，证书字段相关入参字段名如下

- 
certificateRelationInfoList：字段列表

- 
certificateRelationNameId：即字段名ID，取查询接口中 presetInfoList → presetId

- 
certificateRelationValueId：即字段的值的ID值。当字段的输入方式inputType=1/2（从可选项中选择）时，将选择的ID值入参至此，取查询接口中 presetInfoList → presetValueList → presetValueId

- 
certificateRelationValue：即字段的值。当字段的输入方式inputType=3/4（自定义值场景）时，需要将自定义值入参至此。

- 
otherCertificateRelationInfoList：其他字段列表（拆分2个字段列表，没有实际业务意义，开发者不用关注，只要根据下方逻辑入参即可）

- 
certificateRelationNameId：即字段名ID，取查询接口中 otherPresetInfoList → presetId

- 
certificateRelationValueId：

- 
当otherPresetInfoList - sourceFrom=SRM（一套特殊的检测结构列表数据）时，取查询接口中的 srmDetectionAgencyList - detectionAgencyId（检测机构id）

- 
当otherPresetInfoList - sourceFrom≠SRM时，当字段的输入方式inputType=1/2时，取查询接口中 otherPresetInfoList → presetValueList → presetValueId

- 
certificateRelationValue

- 
当otherPresetInfoList - sourceFrom=SRM时，取查询接口中的 srmDetectionAgencyList - laboratoryId（实验室id）

- 
当otherPresetInfoList - sourceFrom≠SRM时，当字段的输入方式inputType=3/4（自定义值场景）时，需要将值入参至此。

- 
创建成功后会生成一个证书池certificatePoolId，后续证书池需要和SKC绑定。（虽然名称为池，但实际一个证书池中只有一个证书）。

### 
不同场景的入参示例

创建店铺维度证书

curl --location --request POST 'https://openapi.sheincorp.com/open-api/goods/save-or-update-supplier-certificate' \
--header 'x-lt-signature: test' \
--header 'x-lt-openKeyId: test' \
--header 'x-lt-timestamp: 1751010644959' \
--header 'language: zh-cn' \
--header 'Content-Type: application/json' \
--header 'Host: openapi.sheincorp.com' \
--data-raw '{
    "certificateTypeId": 135,
    "certificateUrl": "https://pqms-1259571579.cos.ap-nanjing.myqcloud.com/gpc202401111845086.jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240111T020804Z&X-Amz-SignedHeaders=host&X-Amz-Expires=431999&X-Amz-Credential=AKIDIPGrBE0VjgOpztXu1sSmqnY5NPBiz1nJ/20240111/ap-nanjing/s3/aws4_request&X-Amz-Signature=b4d6b45148b51c934bed41e0547b7c586737d7bf71061dc4475eabfe77f420a3", // 此值通过/open-api/goods/upload-certificate-file获取
    "certificateUrlName": "16952760533746985150.jpeg"  // 此值自定义
}'

创建商品维度证书 — 不涉及srm检测机构

curl --location --request POST 'https://openapi.sheincorp.com/open-api/goods/save-or-update-certificate-pool' \
--header 'x-lt-signature: test' \
--header 'x-lt-openKeyId: test' \
--header 'x-lt-timestamp: 1751459666380' \
--header 'language: zh-cn' \
--header 'Content-Type: application/json' \
--header 'Host: openapi.sheincorp.com' \
--data-raw '{
  "certificateRelationInfoList": [
    {
      "certificateRelationNameId": 175,
      "certificateRelationValue": "2025-01-01 00:00:00",
      "certificateRelationValueId": ""
    }
  ],
  "certificateTypeId": 21,
  "certificateUrl": "https://lt-pqms.oss-cn-shenzhen.aliyuncs.com/gpc2913387912766705664.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20250702T123051Z&X-Amz-SignedHeaders=host&X-Amz-Expires=432000&X-Amz-Credential=LTAI5tKvGuVMaYLBaMkpkiBr/20250702/oss-cn-shenzhen/s3/aws4_request&X-Amz-Signature=bdf3d7c5ebc2ee7df574fd144773639dcdc231b0e036d675138e8905e11daf7b",
  "certificateUrlName": "test.jpeg",
  "otherCertificateRelationInfoList": []
}'

创建商品维度证书 — 涉及srm检测机构

curl --location --request POST 'https://openapi.sheincorp.com/open-api/goods/save-or-update-certificate-pool' \
--header 'x-lt-signature: test' \
--header 'x-lt-openKeyId: test' \
--header 'x-lt-timestamp: 1751459491635' \
--header 'language: zh-cn' \
--header 'Content-Type: application/json' \
--header 'Host: openapi.sheincorp.com' \
--data-raw '{
  "certificateRelationInfoList": [
    {
      "certificateRelationNameId": 175,
      "certificateRelationValue": "2025-01-01 00:00:00",
      "certificateRelationValueId": ""
    }
  ],
  "certificateTypeId": 7,
  "certificateUrl": "https://lt-pqms.oss-cn-shenzhen.aliyuncs.com/gpc2913387912766705664.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20250702T123051Z&X-Amz-SignedHeaders=host&X-Amz-Expires=432000&X-Amz-Credential=LTAI5tKvGuVMaYLBaMkpkiBr/20250702/oss-cn-shenzhen/s3/aws4_request&X-Amz-Signature=bdf3d7c5ebc2ee7df574fd144773639dcdc231b0ut036d675138e8905e11daf7b",
  "certificateUrlName": "pdf",
  "otherCertificateRelationInfoList": [
    {
      "certificateRelationNameId": 183,
      "certificateRelationValue": "4000515", //取查询证书材料接口中的 srmDetectionAgencyList - laboratoryId（实验室id）
      "certificateRelationValueId": "2380882" // 取查询证书材料接口中的 srmDetectionAgencyList - detectionAgencyId（检测机构id）
    }
  ]
}'

## 
2.3 绑定商品和证书

店铺维度的证书池会自动和商品绑定，只有商品维度证书需要手动绑定。

证书池需和SKC进行绑定，因此若SPU需要绑定A、B两个类型的证书，则SPU下的所有SKC都需要操作绑定。绑定时提交

curl --location --request POST 'https://openapi.sheincorp.com/open-api/goods/save-certificate-pool-skc-bind' \
--header 'x-lt-signature: test' \
--header 'x-lt-openKeyId: test' \
--header 'x-lt-timestamp: 1751010761337' \
--header 'language: zh-cn' \
--header 'Content-Type: application/json' \
--header 'Host: openapi.sheincorp.com' \
--data-raw '{
  "skcCertificatePoolRelationList": [
    {
      "spuName": "s2409195445",
      "skcName": "ss24091954454649",
      "certificatePoolIdList": [
        9867,
        9817
      ]
    },
    {
      "spuName": "s2409199897",
      "skcName": "ss24091998977394",
      "certificatePoolIdList": [
        9867,
        9817
      ]
    }
  ]
}'

## 
2.4 确认绑定的审核结果

绑定证书后，SHEIN平台会对本次绑定进行审核。审核结果可通过接口查询：
/open-api/goods/get-certificate-rule

- 
入参：提供商品spuName、绑定的证书池certificatePoolId

- 
出参：通过certificatePoolList - auditStatus判断审批结果

- 
查询接口的维度是SPU，但审核维度是SKC。当SPU下有多个SKC时，只有当SKC全部审核通过时，SPU维度才会返回审核通过。

## 解决方案 / 半托管解决方案 / 商品合规

- Page ID：`af751fbf-0a24-484a-98fe-377654bd62d7`
- 路径：`https://open.sheincorp.com/documents/system/af751fbf-0a24-484a-98fe-377654bd62d7`

# 
商品合规

# 
方案概述

- 
若商品需销往欧盟、美国、英国等地区，商家需按当地要求提供相关证明。此方案会介绍如何将证明提供给平台。

- 
此方案适用于所有类型的应用。

# 
业务流程

目前API层支持2个合规场景：

- 
商品绑定代理公司：可覆盖GPSR欧盟责任人、美国代理、英国代理、制造商

- 
商品上传标签实拍图：可覆盖欧洲的环保、GPSR等标签要求

# 
调用概览

类型
名称
文档

API
查询代理公司列表
/open-api/goods-compliance/agency-list

API
查询SKC的代理公司绑定要求
/open-api/goods-compliance/skc-agency-detail

API
绑定SKC和代理公司
/open-api/goods-compliance/save-skc-agency

API
查询SKC的实拍图要求
/open-api/goods-compliance/skc-label-list

API
打印合规标签
/open-api/goods-compliance/label-print

API
上传实拍图图片
/open-api/goods-compliance/upload-skc-label-picture

API
绑定SKC和实拍图
/open-api/goods-compliance/skc-save-label

# 
具体场景

## 
商品绑定代理公司

步骤1：查询已申报的代理公司

- 
目前API不支持申报代理公司，需商家先通过商家后台手动完成申报。

- 
通过接口可查询到商家已申报的代理公司信息，接口地址：
/open-api/goods-compliance/agency-list

- 
代理公司相关的重要字段和规则：

- 
哪些代理公司是有效的，可以和商品绑定的？agencyStatus=0，且applyStatus=1/2的代理公司

字段名
字段说明

agencyId
代理公司ID。

后续商品绑定代理公司时会使用。

agencyType
代理公司类型：0-欧盟责任人；1-英国代理；2-美国代理；3-制造商。

后续商品绑定代理公司时会使用。

agencyStatus
代理公司的协议生效状态：0-生效中，1-已过期，2-未生效。

applyStatus
代理公司申报状态：0-待补充；1-待审核（商家后台此状态会展示申报成功）；2-申报成功；3-审核失败。

coveredProductRange
代理公司可覆盖的商品范围：1-全部商品；2-部分商品。

范围=“全部商品”时，系统会默认所有SKC都绑定该公司，即有新增发品不需要再次单独绑定；

范围=““部分商品”时，需要商家自行绑定SKC和公司的关系。

步骤2：查询商品需要绑定哪些类型的代理公司

- 
不是所有商品都需要绑定代理公司，需绑定公司的商品可能需绑定多个类型的代理公司。平台会根据商品类目、销售地区等信息，判断出哪些商品需要绑定哪些类型的代理公司。商家需按要求提供，若无法及时提供，会导致商品无法上架或被强制下架。

- 
通过接口可查询到哪些商品需要绑定哪些代理公司，以及当前商品的公司绑定状态，接口地址：
/open-api/goods-compliance/skc-agency-detail

- 
建议将商品必须绑定的代理公司全部绑定，以避免商品异常，操作方法如下：

- 
入参：
查询商品有哪些必要绑定信息：isRequired=1

- 
出参：

- 
找到SKC下未绑定或绑定失败的代理公司，稍后进行绑定：reviewState=1/3

- 
确认SKC需要绑定的代理公司类型agencyType，然后从步骤1中获得的已申报的代理公司中，找到相同type且有效的agencyId

步骤3：绑定商品和代理公司

- 
通过接口绑定，接口地址：
/open-api/goods-compliance/save-skc-agency

- 
绑定时使用的agencyId、agencyType，需要从步骤1中获取。

## 
商品上传标签实拍图

步骤1：查询商品的实拍图上传要求

- 
实拍图上传的是商品实物图片、商品包装上贴标的图片。图片中需要体现出各地区对参数、环保、GPSR相关要求的信息要素。

- 
不是所有商品都需要上传实拍图，需传图的商品在实拍图中需要展示的信息有很多类型。上传图片后系统会扫描图片自动识别信息，若图片中未包含指定信息的话，实拍图绑定失败，会导致商品无法上架或被强制下架。

- 
通过接口可查询到哪些商品需要在实拍图中体现哪些信息元素，以及当前商品的实拍图绑定状态，接口地址：
/open-api/goods-compliance/skc-label-list

- 
建议将商品必须绑定的信息要素全部拍摄并上传，以避免商品异常，操作方法如下

- 
入参：
查询商品有哪些必要绑定信息：isRequired=1

- 
出参：

- 
找到SKC下实拍图中未绑定成功的信息，稍后进行绑定：reviewState=0/3。注意：reviewState=1是待审核，此状态在商家后台展示为申报成功。实拍图是异步审核，所以上传后展示申报成功，异步发现失败后才变成失败状态。可对接消息通知及时发现审核失败。

- 
确认SKC需要在实拍图中体现的信息，将他们都打印成标签：labelName

步骤2：打印商品标签

- 
基于SKC，打印出SKC可打印的所有标签。平台会预设一批标签模板，如果预设模板不符合预期，商家需通过商家后台手动绘制标签模板，然后再通过API打印。

- 
打印接口地址：
/open-api/goods-compliance/label-print

步骤3：上传实拍图图片

- 
标签打印后贴到商品包装上，拍摄实拍图后需先上传图片。实拍图有单独的图片上传API，请不要使用商品发布中的图片上传接口。

- 
上传图片接口地址：
/open-api/goods-compliance/upload-skc-label-picture

步骤4：绑定商品和实拍图

- 
实拍图绑定在SKC维度。每个SKC可绑定多张实拍图，最多15张。图片长宽均不能超过8000px、大小不超过10M，支持png/jpeg/jpg格式。

- 
绑定接口：
/open-api/goods-compliance/skc-save-label

## 

## 
监听商品绑定的合规信息失效

- 
此消息目前可监听的场景

- 
SKC绑定的代理公司失效：主要由代理公司自身失效导致，如代理有效期到期。失效后，和代理公司有绑定关系的SKC均会发出失效的通知。

- 
SKC上传的实拍图失效：主要由于实拍图审核失败导致，实拍图非实时审核。

- 
消息地址： 
https://open.sheincorp.com/documents/msgdoc/detail/3001095
 

complianceTypeId
信息类型

1
欧盟代理公司

3
实拍图

## 解决方案 / 半托管解决方案 / 合规证书-警告语

- Page ID：`105b8e3e-5e33-43fe-8848-a9e54fe7c7ea`
- 路径：`https://open.sheincorp.com/documents/system/105b8e3e-5e33-43fe-8848-a9e54fe7c7ea`

# 
合规证书-警告语

# 

# 
1、方案概述

### 
适用范围

服务欧洲、英国市场商家的自运营、半托管、全托管类型应用，可对接此解决方案。

警告语证书覆盖范围

- 
站点：欧盟、英国

- 
品类：目前主要为婴童用品类商品

上述范围内的商品，若没有提供必传的警告语证书，可能会无法上架。

# 
2、调用说明

### 
填写规则介绍

警告语内容由平台预先配置，基于商家选择的商品信息自动生成，商家无法自行输入警告语内容。

例如图片中的【母婴喂养用品警告语】。商家需要选产品属性，若他选了【玻璃容器】，则提示内容（警告语）字段中会自动出现和【玻璃容器】关联的所有警告语（可能是1个或多个）。同时产品属性字段中的值，可能存在互斥。

### 
第1步：查询警告语填写规则

- 
调用接口：
/open-api/goods-compliance/query-warning-certificate-rules

- 
接口返回的是所有需商家手动操作的警告语证书。平台中还有自动的警告语证书，无需商家处理，这类证书不会返回。此接口建议每周调用一次，确保获取平台最新的配置数据。

- 
出参使用说明

字段名
字段名
字段名
字段名
字段名
说明

certificateTypeId
证书类型ID

certificateTypeCode
证书类型Code，唯一编码。后续查询、更新SKC警告语时均会使用。

certificateTypeName
证书类型名称

presetInfo​
证书字段信息

isEnabled
字段信息是否启用。0-禁用；1-启用

​
presetFields
​
​
字段详情

​
fieldCode
​
字段Code，唯一编码。

​
fieldName
​
字段名称，支持返回多语言。

​
fieldType
​
字段值的输入方式。

0=多选;1=单选;2=手动输入（实际上还是多选）

​
fieldSort
​
字段排序。

重要：排序值最大的字段是警告语字段，警告语字段逻辑和常规字段不同。

isEnabled
字段是否启用。0-禁用；1-启用

presetFieldValues
​
字段值信息

fieldValueId
​
字段值ID，唯一编码。

fieldValue
​
字段值名称，支持返回多语言。

valueSort
字段值排序

​isEnabled
字段值是否启用。0-禁用；1-启用

exclusionFieldValueIds
​
常规字段专用，互斥的字段值列表。

若常规字段值A下有互斥值B、C，则当商家选A时，BC均不能选。

mappingPaths
警告语字段专用，警告语组装规则

fieldValueIds
警告语关联的常规字段值fieldValueId列表。

若警告语值a关联了常规字段值A、B，则当商家选了A或B中的任意值时，警告语字段中都需要传入a。

### 
查询SKC的警告语绑定情况

- 
调用接口：
/open-api/goods-compliance/query-skc-warning-status

- 
入参重点：接口必须入参分页信息、证书类型编码certificateTypeCodes。目前平台没有警告语证书的标识，只能通过具体的certificateTypeCode来识别哪些是警告语，因此建议先查询警告语填写规则接口，获取到全量的警告语证书code，将他们入参至此以确保查出的结果全是警告语的绑定数据。

- 
出参重点：需关注一下2个字段isRequired：是否必传。必传证书建议上传，否则会影响上架。reviewState：证书审核状态。若审核驳回，建议重新上传，否则会影响上架。

### 
更新SKC的警告语

- 
调用接口：
/open-api/goods-compliance/update-skc-warning-certificate

- 
此接口覆盖创建、更新场景。支持对多个SKC进行相同警告语证书的批量更新。

- 
入参重点

- 
警告语证书中所有的字段均需要入参，包括警告语字段。

- 
警告语字段的值需要完全匹配商家对于常规字段的选择结果，否则会更新失败。

- 
警告语字段的fieldType通常是2（手动输入），但实际在API入参中，入参方式是多选，即fieldValues中需要提供fieldValueId

- 
下面是一个警告语证书的构建示例

查询警告语填写规则-出参
更新SKC的警告语-入参

{

    "certificateTypeId": 754,

    "certificateTypeCode": "PlaypenWMWAttr",

    "certificateTypeName": "Game Bed Warning",

    "presetInfo": {

        "isEnabled": 1,

        "presetFields": [

            {

                "fieldName": "产品属性",

                "fieldType": 0,

                "fieldCode": "PAWA1",

                "fieldSort": 0,

                "isEnabled": 1,

                "presetFieldValues": [

                    {

                        "fieldValueId": 2455,

                        "fieldValue": "玻璃容器",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": null,

                        "valueSort": 0,

                        "isEnabled": 1

                    },

                    {

                        "fieldValueId": 2458,

                        "fieldValue": "产品带奶嘴",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": null,

                        "valueSort": 1,

                        "isEnabled": 1

                    }

                ]

            },

            {

                "fieldName": "警告语",

                "fieldType": 2,

                "fieldCode": "WAContent",

                "fieldSort": 1,

                "isEnabled": 1,

                "presetFieldValues": [

                    {

                        "fieldValueId": 2457,

                        "fieldValue": "警告语：使用本产品时必须有成人监护.",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": [

                            {

                                "fieldValueIds": [

                                    2455

                                ]

                            },

                            {

                                "fieldValueIds": [

                                    2458

                                ]

                            }

                        ],

                        "valueSort": 0,

                        "isEnabled": 1

                    },

                    {

                        "fieldValueId": 2456,

                        "fieldValue": "警告：严禁将喂食奶嘴用作安抚奶嘴。",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": [

                            {

                                "fieldValueIds": [

                                    2455

                                ]

                            },

                            {

                                "fieldValueIds": [

                                    2458

                                ]

                            }

                        ],

                        "valueSort": 1,

                        "isEnabled": 1

                    },

                    {

                        "fieldValueId": 2454,

                        "fieldValue": "警告：玻璃容器可能破裂。",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": [

                            {

                                "fieldValueIds": [

                                    2455

                                ]

                            }

                        ],

                        "valueSort": 2,

                        "isEnabled": 1

                    }

                ]

            }

        ]

    }

}

{

    "certificateTypeCode": "PlaypenWMWAttr",

    "fieldList": [

        {

            "fieldCode": "PAWA1",    // 常规字段：产品属性

            "fieldValues": [

                {

                    "fieldValueId": 2458   //即属性值：产品带奶嘴

                }

            ]

        },

        {

            "fieldCode": "WAContent",     // 警告语字段

            "fieldValues": [

                {

                    "fieldValueId": 2457     // 此警告语值的mappingPaths中包含2458产品带奶嘴，所以需要入参此值

                },

                {

                    "fieldValueId": 2456      // 此警告语值的mappingPaths中包含2458产品带奶嘴，所以需要入参此值

                }

            ]

        }

    ],

    "skcNames": [

        "s24102107079376"

    ]

}

## 解决方案 / 半托管解决方案 / ERP订单履约方案

- Page ID：`b86df826-638d-4128-9f5e-c7b20d8cf28e`
- 路径：`https://open.sheincorp.com/documents/system/b86df826-638d-4128-9f5e-c7b20d8cf28e`
- 简介：该解决方案适用于具有系统对接能力、有订单履约需求的开发者

## 
一、方案介绍

### 
1.1、业务介绍

该解决方案适用于具有系统对接能力
、有订单履约需求的开发者
。

自运营和半托管店铺模式的自研商家、ISV或其他开发者可以通过此解决方对接SHEIN订单管理服务

适合接入该解决方案的应用类型：

1. 自运营应用

2. 半托管应用

### 
1.2、概念和名词说明

概念&名词
​说明

自运营
由商家定价，商家无需备货到SHIEN，订单由商家负责履约的合作模式

半托管
由SHEIN定价，商家无需备货到SHIEN，订单由商家负责履约的合作模式

在线下单
商家使用SHIEN合作物流发货，简称在线下单

认证仓
商家使用平台认证的仓库，订单生成后由SHEIN平台发送订单至认证仓发货

SFS订单
SHEIN履约服务（SHEIN Fulfillment Service，简称SFS），由商家将货物提前存放到SHEIN仓库，消费者下单后，由SHEIN进行打包发货的服务，该流程无需ERP介入。常见于巴西市场卖家。

## 
二、订单状态说明

### 
2.1、订单状态

### 
2.2、订单状态说明

状态
​订单状态枚举值
状态描述
状态说明

Pending
orderStatus = 1
订单待处理
已付款的订单会变更为此状态，订单状态为Pending（1）时，商家可以对订单执行履约操作

To Be Shipped
orderStatus = 2
订单待发货
不同的履约方式会触发该状态变更：

1、调用导出地址接口，并且入参"handleType"

2、调用在线下单接口，会将状态变更为 To Be Shipped{2}）

To Be Shipped by SHEIN
​orderStatus = 3
待SHIEIN发货
当订单为SHEIN履约的订单，且等待发货的时候，订单会切换到此状态

To Be Picked Up
orderStatus = 7
订单待揽收
除已经退款商品之外，订单中有至少一个商品上传了物流单号信息时，订单变更为待揽收状态。不同的履约方式会触发该状态变更：

1、完成运单号上传

2、完成面单打印

Shipped
orderStatus = 4
订单已发货
除已经退款商品之外，订单中有至少一个商品有揽收信息时，订单变更为待揽收状态。SHEIN平台打通了各个物流商，检测到货物被揽收将更新状态为订单已发货

Delivered
orderStatus = 5
订单已签收
当所有需要发货的商品的物流单号均已签收时，订单变更为此状态。SHEIN平台会检测物流单号的状态是否已签收，请上传正确的物流单号。

Refunded
orderStatus = 6
订单已退款
订单维度和商品维度都有退款状态，具体说明如下：

1、整单的订单状态：所有商品都退款

2、商品的订单状态(newGoodsStatus)：消费者对商品进行退款

3、商品的订单状态(newGoodsStatus)：商家将订单中的单个商品设置为确认无货

      a、当状态为订单待发货（To Be Shipped{2}），商家设置商品无货，商品订单状态将更新为Refund{6}

      b、当状态为订单待揽收（To Be Picked Up{7}），商家设置商品无货，商品订单状态将更新为Refund{6}

## 
三、订单履约说明

### 
3.1、订单履约方式

### 
3.2、履约方式说明

履约方式
履约方式定义说明
是否备货到平台仓
判断方式

商家自行发货（商家导出地址发货）
商家导出订单发货地址，自行委托第三方物流服务商发货
否
不备货到平台：stockMode=3； 订单可选物流包含商家自发货：optionalLogisticsLis=[2]；

平台合作物流发货
商家选择物流发货（在线下单）
平台提供的合作物流商，商家通过平台向物流商在线下单并发货
否
不备货到平台：stockMode=3； 订单可选物流支持在线下单：optionalLogisticsLis=[1]；orderPlaceType = 2

平台指定物流发货
平台指定物流服务商，从商家仓收取货件发货
否
不备货到平台：stockMode=3； 仅支平台合作物流发货：optionalLogisticsLis=[1]；orderPlaceType = 1

SHEIN认证仓发货
商家使用平台认证的仓库，订单生成后由平台发送至认证仓发货，开发者无需处理
否
订单类型，orderType = 5，表示认证仓订单，且库存模式为不备货到平台，stockMode=3；

SFS模式发货
商家将货物提前存放到SHEIN仓库，消费者下单后，由SHEIN物流商揽收并发货，该流程无需开发者介入。
是
库存模式为备货到SHEIN仓库stockMode = 2；

### 
3.3、订单异常处理

订单详情中【
printOrderStatus】表示订单当前是否可处理
，
当订单详情中【printOrderStatus = 2】时，表示订单不可处理，此时需要重点关注【unProcessReason】字段，根据不同情况处理异常订单：

unProcessReason值
解释说明
处理方式

1、5、7、8
系统处理中，请稍后重试
请在30分钟后重新获取订单详情，更新订单状态后处理订单

2
订单存在问题，客服正在核实处理
等客服处理完后，重新拉取订单详情

4
订单未生成包裹/预报失败
订单异常，需要商家后台联系客服处理

3、13
巴西订单需要同步发票
巴西订单需要先上传巴西发票，再进行订单处理

10、11
商家没有设置仓库地址，一般会提示：请到卖家后台设置仓库地址
联系商家配置仓库地址，然后重新调订单详情接口

12
订单是拆包的订单，同时ERP系统还未操作拆单
需要调用API确认拆包或取消拆包

6、9
商品库存为0，可以看到此时storageTag=2
1、 如果有货，则补充库存，消除无货的标签；2、 如果无货，则调用商品无货接口；

## 
四、接口清单

### 
4.1、接口列表

接口名称
接口地址
​接口说明

查询订单列表
/open-api/order/order-list
查询店铺的订单列表

查询订单详情
/open-api/order/order-detail
查询订单详情

导出地址发货
/open-api/order/export-address
商家自行发货，导出订单的发货地址，自行委托第三方物流服务商发货

上传运单接口
/open-api/order/import-batch-multiple-express
商家自行发货，发货完成后上传运单号，标记订单为已发货。

查询商家可用发货渠道
/open-api/order/express-channel
查询商家维度的可用发货渠道

物流在线下单接口
/open-api/gsp/place-express-order
商家使用SHIEN平台合作物流发货，通过此接口创建物流订单

查询在线下单结果
/open-api/gsp/chack-express-order
查询SHIEN平台合作物流发货下单结果

查询店铺可用物流信息
/open-api/gsp/order-mapping-channels
查询店铺维度的可用物流信息

切换导出地址发货
/open-api/gsp/switch-self-shipping
切换发货方式为到出地址发货

打印面单接口
/open-api/order/print-express-info
用于打印面单

回传发票信息
/open-api/order/sync-invoice-info
用户上传发票信息，主要在巴西市场的订单使用

查询物流轨迹
/open-api/gsp/logistics-track
用于查询订单的物流轨迹，物流信息

确认无货接口
/open-api/order/confirm-no-stock
当商品无货无法发货时，调用此接口进行确认无货处理。

确认超限拆分包裹
/open-api/order/unpacking-group-confirm
当订单包裹超限时，需要商家确认是否拆分包裹

取消超限拆分包裹
/open-api/order/unpacking-group-remove
用于取消超限拆分包裹

### 
4.2、webhook列表

​接口名称（拟变更名称）
接口地址
​接口说明

订单状态同步通知
/order_push_notice
订单状态变更时，通过webhook发送通知

在线下单结果通知
/logistics_order_result_notice
在线下单结果通知，有结果时通过webhook发送通知

CTE开票状态通知
/invoice_status_notice
CTE开票状态通知，常用于巴西市场

## 
五、接口调用说明

### 
5.1、商家自行发货（导出地址发货）

商家自行发货，即商家自己导出订单地址，联系物流承运商发货。发货后，由商家上传运单号。

支持该履约类型的范围如下：

商家类型
国家

自运营
美国、欧洲、墨西哥

半托管
所有国家

商家自履约订单状态流转：

商家自履约
接口调用流程：

商家自履约
接口调用流程说明：

- 
获取订单列表：/open-api/order/order-list

- 
获取订单详情：/open-api/order/order-detail

- 
监听订单状态变更webhook：/order_push_notice

- 
判断订单发货方式：

- 
如果订单可选物流包含商家自发货：optionalLogisticsLis = [2]，则订单支持商家导出地址发货；

- 
判断订单是否异常（printOrderStatus是否等于1）：

- 
printOrderStatus等于1为正常订单，则继续完成第6步；

- 
不等于1为异常，请查看unProcessReason字段，进行订单异常处理。

- 
如订单无异常，则导出地址：/open-api/order/export-address

- 
商家导出地址后，自行预约物流上面揽收；

- 
物流揽收后生成运单号。

- 
获取店铺可用物流：/open-api/order/express-channel

- 
调用上传运单号接口：/open-api/order/import-batch-multiple-express

### 
5.2、SHEIN合作物流发货（在线下单发货）

SHEIN合作物流发货，即商家使用SHEIN合作物流商进行发货，这种情况下需要区分“商家选择物流商（在线下单）”和“SHEIN指定物流商”两种方式。以下主要阐述商家使用“SHEIN合作物流发货”，“商家选择物流商（在线下单）”的履约流程。

支持该履约类型的范围如下：

商家类型
国家

自运营
美国、欧洲

半托管
美国、欧洲、中东

在线下单发货订单状态流转：

在线下单发货接口调用流程：

在线下单发货接口调用流程说明：

- 
获取订单列表：/open-api/order/order-list

- 
获取订单详情：/open-api/order/order-detail

- 
监听订单状态变更webhook：/order_push_notice

- 
判断订单发货方式：

- 
如果订单可选物流包含商家自发货：optionalLogisticsLis = [1]，则订单支持SHEIN合作物流发货；

- 
如果orderPlaceType = 2，则表示订单支持商家自选物流，可以使用在线下单功能；

- 
如果orderLogisticsType = 1，则表示商家已选择平台合作物流发货，后续请使用在线下单方式完成订单履约。

- 
判断订单是否异常（printOrderStatus是否等于1）：

- 
printOrderStatus等于1为正常订单，则继续完成第6步；

- 
不等于1为异常，请查看unProcessReason字段，进行订单异常处理。

- 
在线下单流程：

- 
查询商家仓库地址：/open-api/gsp/warehouse-address，获取仓库地址编码（warehouseAddressCode）

- 
查询仓库地址编码（warehouseAddressCode），查询可用物流渠道/open-api/order/express-channel

- 
判断可用物流渠道：平台合作物流列表（platformLogisticsChannels），如果有返回物流渠道则可以使用在线下单

- 
如果没有返回物流渠道，则表示当前仓库地址无法使用在线下单；

- 
查询订单可用物流信息：/open-api/gsp/order-mapping-channels

- 
获取物流价格

- 
获取渠道预判请求ID（preRequestId）

- 
商家选择物流商，并调用在线下单接口：/open-api/gsp/place-express-order

- 
需要传入preRequestId，expressChannelCode，以及包裹明细；

- 
调用成功后得到运单包裹号（deliveryNo），下单请求id（placeRequestId）；

- 
监听在线下单结果：/logistics_order_result_notice

- 
查看物流单下单结果：/open-api/gsp/chack-express-order

- 
如果handleResult = 1，则物流商确认中，请稍后重新查询结果；

- 
如果handleResult = 2，则代表下单成功，可以打印免单进行发货；

- 
如果handleResult = 3，则代表下单失败，可以重新在线下单，或者切换为商家导出地址发货

- 
如物流单无异常，则调用打印面单接口；/open-api/order/print-express-info

### 
5.3、平台指定物流发货

履约场景
​文档链接

平台指定物流履约（墨西哥市场）
平台指定物流履约（墨西哥市场）

平台指定物流履约（巴西市场）
平台指定物流履约（巴西市场）

### 
5.4、其它履约场景说明

履约场景
文档链接

订单换货场景
订单换货场景说明

订单退款退货场景
客单退货退款服务

订单超限拆包场景
订单超限拆包场景

## 

## 
六、常见问题说明

1.  
订单列表接口里返回的时间字段对应的是什么时间？这个和后台所看到的时间是否存在差异？

所有接口内返回的时间是北京时间（GMT+8），商家后台所看到的时间是经过后台导航栏所配置的时区转换后所示，暂无夏令时处理。

2.  
为什么导出地址信息后，订单状态还是待处理（Pending{1}）？

导出地址信息接口里需指定handletype=2的入参获取地址信息才会导致订单状态变为“待发货”。

3.  
上传运单接口里的expressCode和expressIdCode分别如何理解？

expressCode：运单号，可以理解为tracking number

expressIdCode：SHEIN平台设置的渠道商名称，不同市场可用渠道商名称不同，由于名称可能会变更，建议每周更新一次；

expressIdCode根据店铺可用物流商接口获取：

https://open.sheincorp.com/en/documents/apidoc/detail/3000363-2000001

4.  
商品必须具体满足哪些条件才可以上传运单成功?

商品状态（newGoodsStatus）是待发货（To Be Shipped{2}）、待揽收（To Be Picked Up{7}）

换货状态（goodsExchangeTag）是未换货{1}或者换来商品{3}

库存状态（stockMode）=3, 备货在商家仓

5.  
订单详情返回信息中有“goodsId”和“productId”，两者有何差异?

没有差异，字段命名不同。⚠️注意：同种商品多件，每一件商品的goodsId不同

6.  
上传运单号（
/open-api/order/import-batch-multiple-express
）后，接口返回code=0，但订单状态没有改变？

请关注是否接口返回信息中的info不为空，上传运单会存在部分商品成功，部分失败的情况，此时接口返回code=0，但info里会体现商品部分维护失败的原因。

7.  
为什么订单状态=“待处理”，但依然无法进行导出地址？

除订单状态外，还需结合订单详情字段中的“打单状态（printOrderStatus）”、打单状态（printOrderStatus）=1才能导出地址

8.  
发货前，若商家发现某个商品（SKU）库存无货而无法履约时，怎么办？

调用确认无货接口，对订单商品（SKU）进行确认无货处理，操作后商品订单状态将更新为【已退款】

9.  在线下单和导出地址两种履约方式如何切换：

订单状态为待处理状态（orderStatus=1），
打单状态（
printOrderStatus
）=1，且订单状态在“
待发货”之前可以切换履约方式。

## 解决方案 / 半托管解决方案 / 平台指定物流履约（墨西哥市场）

- Page ID：`e2cc7bc5-c043-4c9c-95f6-13b7fe040994`
- 路径：`https://open.sheincorp.com/documents/system/e2cc7bc5-c043-4c9c-95f6-13b7fe040994`

# 
平台指定物流履约（墨西哥市场）

### 
1、SHEIN合作物流发货

SHEIN合作物流发货，即商家使用SHEIN合作物流商进行发货，这种情况下需要区分“商家选择物流商”和“SHEIN指定物流商”两种方式。以下主要阐述商家使用“SHEIN合作物流发货”，“平台指定物流发货”的履约流程。

支持该履约类型的范围如下：

商家类型
国家

自运营
墨西哥

半托管
墨西哥

### 
2、订单状态流转

​

### 
3、接口调用流程

接口调用流程说明：

- 
获取订单列表：
/open-api/order/order-list

- 
获取订单详情：
/open-api/order/order-detail

- 
监听订单状态变更webhook：
/order_push_notice

- 
判断订单发货方式：

- 
如果订单可选物流包含平台指定物流发货：optionalLogisticsLis=[1]；

- 
且orderPlaceType = 1，则该订单为平台指定物流发货。

- 
判断订单是否异常（printOrderStatus是否等于1）；

- 
printOrderStatus等于1为正常订单，则继续完成第6步；

- 
不等于1为异常，请查看unProcessReason字段，进行订单异常处理。

- 
如订单无异常，则调用打印面单接口；
/open-api/order/print-express-info

- 
打印面单后，订单状态变更为“待揽收”；

- 
物流揽收后，订单状态变更为“已发货”；

- 
物流签收后，订单状态变更为“已签收‘，订单履约结束。

## 解决方案 / 半托管解决方案 / 平台指定物流履约（巴西市场）

- Page ID：`14ea81f8-7c58-4111-9cc9-ecdf23541493`
- 路径：`https://open.sheincorp.com/documents/system/14ea81f8-7c58-4111-9cc9-ecdf23541493`

# 
平台指定物流履约（巴西市场）

### 
1、SHEIN合作物流发货

根据当地政府要求，巴西企业卖家需要为订单开具发票。巴西企业卖家需要通过ERP系统完成开票流程，并将开票信息传送回SHEIN。因此，在SHEIN的履约流程中，巴西市场和其他市场的操作流程将有所不同。

支持该履约类型的范围如下：

商家类型
国家

自运营
巴西

半托管
巴西

### 
2、订单状态流转

### 
3、接口调用流程

接口调用流程说明：

- 
获取订单列表：
/open-api/order/order-list

- 
获取订单详情：
/open-api/order/order-detail

- 
监听订单状态变更webhook：
/order_push_notice

- 
判断订单发货方式：

- 
如果订单可选物流
包含
平台指定物流发货：optionalLogisticsLis=[1]；

- 
且orderPlaceType = 1，则该订单为平台指定物流发货；

- 
如果salesSite = shein-br，则为巴西市场订单。

- 
判断订单是否异常（printOrderStatus是否等于1）；

- 
printOrderStatus等于1为正常订单，则继续完成第6步；

- 
不等于1为异常，请查看unProcessReason字段，进行订单异常处理。

- 
如订单无异常，则导出地址：
/open-api/order/export-address

- 
商家导出地址后，自行预约物流上面揽收；

- 
物流揽收后生成运单号。

- 
上传发票：
/open-api/order/sync-invoice-info

- 
上传发票成功后，需要查询订单printOrderStatus是否为可处理状态；

- 
如果订单为可处理状态，则调用打印面单接口。

- 
则调用打印面单接口；
/open-api/order/print-express-info

- 
打印面单后，订单状态变更为“待揽收”；物流揽收后，订单状态变更为“已发货”；

- 
物流签收后，订单状态变更为“已签收‘，订单履约结束。

## 解决方案 / 半托管解决方案 / 超限拆包服务

- Page ID：`7039b56b-69c7-43b1-a706-50d418d723e8`
- 路径：`https://open.sheincorp.com/documents/system/7039b56b-69c7-43b1-a706-50d418d723e8`
- 简介：本方案适用于具有系统对接能力的卖家，基于API/消息的形式对接平台揽收的客单

## 
一、 
业务方案

### 
 1、 
适用范围

本方案适用于具有系统对接能力的卖家，基于API/消息的形式对接平台履约的第三方开发者和卖家。

### 
 2、 
内容概述

本方案围绕平台履约（揽收）的客单履约场景：平台揽收的订单存在由于商品数量过多导致包裹超大，超重等问题导致物流承运商无法发货。巴西和非巴西地区的ERP流程不一致，商家需根据实际情况接入，整体接口架构如下：

API/Notice
Link&path

查询订单列表
/open-api/order/order-list

查询订单详情
/open-api/order/order-detail

打印面单
/open-api/order/print-express-info

确认无货
/open-api/order/confirm-no-stock

上传巴西发票
/open-api/order/sync-invoice-info

确认拆包
/open-api/order/unpacking-group-confirm

取消拆包
/open-api/order/unpacking-group-remove

消息通知
order_push_notice

### 
3、 
方案介绍

#### 
3-1、流程概述

接口调用流程：

1、webhook收到新订单信息（仅限开通webhook的开发者）

2、拉取订单列表接口（
SHEIN Developer Platform
），获取订单详情（
SHEIN Developer Platform
）

3、 
识别需要确认超限拆包的订单

根据订单字段判断：

     a) 
isOverLimitOrder=1，该订单是超限订单

     b) 
isOverLimitOrder=2，该订单不是超限订单

 4、 
ERP给到商家确认拆包或取消拆包，完成发货（
注意，一旦确认或取消不能回滚操作
）

     a) 
如果是巴西卖家，确认拆包后操作如下：

         i) 
巴西订单确认拆包的情况下，使用拆包分组号上传发票信息

         ii) 
上传发票后，使用该订单详情接口（
SHEIN Developer Platform
）的出参「
orderNo
」和「
packageNo
」作为打印面单的入参，完成面单打印
SHEIN Developer Platform

     b) 
如果是巴西卖家，取消拆包后操作如下： 

         i) 
巴西订单取消拆包的情况下，使用订单号上传发票信息

         ii) 
上传发票后，重新调用订单详情接口（
SHEIN Developer Platform
），获取新的订单详情入参「
orderNo
」和「
packageNo
」作为打印面的入参，完成面单打印
SHEIN Developer Platform

     c) 
如果是非巴西卖家，确认拆包后操作如下：

         i) 
使用该订单详情接口（
SHEIN Developer Platform
）的出参「
orderNo
」和「
packageNo
」作为打印面单的入参，完成面单打印
SHEIN    Developer Platform

     d) 
如果是非巴西卖家，取消拆包后操作如下： 

         i) 
重新调用订单详情接口（
SHEIN Developer Platform
），获取新的订单详情入参「
orderNo
」和「
packageNo
」作为打印面的入参，完成面单打印
SHEIN Developer Platform

#### 
3-2、流程详细介绍

#### 
超限拆包服务-最佳实践

## 
二、FAQ 

1、卖家反馈ERP展示订单与GSP订单列表对比有数量差异？

在当前同步逻辑下，由于订单从SHEIN通过
/open-api/order/order-list
接口同步至ERP会有一定的时间间隔，具体间隔取决于ERP调用该接口的频率，因此建议ERP
至少半小时
调用一次订单列表接口获取增量订单。

2、接口里涉及的时间对应的是什么时间？为什么会和后台所看到的存在差异？

所有接口内返回的时间是北京时间（GMT+8），商家后台所看到的时间是经过后台导航栏所配置的时区转换后所示，暂无夏令时处理。

 3、 
/open-api/order/order-list
 报错：请求参数异常,请刷新重试

注意是否为时间戳格式不正确，正确格式为：yyyy-MM-dd HH:mm:ss
 

 4、 
一定要确认是否拆包后才能进行上传发票，打印面单等操作？

是的

 5、 
怎么理解拆包分组号和包裹号？

拆包分组号是用于记录预拆包且和发票挂钩，即使后面订单的包裹号发生改变了，拆包分组号也保持不变，发票信息也保持不变

 6、 
一旦确认或取消系统拆包，操作不可逆？

是的

 7、 
卖家什么时候需要取消拆包？

订单有商品缺货，卖家取消部分商品后卖家认为订单商品没有超限；卖家判断订单不拆包也能履约，例如商品维护的信息不准确导致的系统误判；

 8、 
卖家如何判断会不会超限？后续会考虑开放查询接口？

 
现在暂不支持

 9、 
卖家可以自行拆包吗？后续会考虑开放

现在暂不支持

10、超限拆包，多少阈值触发超限拆包？

这个是业务配置的，目前是60*60*40cm的包裹会触发

11、SHEIN自动处理拆包，这个规则是什么？

无需关注，调用订单详情接口，返回数据中已经有拆好的包裹信息

12、取消超限拆包的影响？

接口没有影响，业务可能导致承运商不揽件，比如商家多件商品包裹为100cm，未拆包裹的情况有可能导致平台承运商拒绝揽收

13、关于发货地址，可以支持1个订单拆包，多个揽收地址发货吗？

不允许，1个订单只绑定1个仓库

14、是否支持商家自己选择哪些商品在某个包裹

不可以

15、是否有测试店铺和测试订单可以调用

这个需要跟内部协商，还在沟通中

如有疑问，可邮件联系nerowang@shein.com

## 解决方案 / 半托管解决方案 / 客单退货退款服务

- Page ID：`949a61a4-bb8b-4683-922a-8755e079b394`
- 路径：`https://open.sheincorp.com/documents/system/949a61a4-bb8b-4683-922a-8755e079b394`
- 简介：适用于商家通过OpenAPI管理退货单

# 
一、 
业务方案

## 
 1、 
适用范围

本方案适用于具有系统对接的卖家，基于API/消息的形式对接客单退货退款服务。

## 
 2、 
内容概述

本方案围绕客单退货退款场景：支持拉取退货退款列表及详情、确认退货签收等功能，商家可自行按需接入，整体接口架构如下：

注：具体每个API/消息实际应用场景见方案介绍部分

API/Notice
Link&path

Get return list 
/open-api/return-order/list

Get return detail
/open-api/return-order/details

Sign the return
/open-api/return-order/sign-return-order

## 
 3、 
订单状态流转图

状态{状态代码}
状态描述

Already Applied{2}
申请中售后单

Closed{1}
系统自动关闭的售后单

Cancel{3}
会员取消的售后单

Waiting for transit in SHEIN warehouse{8}
待SHEIN仓中转

Pending handover{7}
待交接

Delivered{6}
退货单已妥投

Received{5}
退货单已全部签收

Completed{9}
已完成

## 
 4、 
方案介绍

### 
4-1、流程概述

基本流程：

 1、 
拉取新增退货退款单（支持新增退货退款单通知）

 2、 
获取新增退货退款单详情

 3、 
物流商派送退货商品

 4、 
签收退货商品同步到平台

### 
4-2、流程详细介绍

#### 
平台揽收客单退货退款-最佳实践

# 
 二、 
FAQ

1、接口里涉及的时间对应的是什么时间？为什么会和后台所看到的存在差异？

所有接口内返回的时间是北京时间（GMT+8），商家后台所看到的时间是经过后台导航栏所配置的时区转换后所示，暂无夏令时处理。

2、
/open-api/return-order/list
 报错：请求参数异常,请刷新重试

注意是否为时间戳格式不正确，正确格式为：yyyy-MM-dd HH:mm:ss

3、该接口的QPS多少？

每个店铺限制QPS=5/s

 4、 
卖家一直不签收系统会自动签收吗？

会的，自动签收时间会根据不同国家地区不一样

 5、 
接口获取的退货退款单都是客诉处理结果吗？

售前是由客服处理，卖家接收处理的结果反馈，确认退货到仓的签收

# 

#

## 解决方案 / 半托管解决方案 / 订单换货场景说明

- Page ID：`14b4ecf0-8e51-4cfc-bdcb-d4bd26c8e9ae`
- 路径：`https://open.sheincorp.com/documents/system/14b4ecf0-8e51-4cfc-bdcb-d4bd26c8e9ae`

# 
订单换货场景说明  

## 
一、场景说明

在遇到商品无货或买家买错，包裹运输中途破损，丢件，买家收到货不满意等场景平台支持换货的操作

处理节点
处理节点订单状态
申请换货场景
​是否生成换货订单
处理

发货前换货​
待处理
商品缺货，平台联系买家进行换货
​​否​
如果选择换货，在原订单上会新增换货后的商品，即在订单上会看到被换商品（2）和换来商品（3）如果选择退款，那么​直接取消商品或取消订单

待处理
买家买错，订单待处理的状态，买家申请换货

待处理
商家确认无货，联系买家选择退款或是换货

​待揽收、待发货
商家确认无货，联系买家选择退款或是换货
是​
如果选择换货，原订单上的商品会被标记为被换商品（2），新换货单上的商品会标记为换来商品（3）如果选择退款，那么​直接取消商品或取消订单

待处理
买家取消换货
/
订单上会看到买家下单的商品由被换货（2）更新成未换货（1），换来商品（3）更新成删除换货（4）

发货后换货
已发货（已妥投买家），已签收，已报损，已拒收
买家不满意等进行换货重发
​是
买家发起的商品
会在新的换货订单中标记为换来商品（3），原订单上的商品会被标记为被换商品（2）

已发货（未妥投买家）
丢包，破损
是
物流包裹下所有商品
都会在新的换货订单中标记为换来商品（3），原订单上的商品会被标记为被换商品（2）

## 
二、接口清单

### 
接口列表

接口名称
接口地址
​接口说明

查询订单列表
/open-api/order/order-list
支持获取换货订单

查询订单详情
/open-api/order/order-detail
支持查询换货订单详情

### 
Webhook列表

接口名称
接口地址
​接口说明

订单状态变更通知
/order_push_notice
订单发生换货时会通过消息通知

## 
三、接口参数说明

场景
接口
参数
原订单
换货订单

不生成换货订单
/open-api/order/order-detail
orderNo
原订单号
不生成换货订单

orderType
1：正常订单

goodsExchangeTag
1：未换货商品且订单未发货，需要履约2：被换商品，不需要履约3：换来商品且订单未发货，需要履约4：删除换货，不需要履约

beExchangeEntityId
换来商品会有对应的被换商品goodsId

billNo
​ info.billNo=原订单号

生成换货订单
/open-api/order/order-detail
orderNo
原订单号
换货单号（orderType=2的即为换货单）

orderType
1：正常订单
2：换货订单

goodsExchangeTag
1：未换货商品，需要履约2：被换商品，不需要履约3：换来商品，需要履约4：删除换货，不需要履约
1：未换货商品且订单未发货，需要履约2：被换商品，不需要履约3：换来商品且订单未发货，需要履约4：删除换货，不需要履约

beExchangeEntityId
​
原订单上被换商品的goodsId

billNo
​ info.billNo=原订单号
​ info.billNo=原订单号

## 
四、换货订单接口调用说明

1.订阅订单状态变更通知：
/order_push_notice

   订单发生换货时会触发推送消息

2.请求订单列表：
/open-api/order/order-list

   从接口可以获取到一段时间内的订单和换货订单

3.请求订单详情：
/open-api/order/order-detail

   订单号、换货单号都支持获取订单详情

## 
五、常见问题说明

1.为什么原单号和换货单的单号是一样的呢？

单号虽然展示相同，但是换货单会增加展示一个换货订单标识，同时你可以查看到新的履约单号

​

2.如何确保能及时拉取到换货单呢？

可以订阅订单同步通知（/order_push_notice），产生订单换货时会推送消息。

3.怎么知道换货单号与原订单的对应关系？

/open-api/order/order-detail接口换货单号中info.billNo=原订单号

4.为什么换过货的订单状态仍然是正常状态而不是换货订单，即orderType=1？

换过货的原订单会展示orderType=1，生成的新换货单状态才会是换货订单，即orderType=2

5.换货订单如何履约？

在履约场景，需要入参
orderNo的都更换成换货单号履约即可，
换货订单的发货流程与普通订单发货一致。

## 解决方案 / 全托管解决方案 / 全托管模式接入指南

- Page ID：`495d5251-5c71-4b67-8b6f-c7973b01fd12`
- 路径：`https://open.sheincorp.com/documents/system/495d5251-5c71-4b67-8b6f-c7973b01fd12`

# 
全托管模式接入指南

# 
1.模式说明

开放平台的应用类型根据SHEIN商家的业务模式进行拆分，开发者需要根据服务哪些商家模式，来决定要创建什么类型的应用，对接哪些接口。

全托管（旧称代运营、简易平台）模式

- 
商家负责选品并备货至SHEIN仓库，由SHEIN负责营销、订单履约售后、客服等环节

- 
应用可对接商品、采购、库存、财务接口

# 
2.开发接入

开发者需要先注册开发者账号、创建应用后才可开始正式对接，整体流程可参考文档
开发指南
。

- 
应用类型选择：全托管

- 
可授权的商家范围：全托管模式商家

注意：墨西哥地区的全托管模式比较特殊，请不要参考这份文档，请联系开放平台
openapi@
shein.com
获取具体信息。

# 
3.可对接的接口、通知

开发者开发全托管模式应用时，常规情况下可以对接
商品、商品合规、采购单、库存、财务
模块的接口。下面会按业务模块维度，介绍全托管模式在各模块内可利用的解决方案、可对接的接口、通知。

## 
3.1 商品

全托管模式的商品特征

- 
商家仅提供成本价

- 
商家无法随时操控商品上下架状态，只能提供期望上架方式

- 
部分商品类目需要提供样品信息

解决方案名称
文档地址

商品发布
https://open.sheincorp.com/documents/system/99154fa1-77d5-4b48-9253-cfff1d2a60ce

商品属性
https://open.sheincorp.com/documents/system/424039e8-4657-454a-a4cb-781938a42622

商品图片
https://open.sheincorp.com/documents/system/4d96fc8f-4913-4211-8630-5d81e7fcc010

商品证书
https://open.sheincorp.com/documents/system/a4c9a5c4-75db-4f99-bbaf-0e47b34bda80

批量处理商品
https://open.sheincorp.com/documents/system/04fdafe8-9bb7-4fac-bf47-b1f45c859371

类型
接口名称
接口路径

API
商品发布
/open-api/goods/product/publishOrEdit

API
商品发布规范
/open-api/goods/query-publish-fill-in-standard

API
查询店铺分类树
/open-api/goods/query-category-tree

API
根据商品图片查询类目
/open-api/goods/image-category-suggestion

API
查询店铺可用属性
/open-api/goods/query-attribute-template

API
查询分类是否可自定义属性值
/open-api/goods/get-custom-attribute-permission-config

API
添加自定义属性值
/open-api/goods/add-custom-attribute-value

API
查询店铺站点和币种信息（新）
/open-api/goods/query-site-list

API
查询店铺站点和站点币种（旧）
/open-api/openapi-business-backend/site/query

API
图片链接转换
/open-api/goods/transform-pic

API
本地图片上传
/open-api/goods/upload-pic

API
查询店铺品牌列表
/open-api/goods/query-brand-list

API
查询商品审核
/open-api/goods/query-document-state

API
商品列表
/open-api/openapi-business-backend/product/query

API
spu查询
/open-api/goods/spu-info

API
更新商品供货价
/open-api/goods/update-cost

API
查询证书所需上传资料（新）
/open-api/goods/certificate/get-all-certificate-type-list-v2

API
查询商品证书要求和审核状态
/open-api/goods/get-certificate-rule

API
上传证书文件
/open-api/goods/upload-certificate-file

API
商品证书池创建/编辑
/open-api/goods/save-or-update-certificate-pool

API
店铺证书池创建/编辑
/open-api/goods/save-or-update-supplier-certificate

API
SKC绑定商品证书池
/open-api/goods/save-certificate-pool-skc-bind

API
打印商品条码
/open-api/goods/print-barcode

API
创建Feed文件
/open-api/sem/feed/createFeedDocument

API
查询Feed文件
/open-api/sem/feed/getFeedDocument

API
上传Feed文件
/open-api/sem/feed/uploadDocumentContent

API
创建Feed任务
/open-api/sem/feed/createFeed

API
查看Feed任务
/open-api/sem/feed/getFeed

API
取消Feed任务
/open-api/sem/feed/cancelFeed

webook
商品接收通知
/product_document_receive_status_notice

webook
商品审核通知
/product_document_audit_status_notice

webook
商品上下架通知
/product_shelves_notice

webook
商品额度变动通知
/product_quota_change_notice

## 

## 
3.2 商品合规

解决方案名称
文档地址

商品合规
https://open.sheincorp.com/documents/system/af751fbf-0a24-484a-98fe-377654bd62d7

类型
接口名称
接口路径

API
获取全量环保耗材信息（新）
/open-api/goods-quality/environmental-label-rule/material-quality-tree-v2

API
获取全量耗材类型和耗材材质信息
/open-api/goods-quality/environmental-label-rule/material-quality-tree

API
获取环保标配置规则
/open-api/goods-quality/environmental-label-rule/list

API
批量打印环保标
/open-api/goods-quality/environmental-label-rule/print

API
打印合规标签
/open-api/goods-compliance/label-print

API
查询代理公司列表
/open-api/goods-compliance/agency-list

API
查询SKC的代理公司绑定要求
/open-api/goods-compliance/skc-agency-detail

API
绑定SKC和代理公司
/open-api/goods-compliance/save-skc-agency

API
查询SKC的实拍图要求
/open-api/goods-compliance/skc-label-list

API
上传实拍图图片
/open-api/goods-compliance/upload-skc-label-picture

API
绑定SKC和实拍图
/open-api/goods-compliance/skc-save-label

webook
商品合规信息失效通知
/product_compliance_change_notice

## 

## 
3.3 采购单

解决方案名称
文档地址

备货履约
https://open.sheincorp.com/documents/system/a880d468-3c56-4dee-b8d6-5c6ff8be756f

类型
接口名称
接口路径

API
获取采购单信息
/open-api/order/purchase-order-infos

API
查询JIT母单子单关系
/open-api/order/get-mothe-child-orders

API
查询发货信息
/open-api/shipping/basic

API
查询物流产品
/open-api/shipping/express-company-list-v2

API
查询收获仓信息
/open-api/shipping/warehouse

API
查询发货单列表
/open-api/shipping/delivery

API
创建发货单
/open-api/shipping/orderToShipping

API
编辑或取消发货单
/open-api/shipping/modify-delivery-order-info

API
打印发货单面单
/open-api/shipping/delivery/print-package

webook
采购单通知
/purchase_order_notice

webook
发货单变更
/delivery_modify_notice

## 
3.4 库存

全托管模式的库存管理特征

- 
商家仅需要维护总仓库存

类型
接口名称
接口路径

API
查询库存
/open-api/stock/stock-query

API
更新库存
/open-api/goods/stock-update

API
查询SKU销量
/open-api/goods/query-sku-sales

webook
推送缺货需求库存数
/out_of_stock_notice

## 
3.5 财务

类型
接口名称
接口路径

API
报账单列表
/open-api/finance/report-list

API
报账单销售款收支明细
/open-api/finance/report-sales-detail

API
报账单补扣款收支明细
/open-api/finance/report-adjustment-detail

# 
关联阅读

    
开发者接入指南

    
店铺授权指南

    
API调用指南

    
事件回调接入指南

## 解决方案 / 全托管解决方案 / 商品发布-全托管

- Page ID：`99154fa1-77d5-4b48-9253-cfff1d2a60ce`
- 路径：`https://open.sheincorp.com/documents/system/99154fa1-77d5-4b48-9253-cfff1d2a60ce`

商品发布 - 全托管模式

## 

# 
方案概述

## 
适用范围

本文档仅适合【应用类型=全托管】的应用。

## 
业务流程

本文档介绍商品发布/商品上传流程。主要包含4个阶段：发布准备、发布商品、等待平台审核、获取审核结果。

文档将会详细介绍，每个阶段所用接口、调用逻辑、调用注意事项。

## 
商品上传接口调用流程

#### 

## 
商品上传API&消息清单

API名称
API & 文档地址

查询商品发布字段规范
/open-api/goods/query-publish-fill-in-standard

查询店铺可用品牌
/open-api/goods/query-brand-list

查询店铺可用分类
/open-api/goods/query-category-tree

查询店铺可用属性
/open-api/goods/query-attribute-template

查询是否支持自定义属性值
/open-api/goods/get-custom-attribute-permission-config

添加自定义属性值
/open-api/goods/add-custom-attribute-value

转换图片成SHEIN可用的图片
/open-api/goods/transform-pic

本地图片上传
/open-api/goods/upload-pic

商品发布&编辑
/open-api/goods/product/publishOrEdit

查询商品审核状态
/open-api/goods/query-document-state

查询SPU商品详情
/open-api/goods/spu-info

消息名称
event_code & 文档地址

商品公文接收结果通知
/product_document_receive_status_notice

商品公文审批结果通知
/product_document_audit_status_notice

# 
商品上传详细步骤

## 
1、商品上传发布准备

全托管店铺在发布商品时，需提供的商品信息包括：

     ● 
品牌：商家可销售的品牌。商家先在商家后台创建，可通过API获取可售品牌。

     ● 
类目：商家可销售的类目。商家入驻后，平台会依据商家情况为其店铺分配可销售的类目，可通过API获取可售类目。

     ● 
属性：商品各维度属性，辅助买家全面了解商品。商品可用的属性，由平台决定，不同类目会有不同可用属性，可通过API获取。

     ● 
图片：商品图片由商家提供，可来自本地文件或线上链接，但需要将其转换成SHEIN平台的图片链接才可使用，可通过API完成转换。

     ● 
描述：商品描述由商家提供

     ● 
成本价：全托管店铺提供商品时只需要提供成本价，销售价由平台决定。

     ● 
库存：全托管店铺需要维护商品可销售的库存信息，不需要维护仓库信息。

接下来，会详细介绍如何开展发品准备工作。

### 
1.1 获取商品发布规范

因市场政策、类目规则等因素，不同店铺、不同类目对商品发布会有不同要求，例如：某些非必填字段要求必填。同时平台的要求在不断变化，因此建议在每次发品之前，先查询发布规范，基于规范去要求商家提供信息，然后发布商品，可提升商家的发品效率。

如何获取

- 
通过接口：
/open-api/goods/query-publish-fill-in-standard

- 
使用说明：

- 
请求说明

- 
常规情况：大部分规范绑定在店铺维度，所以请求时只关注请求头即可

- 
特殊情况

- 
当你要确认商品图片需要按什么要求提供时，需要关注请求体，提供"
category_id
"或"
spu_name
"。商品图片要求绑定在分类维度。

- 
当需要确认商品是否要样品信息
sample_spec
时，需要提供"category_id"

- 
返回说明

- 
"default_language"：商品默认语种；发布商品接口中商品名称多语言"
multi_language_name_list
"、商品描述多语言"
multi_language_desc_list
"中，
必须提供默认语种对应的内容。

- 
"
fill_in_standard_list
"：告知商品发布接口中时，哪些非必填的字段会变成必填。下方表格是两个接口中参数的映射关系。

- 
"picture_config_list"：告知商品图片上传要求。目前平台有多套图片要求，
请详细阅读文档：API支持上传SPU和SKU维度图片
。

"fill_in_standard_list"映射关系

发布规范接口中"field_key"枚举值
此枚举在商品发布接口中对应的入参字段

reference_product_link
competing_product_link （全托管无需关注）

proof_of_stock
proof_of_stock_list（全托管无需关注）

shelf_require
shelf_require

brand_code
brand_code

skc_title
skc_title

minimum_stock_quantity
minimum_stock_quantity

stop_purchase
stop_purchase

mall_state
mall_state

sample_spec
sample_info

### 
1.2 获取可用品牌

获取商家可销售品牌，供商家选用。商家先在商家后台创建品牌，才可通过API获取品牌信息。

如何获取

 ● 
通过接口：
/open-api/goods/query-brand-list

 ● 
使用说明：海外市场发布商品必须提供品牌，否则会影响C端展示；其他店铺是否必传，请以
商品发布规范信息
为准。

#### 

### 
1.3 获取可用类目树

获取店铺可用的类目，供商家选用。同时，商品可用属性绑定在类目下，获取属性时也会用到类目信息。

类目介绍

 ● 
不同店铺可用的类目不同，SHEIN会根据店铺的售卖地区、类型等因素决定店铺可用类目。

 ● 
类目下有多层子类目，不同类目下的子类目层级数量不同。

 ● 
类目下最后一层称为【末级类目】，商品与【末级类目】关联，且一个商品只会关联一个【末级类目】。

如何获取类目树

 ● 
通过接口：
/open-api/goods/query-category-tree

 ● 
使用说明

     ○ 
返回说明

         ■ 
需关注【末级类目】的概念，因为大部分商品接口中使用的都是【末级类目】的"category_id"。【末级类目】的判定方式："
last_category
"=true

         ■ 
需关注字段"product_type_id"，仅末级类目中有值，可理解为某个末级分类的信息模板。在发布商品、查询可用属性中都会用到。

### 
1.4 获取类目下可用属性

获取此商品类目下可用的所有属性、属性值，供商家选用/填写。

属性介绍

 ● 
不同【末级类目】有不同的可用属性。

 ● 
SHEIN决定每个类目下的可用属性、以及每个属性下可用的属性值。部分属性支持添加自定义属性值，可通过接口确认：
/open-api/goods/get-custom-attribute-permission-config

如何获取属性

 ● 
通过接口：
/open-api/goods/query-attribute-template

 ● 
使用说明：

    ○ 
请求参数使用的是末级类目的"
product_type_id
"，不是"
category_id"；
支持批量查询。

    ○ 
接口会返回指定的末级类目下所有属性以及所有属性值（目前包括自定义属性，但后续可能不再返回，建议开发者自己保存一份数据）

如何使用属性

根据属性的信息，明确此属性在商品发布接口中如何使用。

 ● 
如何判断属性在商品发布接口中对应哪个入参？

     ○ 
可通过属性类型概念去判断。

     ○ 
属性类型需要通过多个属性信息联合判断。

属性类型
判断方式
此类型在商品发布接口中的传参

主销售属性
attribute_type=1 & attribute_label=1注意：1个商品只有1个主销售属性
skc_list -> sales_attribute

次销售属性
attribute_type=1 注意：主销售属性可以作为次销售属性；1个商品最多可以有2个次销售属性。
sku_list -> sales_attribute

商品属性
attribute_type=3/4
product_attribute_list

尺码表属性
attribute_type=2
size_attribute_list

 ● 
如何确定属性是否必填：通过"
attribute_status
"判断，
1-不填；2-选填；3-必填；不填代表历史存在过但已停用的属性，可不填。

 ● 
属性值的输入方式：通过"
attribute_mode
"判断。当输入方式为下拉选择时，可选内容来自于属性值"
attribute_value_info_list
"。当可选属性值中没有商家想要的内容，需要自定义属性值时，可参考下方流程：

     ○ 
先确定属性是否支持添加自定义属性值：
/open-api/goods/get-custom-attribute-permission-config

     ○ 
若支持添加，则通过接口添加属性值：
/open-api/goods/add-custom-attribute-value

     ○ 
添加成功后保存返回的属性值ID"
attribute_value_id
"，或通过接口再次查询可用属性（不推荐）：
/open-api/goods/query-attribute-template

### 
1.5 将图片转换为SHEIN链接

通过API发布商品时提供的图片URL，必须为SHEIN可用的URL。需要提前将本地图片或在线URL转换为SHEIN URL后，再提交。

本地图片上传

 ● 
接口地址：
/open-api/goods/upload-pic

 ● 
上传之前，请先确认图片是否满足
SHEIN平台的图片规范
，不满足规范会转换失败。

外部在线链接转换

 ● 
接口地址：
/open-api/goods/transform-pic

 ● 
转换之前，请先确认图片是否满足
SHEIN平台的图片规范
，不满足规范会转换失败。

## 
2、上传/发布商品

 ● 
发布商品接口：
/open-api/goods/product/publishOrEdit

 ● 
以下是全托管应用，在发布商品时会使用到的参数

字段
类型
是否必填 

发布新品场景
是否必填 

编辑商品场景
字段描述

brand_code
string
否
否
商品品牌。SHEIN内部生成的品牌CODE。 通过接口
【商品发布字段规范（含默认语种）】
查询是否该字段必填

category_id
int64
是
是
商品所属的末级类目id。 通过
【店铺查商品末级类目】
获取。

product_type_id
int64
是
是
商品所属的商品类型id。 末级分类对应的类型ID。 通过
【店铺查商品末级类目】
获取

source_system
string
否
否
固定为openapi

spu_name
string
否
是
商品的spuName。SHEIN内部生成的SPU唯一标识。 创建商品场景不用传，商品发布成功以后的场景必传。

suit_flag
string
是
是
商品是否为套装：1-是；0-否。全托管必填。

supplier_code
string
是
是
卖家SPU维度的货号。由卖家自定义。最多200个字符。

is_spu_pic
boolean
否
否
是否选择新版图片上传方案。 新版图片上传方案的详细信息，详细参考文档。

image_info >
object[]
否
否
SPU维度商品图片。 上传图片的要求，详细参考
文档
。

 image_group_code
string
否
是
图片组编码。由平台生成的编码。 创建商品场景不用传，商品发布成功以后的场景必传。

 image_info_list >
object[]
否
是
图片列表

 image_item_id
int64
否
是
图片唯一id。由平台生成。 创建商品场景不用传，商品发布成功以后的场景必传。

 image_sort
integer
是
是
图片排序序号。

 image_type
integer
是
是
图片类型：1-主图,2-细节图,5-方块图,6-色块图

 image_url
string
否
否
图片链接。链接必须转换成SHEIN链接。 可使用接口
【图片链接转换】
或
【本图片上传】
转换为SHEIN链接。

multi_language_desc_list >
object[]
是
是
商品描述的多语言列表。 商品的默认语种以及对应的描述，必传。

 language
string
是
是
语种缩写。缩写：

 name
string
是
是
描述文本，最大5000字符

multi_language_name_list >
object[]
是
是
商品名称的多语言列表。 商品的默认语种以及名称，必传。默认语种可通过
【商品发布字段规范（含默认语种）】
获取。

 language
string
是
是
语种缩写。使用SHEIN内部缩写

## 解决方案 / 全托管解决方案 / 商品编辑-全托管

- Page ID：`cb90cf21-d604-4f35-a12d-ef7706dd2ac4`
- 路径：`https://open.sheincorp.com/documents/system/cb90cf21-d604-4f35-a12d-ef7706dd2ac4`

# 
商品编辑-全托管

## 

# 
1 确认商品能否编辑

商品必须满足以下两个条件才可编辑：

1、商品SPU已发布且通过平台审核

      确认方式：若SPU能在
/open-api/goods/spu-info
中查询到结果，说明已通过审核。

      若SPU的首次发布没有审核通过，请基于新发布商品的调用逻辑，调整信息后重新发布。

2、商品当前没有其他进行中的审核流程

     确认方式：使用spuName查询接口
/open-api/goods/query-document-state
。当响应的skcList中，没有skc的
documentState=1/5，代表商品没有进行中的审核流程。参考的返回示例如下。

{
    "code": "0",
    "msg": "OK",
    "info": {
        "data": [
            {
                "spuName": "c250722589993",
                "version": "SPMP250724229942289",
                "skcList": [
                    {
                        "skcName": "sc25072258999337915",
                        "documentSn": "SPMPM1020250724001140",
                        "documentState": 2, //不可等于1或5
                        "failedReason": null
                    },
                    {
                        "skcName": "sc25072258999308304",
                        "documentSn": "SPMPM1020250724001141",
                        "documentState": 2,//不可等于1或5
                        "failedReason": null
                    }
                ]
            }
        ],
        "meta": {
            "count": 1,
            "customObj": null
        }
    },
    "bbl": null,
    "traceId": "5e0819423f8012b7"
}

# 
2 可编辑/不可编辑内容

编辑商品涉及到多个接口，每个接口都有各自可编辑、不可编辑的范围见下表，每个接口的使用方式详见文档下方

接口信息
可编辑内容
不可编辑内容

商品发布&编辑

/open-api/goods/product/publishOrEdit
1、编辑已发布的SPU/SKC/SKU的以下信息：

商品标题、描述、品牌、包装重量

商品分类、商品属性、尺码属性

所有类型的商品图片

所有类型的商品货号

2、在已发布的SPU下新增SKC或KU
不可编辑已发布SPU/SKC/SKU的以下信息

商品供货价；

商品主销售属性、次销售属性；

商品库存；

更新商品供货价

/open-api/goods/update-cost
商品在所有站点的供货价
仅支持左侧内容

更新商品库存

/open-api/goods/stock-update
商品在仓库中的库存值
仅支持左侧内容

## 

# 
3 商品发布&编辑接口

- 
接口地址：
/open-api/goods/product/publishOrEdit

- 
商品发布和编辑共用一个接口，因此这个接口在编辑商品可做到2个场景：
编辑已发布的SPU/SKC/SKU信息、在SPU下发布新的SKC/SKU

## 
3.1 编辑已发布的SPU/SKU/SKC信息

接口信息
可编辑内容
不可编辑内容

商品发布&编辑

/open-api/goods/product/publishOrEdit
1、编辑已发布的SPU/SKC/SKU的以下信息：

商品标题、描述、品牌、包装重量

商品分类、商品属性、尺码属性

所有类型的商品图片

所有类型的商品货号

2、在已发布的SPU下新增SKC或KU
不可编辑已发布SPU/SKC/SKU的以下信息

商品供货价；

商品主销售属性、次销售属性；

商品库存；

核心规则

- 
编辑场景中，入参中都必须有SPU（spu_name）、至少一个SKC（skc_list）、至少一个SKU（sku_list）

- 
编辑时，必须入参平台生成的对象唯一编码，例如spu_name、skc_name、sku_code、image_group_code等

- 
编辑时，并非所有商品信息都可编辑，拆分为可编辑字段、不可编辑字段进行说明

- 
可编辑字段：
编辑时入参的字段，全部按覆盖逻辑处理
。即若不给字段A则代表商品不需要字段A，字段A的值按清空处理；若给字段"filedA":"value1"，则代表fieldA会更新为value1。

- 
不可编辑字段：
编辑时不可在字段中给出入参，给了就会报错编辑失败
（大部分按这个逻辑走，个别字段除外，例如销售属性）

- 
下面是编辑场景下接口入参的使用说明（因篇幅问题，仅对需要关注的字段、对象进行说明）

字段名
字段名
字段名
​编辑时是否必填
是否可被编辑
​数据来源
编辑说明

brand_code
部分情况必填
可编辑
/open-api/goods/spu-info:brandCode
不传字段时，按清空处理。

若原本有品牌，或要更新品牌，则需要填写

category_id
必填
可编辑
/open-api/goods/spu-info:categoryId
一定条件下可编辑。

当新分类下的主&次销售属性包含了已发布SKC、SKU的销售属性时，可编辑

product_type_id
必填
可编辑
/open-api/goods/spu-info:productTypeId

注意：此处一定要查询SPU中返回信息为准，平台有修改category_id和product_type_id间关联关系的情况。如果使用查询店铺分类树中获取的关系入参，会出现报错。
当分类被编辑时，此字段也需要更新为新分类对应的product type id

spu_name
必填
不可编辑
/open-api/goods/spu-info:spuName
提供平台生成值，可通过接口获取：/open-api/openapi-business-backend/product/query

supplier_code
必填
可编辑
/open-api/goods/spu-info:supplierCode
需注意此code全店唯一，不可重复

suit_flag
必填
不可编辑
无来源但API不支持套装，因此需给0
商品接口暂不支持套装信息，因此必须给0

is_spu_pic
部分情况必填
可编辑
/open-api/goods/spu-info

需基于已发布图片的组合情况判断
不传字段时，默认按false处理。

若原本此字段需要更新为true，则字段必填。

image_info
部分情况必填
可编辑
/open-api/goods/spu-info:spuImageInfoList
不传字段时，按清空图片处理。

若原本有提供SPU图片，或需要更新SPU图片时，必须给出完整的list数据；编辑时必须image_group_code，可以不提供image_item_id。

multi_language_desc_list
部分情况必填
可编辑
/open-api/goods/spu-info:productMultiDescList
不传字段时，按清空处理。

若原本有提供描述，或要更新描述，必须给出所有语种的描述。

multi_language_name_list
部分情况必填
可编辑
/open-api/goods/spu-info:productMultiNameList
不传字段时，保留原值。

若需要修改商品标题，则需要给出所有语种的名称，并且编辑时需带上所有已发布的SKC信息，SKC带数方式见下方2

product_attribute_list
部分情况必填
可编辑
/open-api/goods/spu-info:productAttributeInfoList

注意：productAttributeInfoList包含商品属性、销售属性。需ERP自行剔除其中的销售属性。销售属性可通过此接口的saleAttributeList的销售属性获取，剔除后就只剩商品属性
不传字段时，按清空处理.

若原本有提供属性或要更新属性，需要给出完整属性列表。注意如果更换了分类，则需要给新分类下的商品属性。

size_attribute_list
部分情况必填
可编辑
/open-api/goods/spu-info:dimensionAttributeInfoList
不传字段时，按清空处理.

若原本有提供属性或要更新属性，需要给出完整属性列表。注意如果更换了分类，则需要给新分类下的属性。

sale_attribute_sort_list
部分情况必填
可编辑
无
不传字段时，按清空处理.

若原本有提供排序，需要给出完整列表。注意如果更换了分类，则需要给新分类下的属性。

skc_list
必填
部分可编辑
/open-api/goods/spu-info:skcInfoList
即使只是编辑SPU的信息，也需要在入参里体现至少一个已发布的SKC或新的SKC

image_info
部分情况必填
可编辑
/open-api/goods/spu-info:skcImageInfoList
不传字段时，按清空图片处理。

若原本有提供SKC图片，或需要更新SKC图片时，必须给出完整的list数据；编辑时必须image_group_code，可以不提供image_item_id。

sale_attribute
必填
不可编辑
/open-api/goods/spu-info:skcInfoList - attributeId skcInfoList - attributeValueId
已发布的SKC不可修改属性

skc_name
必填
不可编辑
/open-api/goods/spu-info:skcName
可通过接口获取：/open-api/openapi-business-backend/product/query

supplier_code
必填
可编辑
/open-api/goods/spu-info:skcInfoList -supplierCode
需注意此code全店唯一，不可重复

site_detail_image_info_list
部分情况必填
可编辑
/open-api/goods/spu-info:siteDetailImageInfoList
不传字段时，按清空图片处理。

若原本有提供图片，或需要更新图片时，必须给出完整的list数据；编辑时必须image_group_code，可以不提供image_item_id。

​shelf_require
不可填
不可编辑
无数据来源
不可编辑，不可传值即使传值也不会生效

shelf_way
必填
不可编辑
无数据来源
不可编辑，但必须填值

hope_on_sale_date
部分情况必填
不可编辑
无数据来源
不可编辑，但当shelf_way=2时，必传

sku_list
必填
部分可编辑
/open-api/goods/spu-info:skuInfoList
即使不更新SKU信息，也需要在入参里体现至少一个已发布的SKU或新的SKU

height
必填
可编辑
/open-api/goods/spu-info:height
更新为编辑时提供的值

length
必填
可编辑
/open-api/goods/spu-info:length
更新为编辑时提供的值

width
必填
可编辑
/open-api/goods/spu-info:width
更新为编辑时提供的值

weight
必填
可编辑
/open-api/goods/spu-info:weight
更新为编辑时提供的值

mall_state
必填
可编辑
/open-api/goods/spu-info:mallState
更新为编辑时提供的值

stop_purchase
必填
可编辑
/open-api/goods/spu-info:stopPurchase
更新为编辑时提供的值

sku_code
必填
不可编辑
/open-api/goods/spu-info:skcName
提供平台生成值，可通过接口获取：/open-api/openapi-business-backend/product/query

image_info
部分情况必填
可编辑
/open-api/goods/spu-info:skuImageInfoList
不传字段时，按清空处理。

若原本有提供或需要更新时，需给出完整的list数据；编辑时必须image_group_code，可以不提供image_item_id。

supplier_sku
必填
可编辑
/open-api/goods/spu-info:skuInfoList-supplierSku
更新为编辑时提供的值。需注意此code全店唯一，不可重复

competing_product_link
部分情况必填
可编辑
暂无来源
不传字段时，按清空处理。

若原本有提供或需要更新时，需给值。

cost_info
不可填
不可编辑
/open-api/goods/spu-info:costInfoList
编辑时不可提供此字段，会报错编辑失败。

更新供货价通过/open-api/goods/update-cost

sale_attribute_list
必填
不可编辑
/open-api/goods/spu-info:skuInfoList - saleAttributeList
已发布的SKU不可修改属性

stock_info_list
不可填
不可编辑
/open-api/stock/stock-query
编辑时不可提供此字段，会报错编辑失败。

更新库存通过/open-api/goods/stock-update

minimum_stock_quantity
部分情况必填
可编辑
暂无来源
不传字段时，按清空处理。

若原本有提供或需要更新时，需给值。

## 
3.2 新增SPU下的SKC/SKU

核心规则

- 
在SPU下发布新的SKC/SKU时，
新的skc_list或sku_list按照商品发布规则填写即可。

- 
发布新SKC/SKU时，入参中可以带上已发布的SKC（更新信息），也可以不带（入参里仅体现新发布信息）

## 
3.3 各场景请求示例

### 

### 
编辑已发布的SPU/SKC/SKU

{
  "spu_name": "s250805261495",
  "category_id": 1727,
  "product_type_id": 1080,
  "suit_flag": "0",
  "supplier_code": "4545",
  "is_spu_pic": "false",
  "multi_language_name_list": [
    {
      "language": "en",
      "name": "Bennie For Edit Product SKC fully en"
    },
    {
      "language": "zh-cn",
      "name": "Bennie For Edit Product SKC fully zhcn"
    }
  ],
  "multi_language_desc_list": [
    {
      "language": "en",
      "name": "Bennie For Edit Product SKC fully en"
    }
  ],
  "product_attribute_list": [
    {
      "attribute_id": 169,
      "attribute_value_id": 1000045
    }
  ],
  "skc_list": [
      {
      "skc_name": "ss25080526149593844",
      "sale_attribute": {
        "attribute_id": 1000248,
        "attribute_value_id": 1001484
      },
      "supplier_code": "4545",
      "shelf_require":0,
      "shelf_way":1,
      "image_info": {
        "image_group_code": "G3vpir6i984f",
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "sku_list": [
        {
          "sku_code": "I0synkixnved",          
          "supplier_sku": "434",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "sale_attribute_list": [
            {
              "attribute_id": 1001184,
              "attribute_value_id": 19268998
            }
          ]
          }
      ]
    }
  ]
}
    

### 
SPU下新增SKC/SKU，同时编辑已发布SKC

{
  "spu_name": "s250805261495",
  "category_id": 1727,
  "product_type_id": 1080,
  "suit_flag": "0",
  "supplier_code": "4545",
  "is_spu_pic": "false",
  "multi_language_name_list": [
    {
      "language": "en",
      "name": "Bennie For Edit Product SKC fully en"
    },
    {
      "language": "zh-cn",
      "name": "Bennie For Edit Product SKC fully zhcn"
    }
  ],
  "multi_language_desc_list": [
    {
      "language": "en",
      "name": "Bennie For Edit Product SKC fully en"
    }
  ],
  "product_attribute_list": [
    {
      "attribute_id": 169,
      "attribute_value_id": 1000045
    }
  ],
  "skc_list": [
      {
      "skc_name": "ss25080526149593844",
      "sale_attribute": {
        "attribute_id": 1000248,
        "attribute_value_id": 1001484
      },
      "supplier_code": "4545",
      "shelf_way": 1,
      "image_info": {
        "image_group_code": "G4s4k5w68s54",
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "sku_list": [
        {
          "sku_code": "I0synkixnved",          
          "supplier_sku": "43454",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
          "stop_purchase":1,
          "sale_attribute_list": [
            {
              "attribute_id": 1001184,
              "attribute_value_id":19268998
            }
          ]
          }
      ]
    },
      {                           //这是新增的SKC
      "sale_attribute": {
        "attribute_id": 1000248,
        "attribute_value_id": 1014817
      },
      "supplier_code": "4545454545",
      "shelf_require":0,
      "shelf_way": 2,
      "hope_on_sale_date": "2025-08-25 00:00:00",
      "image_info": {
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "sku_list": [
        {
          "supplier_sku": "4375675998",
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1",
          "mall_state": 1,
           "stop_purchase":1,
          "sale_attribute_list": [
            {
              "attribute_id": 1001184,
              "attribute_value_id": 14311595
            }
          ],
          "cost_info": {
            "cost_price": 2,
            "currency": "CNY"
          },
          "stock_info_list": [
            {
              "inventory_num": 100,
              "supplier_warehouse_id": "PS7448683004"
            }
          ]
        }
      ]
    }
  ]
}
        
          
          
         

# 
4 更新商品供货价

- 
接口地址：/open-api/goods/update-cost

- 
此接口支持场景：更新商品在所有站点中的供货价（全托管商品不感知站点，提供统一的供货价）

{
    "spu_name": "xS25121523423",
    "skc_info_list": [
        {
            "skc_name": "sf24112312321581",
            "sku_info_list": [
                {
                    "cost": "10.55",
                    "currency": "EUR",
                    "sku_code": "I1231281em4e"
                },
                {
                    "cost": "10.55",
                    "currency": "EUR",
                    "sku_code": "I12312311ew4e"
                },
                {
                    "cost": "10.55",
                    "currency": "EUR",
                    "sku_code": "I122211281ef4e"
                }
            ]
        }
    ]
}

## 

## 

# 
5 更新商品库存

- 
接口地址：/open-api/goods/stock-update

- 
支持修改商品在仓库内的库存值

{"stock": [
  {
		"stock_type": 3,
		"skc": "sx2410224003123100",
		"shein_sku": "I83ty0f2d502",
		"available_number": 18
	}
  ]
}

## 解决方案 / 全托管解决方案 / 商品属性

- Page ID：`424039e8-4657-454a-a4cb-781938a42622`
- 路径：`https://open.sheincorp.com/documents/system/424039e8-4657-454a-a4cb-781938a42622`
- 简介：本文旨在帮助开发者们了解和熟悉在创建商品时需要必填的属性如何设置，以及平台的相关要求。

# 
商品属性

# 

# 
1 方案概述

- 
本文档适用于【应用类型=自运营/半托管/全托管/POP】的应用。

- 
商品属性会在商品发布/编辑场景中使用（即接口：/open-api/goods/product/publishOrEdit）。本文档会介绍商品属性的基础定义、获取方式、使用方式。

# 
2 商品属性结构

属性类型
​属性定义
是否必填
属性数量
商家后台的配置界面
​C端看到的属性界面

商品属性
描述商品特性，帮助消费者在购买时了解商品详细情况。例如材质、成分、风格、税务
需通过接口确认
支持0~多个

尺寸属性
商品规格维度的尺码信息，如服装、鞋类等，提供有关不同尺码的详细信息，确保消费者能够找到合适的尺码
需通过接口确认
支持0~多个

主销售属性（主规格）
​消费者在选购时选择的属性，一般为颜色
必填
有且只有1个

次销售属性（其他规格）
消费者在选购时选择的属性，例如尺寸和款式等
需通过接口确认
支持0~2个属性

# 

# 
3 商品属性使用方式

### 
3.1 获取可用的属性

- 
通过接口查询某个商品分类下可用的属性，以及属性下的属性值。接口地址：
/open-api/goods/query-attribute-template

- 
属性信息中包含2部分属性自身信息属性下可用的属性值列表：attribute_value_info_list

- 
以下是属性信息的代码示例，以及重要字段的说明

"attribute_infos": [
          {
            "attribute_id": 31,
            "attribute_name": "细节",
            "attribute_name_en": "Details",
            "attribute_remark_list": [1],
            "attribute_is_show": 1,
            "attribute_label": 0,
            "attribute_mode": 1,
            "attribute_input_num": 10,
            "attribute_status": 2,
            "attribute_type": 4,
            "attribute_value_info_list": [
              {
                "attribute_value_id": 501,
                "attribute_value": "珍珠",
                "attribute_value_en": "Pearls",
                "is_custom_attribute_value": false,
                "is_show": 1,
                "attribute_value_group_list": null
              }
             ],
            "site_title": null,
            "site_url": null,
            "skc_scope": null
         ]
字段归属
字段名
字段定义

属性
attribute_id
属性id

attribute_name
属性名称

attribute_is_show
属性是否会在买家商详页内显示。1-展示；2-不展示

attribute_type
属性种类。1-销售属性（覆盖主销售、次销售属性）；2-尺寸属性；3-成分属性；4-普通属性

attribute_label
是否为主销售属性。1-是；0-否

attribute_mode
属性值的录入方式。0: 手工填写参数；1:下拉多选;2:下拉单选(只针对销售属性);3:下拉单选；4:下拉列表+手工填写参数

attribute_input_num
多选属性的属性值数量上限（attribute_mode=1）。0代表无限制

attribute_status
判断属性是否必填 。1:属性不填（即属性不能被使用）; 2:属性选填; 3:属性必填

attribute_remark_list
属性的业务场景，对使用逻辑没有影响。1:重要,2:合规,3:质量,4:关务

属性值
attribute_value
属性值名称

attribute_value_id
属性值ID

is_show
属性值是否会在买家商详页内显示

is_custom_attribute_value
判断是否为商家自己添加的自定义属性值，true代表是，false代表否

### 
3.2 确认属性在商品发布接口的入参字段

商品发布接口中的属性字段
什么样的属性信息在此字段中入参

product_attribute_list：商品属性
attribute_type=3/4

​size_attribute_list：尺寸属性
attribute_type=2

​skc_list → sale_attribute：主销售属性
attribute_type=1 且 attribute_label=1

sku_list → sale_attribute_list​：次销售属性
attribute_type=1 且 attribute_label=1/0（主销售属性也可以入参到次销售属性中）

### 
3.3 确认属性是否必填

属性必填有3种情况

- 
商品的主销售属性必填：每个商品有且必须要有1个主销售属性，所以skc_list → sale_attribute中必须入参属性

- 
某个属性自身必填：基于政策或品类的要求，部分属性会要求商家必填。可通过attribute_status=3（属性必填）来判断，如果必填属性没有在入参中体现，商品发布会报错

- 
属性间关联必填基于合规的要求，当商品中填写了A属性，则B属性也要求必填（B属性原本可能是非必填）关联必填的规则，目前没有接口对外透出。在发布商品时，会通过报错体现，请引导商家按照报错提示调整。报错规范如下

### 
3.4 确认属性值的输入方式

属性值的输入方式主要依赖
attribute_mode字段，
但也有一些特殊情况，详见下方表格

判断方式
属性值的入参方式
​商家后台的操作界面

​attribute_mode=0（手工输入值）
由商家自定义属性值，仅支持录入正整数，尺码属性中常见。

在商品发布接口中，不需要入参attribute_value_id，将属性值入参至attribute_extra_value

"size_attribute_list": [

    {

      "attribute_id": 85,

      "attribute_extra_value": "100",

      "relate_sale_attribute_id": 87,

      "relate_sale_attribute_value_id": 1006040

    }

  ]

​​attribute_mode=1（下拉多选）
​下拉多选。商品属性中常见。

如果商家在属性A下选择多个属性值，在商品发布接口中，需要传多组attribute_id、attribute_value_id的数据。不可以在attribute_value_id中传数组。多选的上限值，通过attribute_input_num判断。

"product_attribute_list": [{

      "attribute_id": 31,

      "attribute_value_id": 501

    },

    {

      "attribute_id": 31,

      "attribute_value_id": 565

    }]

​​​attribute_mode=2（下拉单选，销售属性专用）
下拉单选。只有销售属性才会出现此输入类型。

​​​​attribute_mode=3（下拉单选）
下拉单选。商品属性中常见。

在商品发布接口中，某个attribute_id只能有一组数据

​attribute_mode=4（下拉多选+手工输入）
下拉多选+手工输入。商品属性中常见。

即在商品发布接口中，可传多组attribute_id、attribute_value_id、attribute_extra_value。

常见于数量+单位，例如属性值为单位（双/件），输入数值后，就组成N双。

​​​​​attribute_mode=4 （下拉多选+手工输入）且 attribute_type=3（成分属性）
这类成分属性比较特殊。常见于服装材质成分、日用品涂层成分等。

属性A下可以选属性值a,b,c，每个属性值需要手动输入正整数，
A下的a,b,c三者输入值需相加等于100
。业务上定义就是三者加起来是100%。

"product_attribute_list": [

    {

      "attribute_id": 1000105,

      "attribute_value_id": 63,

      "attribute_extra_value": "50"

    },

    {

      "attribute_id": 1000105,

      "attribute_value_id": 1000145,

      "attribute_extra_value": "50"

    }

  ]

### 
3.5 如何添加自定义属性值

如果平台提供的属性值无法满足需求，可尝试添加自定义属性值，具体流程如下：

- 
先确认属性是否可以添加自定义属性值：
/open-api/goods/get-custom-attribute-permission-config
。若属性的has_permission=1，则可以自定义属性值

- 
通过接口添加属性值：
/open-api/goods/add-custom-attribute-value
。记录下创建成功的attribute_value_id

- 
在商品发布接口中，使用创建好的attribute_value_id

### 
3.6 特别说明：尺码属性

场景
入参示例
商家后台操作界面

商品只有主销售属性时，尺码属性不用关联次销售属性
"size_attribute_list": [

    {

      "attribute_id": 85,

      "attribute_extra_value": "100"

    }

商品有次销售属性时，尺码属性需要关联次销售属性。尺码属性作为横轴，次销售属性作为纵轴，填写组合值。例如：尺码属性宽度，次销售属性尺寸=S/M/L，则会填写S的宽度、M的宽体、L的宽度
"size_attribute_list": [

    {

      "attribute_id": 85,

      "attribute_extra_value": "100",

      "relate_sale_attribute_id": 87,

      "relate_sale_attribute_value_id": 1006040

    }

## 解决方案 / 全托管解决方案 / 商品自定义属性值

- Page ID：`a0f9bf6a-bc89-4a6d-a25f-385cca93f866`
- 路径：`https://open.sheincorp.com/documents/system/a0f9bf6a-bc89-4a6d-a25f-385cca93f866`

# 
销售属性的自定义属性值新方案

# 
适用范围

- 
适用的应用类型：自运营、半托管、全托管、POP

- 
上述类型的应用均可使用新方案

- 
2025年12月1日后创建的应用，必须使用新方案

- 
2025年12月1日前创建的旧应用，可按需对接新方案

# 
新旧方案对比

对比项
旧方案
新方案

数据结构
销售属性的自定义属性值和分类绑定。

自定义属性值【例如：小码】如果想在多个分类下使用，则需在每个分类下创建attribute value id，然后一一对应放在对应分类下使用。

销售属性的自定义属性值和分类解绑，和商家绑定

自定义属性值【例如小码】创建一次后，可以在多个分类下使用。

接口调用流程
场景1：创建新的自定义属性值

查询商家的分类A下有哪些销售属性支持自定义属性值

→ 若支持，则在分类A下，为可自定义的属性创建自定义属性值，获取attribute_value_id

→ 发布/编辑分类A的商品时，在销售属性中下入参attribute_value_id

场景2：使用已创建的自定义属性值

查询店内全量可用属性值

→ 找到is_custom_attribute_value=true的attribute_value_id

→ 发布/编辑商品时，销售属性中入参获取的attribute_value_id
场景1：创建新的自定义属性值

查询商家的分类A下有哪些销售属性支持自定义属性值

→ 若支持，则发布/编辑分类A的商品时，可自定义的销售属性中入参自定义属性值的custom_attribute_value即可，不需要attribute_value_id

场景2：使用已创建的自定义属性值

和场景1相同的操作流程。

系统会对所有自定义属性值去重，即内容一致代表是同一个自定义属性值；且自定义属性值和分类不再关联。只要分类可自定义属性值，就可用店内所有自定义属性值。

商家自定义属性值数量上限
1万
3万

优劣
劣势：商家可用自定义属性值数量少；查询可用属性接口速度慢
优势：商家可用自定义属性值数量增加；查询可用属性接口速度加快

# 

# 
新方案对接方式

### 
1 对接流程

2025年12月1日前创建的应用，在新方案对接完成后，需要联系开放平台，告知上线的应用ID和上线时间。开放平台需要将您的应用进行配置，以确保使用应用的商家全部切换至新方案中。

### 
2 接入说明

#### 
第1步：查询销售属性是否支持自定义属性值
【重要】

- 
平台对于自定义属性值的功能管控颗粒度是【商家+分类+属性】，必须按此逻辑确认属性是否支持自定义属性值。

- 
例如商家1和商家2，均可使用分类A，；分类A下有两个销售属性，S1和S2。在平台的管控下可能出现以下情况

- 
商家1的分类A下的销售属性S1可自定义属性值，S2不可以

- 
商家2的分类A下，S1和S2都不可以自定义属性值

- 
请通过此接口来确认属性是否可自定义：
/open-api/goods/get-custom-attribute-permission-config

- 
"has_permission": 1，代表支持自定义属性值

Example

curl --location --request POST 'https://openapi-test01.sheincorp.cn/open-api/goods/get-custom-attribute-permission-config' \
--header 'x-lt-signature: test0ZWYwZGY5N2VjM2M1ZmNkOGI1NDU0M2VjMTM3NWNiNDk0ZjhmY2E3NThkM2NkMzdkM2VjYzEyNGY5Y2QzN2NhNQ==' \
--header 'x-lt-openKeyId: EED6AEEA6B4741EF94D29FED5A1CE76F' \
--header 'x-lt-timestamp: 1753841948096' \
--header 'language: en' \
--header 'User-Agent: Apifox/1.0.0 (https://apifox.com)' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--header 'Host: openapi-test01.sheincorp.cn' \
--header 'Connection: keep-alive' \
--data-raw '{
  "category_id_list": [
    20039881
  ]
}'

----------------------------------------------------------------------------

响应
{
    "code": "0",
    "msg": "OK",
    "info": {
        "data": [
            {
                "has_permission": 1,
                "last_category_id": 20039881,
                "attribute_id": 2147484187
            },
            {
                "has_permission": 1,
                "last_category_id": 20039881,
                "attribute_id": 2147484186
            }
        ],
        "meta": {
            "count": 2,
            "customObj": null
        }
    },
    "bbl": null,
    "traceId": "84de1e85727ee683"
}

#### 
第2步：发布/编辑商品时通过custom_attribute_value字段创建自定义属性值

- 
发布/编辑商品接口：/open-api/goods/product/publishOrEdit

- 
只有支持自定义属性值的销售属性，可以通过发布接口中custom_attribute_value字段创建自定义属性值。发布接口中涉及自定义属性值的入参字段
（红色加粗）
见下表，表格下方有请求、响应示例

​字段名
字段名
字段名
字段名
​字段类型
是否必填
字段描述

skc_list
object[]
是
skc列表

sale_attribute
是
skc销售属性

attribute_id
int64
是
销售属性ID

attribute_value_id
int64
否
销售属性值ID（平台提供值/通过添加自定义属性接口获取的值）

custom_attribute_value
string
否
商家的自定义销售属性值。

仅在销售属性ID支持自定义属性值时，才可在此字段内入参。

属性值要求：字符数50以内；支持半角符号，不可输入全角符号；不支持unicode，检验表达式可参考：String emojiPattern = "[\\uD83C-\\uDBFF\\uDC00-\\uDFFF\\u2600-\\u27ff]"

​language
string
否
自定义属性值的语种。

支持的语种：en、zh-cn、fr、es、it。如果ERP不传多语言内容，平台会做系统翻译。

sku_list
​
object[]
是
sku列表

​sale_attribute_list
object[]
是
销售属性列表

​
attribute_id
int64
是
销售属性ID

attribute_value_id
int64
否
销售属性值ID（平台提供值/通过添加自定义属性接口获取的值）

custom_attribute_value
string
否
商家的自定义销售属性值。

仅在销售属性ID支持自定义属性值时，才可在此字段内入参。

属性值要求：字符数50以内；支持半角符号，不可输入全角符号；不支持unicode，检验表达式可参考：String emojiPattern = "[\\uD83C-\\uDBFF\\uDC00-\\uDFFF\\u2600-\\u27ff]"

language
string
否
自定义属性值的语种。

支持的语种：en、zh-cn、fr、es、it。如果ERP不传多语言内容，平台会做系统翻译。

size_attribute_list
object[]
否
尺码属性列表

attribute_id
int64
是
属性ID

attribute_extra_value
string
否
属性值。尺码属性均为手动输入，在此入参。支持正数，最多2位小数

relate_sale_attribute_id
int64
否
关联的次销售属性ID（只可入参sku维度销售属性）

relate_sale_attribute_value
string
否
关联的次销售属性属性值。

自定义属性值的场景需要在此入参，入参内容必须和销售属性中填写的属性值一模一样。

relate_sale_attribute_value_id
int64
否
关联的次销售属性属性值。非自定义属性值场景在此入参

sale_attribute_sort_list
object[]
否
销售属性自定义排序

attribute_id
int64
是
属性名ID

in_order_attribute_value_id_list
int64[]
否
排好序的属性值ID列表。如果属性下无自定义属性值，可用这个字段。

in_order_attribute_value_list
object[]
否
排好序的属性值ID/自定义属性值备注列表。

如果属性下有自定义属性值，需用这个字段，属性值用哪个形式就入参下面的哪个字段，按排序输入即可。

attribute_value_id
int64
否
属性值ID

custom_attribute_value
string
否
自定义属性值的内容。入参内容必须和销售属性中填写的属性值一模一样
。

 {
  "category_id": 20039919,
  "product_type_id": 2147503231,
  "multi_language_name_list": [
    {
      "language": "en",
      "name": "name"
    }
  ],
  "supplier_code": "34543345655",
  "site_list": [
    {
      "main_site": "shein",
      "sub_site_list": [
        "shein-us"
      ]
    }
  ],
  "is_spu_pic": "false",
  "suit_flag": "0",
  "size_attribute_list":[
    {
      "attribute_id":" 7",
      "attribute_extra_value":11,
      "relate_sale_attribute_id":"2147484186",
      "relate_sale_attribute_value":"custom attribute value for SKU 0911"
    }
  ],
  "sale_attribute_sort_list":[
        {
          "attribute_id":"2147484187",
          "in_order_attribute_value_list":[
            {
              "custom_attribute_value":"custom attribute value for SKC 0911"
            },
            {
              "attribute_value_id":2147488295
            }
          ]
        },
                {
          "attribute_id":"2147484186",
          "in_order_attribute_value_list":[
            {
              "custom_attribute_value":"custom attribute value for SKU 0911"
            },
              {
              "attribute_value_id":2147488283
            }
          ]
        }
      ],
  "sample_info":{
    "sample_spec":{
        "main_spec":{
            "attribute_id":"2147484187",
            "attribute_value_name":"custom attribute value for SKC 0911"
        },
        "sub_spec_list":[
            {
                 "attribute_id": "2147484186",
                 "attribute_value_id":"2147488295"
            },
            {
                "attribute_id":"2147484186",
                "attribute_value_name":"custom attribute value for SKU 0911"
            }
        ]
    },
     "sample_judge_type":2,
     "reserve_sample_flag":2,
     "spot_flag":2
  },
  "skc_list": [
    {
      "sale_attribute": {
        "attribute_id": 2147484187,
        "custom_attribute_value":"custom attribute value for SKC 0911",
        "language":"en"
      },
      "image_info": {
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "site_detail_image_info_list": [
        {
          "image_info_list": [
            {
              "image_sort": 1,
              "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
            }
          ],
          "site_abbr_list": [
            "shein-us"
          ]
        }
      ],
      "proof_of_stock_list": [
        {
          "file_name": "fd",
          "type": "1",
          "url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
        }
      ],
      "sku_list": [
        {
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "custom_attribute_value":"custom attribute value for SKU 0911",
              "language":"en"
            }
          ],
          "price_info_list": [
            {
              "base_price": 334,
              "currency": "USD",
              "special_price": 35,
              "sub_site": "shein-us"
            }
          ],
          "stock_info_list": [
            {
              "inventory_num": 1
            }
          ],
          "supplier_sku": "36636565623",
          "mall_state": 1,
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1"
        }
      ],
      "supplier_code": "4564880035",
      "suggested_retail_price": {
        "currency": "USD",
        "price": 34
      }
    },
    {
      "sale_attribute": {
        "attribute_id": 2147484187,
        "attribute_value_id":"2147488295"
      },
      "image_info": {
        "image_info_list": [
          {
            "image_sort": 1,
            "image_type": 1,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 2,
            "image_type": 2,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 3,
            "image_type": 5,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          },
          {
            "image_sort": 4,
            "image_type": 6,
            "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
          }
        ]
      },
      "site_detail_image_info_list": [
        {
          "image_info_list": [
            {
              "image_sort": 1,
              "image_url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
            }
          ],
          "site_abbr_list": [
            "shein-us"
          ]
        }
      ],
      "proof_of_stock_list": [
        {
          "file_name": "fd",
          "type": "1",
          "url": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
        }
      ],
      "sku_list": [
        {
          "sale_attribute_list": [
            {
              "attribute_id": 2147484186,
              "attribute_value_id":"2147488283"
            }
          ],
          "price_info_list": [
            {
              "base_price": 334,
              "currency": "USD",
              "special_price": 35,
              "sub_site": "shein-us"
            }
          ],
          "stock_info_list": [
            {
              "inventory_num": 1
            }
          ],
          "supplier_sku": "365650023",
          "mall_state": 1,
          "height": "1",
          "length": "1",
          "weight": "1",
          "width": "1"
        }
      ],
      "supplier_code": "45667800835",
      "suggested_retail_price": {
        "currency": "USD",
        "price": 34
      }
    }
  ]
}

#### 
第3步：查询商品详情

- 
查询接口：/open-api/goods/spu-info

- 
商品的自定义销售属性值在此接口中，会给出属性值的内容以及value id。涉及字段包括：skcInfoList - attributeId、attributeMultiList、attributeValueId、attributeValueMultiListskuInfoList - saleAttributeListdimensionAttributeAdditionList -relateSaleAttributeValueId

{
    "code": "0",
    "msg": "OK",
    "info": {
        "spuName": "c250905438333",
        "categoryId": 20039919,
        "productTypeId": 2147503231,
        "brandCode": "",
        "supplierCode": "4545880035",
        "productMultiNameList": [
            {
                "productName": "Bennie For Custom Attribute 0905",
                "language": "en"
            }
        ],
        "productMultiDescList": [
            {
                "productDesc": "",
                "language": "en"
            }
        ],
        "productAttributeInfoList": [
            {
                "attributeId": 2147484186,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Size",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147488283,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "30*20",
                        "language": "en"
                    }
                ],
                "attributeValue": null
            },
            {
                "attributeId": 2147484187,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Color",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147488294,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "Mustard",
                        "language": "en"
                    }
                ],
                "attributeValue": null
            },
            {
                "attributeId": 2147484186,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Size",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147489739,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "custom attribute value for SKU",
                        "language": "en"
                    }
                ],
                "attributeValue": null
            }
        ],
        "dimensionAttributeInfoList": [
            {
                "attributeId": 7,
                "attributeMultiList": [
                    {
                        "attributeName": "Bag Width66 (1cm)",
                        "language": "en"
                    }
                ],
                "dimensionAttributeAdditionList": [
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147488283,
                        "additionValue": "1"
                    },
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147489739,
                        "additionValue": "2"
                    }
                ]
            },
            {
                "attributeId": 15,
                "attributeMultiList": [
                    {
                        "attributeName": "Bottoms Length (cm)",
                        "language": "en"
                    }
                ],
                "dimensionAttributeAdditionList": [
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147488283,
                        "additionValue": "1"
                    },
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147489739,
                        "additionValue": "2"
                    }
                ]
            },
            {
                "attributeId": 29,
                "attributeMultiList": [
                    {
                        "attributeName": "Cuff (cm)",
                        "language": "en"
                    }
                ],
                "dimensionAttributeAdditionList": [
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147488283,
                        "additionValue": "1"
                    },
                    {
                        "relateSaleAttributeId": 2147484186,
                        "relateSaleAttributeValueId": 2147489739,
                        "additionValue": "2"
                    }
                ]
            }
        ],
        "spuImageInfoList": null,
        "skcInfoList": [
            {
                "skcName": "sc25090543833308995",
                "supplierCode": "4545880035",
                "sampleInfo": {
                    "sampleCode": "",
                    "reserveSampleFlag": 0,
                    "spotFlag": 0,
                    "sampleJudgeType": 2
                },
                "productMultiNameList": [
                    {
                        "productName": "Bennie For Custom Attribute 0905",
                        "language": "en"
                    }
                ],
                "attributeId": 2147484187,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Color",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147489740,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "custom attribute value for SKC",
                        "language": "en"
                    }
                ],
                "skuInfoList": [
                    {
                        "skuCode": "I41m0y0swjql",
                        "supplierSku": "366485454623",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "366485454623",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147489739,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "custom attribute value for SKU",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 334.0,
                                "specialPrice": 35.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    },
                    {
                        "skuCode": "I41m1jlbevlc",
                        "supplierSku": "45345345",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "45345345",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147488283,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "30*20",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 33.0,
                                "specialPrice": 23.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    }
                ],
                "shelfStatusInfoList": [
                    {
                        "siteAbbr": "shein-us",
                        "shelfStatus": 1,
                        "lastShelfTime": "2025-09-05 14:00:06",
                        "firstShelfTime": "2025-09-05 14:00:06",
                        "lastUpdateTime": "2025-09-05 14:00:06",
                        "link": "https://us.shein.com/Bennie-For-Custom-Attribute-0905-p-54645646522692-cat-4913127337.html"
                    }
                ],
                "recycleInfoList": null,
                "skcImageInfoList": [
                    {
                        "groupCode": "G21ja2yef1mm",
                        "imageItemId": 2148036234,
                        "imageType": "MAIN",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 1
                    },
                    {
                        "groupCode": "G21ja2yef1mm",
                        "imageItemId": 2148036235,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 2
                    },
                    {
                        "groupCode": "G21ja2yef1mm",
                        "imageItemId": 2148036236,
                        "imageType": "SQUARE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 3
                    },
                    {
                        "groupCode": "G21ja2yef1mm",
                        "imageItemId": 2148036237,
                        "imageType": "PIECE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 4
                    }
                ],
                "siteDetailImageInfoList": null,
                "proofOfStockInfoList": [],
                "srpPriceInfo": {
                    "currency": "USD",
                    "srpPrice": 34.0
                }
            },
            {
                "skcName": "sc25090543833396934",
                "supplierCode": "4545880035",
                "sampleInfo": {
                    "sampleCode": "",
                    "reserveSampleFlag": 0,
                    "spotFlag": 0,
                    "sampleJudgeType": 2
                },
                "productMultiNameList": [
                    {
                        "productName": "Bennie For Custom Attribute 0905",
                        "language": "en"
                    }
                ],
                "attributeId": 2147484187,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Color",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147488295,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "Navy",
                        "language": "en"
                    }
                ],
                "skuInfoList": [
                    {
                        "skuCode": "I41m0y0syo5g",
                        "supplierSku": "3655435436523",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "3655435436523",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147488283,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "30*20",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 334.0,
                                "specialPrice": 35.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    },
                    {
                        "skuCode": "I41m1jlbh70p",
                        "supplierSku": "45345",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "45345",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147489739,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "custom attribute value for SKU",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 33.0,
                                "specialPrice": 23.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    }
                ],
                "shelfStatusInfoList": [
                    {
                        "siteAbbr": "shein-us",
                        "shelfStatus": 1,
                        "lastShelfTime": "2025-09-05 14:00:06",
                        "firstShelfTime": "2025-09-05 14:00:06",
                        "lastUpdateTime": "2025-09-05 14:00:06",
                        "link": "https://us.shein.com/Bennie-For-Custom-Attribute-0905-p-54645646522693-cat-4913127337.html"
                    }
                ],
                "recycleInfoList": null,
                "skcImageInfoList": [
                    {
                        "groupCode": "G21m0y2n7hfw",
                        "imageItemId": 2148036238,
                        "imageType": "MAIN",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 1
                    },
                    {
                        "groupCode": "G21m0y2n7hfw",
                        "imageItemId": 2148036239,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 2
                    },
                    {
                        "groupCode": "G21m0y2n7hfw",
                        "imageItemId": 2148036240,
                        "imageType": "SQUARE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 3
                    },
                    {
                        "groupCode": "G21m0y2n7hfw",
                        "imageItemId": 2148036241,
                        "imageType": "PIECE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_405x552.jpeg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226_thumbnail_220x293.jpeg",
                        "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg",
                        "sort": 4
                    }
                ],
                "siteDetailImageInfoList": [
                    {
                        "imageGroupCode": "G41j8kjqvt7w",
                        "imageInfoList": [
                            {
                                "imageItemId": 1147541301,
                                "imageSort": 1,
                                "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/12/10/27/17338148602250996226.jpeg"
                            }
                        ],
                        "siteInfoList": [
                            {
                                "channel": "",
                                "mainSite": "shein",
                                "site": "shein-us"
                            }
                        ]
                    }
                ],
                "proofOfStockInfoList": [],
                "srpPriceInfo": {
                    "currency": "USD",
                    "srpPrice": 34.0
                }
            },
            {
                "skcName": "sc25090543833306711",
                "supplierCode": "4545880035",
                "sampleInfo": {
                    "sampleCode": "",
                    "reserveSampleFlag": 0,
                    "spotFlag": 0,
                    "sampleJudgeType": 2
                },
                "productMultiNameList": [
                    {
                        "productName": "Bennie For Custom Attribute 0905",
                        "language": "en"
                    }
                ],
                "attributeId": 2147484187,
                "attributeMultiList": [
                    {
                        "attributeName": "OPENAPI-Color",
                        "language": "en"
                    }
                ],
                "attributeValueId": 2147488294,
                "attributeValueMultiList": [
                    {
                        "attributeValueName": "Mustard",
                        "language": "en"
                    }
                ],
                "skuInfoList": [
                    {
                        "skuCode": "I41m1jlbjmfa",
                        "supplierSku": "5345354354",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "5345354354",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147489739,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "custom attribute value for SKU",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 33.0,
                                "specialPrice": 23.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    },
                    {
                        "skuCode": "I41m1jlbirjp",
                        "supplierSku": "435344545",
                        "length": "1.00",
                        "width": "1.00",
                        "height": "1.00",
                        "weight": 1,
                        "packageType": 0,
                        "sellerSkuWeight": {
                            "length": "1.00",
                            "width": "1.00",
                            "height": "1.00",
                            "weight": 1,
                            "packageType": 0,
                            "systemSource": 0
                        },
                        "wmsSkuWeight": {
                            "length": null,
                            "width": null,
                            "height": null,
                            "weight": null,
                            "packageType": null,
                            "systemSource": null
                        },
                        "skuSupplierInfo": {
                            "supplierSku": "435344545",
                            "supplierBarcodeEnabled": false,
                            "supplierBarcodeList": []
                        },
                        "quantity": null,
                        "quantityType": null,
                        "quantityUnit": null,
                        "mallState": 1,
                        "stopPurchase": 1,
                        "saleAttributeList": [
                            {
                                "attributeId": 2147484186,
                                "attributeValueId": 2147488283,
                                "attributeValueMultiList": [
                                    {
                                        "attributeValueName": "30*20",
                                        "language": "en"
                                    }
                                ]
                            }
                        ],
                        "priceInfoList": [
                            {
                                "site": "shein-us",
                                "basePrice": 33.0,
                                "specialPrice": 23.0,
                                "currency": "USD"
                            }
                        ],
                        "costInfoList": [],
                        "skuImageInfoList": null
                    }
                ],
                "shelfStatusInfoList": [
                    {
                        "siteAbbr": "shein-us",
                        "shelfStatus": 0,
                        "lastShelfTime": "2018-08-28 00:00:00",
                        "firstShelfTime": "1970-01-01 08:00:01",
                        "lastUpdateTime": "2025-09-05 14:16:27",
                        "link": "https://us.shein.com/Bennie-For-Custom-Attribute-0905-p-54645646522710-cat-4913127337.html"
                    }
                ],
                "recycleInfoList": null,
                "skcImageInfoList": [
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036302,
                        "imageType": "MAIN",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/a7/1757052939fe552dac89a2f5d12503e7afff826dbe_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/a7/1757052939fe552dac89a2f5d12503e7afff826dbe_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/a7/1757052939fe552dac89a2f5d12503e7afff826dbe.jpg",
                        "sort": 1
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036303,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/62/1757052939de92a781e416b49f1d299c1489a94d71_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/62/1757052939de92a781e416b49f1d299c1489a94d71_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/62/1757052939de92a781e416b49f1d299c1489a94d71.jpg",
                        "sort": 2
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036304,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/53/1757052939be6a4855caf38d4045211ca2fd081d59_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/53/1757052939be6a4855caf38d4045211ca2fd081d59_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/53/1757052939be6a4855caf38d4045211ca2fd081d59.jpg",
                        "sort": 3
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036305,
                        "imageType": "DETAIL",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/df/1757052939abdf9d03aaeae017c715bbf69efef417_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/df/1757052939abdf9d03aaeae017c715bbf69efef417_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/df/1757052939abdf9d03aaeae017c715bbf69efef417.jpg",
                        "sort": 4
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036306,
                        "imageType": "SQUARE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/1e/175705293940f3cb182c3d04df3a2d17ca84c0b4d2_thumbnail_405x552.jpg",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/1e/175705293940f3cb182c3d04df3a2d17ca84c0b4d2_thumbnail_220x293.jpg",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/j/pi/2025/09/05/1e/175705293940f3cb182c3d04df3a2d17ca84c0b4d2.jpg",
                        "sort": 5
                    },
                    {
                        "groupCode": "G01vcmbtfn5k",
                        "imageItemId": 2148036307,
                        "imageType": "PIECE",
                        "imageMediumUrl": "https://imgdeal-test01.shein.com/v4/p/pi/2025/09/05/65/175705293910d4d904ed8af6396c39f713758a10ef_thumbnail_405x552.png",
                        "imageSmallUrl": "https://imgdeal-test01.shein.com/v4/p/pi/2025/09/05/65/175705293910d4d904ed8af6396c39f713758a10ef_thumbnail_220x293.png",
                        "imageUrl": "https://imgdeal-test01.shein.com/v4/p/pi/2025/09/05/65/175705293910d4d904ed8af6396c39f713758a10ef.png",
                        "sort": 6
                    }
                ],
                "siteDetailImageInfoList": null,
                "proofOfStockInfoList": [],
                "srpPriceInfo": {
                    "currency": "USD",
                    "srpPrice": 33.0
                }
            }
        ]
    },
    "bbl": null,
    "traceId": "d8d37306e13e15f6"
}

### 
3 测试店铺

测试调用域名：https://openapi-test01.sheincorp.cn

openKey：EED6AEEA6B4741EF94D29FED5A1CE76F

secretKey：35D01D988EBA46FB9D87CA066FFD1805

### 
4 常见FAQ

Q:：商家切换为新的属性方案后，无法从查询属性接口中获得自定义属性值的attribute value id，如需使用可以从哪里获取？

A：可以通过查询SPU详情接口/open-api/goods/spu-info获取，此接口中会返回自定义属性值的value id

## 解决方案 / 全托管解决方案 / 商品图片

- Page ID：`4d96fc8f-4913-4211-8630-5d81e7fcc010`
- 路径：`https://open.sheincorp.com/documents/system/4d96fc8f-4913-4211-8630-5d81e7fcc010`
- 简介：介绍商品发布、查询场景中的商品图片使用方式

# 
商品图片

# 
1 方案概述

## 
1.1 适用范围

本文档适用于所有类型的应用。

## 
1.2 业务说明

应用需要发布或编辑商品时，会使用到商品图片，可通过此文档确认图片上传、管理方式。

商品图片上传主要包含3个步骤：确认商品的图片上传要求、生成图片URL、将URL发布到商品中。

## 
1.3 调用概览

## 
1.4 API清单

API名称
API & 文档地址

查询商品发布字段规范
/open-api/goods/query-publish-fill-in-standard

转换图片成SHEIN可用的图片
/open-api/goods/transform-pic

本地图片上传
/open-api/goods/upload-pic

商品发布&编辑
/open-api/goods/product/publishOrEdit

查询商品
/open-api/goods/spu-info

# 
2 详细步骤

## 
2.1 商品图片方案概览

 
SHEIN的商品图片有新旧方案

    旧方案：仅支持SKC、SKU传图

    
新方案：支持SPU、SKC、SKU上传图片。但不同商品类目传图要求不同，因此新方案中又有多套方案

商品图片名称
旧方案
新方案A
新方案B
发布商品 接口中的图片类型
图片规格要求

SPU层
商品轮播图
X
选填，1张
必填，上限11张
单张时：1-主图，最多1张

多张时：1-主图，必传，最多1张

               2-细节图必传，最多10张
● 像素1340px*1785px；或宽高比例1:1，像素范围900px-2200px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

方形图
X
X
必填，1张
5-方块图
● 像素1200px*1200px 

● 格式JPG/JPEG/PNG

● 大小≤3MB

SKC层
主图
必填，1张
必填，1张
必填，1张
1-主图
● 像素1340px*1785px；或宽高比例1:1，像素范围900px-2200px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

细节图
必填，上限10张
必填，上限10张
X
2-细节图

方形图
必填，1张
必填，1张
X
5-方块图
● 宽高比例1:1，像素900*900~2200*2200 px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

色块图
单skc非必填

多skc必填
单skc非必填

多skc必填
单skc非必填

多skc必填
6-色块图
● 宽高比例1:1，像素80×80 px 

● 格式JPG/JPEG/PNG

● 大小≤3MB

站点详情图
非必填，最多10张
非必填，最多10张
非必填，最多10张
不需传类型
● 宽高比例3:4，像素大于900px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

SKU层
SKU图
选填，1张

若skc下有1个sku传图，则skc下所有sku都要传图
选填，1张

若skc下有1个sku传图，则skc下所有sku都要传图
选填，1张

若skc下有1个sku传图，则skc下所有sku都要传图
1-主图
● 像素1340px*1785px；或宽高比例1:1，像素范围900px-2200px 

● 格式JPG/JPEG/PNG 

● 大小≤3MB

## 
2.2 步骤1：确认商品图片上传要求

 ● 
接口地址：
/open-api/goods/query-publish-fill-in-standard

 ● 
通过接口获取商品的图片上传要求时

     ○ 
必需入参"category_id"，因为不同类目的图片要求不同

     ○ 
必须按商家维度查询上传要求，同类目下不同商家的图片要求不同

 ● 
根据返回参数确定图片要求，返回参数主要有2种形态

### 
旧方案判断方式

 ● 
当"picture_config_list"中只有1个"field_key": "switch_spu_picture"时，代表类目走旧方案传图，只在SKC维度传图即可。

 ● 
旧方案下，商品发布接口中的"is_spu_pic"需要传false

{
    "picture_config_list": [
        {
            "field_key": "switch_spu_picture",
            "is_true": false
        }
    ]
}

### 
新方案判断方式

 ● 
当"picture_config_list"中包含很多"field_key"时，代表类目走新方案传图。具体传什么图、传几张，需多个字段结合起来一起看，可参考下方表格。

   
 注意：2025年9月开始所有商品都支持上传SKU图片，此接口中不会再返回"field_key": "sku_image_detail_show", "field_key": "sku_image_detail_required",

 ● 
新方案下，商品发布接口中的"is_spu_pic"需要传true

新方案A返回示例：

{
    "picture_config_list": [
        {
            "field_key": "switch_spu_picture",
            "is_true": false
        },
        {
            "field_key": "spu_image_detail_show",
            "is_true": true
        },
        {
            "field_key": "spu_image_detail_required",
            "is_true": false
        },
        {
            "field_key": "spu_image_detail_single",
            "is_true": true
        },
        {
            "field_key": "spu_image_square_show",
            "is_true": false
        },
        {
            "field_key": "spu_image_square_required",
            "is_true": false
        },
        {
            "field_key": "skc_image_detail_show",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_required",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_single",
            "is_true": false
        },
        {
            "field_key": "skc_image_square_show",
            "is_true": true
        },
        {
            "field_key": "skc_image_square_required",
            "is_true": true
        }
    ]
}

新方案B的响应示例
{
    "picture_config_list": [
        {
            "field_key": "switch_spu_picture",
            "is_true": false
        },
        {
            "field_key": "spu_image_detail_show",
            "is_true": true
        },
        {
            "field_key": "spu_image_detail_required",
            "is_true": true
        },
        {
            "field_key": "spu_image_detail_single",
            "is_true": false
        },
        {
            "field_key": "spu_image_square_show",
            "is_true": true
        },
        {
            "field_key": "spu_image_square_required",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_show",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_required",
            "is_true": true
        },
        {
            "field_key": "skc_image_detail_single",
            "is_true": true
        },
        {
            "field_key": "skc_image_square_show",
            "is_true": false
        },
        {
            "field_key": "skc_image_square_required",
            "is_true": false
        }
    ]
}
字段名
字段说明
商品发布接口中的传图说明

switch_spu_picture
入参查询的SPU，当前是否已用新方案传图。

没有入参SPU时，此值都是false。
此字段在商品发布场景不用关注，编辑场景需关注。

spu_image_detail_show
spu轮播图是否展示
SPU轮播图，单张/多张的传图方式不同 

● 单张时，1-主图必传，最多1张

● 多张时，1-主图必传，最多1张；2-细节图必传，最多10张

spu_image_detail_required
spu轮播图否必填

spu_image_detail_single
spu轮播图是否单张

spu_image_square_show
spu方形图是否展示
SPU方形图，仅1张，所以无是否单张的字段 

● 必填时，5-方形图必传

spu_image_square_required
spu方形图是否必填

skc_image_detail_show
skc细节图是否展示
SKC细节图，单张/多张的传图方式不同

● 单张时，1-主图必传，最多1张

● 多张时，1-主图必传，最多1张；2-细节图必传，最多10张

skc_image_detail_required
skc细节图是否必填

skc_image_detail_single
skc细节图是否单张

skc_image_square_show
skc方形图是否展示
SKC方形图，仅1张，所以无是否单张的字段 

● 必填时，5-方形图必传

skc_image_square_required
skc方形图是否必填

## 
2.3 步骤2：获取图片URL

 ● 
所有上传的图片必须先转换成SHEIN的图片URL，提供两种方式：本地图片上传、转换在线图片

### 
本地图片上传

 ● 
接口地址：
/open-api/goods/upload-pic

 ● 
请求示例

--form 'image_type="2"' \ --form 'file=@"/Users/10027511/Documents/1068*455.png"
 ● 
返回示例

{
    "code": "0",
    "msg": "OK",
    "info": {
        "image_url": "http://imgdeal-test01.shein.com/images3_pi/2023/11/15/3c/17000397694031071724_square.jpg",
        "width": 1200,
        "height": 1200,
        "size": 363846,
        "image_hex_type": "jpg"
    },
    "bbl": null
}

### 
转换在线图片

 ● 
接口地址：
/open-api/goods/transform-pic

● 
接口限流为20次/秒，请注意控制调用频次

 ● 
请求示例

{
    "image_type": 2,
    "original_url": "http://imgdeal-test01.shein.com/images3_pi/2023/11/15/fe/17000325694031071724_square.jpg"
}
 ● 
返回示例

{
    "code": "0",
    "msg": "OK",
    "info": {
        "original": "http://imgdeal-test01.shein.com/images3_pi/2023/11/15/fe/17000325694031071724_square.jpg",
        "transformed": "https://imgdeal-test01.shein.com/images3_pi/2024/05/23/db/17164580272759534094.jpeg",
        "failure_reason": ""
    },
    "bbl": null
}

## 
2.4 步骤3：上传图片发布商品

 ● 
商品发布中上传图片，主要关注以下字段

     ● 
is_spu_pic：
是否为新方案传图，true=新方案；false=旧方案

     ● 
image_info：此对象在SPU、SKU、SKC都有，且对象下的字段逻辑一致，字段逻辑见下方表格。具体什么层级传多少图，按步骤2中获取的图片要求传图即可。

字段
字段
字段
说明

image_info

image_group_code
图片组编码，由SHEIN生成。商品发布场景不用传，编辑场景要传

image_info_list
图片列表

image_type
图片类型：1-主图,2-细节图,5-方块图,6-色块图

image_sort
图片序号：主图必须排序为1，其他依次排序

image_item_id
图片唯一id，由SHEIN生成。商品发布场景不用传，编辑场景要传

image_url
图片链接

## 
2.5 其他场景：查询商品图片

 ● 
接口地址：
/open-api/goods/spu-info

 ● 
查询接口返回的图片类型是
"string"
，查询返回的枚举值 和 上传图片的枚举值对应关系如下所示

商品发布接口的图片类型
商品查询详情的图片类型

1-主图
MAIN

2-细节图
DETAIL

5-方块图
SQUARE

6-色块图
PIECE

 ● 查询的返回示例

{
    "spuImageInfoList": [
        {
            "groupCode": "G140qbzchcil",
            "imageItemId": 2147609257,
            "imageType": "MAIN",
            "imageMediumUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/05/21/1b/17162749351136466060_square_thumbnail_405x552.jpeg",
            "imageSmallUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/05/21/1b/17162749351136466060_square_thumbnail_220x293.jpeg",
            "imageUrl": "https://imgdeal-test01.shein.com/images3_pi/2024/05/21/1b/17162749351136466060_square.jpeg",
            "sort": 1
        }
    ]
}

# 
3 关联阅读

    
商品发布-全托管

    
商品发布-半托管

    
商品发布-自运营

## 解决方案 / 全托管解决方案 / 商品证书

- Page ID：`a4c9a5c4-75db-4f99-bbaf-0e47b34bda80`
- 路径：`https://open.sheincorp.com/documents/system/a4c9a5c4-75db-4f99-bbaf-0e47b34bda80`
- 简介：该解决方案用于上传商品证书，适用于管理自主运营、代运营和半托管商家的证书管理

# 
商品证书

# 
1 方案概述

## 
适用范围

- 
本文档适用于【应用类型=自运营/半托管/全托管/POP】的应用。

- 
商品证书解决的是商品在海外市场中销售时，遇到的合规/法务问题。

## 
业务说明

部分商品在销售到海外时，需提供商品的资质证书或者检测报告，用于证明商品质量符合市场当地要求。例如销售至欧洲的儿童玩具，需提供玩具检测报告。

因此SHEIN在商品发布时，会基于商品信息要求商家提供相关证书。若商家无法提供证书，商品会有无法正常销售的风险。

SHEIN中的商品合规信息主要有以下3类。此解决方案中的接口可覆盖证书报告、自符声明这两类（在下文中用商品证书来指代），责任/代理公司需使用另一套接口实现，详见
方案

- 
证书报告：由机构或公开组织提供的证明或报告，用于证明商品质量符合当地要求。

- 
自符声明：销售婴童、玩具类商品的卖家，可签署声明协议，确保商品符合美国法规要求。

- 
责任/代理公司：销售至欧洲、美国、英国的商品需申报代理公司，代理公司可理解为销售资质的一种，商品需和代理公司绑定，否则可能影响销售。

商品证书的基础概念

- 
SHEIN管理了多种证书类型，比如燃烧检测报告、化妆品重金属报告等。每个证书类型需要提供什么信息都由平台决定。

- 
店铺内可上传多个证书，同类型的证书也可上传多个。每上传一个证书就会生成一个证书池（虽然名为证书池，但一个证书池内只有一个证书）

- 
每个商品需要提供的证书类型由平台决定，可能是0个，也可能是多个，商家需按要求为商品绑定对应类型的证书。

## 
调用概览

# 
2 详细步骤

## 
2.1 确认商品需绑定哪些类型的证书

SHEIN会根据商品信息和销售市场来判定，商品是否需要提供证书、需要提供哪些类型的证书。这个信息可通过接口查询：
/open-api/goods/get-certificate-rule
，此接口的使用方式有2种，参考下方

方式1：查询某SPU缺失哪些证书

- 
使用场景：商品发布成功后生成SPU A，查询SPU A需绑定的证书类型，明确他当前缺失的证书类型。若必填证书是缺失状态，则引导商家补充对应证书，否则会影响商品上下架状态。

- 
入参：必需提供"spuName"

- 
出参：先找到缺失状态的证书类型：certificateMissStatus=true再判断缺失的证书类型是否为必传，若必传则建议商家补充证书：isRequired=true最后明确必传且缺失的证书类型的类型id，去查询证书类型需要哪些信息，最终创建证书：certificateTypeId其他情况：当某类型证书的certificateMissStatus=false时，代表SPU已绑定此类证书，会在出参中的certificatePoolList字段中看到绑定证书池的具体内容

方式2：查询某商品分类的证书绑定要求

- 
使用场景：在商品发布前预先让商家创建证书，基于商品分类可查到分类维度的证书要求。

- 
入参：必需提供"categoryId"

- 
出参：确认证书类型的管控站点范围：mergeSiteInfoList。若需要精确知道此店铺在此分类下需提供哪些证书，需要先查询店铺可上架站点范围，将两个站点范围匹配后得出最终需上传找到要求的证书类型的类型id，去查询证书类型需要哪些信息，最终创建证书：certificateTypeId

## 
2.2 查询证书所需材料&创建证书

创建某类型的证书之前，需先查询此类型证书需要提交哪些信息。

此部分会说明，创建接口、查询接口之间的出入参关系。适用于普通/自符证书、商品/店铺维度证书。

- 
通过接口查询证书材料：
/open-api/goods/certificate/get-all-certificate-type-list-v2
。接口会返回平台所有证书类型的信息，找到你需要的证书类型certificateTypeId

- 
确认此类型证书的适用范围：

- 
certificateDimensioncertificateDimension=1，即适用部分商品，商品维度证书，创建证书时需使用接口：
/open-api/goods/save-or-update-certificate-pool

- 
certificateDimension=2，即适用全部商品，店铺维度证书，创建证书时需使用接口：
/open-api/goods/save-or-update-supplier-certificate

- 
根据证书材料要求开始创建证书，证书信息主要有2部分

- 
证书文件

- 
即报告或证明的图片/PDF文件内容。每个证书都有且必须提供1个证书文件。

- 
创建证书接口中，文件入参字段名

- 
certificateUrl，需要通过接口上传文件后获取：
/open-api/goods/upload-certificate-file

- 
certificateUrlName，由开发者自定义值

- 
证书字段

- 
即证书相关的描述信息。不同证书类型所需要的证书字段不同。

- 
创建证书接口中，证书字段相关入参字段名如下

- 
certificateRelationInfoList：字段列表

- 
certificateRelationNameId：即字段名ID，取查询接口中 presetInfoList → presetId

- 
certificateRelationValueId：即字段的值的ID值。当字段的输入方式inputType=1/2（从可选项中选择）时，将选择的ID值入参至此，取查询接口中 presetInfoList → presetValueList → presetValueId

- 
certificateRelationValue：即字段的值。当字段的输入方式inputType=3/4（自定义值场景）时，需要将自定义值入参至此。

- 
otherCertificateRelationInfoList：其他字段列表（拆分2个字段列表，没有实际业务意义，开发者不用关注，只要根据下方逻辑入参即可）

- 
certificateRelationNameId：即字段名ID，取查询接口中 otherPresetInfoList → presetId

- 
certificateRelationValueId：

- 
当otherPresetInfoList - sourceFrom=SRM（一套特殊的检测结构列表数据）时，取查询接口中的 srmDetectionAgencyList - detectionAgencyId（检测机构id）

- 
当otherPresetInfoList - sourceFrom≠SRM时，当字段的输入方式inputType=1/2时，取查询接口中 otherPresetInfoList → presetValueList → presetValueId

- 
certificateRelationValue

- 
当otherPresetInfoList - sourceFrom=SRM时，取查询接口中的 srmDetectionAgencyList - laboratoryId（实验室id）

- 
当otherPresetInfoList - sourceFrom≠SRM时，当字段的输入方式inputType=3/4（自定义值场景）时，需要将值入参至此。

- 
创建成功后会生成一个证书池certificatePoolId，后续证书池需要和SKC绑定。（虽然名称为池，但实际一个证书池中只有一个证书）。

### 
不同场景的入参示例

创建店铺维度证书

curl --location --request POST 'https://openapi.sheincorp.com/open-api/goods/save-or-update-supplier-certificate' \
--header 'x-lt-signature: test' \
--header 'x-lt-openKeyId: test' \
--header 'x-lt-timestamp: 1751010644959' \
--header 'language: zh-cn' \
--header 'Content-Type: application/json' \
--header 'Host: openapi.sheincorp.com' \
--data-raw '{
    "certificateTypeId": 135,
    "certificateUrl": "https://pqms-1259571579.cos.ap-nanjing.myqcloud.com/gpc202401111845086.jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240111T020804Z&X-Amz-SignedHeaders=host&X-Amz-Expires=431999&X-Amz-Credential=AKIDIPGrBE0VjgOpztXu1sSmqnY5NPBiz1nJ/20240111/ap-nanjing/s3/aws4_request&X-Amz-Signature=b4d6b45148b51c934bed41e0547b7c586737d7bf71061dc4475eabfe77f420a3", // 此值通过/open-api/goods/upload-certificate-file获取
    "certificateUrlName": "16952760533746985150.jpeg"  // 此值自定义
}'

创建商品维度证书 — 不涉及srm检测机构

curl --location --request POST 'https://openapi.sheincorp.com/open-api/goods/save-or-update-certificate-pool' \
--header 'x-lt-signature: test' \
--header 'x-lt-openKeyId: test' \
--header 'x-lt-timestamp: 1751459666380' \
--header 'language: zh-cn' \
--header 'Content-Type: application/json' \
--header 'Host: openapi.sheincorp.com' \
--data-raw '{
  "certificateRelationInfoList": [
    {
      "certificateRelationNameId": 175,
      "certificateRelationValue": "2025-01-01 00:00:00",
      "certificateRelationValueId": ""
    }
  ],
  "certificateTypeId": 21,
  "certificateUrl": "https://lt-pqms.oss-cn-shenzhen.aliyuncs.com/gpc2913387912766705664.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20250702T123051Z&X-Amz-SignedHeaders=host&X-Amz-Expires=432000&X-Amz-Credential=LTAI5tKvGuVMaYLBaMkpkiBr/20250702/oss-cn-shenzhen/s3/aws4_request&X-Amz-Signature=bdf3d7c5ebc2ee7df574fd144773639dcdc231b0e036d675138e8905e11daf7b",
  "certificateUrlName": "test.jpeg",
  "otherCertificateRelationInfoList": []
}'

创建商品维度证书 — 涉及srm检测机构

curl --location --request POST 'https://openapi.sheincorp.com/open-api/goods/save-or-update-certificate-pool' \
--header 'x-lt-signature: test' \
--header 'x-lt-openKeyId: test' \
--header 'x-lt-timestamp: 1751459491635' \
--header 'language: zh-cn' \
--header 'Content-Type: application/json' \
--header 'Host: openapi.sheincorp.com' \
--data-raw '{
  "certificateRelationInfoList": [
    {
      "certificateRelationNameId": 175,
      "certificateRelationValue": "2025-01-01 00:00:00",
      "certificateRelationValueId": ""
    }
  ],
  "certificateTypeId": 7,
  "certificateUrl": "https://lt-pqms.oss-cn-shenzhen.aliyuncs.com/gpc2913387912766705664.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20250702T123051Z&X-Amz-SignedHeaders=host&X-Amz-Expires=432000&X-Amz-Credential=LTAI5tKvGuVMaYLBaMkpkiBr/20250702/oss-cn-shenzhen/s3/aws4_request&X-Amz-Signature=bdf3d7c5ebc2ee7df574fd144773639dcdc231b0ut036d675138e8905e11daf7b",
  "certificateUrlName": "pdf",
  "otherCertificateRelationInfoList": [
    {
      "certificateRelationNameId": 183,
      "certificateRelationValue": "4000515", //取查询证书材料接口中的 srmDetectionAgencyList - laboratoryId（实验室id）
      "certificateRelationValueId": "2380882" // 取查询证书材料接口中的 srmDetectionAgencyList - detectionAgencyId（检测机构id）
    }
  ]
}'

## 
2.3 绑定商品和证书

店铺维度的证书池会自动和商品绑定，只有商品维度证书需要手动绑定。

证书池需和SKC进行绑定，因此若SPU需要绑定A、B两个类型的证书，则SPU下的所有SKC都需要操作绑定。绑定时提交

curl --location --request POST 'https://openapi.sheincorp.com/open-api/goods/save-certificate-pool-skc-bind' \
--header 'x-lt-signature: test' \
--header 'x-lt-openKeyId: test' \
--header 'x-lt-timestamp: 1751010761337' \
--header 'language: zh-cn' \
--header 'Content-Type: application/json' \
--header 'Host: openapi.sheincorp.com' \
--data-raw '{
  "skcCertificatePoolRelationList": [
    {
      "spuName": "s2409195445",
      "skcName": "ss24091954454649",
      "certificatePoolIdList": [
        9867,
        9817
      ]
    },
    {
      "spuName": "s2409199897",
      "skcName": "ss24091998977394",
      "certificatePoolIdList": [
        9867,
        9817
      ]
    }
  ]
}'

## 
2.4 确认绑定的审核结果

绑定证书后，SHEIN平台会对本次绑定进行审核。审核结果可通过接口查询：
/open-api/goods/get-certificate-rule

- 
入参：提供商品spuName、绑定的证书池certificatePoolId

- 
出参：通过certificatePoolList - auditStatus判断审批结果

- 
查询接口的维度是SPU，但审核维度是SKC。当SPU下有多个SKC时，只有当SKC全部审核通过时，SPU维度才会返回审核通过。

## 解决方案 / 全托管解决方案 / 商品合规

- Page ID：`af751fbf-0a24-484a-98fe-377654bd62d7`
- 路径：`https://open.sheincorp.com/documents/system/af751fbf-0a24-484a-98fe-377654bd62d7`

# 
商品合规

# 
方案概述

- 
若商品需销往欧盟、美国、英国等地区，商家需按当地要求提供相关证明。此方案会介绍如何将证明提供给平台。

- 
此方案适用于所有类型的应用。

# 
业务流程

目前API层支持2个合规场景：

- 
商品绑定代理公司：可覆盖GPSR欧盟责任人、美国代理、英国代理、制造商

- 
商品上传标签实拍图：可覆盖欧洲的环保、GPSR等标签要求

# 
调用概览

类型
名称
文档

API
查询代理公司列表
/open-api/goods-compliance/agency-list

API
查询SKC的代理公司绑定要求
/open-api/goods-compliance/skc-agency-detail

API
绑定SKC和代理公司
/open-api/goods-compliance/save-skc-agency

API
查询SKC的实拍图要求
/open-api/goods-compliance/skc-label-list

API
打印合规标签
/open-api/goods-compliance/label-print

API
上传实拍图图片
/open-api/goods-compliance/upload-skc-label-picture

API
绑定SKC和实拍图
/open-api/goods-compliance/skc-save-label

# 
具体场景

## 
商品绑定代理公司

步骤1：查询已申报的代理公司

- 
目前API不支持申报代理公司，需商家先通过商家后台手动完成申报。

- 
通过接口可查询到商家已申报的代理公司信息，接口地址：
/open-api/goods-compliance/agency-list

- 
代理公司相关的重要字段和规则：

- 
哪些代理公司是有效的，可以和商品绑定的？agencyStatus=0，且applyStatus=1/2的代理公司

字段名
字段说明

agencyId
代理公司ID。

后续商品绑定代理公司时会使用。

agencyType
代理公司类型：0-欧盟责任人；1-英国代理；2-美国代理；3-制造商。

后续商品绑定代理公司时会使用。

agencyStatus
代理公司的协议生效状态：0-生效中，1-已过期，2-未生效。

applyStatus
代理公司申报状态：0-待补充；1-待审核（商家后台此状态会展示申报成功）；2-申报成功；3-审核失败。

coveredProductRange
代理公司可覆盖的商品范围：1-全部商品；2-部分商品。

范围=“全部商品”时，系统会默认所有SKC都绑定该公司，即有新增发品不需要再次单独绑定；

范围=““部分商品”时，需要商家自行绑定SKC和公司的关系。

步骤2：查询商品需要绑定哪些类型的代理公司

- 
不是所有商品都需要绑定代理公司，需绑定公司的商品可能需绑定多个类型的代理公司。平台会根据商品类目、销售地区等信息，判断出哪些商品需要绑定哪些类型的代理公司。商家需按要求提供，若无法及时提供，会导致商品无法上架或被强制下架。

- 
通过接口可查询到哪些商品需要绑定哪些代理公司，以及当前商品的公司绑定状态，接口地址：
/open-api/goods-compliance/skc-agency-detail

- 
建议将商品必须绑定的代理公司全部绑定，以避免商品异常，操作方法如下：

- 
入参：
查询商品有哪些必要绑定信息：isRequired=1

- 
出参：

- 
找到SKC下未绑定或绑定失败的代理公司，稍后进行绑定：reviewState=1/3

- 
确认SKC需要绑定的代理公司类型agencyType，然后从步骤1中获得的已申报的代理公司中，找到相同type且有效的agencyId

步骤3：绑定商品和代理公司

- 
通过接口绑定，接口地址：
/open-api/goods-compliance/save-skc-agency

- 
绑定时使用的agencyId、agencyType，需要从步骤1中获取。

## 
商品上传标签实拍图

步骤1：查询商品的实拍图上传要求

- 
实拍图上传的是商品实物图片、商品包装上贴标的图片。图片中需要体现出各地区对参数、环保、GPSR相关要求的信息要素。

- 
不是所有商品都需要上传实拍图，需传图的商品在实拍图中需要展示的信息有很多类型。上传图片后系统会扫描图片自动识别信息，若图片中未包含指定信息的话，实拍图绑定失败，会导致商品无法上架或被强制下架。

- 
通过接口可查询到哪些商品需要在实拍图中体现哪些信息元素，以及当前商品的实拍图绑定状态，接口地址：
/open-api/goods-compliance/skc-label-list

- 
建议将商品必须绑定的信息要素全部拍摄并上传，以避免商品异常，操作方法如下

- 
入参：
查询商品有哪些必要绑定信息：isRequired=1

- 
出参：

- 
找到SKC下实拍图中未绑定成功的信息，稍后进行绑定：reviewState=0/3。注意：reviewState=1是待审核，此状态在商家后台展示为申报成功。实拍图是异步审核，所以上传后展示申报成功，异步发现失败后才变成失败状态。可对接消息通知及时发现审核失败。

- 
确认SKC需要在实拍图中体现的信息，将他们都打印成标签：labelName

步骤2：打印商品标签

- 
基于SKC，打印出SKC可打印的所有标签。平台会预设一批标签模板，如果预设模板不符合预期，商家需通过商家后台手动绘制标签模板，然后再通过API打印。

- 
打印接口地址：
/open-api/goods-compliance/label-print

步骤3：上传实拍图图片

- 
标签打印后贴到商品包装上，拍摄实拍图后需先上传图片。实拍图有单独的图片上传API，请不要使用商品发布中的图片上传接口。

- 
上传图片接口地址：
/open-api/goods-compliance/upload-skc-label-picture

步骤4：绑定商品和实拍图

- 
实拍图绑定在SKC维度。每个SKC可绑定多张实拍图，最多15张。图片长宽均不能超过8000px、大小不超过10M，支持png/jpeg/jpg格式。

- 
绑定接口：
/open-api/goods-compliance/skc-save-label

## 

## 
监听商品绑定的合规信息失效

- 
此消息目前可监听的场景

- 
SKC绑定的代理公司失效：主要由代理公司自身失效导致，如代理有效期到期。失效后，和代理公司有绑定关系的SKC均会发出失效的通知。

- 
SKC上传的实拍图失效：主要由于实拍图审核失败导致，实拍图非实时审核。

- 
消息地址： 
https://open.sheincorp.com/documents/msgdoc/detail/3001095
 

complianceTypeId
信息类型

1
欧盟代理公司

3
实拍图

## 解决方案 / 全托管解决方案 / 合规证书-警告语

- Page ID：`105b8e3e-5e33-43fe-8848-a9e54fe7c7ea`
- 路径：`https://open.sheincorp.com/documents/system/105b8e3e-5e33-43fe-8848-a9e54fe7c7ea`

# 
合规证书-警告语

# 

# 
1、方案概述

### 
适用范围

服务欧洲、英国市场商家的自运营、半托管、全托管类型应用，可对接此解决方案。

警告语证书覆盖范围

- 
站点：欧盟、英国

- 
品类：目前主要为婴童用品类商品

上述范围内的商品，若没有提供必传的警告语证书，可能会无法上架。

# 
2、调用说明

### 
填写规则介绍

警告语内容由平台预先配置，基于商家选择的商品信息自动生成，商家无法自行输入警告语内容。

例如图片中的【母婴喂养用品警告语】。商家需要选产品属性，若他选了【玻璃容器】，则提示内容（警告语）字段中会自动出现和【玻璃容器】关联的所有警告语（可能是1个或多个）。同时产品属性字段中的值，可能存在互斥。

### 
第1步：查询警告语填写规则

- 
调用接口：
/open-api/goods-compliance/query-warning-certificate-rules

- 
接口返回的是所有需商家手动操作的警告语证书。平台中还有自动的警告语证书，无需商家处理，这类证书不会返回。此接口建议每周调用一次，确保获取平台最新的配置数据。

- 
出参使用说明

字段名
字段名
字段名
字段名
字段名
说明

certificateTypeId
证书类型ID

certificateTypeCode
证书类型Code，唯一编码。后续查询、更新SKC警告语时均会使用。

certificateTypeName
证书类型名称

presetInfo​
证书字段信息

isEnabled
字段信息是否启用。0-禁用；1-启用

​
presetFields
​
​
字段详情

​
fieldCode
​
字段Code，唯一编码。

​
fieldName
​
字段名称，支持返回多语言。

​
fieldType
​
字段值的输入方式。

0=多选;1=单选;2=手动输入（实际上还是多选）

​
fieldSort
​
字段排序。

重要：排序值最大的字段是警告语字段，警告语字段逻辑和常规字段不同。

isEnabled
字段是否启用。0-禁用；1-启用

presetFieldValues
​
字段值信息

fieldValueId
​
字段值ID，唯一编码。

fieldValue
​
字段值名称，支持返回多语言。

valueSort
字段值排序

​isEnabled
字段值是否启用。0-禁用；1-启用

exclusionFieldValueIds
​
常规字段专用，互斥的字段值列表。

若常规字段值A下有互斥值B、C，则当商家选A时，BC均不能选。

mappingPaths
警告语字段专用，警告语组装规则

fieldValueIds
警告语关联的常规字段值fieldValueId列表。

若警告语值a关联了常规字段值A、B，则当商家选了A或B中的任意值时，警告语字段中都需要传入a。

### 
查询SKC的警告语绑定情况

- 
调用接口：
/open-api/goods-compliance/query-skc-warning-status

- 
入参重点：接口必须入参分页信息、证书类型编码certificateTypeCodes。目前平台没有警告语证书的标识，只能通过具体的certificateTypeCode来识别哪些是警告语，因此建议先查询警告语填写规则接口，获取到全量的警告语证书code，将他们入参至此以确保查出的结果全是警告语的绑定数据。

- 
出参重点：需关注一下2个字段isRequired：是否必传。必传证书建议上传，否则会影响上架。reviewState：证书审核状态。若审核驳回，建议重新上传，否则会影响上架。

### 
更新SKC的警告语

- 
调用接口：
/open-api/goods-compliance/update-skc-warning-certificate

- 
此接口覆盖创建、更新场景。支持对多个SKC进行相同警告语证书的批量更新。

- 
入参重点

- 
警告语证书中所有的字段均需要入参，包括警告语字段。

- 
警告语字段的值需要完全匹配商家对于常规字段的选择结果，否则会更新失败。

- 
警告语字段的fieldType通常是2（手动输入），但实际在API入参中，入参方式是多选，即fieldValues中需要提供fieldValueId

- 
下面是一个警告语证书的构建示例

查询警告语填写规则-出参
更新SKC的警告语-入参

{

    "certificateTypeId": 754,

    "certificateTypeCode": "PlaypenWMWAttr",

    "certificateTypeName": "Game Bed Warning",

    "presetInfo": {

        "isEnabled": 1,

        "presetFields": [

            {

                "fieldName": "产品属性",

                "fieldType": 0,

                "fieldCode": "PAWA1",

                "fieldSort": 0,

                "isEnabled": 1,

                "presetFieldValues": [

                    {

                        "fieldValueId": 2455,

                        "fieldValue": "玻璃容器",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": null,

                        "valueSort": 0,

                        "isEnabled": 1

                    },

                    {

                        "fieldValueId": 2458,

                        "fieldValue": "产品带奶嘴",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": null,

                        "valueSort": 1,

                        "isEnabled": 1

                    }

                ]

            },

            {

                "fieldName": "警告语",

                "fieldType": 2,

                "fieldCode": "WAContent",

                "fieldSort": 1,

                "isEnabled": 1,

                "presetFieldValues": [

                    {

                        "fieldValueId": 2457,

                        "fieldValue": "警告语：使用本产品时必须有成人监护.",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": [

                            {

                                "fieldValueIds": [

                                    2455

                                ]

                            },

                            {

                                "fieldValueIds": [

                                    2458

                                ]

                            }

                        ],

                        "valueSort": 0,

                        "isEnabled": 1

                    },

                    {

                        "fieldValueId": 2456,

                        "fieldValue": "警告：严禁将喂食奶嘴用作安抚奶嘴。",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": [

                            {

                                "fieldValueIds": [

                                    2455

                                ]

                            },

                            {

                                "fieldValueIds": [

                                    2458

                                ]

                            }

                        ],

                        "valueSort": 1,

                        "isEnabled": 1

                    },

                    {

                        "fieldValueId": 2454,

                        "fieldValue": "警告：玻璃容器可能破裂。",

                        "exclusionFieldValueIds": null,

                        "mappingPaths": [

                            {

                                "fieldValueIds": [

                                    2455

                                ]

                            }

                        ],

                        "valueSort": 2,

                        "isEnabled": 1

                    }

                ]

            }

        ]

    }

}

{

    "certificateTypeCode": "PlaypenWMWAttr",

    "fieldList": [

        {

            "fieldCode": "PAWA1",    // 常规字段：产品属性

            "fieldValues": [

                {

                    "fieldValueId": 2458   //即属性值：产品带奶嘴

                }

            ]

        },

        {

            "fieldCode": "WAContent",     // 警告语字段

            "fieldValues": [

                {

                    "fieldValueId": 2457     // 此警告语值的mappingPaths中包含2458产品带奶嘴，所以需要入参此值

                },

                {

                    "fieldValueId": 2456      // 此警告语值的mappingPaths中包含2458产品带奶嘴，所以需要入参此值

                }

            ]

        }

    ],

    "skcNames": [

        "s24102107079376"

    ]

}

## 解决方案 / 全托管解决方案 / 备货履约

- Page ID：`a880d468-3c56-4dee-b8d6-5c6ff8be756f`
- 路径：`https://open.sheincorp.com/documents/system/a880d468-3c56-4dee-b8d6-5c6ff8be756f`

# 
备货履约

## 
一、适用角色

该解决方案适用于开发【代运营】或【SHEIN自营】应用模式的开发者，支持通过API/Webhook消息进行信息交互，完成备货履约业务。

## 
二、业务介绍

业务介绍：备货单主要由SHEIN下单给到卖家，卖家备货给到SHEIN，SHEIN发货给到买家的业务模式

## 
三、概念&名词解释

1、备货单：SHEIN平台给商家下的订单。有三种模式：

    模式1  急采：先设置虚拟库存进行销售，有买家购买后再统一生成备货单的模式；

    模式2 备货：商家自主申请备货或SHEIN建议备货的模式；

    模式3 JIT备货：SHEIN向商家订一批货但通过分批备货到仓的模式；JIT母单不需要履约，JIT备货需要履约时会生成备货模式的子单进行履约，该备货单的prepareTypeId=9；

2、备货单发货：商家将备货单货品交付给到SHEIN使用的发货方式。发货有四种模式

    模式1 通过SHEIN提供的合作服务商发货，其中服务商又分为以下两种

          ① SHEIN合作的物流快递服务商

          ② SHEIN合作的区域车队服务商

    模式2  商家自行委托第三方服务商发货，其中服务商又分为以下两种

          ① 商家自行委托物流快递服务商

          ② 商家自行委托的车队服务商

    模式3  自送/自提：商家自行送货到平台仓或平台上门取件

    模式4  SHEIN上门查货；在商家的仓库划分货品给到SHEIN，SHEIN上门查验的方式

3、打包方式

    3.1 箱唛发货：针对鞋子等易破碎、易挤压的商品，SHEIN会要求商家将商品打包后装入纸箱，此时适用于箱唛发货，需要打印箱唛，箱唛发货一个采购单至少需要一个包裹

    3.2包裹发货：针对服装等不易破坏的商品，此时适用于包裹发货，需要打印物流面单，商家一般都为包裹发货，箱唛发货需要申请权限；

4、打印

    4.1 商品维度的信息打印

        4.1.1  商品条码：送货到平台仓时，用以扫描入库的条码

        4.1.2 环保标签：部分国家地区要求商品必须要标注的环保信息

    4.2 发货单维度的信息打印

        4.2.1  面单打印：物流运输相关的面单

5、预估运费：使用SHEIN合作物流发货的场景下，查询商家所要承担的费用

     5.1 计算规则：同一个时效产品下，平台提供多个shein合作物流给商家选择，当其中有给到推荐物流的情况下，

                             平台以该推荐物流运费的一半为标准承担备货单运费，若无推荐则需商家自行承担全部运费；

                              在部分场景平台会在承担的运费上再给到补贴；

## 
四、备货单状态以及流转

代运营模式备货单状态流转图

## 
五、接口调用实践

1、接口调用流程图

2、实践描述

   2.1 获取备货单信息

       2.1.1 通过【采购单通知】Webhook通知获取最新的备货单；

       2.1.2 通过【获取采购单信息】接口获取备货单信息；

   2.2 打印商品条码

       2.2.1 通过【商品打印条码】接口获取条码信息；

  

2.3 打印环保标

       2.3.1 通过【获取全量耗材类型和耗材材质信息】接口获取信息；

       2.3.2 通过【获取环保标配置规则】接口获取信息；

       2.3.3 通过【批量打印环保标】接口获取信息；

  2.4 发货

       2.4.1 通过【查询收货仓信息】接口获取收货仓信息；

       2.4.2 通过【发货基本信息查询接口】接口获取信息；

               2.4.2.1送货方式

送货方式
是否支持的判断
获取具体的服务商信息

上门查货
deliveryTypeList.deliveryTypeValue=21
/

自送/自提
deliveryTypeList.deliveryTypeValue=4
/

SHEIN集成的物流快递服务商
deliveryTypeList.deliveryTypeValue=1
通过【
物流产品查询
】接口获取

商家自行委托物流快递服务商
deliveryTypeList.deliveryTypeValue=1
【
发货基本信息查询接口
】接口获取信息expressCompanyList.isSupport=false的物流公司

SHEIN集成的区域车队服务商
deliveryTypeList.deliveryTypeValue=2，且存在motorcadeList.isSupport=true
【
发货基本信息查询接口
】接口获取信息motorcadeList.isSupport=true的车队

商家自行委托的车队服务商
deliveryTypeList.deliveryTypeValue=2，且存在motorcadeList.isSupport=false
【
发货基本信息查询接口
】接口获取信息motorcadeList.isSupport=false的车队

       2.4.3 通过【查询收货仓信息】接口获取配送的仓库地址信息；

       2.4.4 通过【创建发货单】接口发货；

   2.5 打印发货单面单

      2.5.1  通过【发货单维度打印面单】打印；

  2.6 获取发货单信息

      2.6.1  通过【发货单变更通知】获取变更信息；

      2.6.2  通过【查询发货单列表】获取发货单信息；

## 
六、常见问题

Q：同一个商家可能会同时存在多种备货单吗？

A：会同时存在多种备货单

Q：备货单会有多个商品吗？

A：急采和备货都只含一个SKC

Q：可以合并备货单发货吗？

A：相同模式的备货单一般情况下可以合并发货（除SHEIN预估收货仓、安检标签值不一样等场景）；

Q：备货单可以拆单发货吗？

A：急采模式不允许拆单发货，但可以少发（只发一部分，剩下的会被自动取消）；备货模式部分场景允许拆单发货，当部分发货后剩下不发的sku数量>=20会生成一个新的备货单即拆单成功，当剩下的sku数量<20，则不拆单直接作废剩余sku

Q：备货单被退回如何处理？

A：备货单被退回后，备货单状态会修改成“已退货”状态，商家可以针对该备货单重新发货或作废；已退货的备货单可重发的窗口期，急采类型的取退货时间+1天，备货类型的取退货时间+14天；

Q：备货单和发货单是1:1的关系吗？

A：1:N。如果备货单已退货再重新发货的场景，备货单会关联旧发货单和新发货单

## 
七、接口以及webhook清单

API清单

API名称
接口说明

订单接口-获取采购单信息
商家可以通过此接口，获取SHEIN方已经下单的采购单信息，包括急采订单和备货订单

发货基本信息查询接口
获取发货基本信息，包含商家发货地址

物流产品查询
获取和SHEIN后台可选范围一致的物流方式（包含全国性物流和区域性物流）

查shein合作物流预估运费
通过该接口查询shein合作物流的预估运费，适用于全托管、shein自营模式；

创建发货单
创建发货单进行发货

打印商品条码
获取sku对应的条码文件，适用于备货时需要粘贴SHEIN条码的商家

收货仓信息查询
根据备货单查送货的目的地信息（平台收货仓信息）

查询发货单列表
可以获取发货单信息，可以按需选择是否打印发货单，平台无要求

发货单维度打印面单
可以通过此接口，获取需要打印的物流面单、箱唛

获取全量环保耗材信息（新）
获取全量的耗材材质和耗材类型（也即sku外包装的类型和材质）

合规标签打印
此接口支持打印合规相关的标签，包括：环保标签、GPSR标签、GPSR和环保标结合的标签、商家自定义标签。

Webhook清单

消息名称
说明

发货变更通知
发货单变更消息通知

采购单通知
采购单状态变更消息通知

## 解决方案 / 全托管解决方案 / 库存管理-全托管

- Page ID：`fe87780a-a3c4-46c3-a1bc-0e80bc5dea7b`
- 路径：`https://open.sheincorp.com/documents/system/fe87780a-a3c4-46c3-a1bc-0e80bc5dea7b`
- 简介：该方案适用于修改 代运营（又名全托管、简易平台）和SHEIN自营商家的库存数量

## 
一. 概述

该方案适用于修改 代运营（又名全托管、简易平台）和SHEIN自营商家的库存数量。主要目的是帮助开发者实现商家的库存同步和库存预占。针对以上场景，我们提供了以下接口：

接口名称
接口
接口描述

采购商库存更新
/open-api/goods/stock-update
更新 SHEIN 后台的商家仓库存。此操作将影响消费者可见的可售库存。在虚拟销售模式下，同步的库存数量为消费者可见的可售库存；在实际销售模式下，同步的库存数量加上 SHEIN 仓的实际库存数量等于消费者可见的可售库存。

库存查询
/open-api/stock/stock-query
查询库存数

推送缺货需求库存
/out_of_stock_notice
通知全托管（代运营）ERP 平台关于店铺商品的缺货情况，以便ERP在生成采购单前提前锁定库存

## 
二. 方案说明

### 
1、
更新库存说明：

字段说明：

字段
是否必填
说明

skc
是
平台生成的SKC；相当于商品发布的skc_name

shein_sku
是
平台生成的SKU；相当于商品发布的skc_code

available_number
是
商品总库存数量，更新后会覆盖原有的总库存数

remark
否
备注，不超过100个字符

stock_type
是
默认传3，全量覆盖

接口入参示例：

{ "stock": [{ "stock_type": 3, "skc": "sx2410224003123100", "shein_sku": "I83ty0f2d502", "available_number": 18 }, { "stock_type": 3, "skc": "sx2410224003123100", "shein_sku": "I83ty0f2h5hc", "available_number": 16 }, { "stock_type": 3, "skc": "sx2410224003123100", "shein_sku": "I83ty0f2ks18", "available_number": 7 }, { "stock_type": 3, "skc": "sx2410224003123100", "shein_sku": "I83ty0f2o8d4", "available_number": 0 }{ "stock_type": 3, "skc": "sx2410220100534309", "shein_sku": "I83txx7ku2my", "available_number": 12 }, { "stock_type": 3, "skc": "sx2410220100534309", "shein_sku": "I83txx7kyffc", "available_number": 8 }, { "stock_type": 3, "skc": "sx2410220100534309", "shein_sku": "I83txx7l2vdw", "available_number": 1 }, { "stock_type": 3, "skc": "sx2410220100534309", "shein_sku": "I83txx7l6a2o", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410221254070290", "shein_sku": "I23txvm9lzi4", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410221254070290", "shein_sku": "I23txvm9qgsn", "available_number": 4 }, { "stock_type": 3, "skc": "sx2410221254070290", "shein_sku": "I23txvm96qgl", "available_number": 12 }, { "stock_type": 3, "skc": "sx2410221254070290", "shein_sku": "I23txvm9aryk", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410221254070290", "shein_sku": "I23txvm9emg9", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410221254070290", "shein_sku": "I23txvm9i56p", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410221254034919", "shein_sku": "I23txvmbfoe9", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410221254034919", "shein_sku": "I23txvmbjrjf", "available_number": 4 }, { "stock_type": 3, "skc": "sx2410221254034919", "shein_sku": "I23txvmavt8m", "available_number": 12 }, { "stock_type": 3, "skc": "sx2410221254034919", "shein_sku": "I23txvmb0jj8", "available_number": 6 }, { "stock_type": 3, "skc": "sx2410221254034919", "shein_sku": "I23txvmb4qxl", "available_number": 4 }, { "stock_type": 3, "skc": "sx2410221254034919", "shein_sku": "I23txvmbarhr", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410221254011559", "shein_sku": "I23txvmd3fup", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410221254011559", "shein_sku": "I23txvmd7gcl", "available_number": 1 }, { "stock_type": 3, "skc": "sx2410221254011559", "shein_sku": "I23txvmcj05d", "available_number": 1 }, { "stock_type": 3, "skc": "sx2410221254011559", "shein_sku": "I23txvmcnkfh", "available_number": 6 }, { "stock_type": 3, "skc": "sx2410221254011559", "shein_sku": "I23txvmcsr69", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410221254011559", "shein_sku": "I23txvmcymd2", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410221254075505", "shein_sku": "I23txvmdzc81", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410222799301842", "shein_sku": "I13xg8k2fsea", "available_number": 8 }, { "stock_type": 3, "skc": "sx2410222799301842", "shein_sku": "I13xg8k2ldy1", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410222799301842", "shein_sku": "I13xg8k2rs9p", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410222799336681", "shein_sku": "I13xg8k3t5tr", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410222799343532", "shein_sku": "I13xg8k4nh8r", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410222799346161", "shein_sku": "I13xg8k5q5cc", "available_number": 1 }, { "stock_type": 3, "skc": "sx2410222799346161", "shein_sku": "I13xg8k5uf66", "available_number": 7 }, { "stock_type": 3, "skc": "sx2410222799346161", "shein_sku": "I13xg8k55pi5", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410222799346161", "shein_sku": "I13xg8k5a7ge", "available_number": 12 }, { "stock_type": 3, "skc": "sx2410222799346161", "shein_sku": "I13xg8k5ezw6", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410222799346161", "shein_sku": "I13xg8k5kavv", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410222799344440", "shein_sku": "I13xg8k6krmx", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410222799344440", "shein_sku": "I13xg8k6orhm", "available_number": 8 }, { "stock_type": 3, "skc": "sx2410222799344440", "shein_sku": "I13xg8k64fmt", "available_number": 10 }, { "stock_type": 3, "skc": "sx2410222799344440", "shein_sku": "I13xg8k67yqg", "available_number": 8 }, { "stock_type": 3, "skc": "sx2410222799344440", "shein_sku": "I13xg8k6dudg", "available_number": 5 }, { "stock_type": 3, "skc": "sx2410222799344440", "shein_sku": "I13xg8k6hoxy", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410235191171176", "shein_sku": "I33ulkf11oph", "available_number": 1 }, { "stock_type": 3, "skc": "sx2410235191171176", "shein_sku": "I33ulkf16pez", "available_number": 25 }, { "stock_type": 3, "skc": "sx2410235191171176", "shein_sku": "I33ulkf0g2bc", "available_number": 42 }, { "stock_type": 3, "skc": "sx2410235191171176", "shein_sku": "I33ulkf0mf9t", "available_number": 48 }, { "stock_type": 3, "skc": "sx2410235191171176", "shein_sku": "I33ulkf0qyki", "available_number": 9 }, { "stock_type": 3, "skc": "sx2410235191171176", "shein_sku": "I33ulkf0w10s", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410235191116114", "shein_sku": "I33ulkf27799", "available_number": 0 }, { "stock_type": 3, "skc": "sx2410235191116114", "shein_sku": "I33ulkf2dwfz", "available_number": 4 }, { "stock_type": 3, "skc": "sx2410235191116114", "shein_sku": "I33ulkf1fsuw", "available_number": 8 }, { "stock_type": 3, "skc": "sx2410235191164731", "shein_sku": "I33ulkf49jar", "available_number": 0 }] }
接口出参示例：

{ "code": "0", "msg": "OK", "info": { "batch_number": "202412251833184", "fail_num": 0, "fail_list": [ ] }, "bbl": null, "traceId": "185259a2759646b2" }

### 

### 
2、预占库存
：

场景：
在实际操作中，商家通常会在多个平台上同时售卖同一批货物。为了避免出现超卖或断码的情况，SHEIN 平台提供了库存预占功能。通过该功能，商家可以对其商品进行预占库存，从而确保在多个平台间的库存管理更加规范和高效

举例说明：

商品总库存
SHEIN平台库存
预占库存
其他平台库存
其他平台预占
...

10000
5000
3000
3000
2000
...

目前平台提供了两种预占库存的方式：

a）webhook消息通知
，
点击查看详情

Event Code:  /out_of_stock_notice；以下是该消息的推送流程：

Webhook 消息通知可在以下具体场景中触发：

     ●  
客户下单/付款，且 SHEIN 仓无库存时：当消费者下单或付款，但 SHEIN 仓库中已无库存的情况下，会触发通知。

     ● 
未付款缺货需求数有变动时：这种情况常见于 SHEIN 仓库无库存时，消费者进行下单或取消订单所导致的缺货需求数变化。当未付款的订单数量发生变化时，将发送通知。

     ● 
已付款缺货需求数有变动时：在 SHEIN 仓库无库存的情况下，如果消费者完成付款或者取消已付款订单，系统将会告知相关缺货需求数量的变化

webhook字段说明

参数名称
描述
备注

sendTimestamp
事件发生时间
建议保存该时间，当接收到消息后比较推送时间和保存的时间，若版本较老则丢弃处理；

tempLockExceptionQty
未付款缺货需求数
该字段不会由于生成采购单而更新数据；消费者下单或取消订单会更新该数字。

outOfStockQty
已付款缺货需求数
该数字将在上午 6 点和下午 2 点转成采购单数量，同时数据更新后会推送给 ERP。消费者付款会更新该数字

skcName
SHEIN 平台生成的SKC

skuCode
SHEIN 平台生成的SKU

推送数据示例

eventData:"{\"outOfStockQty\":0,\"sendTimestamp\":1725357735472,\"skcName\":\"sw2212205439442765\",\"skuCode\":\"I13ikm28pyqg\",\"tempLockExceptionQty\":11}"

b、接口查询，具体触发场景如下：

接口：/open-api/stock/stock-query

字段说明

入参

参数名称
必填
描述

skuCodeList
是
sku列表（不超过200个）

warehouseType
是
传3

出参

参数名称
描述

totalOutOfStockQty
总缺货需求数（未转急采单的数量）

skuCode
平台生成的SKU；相当于商品发布的skc_code

## 

## 
三、FAQ

 1、 
遇到以下报错如何处理

报错信息
：“请在SHEIN全球商家平台开启同步库存”

处理方式
：引导商家进入shein系统后台开启库存同步开关

## 解决方案 / 全托管解决方案 / 定制业务接入解决方案

- Page ID：`689a45fd-95c4-485d-bd30-e16e3ffbf163`
- 路径：`https://open.sheincorp.com/documents/system/689a45fd-95c4-485d-bd30-e16e3ffbf163`
- 简介：用于指引开发者接入个性化定制商品的业务

## 
适用角色

本文档将帮助开发者接入个性化定制业务，实现个性化定制类商品的订单获取，合成图片，
获取用户定制数据等功能。

## 
业务介绍

开发者可以获取定制商品的信息来完成定制业务，整体业务流程如下：

## 
概念&名词解释

名词
名词解释

个性化定制
指商品类目中有“个性化”一类的商品，支持买家个性化定制的业务类型。

采购单
指用户已经在平台下单成功，并向商家生成采购单，商家可根据采购单的信息来生产定制商品。

定制商品
指支持个性化定制的商品，包含定制图案，样式等信息。

模版id
指定制商品的“设计模版”的id，商家发布定制商品时可以自定义设计模版。

模版任务
指按照设计模版和用户上传的定制信息，生产合成图片的任务。

## 
接口调用流程

调用流程说明：

    1. 获取采购单，对应商家后台的订单页面，可以查询当前需要发货的订单。

        

    2. 获取模版数据，需要使用采购单查询获得的定制商品id（customInfoId）来查询商品对应的模版id（compositeId），对应商家后台，商品定制的设计模版，设计模版由商家创建。

         

    3. 获取定制数据，可以查看当前订单的的定制信息，定制信息由用户下单时填写。对应商家后台，查看定制信息页面。

         

## 
相关接口以及webhook清单

接口名称
接口地址
接口说明

订单接口-获取采购单信息
/open-api/order/purchase-order-infos
获取采购单信息拿到定制商品id（customInfoId）

获取定制数据 V1
/open-api/ccst/v1/custom-infos
使用定制商品id（customInfoId）查询定制数据

获取模版数据V1
/open-api/ccst/v1/custom-info/templates
使用采购单上的定制商品id（customInfoId）查询模版id（compositeId）

创建⽣产模板任务V1
/open-api/ccst/v1/composite/task
使用定制商品id（customInfoId）+ 模版id（compositeId）生成最终定制生产任务，需要异步查询结果

查询任务结果V1
/open-api/ccst/v1/composite/queryTask
使用/ccst/composite/task获取的任务id查询最终定制的商品信息

商品打印条码
/open-api/goods/print-barcode
打印商品条码，需要关注定制商品输出的是二维码编码值（customCodingList）如果多次调用打印商品条码的接口，则以最新的二维码编码值为准，旧的二维码编码值将失效。

##

## 解决方案 / 全托管解决方案 / 备货至海外仓解决方案

- Page ID：`ba0cb66d-aad2-40d2-bd59-58da2b676711`
- 路径：`https://open.sheincorp.com/documents/system/ba0cb66d-aad2-40d2-bd59-58da2b676711`

## 
一、场景说明

目前支持商家备货到SHEIN的海外仓库，海外仓库支持“直送”和“集货”两种模式，“直送”模式下，商家需要填写装箱明细。

“集货”模式下，商家可以先发货到SHEIN集货仓，再发往海外仓库（两段物流），商家不需要自行填写装箱明细，由SHEIN集货仓填写装箱明细。

商家可以通过订单号查询
发货基本信息查询接口
，发货路径：hasShippingRoute，用于判断集货路径（直送，集货），hasShippingRoute = 2时支持集货路径。

名词
定义

直送
由商家直接发货到SHEIN美国仓库（一段物流），商家需要自行填写装箱明细。

集货
由商家先发货到SHEIN集货仓，再发往美国仓库（两段物流），商家不需要自行填写装箱明细，由集货仓填写装箱明细。

装箱明细
指备货单发货时填写的每个箱子的明细

发货路径及送货方式说明：

发货路径
送货方式
下单方式​
​场景说明

直送
SHEIN合作物流
目前暂不支持
直送的场景下，商家需要将货物发货到SHEIN美国仓库。在发货前商家需要填写每个包裹详细的订单信息，并打印面单后发出。

自行委托第三方
SHEIN代下单（选择货代）

商家自行下单

集货（第一段物流）
SHEIN合作物流
SHEIN代下单（选择车队）
集货的场景下，商家需要将货物发货到SHEIN指定的仓库，由仓库质检后贴面单，再发送到美国仓库。因此集货会有两段物流：1、商家发货到SHEIN集货仓；2、SHEIN集货仓发货到SHEIN美国仓。集货模式下，商家不需要填写每一箱的装箱明细信息。

自行委托第三方
SHEIN代下单（选择车队）

集货（第二段物流）
自行委托第三方
SHEIN代下单

## 
二、接口调用说明

接口调用顺序：

集货模式相关接口说明：

接口名称
接口地址
​
接口说明

获取采购单信息
/open-api/order/purchase-order-infos
用于查询备货单（采购单）详情

​查询发货基本信息
​/open-api/shipping/basic
通过订单号查询发货信息，关键入参：orderType，addressId。发货方式：hasShippingRoute，用于判断集货路径（直送，集货）。hasShippingRoute = 2，则支持集货。

​创建发货单
​/open-api/shipping/orderToShipping
创建发货单，在创建之前需要商家确认：1、发货地址，发货仓库，发货路径2、发货方式，物流下单方式，物流信息3、新增装箱明细（如果是直送需要商家填写，如果是集货则不需要填写装箱明细）

查询发货单接口
​/open-api/shipping/delivery
​查询发货单，新增装箱明细，发货路径信息

​修改发货单接口
/open-api/shipping/modify-delivery-order-info
修改发货单，已经发货的订单无法修改发货方式，可以修改装箱明细

​收货仓信息查询
​/open-api/shipping/warehouse
​根据订单查询仓库id，仓库名称和地址可以查询集货仓地址

​打印发货单
​/open-api/pfmp/printDeliveryDetail
​打印发货单，发货单样式如下：

​查询货代信息
​/open-api/pfmp/shipping/thirdPartyAndChannelList
用于查询货代信息，供商家选择使用货代服务

打印面单（订单维度）
/open-api/shipping/delivery/print-package
根据发货单号打印面单，创建发货单后可打印面单。如果发货单中有装箱明细的信息，则打印的面单里面会展示装箱明细：

## 解决方案 / 全托管解决方案 / 商品合规

- Page ID：`af751fbf-0a24-484a-98fe-377654bd62d7`
- 路径：`https://open.sheincorp.com/documents/system/af751fbf-0a24-484a-98fe-377654bd62d7`

# 
商品合规

# 
方案概述

- 
若商品需销往欧盟、美国、英国等地区，商家需按当地要求提供相关证明。此方案会介绍如何将证明提供给平台。

- 
此方案适用于所有类型的应用。

# 
业务流程

目前API层支持2个合规场景：

- 
商品绑定代理公司：可覆盖GPSR欧盟责任人、美国代理、英国代理、制造商

- 
商品上传标签实拍图：可覆盖欧洲的环保、GPSR等标签要求

# 
调用概览

类型
名称
文档

API
查询代理公司列表
/open-api/goods-compliance/agency-list

API
查询SKC的代理公司绑定要求
/open-api/goods-compliance/skc-agency-detail

API
绑定SKC和代理公司
/open-api/goods-compliance/save-skc-agency

API
查询SKC的实拍图要求
/open-api/goods-compliance/skc-label-list

API
打印合规标签
/open-api/goods-compliance/label-print

API
上传实拍图图片
/open-api/goods-compliance/upload-skc-label-picture

API
绑定SKC和实拍图
/open-api/goods-compliance/skc-save-label

# 
具体场景

## 
商品绑定代理公司

步骤1：查询已申报的代理公司

- 
目前API不支持申报代理公司，需商家先通过商家后台手动完成申报。

- 
通过接口可查询到商家已申报的代理公司信息，接口地址：
/open-api/goods-compliance/agency-list

- 
代理公司相关的重要字段和规则：

- 
哪些代理公司是有效的，可以和商品绑定的？agencyStatus=0，且applyStatus=1/2的代理公司

字段名
字段说明

agencyId
代理公司ID。

后续商品绑定代理公司时会使用。

agencyType
代理公司类型：0-欧盟责任人；1-英国代理；2-美国代理；3-制造商。

后续商品绑定代理公司时会使用。

agencyStatus
代理公司的协议生效状态：0-生效中，1-已过期，2-未生效。

applyStatus
代理公司申报状态：0-待补充；1-待审核（商家后台此状态会展示申报成功）；2-申报成功；3-审核失败。

coveredProductRange
代理公司可覆盖的商品范围：1-全部商品；2-部分商品。

范围=“全部商品”时，系统会默认所有SKC都绑定该公司，即有新增发品不需要再次单独绑定；

范围=““部分商品”时，需要商家自行绑定SKC和公司的关系。

步骤2：查询商品需要绑定哪些类型的代理公司

- 
不是所有商品都需要绑定代理公司，需绑定公司的商品可能需绑定多个类型的代理公司。平台会根据商品类目、销售地区等信息，判断出哪些商品需要绑定哪些类型的代理公司。商家需按要求提供，若无法及时提供，会导致商品无法上架或被强制下架。

- 
通过接口可查询到哪些商品需要绑定哪些代理公司，以及当前商品的公司绑定状态，接口地址：
/open-api/goods-compliance/skc-agency-detail

- 
建议将商品必须绑定的代理公司全部绑定，以避免商品异常，操作方法如下：

- 
入参：
查询商品有哪些必要绑定信息：isRequired=1

- 
出参：

- 
找到SKC下未绑定或绑定失败的代理公司，稍后进行绑定：reviewState=1/3

- 
确认SKC需要绑定的代理公司类型agencyType，然后从步骤1中获得的已申报的代理公司中，找到相同type且有效的agencyId

步骤3：绑定商品和代理公司

- 
通过接口绑定，接口地址：
/open-api/goods-compliance/save-skc-agency

- 
绑定时使用的agencyId、agencyType，需要从步骤1中获取。

## 
商品上传标签实拍图

步骤1：查询商品的实拍图上传要求

- 
实拍图上传的是商品实物图片、商品包装上贴标的图片。图片中需要体现出各地区对参数、环保、GPSR相关要求的信息要素。

- 
不是所有商品都需要上传实拍图，需传图的商品在实拍图中需要展示的信息有很多类型。上传图片后系统会扫描图片自动识别信息，若图片中未包含指定信息的话，实拍图绑定失败，会导致商品无法上架或被强制下架。

- 
通过接口可查询到哪些商品需要在实拍图中体现哪些信息元素，以及当前商品的实拍图绑定状态，接口地址：
/open-api/goods-compliance/skc-label-list

- 
建议将商品必须绑定的信息要素全部拍摄并上传，以避免商品异常，操作方法如下

- 
入参：
查询商品有哪些必要绑定信息：isRequired=1

- 
出参：

- 
找到SKC下实拍图中未绑定成功的信息，稍后进行绑定：reviewState=0/3。注意：reviewState=1是待审核，此状态在商家后台展示为申报成功。实拍图是异步审核，所以上传后展示申报成功，异步发现失败后才变成失败状态。可对接消息通知及时发现审核失败。

- 
确认SKC需要在实拍图中体现的信息，将他们都打印成标签：labelName

步骤2：打印商品标签

- 
基于SKC，打印出SKC可打印的所有标签。平台会预设一批标签模板，如果预设模板不符合预期，商家需通过商家后台手动绘制标签模板，然后再通过API打印。

- 
打印接口地址：
/open-api/goods-compliance/label-print

步骤3：上传实拍图图片

- 
标签打印后贴到商品包装上，拍摄实拍图后需先上传图片。实拍图有单独的图片上传API，请不要使用商品发布中的图片上传接口。

- 
上传图片接口地址：
/open-api/goods-compliance/upload-skc-label-picture

步骤4：绑定商品和实拍图

- 
实拍图绑定在SKC维度。每个SKC可绑定多张实拍图，最多15张。图片长宽均不能超过8000px、大小不超过10M，支持png/jpeg/jpg格式。

- 
绑定接口：
/open-api/goods-compliance/skc-save-label

## 

## 
监听商品绑定的合规信息失效

- 
此消息目前可监听的场景

- 
SKC绑定的代理公司失效：主要由代理公司自身失效导致，如代理有效期到期。失效后，和代理公司有绑定关系的SKC均会发出失效的通知。

- 
SKC上传的实拍图失效：主要由于实拍图审核失败导致，实拍图非实时审核。

- 
消息地址： 
https://open.sheincorp.com/documents/msgdoc/detail/3001095
 

complianceTypeId
信息类型

1
欧盟代理公司

3
实拍图
