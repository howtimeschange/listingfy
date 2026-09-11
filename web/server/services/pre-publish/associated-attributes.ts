import { requestSheinWithCredentialsAndRetry } from '../../../../scripts/lib/shein_client.mjs'
import type { SheinCredentials } from '../../lib/platform-config'

export type AssociatedRule = { attribute_id: number; allowed_value_ids: number[] }
export function parseAssociatedRules(payload: unknown, groupId: string): AssociatedRule[] {
  const result = payload as { code?: unknown; msg?: string; info?: { data?: Array<{ group_id?: unknown; link_rule_attribute_list?: Array<{ attribute_id?: unknown; attribute_value_list?: unknown[]; attribute_value_pre_fill_list?: unknown[] }> }> } }
  if (String(result?.code) !== '0') throw new Error(result?.msg || 'SHEIN 关联属性查询失败')
  const group = result.info?.data?.find((item) => String(item.group_id) === groupId)
  if (!group || (group.link_rule_attribute_list != null && !Array.isArray(group.link_rule_attribute_list))) throw new Error('SHEIN 未返回当前商品的关联属性规则，请重试')
  return (group.link_rule_attribute_list ?? []).map((item) => {
    const id = Number(item.attribute_id)
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('SHEIN 关联属性 ID 无效')
    return { attribute_id: id, allowed_value_ids: [...new Set([
      ...(item.attribute_value_list ?? []), ...(item.attribute_value_pre_fill_list ?? []),
    ].map(Number))] }
  })
}
export async function queryAssociatedRules(credentials: SheinCredentials, categoryId: number, productTypeId: number, attributes: Array<Record<string, unknown>>) {
  const groupId = 'listing'
  const response = await requestSheinWithCredentialsAndRetry('/open-api/goods/get-associated-attribute-rules', {
    credentials, timeoutMs: 15000,
    body: { get_linked_rule_req_list: [{ group_id: groupId, category_id: categoryId, product_type_id: productTypeId,
      attribute_list: attributes.map(({ attribute_id, attribute_value_id }) => ({ attribute_id, ...(attribute_value_id ? { attribute_value_id } : {}) })),
    }] },
  })
  if (!response.ok) throw new Error(`SHEIN 关联属性查询失败（HTTP ${response.status}）`)
  return parseAssociatedRules(response.payload, groupId)
}
export function associatedAttributeErrors(rules: AssociatedRule[], attributes: Array<Record<string, unknown>>, label: (id: number) => string) {
  return rules.flatMap((rule) => {
    const values = attributes.filter((item) => Number(item.attribute_id) === rule.attribute_id)
    if (!values.length) return [`商品属性「${label(rule.attribute_id)}」为当前属性组合触发的必填项`]
    if (rule.allowed_value_ids.length && values.some((item) => !rule.allowed_value_ids.includes(Number(item.attribute_value_id)))) {
      return [`商品属性「${label(rule.attribute_id)}」不在当前关联规则允许的取值范围内`]
    }
    return []
  })
}
