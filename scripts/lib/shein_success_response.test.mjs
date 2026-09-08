import assert from "node:assert/strict";
import test from "node:test";
import { isSheinSuccessResult } from "./shein_client.mjs";

test("SHEIN writes require a valid business success receipt, not just HTTP 200", () => {
  for (const payload of [null, undefined, "", "<html>gateway error</html>", {}, [], {code:""}, {code:false}, {code:"error",msg:"rejected"}]) {
    assert.equal(isSheinSuccessResult({status:200,payload}),false,JSON.stringify(payload));
  }
  for(const code of ["0",0]) {
    assert.equal(isSheinSuccessResult({status:200,payload:{code}}),true);
    assert.equal(isSheinSuccessResult({status:500,payload:{code}}),false);
  }
});


test("unknown lifecycle write receipts cannot be blindly retried, while reads and explicit rejections can", async () => {
  const {assertLifecycleOperationRetryable}=await import("../../web/server/services/shein-platform-products.ts");
  for(const operation_type of ["FIELD_EDIT_PRODUCT","PARTIAL_EDIT_PRODUCT","ADD_VARIANTS","UPDATE_COST","REVOKE_PRODUCT","RETRY_ADD_VARIANTS"]) {
    assert.throws(()=>assertLifecycleOperationRetryable({status:"FAILED",operation_type,response_code:null}),/结果未知/);
  }
  assert.doesNotThrow(()=>assertLifecycleOperationRetryable({status:"FAILED",operation_type:"SYNC_PRODUCT_DETAIL",response_code:null}));
  assert.doesNotThrow(()=>assertLifecycleOperationRetryable({status:"FAILED",operation_type:"UPDATE_COST",response_code:"INVALID_COST"}));
});
