import { normalizeText, parseJsonArray, parseJsonObject } from "./shared"

export function publishInfo(payload: unknown) {
  const object = parseJsonObject(payload)
  return parseJsonObject(object.info)
}

export function responseCode(payload: unknown) {
  const object = parseJsonObject(payload)
  return normalizeText(object.code)
}

export function responseMessage(payload: unknown) {
  const object = parseJsonObject(payload)
  return normalizeText(object.msg) || normalizeText(object.message)
}

export function publishBusinessValidationErrors(payload: unknown) {
  const info = publishInfo(payload)
  const errors: string[] = []
  for (const key of ["pre_valid_result", "mcc_valid_result"]) {
    for (const item of parseJsonArray(info[key])) {
      const object = parseJsonObject(item)
      const formName = normalizeText(object.form_name) || normalizeText(object.form) || key
      for (const message of parseJsonArray(object.messages)) {
        const text = normalizeText(message)
        if (text) errors.push(`${formName}：${text}`)
      }
    }
  }
  return errors
}
