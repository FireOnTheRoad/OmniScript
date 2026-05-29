type MessageFn = (content: string) => void

let _success: MessageFn = () => {}
let _error: MessageFn = () => {}
let _info: MessageFn = () => {}

export function initMessageApi(success: MessageFn, error: MessageFn, info: MessageFn): void {
  _success = success
  _error = error
  _info = info
}

export function notify(): { success: MessageFn; error: MessageFn; info: MessageFn } {
  return { success: _success, error: _error, info: _info }
}
