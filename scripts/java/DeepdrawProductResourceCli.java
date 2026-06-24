import cn.deepdraw.api.rest.request.v2.ProductGetByIdRequest;
import cn.deepdraw.api.rest.response.DopResponse;
import cn.deepdraw.api.rest.response.Reply;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;

import java.io.ByteArrayOutputStream;

public class DeepdrawProductResourceCli {
  private static String readStdin() throws Exception {
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    byte[] chunk = new byte[8192];
    int read;
    while ((read = System.in.read(chunk)) != -1) {
      buffer.write(chunk, 0, read);
    }
    return new String(buffer.toByteArray(), "UTF-8");
  }

  private static String text(JSONObject object, String key) {
    String value = object == null ? null : object.getString(key);
    return value == null ? "" : value.trim();
  }

  private static Long longValue(JSONObject object, String key) {
    String value = text(object, key);
    return value.length() == 0 ? null : Long.valueOf(value);
  }

  public static void main(String[] args) throws Exception {
    JSONObject input = JSON.parseObject(readStdin());
    JSONObject config = input.getJSONObject("config");
    JSONObject query = input.getJSONObject("query");

    ProductGetByIdRequest request = new ProductGetByIdRequest(
      text(config, "appKey"),
      text(config, "appSecret"),
      text(config, "dopKey"),
      text(config, "host")
    ).setMerchantId(longValue(config, "merchantId"))
      .setProductCode(text(query, "productCode"));

    if (text(query, "productId").length() > 0) {
      request.setProductId(text(query, "productId"));
    }
    if (text(query, "resource").length() > 0) {
      request.setResource(text(query, "resource"));
    }

    Reply reply = request.execute();
    JSONObject output = new JSONObject(true);
    output.put("status", reply.getStatus());
    DopResponse response = reply.getResponse();
    if (response != null) {
      JSONObject responseJson = new JSONObject(true);
      responseJson.put("code", response.getCode());
      responseJson.put("reason", response.getReason());
      responseJson.put("response", response.getResponse() == null ? null : response.getResponse().toString());
      responseJson.put("requestId", response.getRequestId());
      responseJson.put("timestamp", response.getTimestamp());
      responseJson.put("body", JSON.toJSON(response.getBody()));
      output.put("response", responseJson);
    }
    System.out.println(JSON.toJSONString(output));
  }
}
