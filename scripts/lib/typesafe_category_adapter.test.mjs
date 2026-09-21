import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryAdviceRequest,requestCategoryAdvice,validateCategoryAdvice} from './typesafe_category_adapter.mjs';
import {shouldRequestCategoryAdvice,categoryCandidateMatchesFacts} from './deepdraw_category_advice_policy.mjs';
const facts={officialCategory:['童鞋/皮靴'],gender:['女'],age:['中童']};
const request=categoryAdviceRequest(facts,[{trade_id:'533',trade_path:'童鞋/靴子'}]);
const payload={answers:{category:{type:'choice',choice:'533',confidence:.9,probabilities:{533:.9,NEEDS_REVIEW:.1}}}};
test('rejects unknown ids, missing probabilities and invalid confidence',()=>{
 assert.equal(validateCategoryAdvice(payload,request).choice,'533');
 for(const patch of [{choice:'bad'},{probabilities:{533:1}},{confidence:NaN}]) assert.throws(()=>validateCategoryAdvice({answers:{category:{...payload.answers.category,...patch}}},request));
 assert.throws(()=>categoryAdviceRequest({officialCategory:['皮靴','板鞋']},[]));
});
test('dedicated endpoint and sanitized transport errors',async()=>{
 const result=await requestCategoryAdvice(request,{apiKey:'secret',fetchImpl:async(url,options)=>{assert.equal(url,'https://api.typesafe.ai/v1/systemone');assert.equal(options.headers.Authorization,'Bearer secret');return new Response(JSON.stringify(payload));}});
 assert.equal(result.answer.choice,'533');
 await assert.rejects(requestCategoryAdvice(request,{apiKey:'secret',fetchImpl:async()=>{throw new Error('secret')}}),/^Error: typesafe_transport_failure$/);
});
test('rules and human decisions bypass model; actual facts restrict candidates',()=>{
 assert.equal(shouldRequestCategoryAdvice({status:'auto_applied',reasonCode:'unique_high_confidence'},facts),false);
 assert.equal(shouldRequestCategoryAdvice({status:'human_adjusted',reasonCode:'ambiguous_match'},facts),false);
 assert.equal(shouldRequestCategoryAdvice({status:'manual_selection_required',reasonCode:'ambiguous_match'},facts),true);
 assert.equal(categoryCandidateMatchesFacts({trade_path:'童鞋/男童鞋/靴子'},facts),false);
 assert.equal(categoryCandidateMatchesFacts({trade_path:'童鞋/女童鞋/靴子'},facts),true);
 assert.equal(categoryCandidateMatchesFacts({trade_path:'童装婴幼儿服装/婴童配件/帽子'},{officialCategory:['帽子'],age:['中童']}),false);
});
