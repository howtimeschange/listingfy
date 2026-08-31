import cn.deepdraw.api.model.dp.basic.DpField;
import cn.deepdraw.api.model.dp.basic.FieldType;
import cn.deepdraw.api.model.dp.fieldvalue.DpFieldValue;
import cn.deepdraw.api.model.gpus.GpusProduct;
import cn.deepdraw.api.rest.request.BaseRequest;
import cn.deepdraw.api.rest.request.v2.GpusProductIncrementalUpdateRequest;
import cn.deepdraw.api.rest.response.DopResponse;
import cn.deepdraw.api.rest.response.Reply;
import com.alibaba.cloudapi.sdk.model.ApiRequest;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Method;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

public class DeepdrawGpusProductIncrementalUpdateCli {
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

  private static JSONArray array(JSONObject object, String key) {
    JSONArray value = object == null ? null : object.getJSONArray(key);
    return value == null ? new JSONArray() : value;
  }

  private static Set<String> stringSet(JSONArray array) {
    Set<String> output = new LinkedHashSet<String>();
    if (array == null) return output;
    for (Object value : array) {
      if (value != null && value.toString().trim().length() > 0) {
        output.add(value.toString().trim());
      }
    }
    return output;
  }

  private static Map<String, String> stringMap(JSONObject object) {
    Map<String, String> output = new LinkedHashMap<String, String>();
    if (object == null) return output;
    for (Map.Entry<String, Object> entry : object.entrySet()) {
      if (entry.getKey() != null && entry.getValue() != null) {
        output.put(entry.getKey(), entry.getValue().toString());
      }
    }
    return output;
  }

  private static DpField dpField(JSONObject valueJson) {
    DpField field = new DpField();
    field.setId(text(valueJson, "fieldId"));
    field.setName(text(valueJson, "fieldName"));
    field.setType(FieldType.valueOf(text(valueJson, "fieldType")));
    field.setOptions(stringSet(array(valueJson, "fieldOptions")));
    return field;
  }

  private static DpFieldValue dpFieldValue(JSONObject valueJson) {
    DpFieldValue value = new DpFieldValue();
    value.setField(dpField(valueJson));
    value.setOptions(stringSet(array(valueJson, "options")));
    value.setOptionAliases(stringMap(valueJson.getJSONObject("optionAliases")));
    value.setTexts(stringSet(array(valueJson, "texts")));
    return value;
  }

  private static void setBasicProductFields(GpusProduct product, JSONObject productJson) {
    product.setCode(text(productJson, "code"));
    product.setTitle(text(productJson, "title"));
    product.setRetailPrice(text(productJson, "retailPrice"));
    if (text(productJson, "date").length() > 0) {
      product.setDate(text(productJson, "date"));
    }
    JSONArray siteValues = productJson.getJSONArray("sites");
    if (siteValues == null) siteValues = productJson.getJSONArray("places");
    if (siteValues != null && !siteValues.isEmpty()) {
      product.setSites(stringSet(siteValues));
    }
  }

  private static JSONArray fieldChecks(GpusProduct product) {
    JSONArray output = new JSONArray();
    if (product.getSizes() != null) {
      JSONObject entry = new JSONObject(true);
      entry.put("name", product.getSizes().getField() == null ? null : product.getSizes().getField().getName());
      entry.put("fieldType", product.getSizes().getField() == null ? null : product.getSizes().getField().getType());
      entry.put("check", product.getSizes().check());
      entry.put("slot", "sizes");
      output.add(entry);
    }
    for (DpFieldValue fieldValue : product.getFields()) {
      JSONObject entry = new JSONObject(true);
      entry.put("name", fieldValue.getField() == null ? null : fieldValue.getField().getName());
      entry.put("fieldType", fieldValue.getField() == null ? null : fieldValue.getField().getType());
      entry.put("check", fieldValue.check());
      entry.put("slot", "fields");
      output.add(entry);
    }
    return output;
  }

  public static void main(String[] args) throws Exception {
    JSONObject input = JSON.parseObject(readStdin());
    JSONObject config = input.getJSONObject("config");
    JSONObject productJson = input.getJSONObject("product");

    GpusProduct product = new GpusProduct();
    setBasicProductFields(product, productJson);
    if (productJson.containsKey("sizes") && productJson.getJSONObject("sizes") != null) {
      product.setSizes(dpFieldValue(productJson.getJSONObject("sizes")));
    }
    JSONArray fields = productJson.getJSONArray("fields");
    if (fields != null) {
      for (Object field : fields) {
        if (field instanceof JSONObject) {
          product.addField(dpFieldValue((JSONObject) field));
        }
      }
    }

    GpusProductIncrementalUpdateRequest request = new GpusProductIncrementalUpdateRequest(
      text(config, "appKey"),
      text(config, "appSecret"),
      text(config, "dopKey"),
      text(config, "host")
    ).setProductId(text(input, "productId"));
    request.setProduct(product);

    if ("1".equals(System.getenv("DEEPDRAW_SDK_DUMP_REQUEST"))) {
      Method prepare = BaseRequest.class.getDeclaredMethod("prepare");
      prepare.setAccessible(true);
      prepare.invoke(request);
      ApiRequest apiRequest = request.getApiRequest();
      Set<String> fieldCheckErrors = new HashSet<String>();
      JSONObject dump = new JSONObject(true);
      dump.put("status", 200);
      dump.put("method", apiRequest.getMethod() == null ? null : apiRequest.getMethod().toString());
      dump.put("path", apiRequest.getPath());
      dump.put("query", JSON.toJSON(apiRequest.getQuerys()));
      dump.put("body", apiRequest.getBodyStr() == null ? new String(apiRequest.getBody(), "UTF-8") : apiRequest.getBodyStr());
      dump.put("productCheck", product.check());
      dump.put("sizeCheck", product.checkSizes());
      dump.put("fieldsCheck", product.checkFields(fieldCheckErrors));
      dump.put("fieldCheckErrors", JSON.toJSON(fieldCheckErrors));
      dump.put("fieldChecks", fieldChecks(product));
      System.out.println(JSON.toJSONString(dump));
      return;
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
