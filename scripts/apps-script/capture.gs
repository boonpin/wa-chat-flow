/**
 * WA Chat Flow — Google Sheet capture endpoint.
 *
 * Paste this into the sheet you want rows written to:
 *   Extensions → Apps Script → replace Code.gs with this file → Save
 *   Deploy → New deployment → Web app
 *     Execute as:      Me
 *     Who has access:  Anyone
 *   Copy the /exec URL into the tool's "Apps Script URL" field.
 *
 * Set SECRET to the same value as the tool's "Shared secret". The /exec URL is
 * world-callable by design, so the secret is what stops anyone who finds the
 * URL from writing rows.
 *
 * Rows are upserted on conversationId: a customer who repeats their details
 * updates their one row instead of creating a new one each time.
 */

var SECRET = 'CHANGE_ME'

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return json({ ok: false, error: 'Empty request' })

    var payload = JSON.parse(e.postData.contents)

    if (SECRET === 'CHANGE_ME') return json({ ok: false, error: 'SECRET not set in the script' })
    if (payload.secret !== SECRET) return json({ ok: false, error: 'Bad secret' })

    var lock = LockService.getScriptLock()
    // Two customers can finish at the same moment; without the lock they race
    // on the same last row.
    lock.waitLock(20000)
    try {
      return json(writeRow(payload))
    } finally {
      lock.releaseLock()
    }
  } catch (err) {
    return json({ ok: false, error: String(err) })
  }
}

function writeRow(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var name = payload.sheet || 'Sheet1'
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name)

  var labels = Object.keys(payload.values || {})
  var headers = ['Captured At', 'Contact Name', 'Phone'].concat(labels).concat(['Conversation ID'])

  // Write headers on a fresh tab, and widen them if the tool gained a field.
  var existing = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    : []

  if (existing.length === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold')
    sheet.setFrozenRows(1)
    existing = headers
  } else if (headers.length > existing.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold')
    existing = headers
  }

  var row = existing.map(function (header) {
    if (header === 'Captured At') return payload.capturedAt || new Date().toISOString()
    if (header === 'Contact Name') return payload.contactName || ''
    if (header === 'Phone') return payload.contactPhone || ''
    if (header === 'Conversation ID') return payload.conversationId || ''
    var value = (payload.values || {})[header]
    return value === undefined ? '' : value
  })

  var target = findRowByConversation(sheet, existing, payload.conversationId)
  if (target > 0) {
    sheet.getRange(target, 1, 1, row.length).setValues([row])
    return { ok: true, row: target, updated: true }
  }

  sheet.appendRow(row)
  return { ok: true, row: sheet.getLastRow(), updated: false }
}

/** Returns the 1-based row for this conversation, or -1 when it is new. */
function findRowByConversation(sheet, headers, conversationId) {
  if (!conversationId) return -1

  var column = headers.indexOf('Conversation ID') + 1
  if (column === 0 || sheet.getLastRow() < 2) return -1

  var values = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getValues()
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === conversationId) return i + 2
  }
  return -1
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  )
}
