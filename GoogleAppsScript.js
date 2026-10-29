// 제공해주신 스프레드시트 ID
var SPREADSHEET_ID = "1wWyD3F-JkafniQeayENJ79mlM19S1Tniv7NsVnxI2aM";

function getTargetSheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    return SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
  }
  return SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
}

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var sheet = getTargetSheet();
    initSheetIfNotExists(sheet);

    
    var action = e.parameter.action;
    var data = null;
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter;
      }
    } else {
      data = e.parameter;
    }
    
    if (!action && data && data.action) {
      action = data.action;
    }
    
    var result = { success: false };
    
    if (action === "read") {
      result = readNotes(sheet);
    } else if (action === "create") {
      result = createNote(sheet, data);
    } else if (action === "update") {
      result = updateNote(sheet, data);
    } else if (action === "delete") {
      result = deleteNote(sheet, data);
    } else if (action === "reorder") {
      result = reorderNotes(sheet, data);
    } else {
      result = readNotes(sheet);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function initSheetIfNotExists(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "timestamp", 
      "datetime", 
      "category", 
      "content", 
      "color", 
      "state", 
      "order"
    ]);
  }
}

function readNotes(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return { success: true, notes: [] };
  }
  
  var notes = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0] && !r[1] && !r[3]) continue; // 빈 줄 건너뛰기
    notes.push({
      rowIndex: i + 1,
      timestamp: r[0],
      datetime: r[1],
      category: r[2],
      content: r[3],
      color: r[4],
      state: r[5],
      order: r[6]
    });
  }
  
  notes.sort(function(a, b) {
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  });
  
  return { success: true, notes: notes };
}

function createNote(sheet, data) {
  var now = new Date();
  var timestampStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  var dtStr = data.datetime || timestampStr;
  var orderVal = Number(data.order) || (sheet.getLastRow());
  
  sheet.appendRow([
    timestampStr,
    dtStr,
    data.category || "기타",
    data.content || "",
    data.color !== undefined ? data.color : 0,
    data.state || "진행중",
    orderVal
  ]);
  
  return { success: true, message: "Created successfully" };
}

function updateNote(sheet, data) {
  var rows = sheet.getDataRange().getValues();
  var targetRow = -1;
  
  for (var i = 1; i < rows.length; i++) {
    // datetime이나 rowIndex로 식별
    if (data.rowIndex && Number(data.rowIndex) === i + 1) {
      targetRow = i + 1;
      break;
    } else if (data.datetime && String(rows[i][1]) === String(data.datetime)) {
      targetRow = i + 1;
      break;
    }
  }
  
  if (targetRow === -1) {
    return { success: false, error: "Note not found" };
  }
  
  var now = new Date();
  var timestampStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  sheet.getRange(targetRow, 1).setValue(timestampStr);
  
  if (data.category !== undefined) sheet.getRange(targetRow, 3).setValue(data.category);
  if (data.content !== undefined) sheet.getRange(targetRow, 4).setValue(data.content);
  if (data.color !== undefined) sheet.getRange(targetRow, 5).setValue(data.color);
  if (data.state !== undefined) sheet.getRange(targetRow, 6).setValue(data.state);
  if (data.order !== undefined) sheet.getRange(targetRow, 7).setValue(data.order);
  
  return { success: true, message: "Updated successfully" };
}

function deleteNote(sheet, data) {
  var rows = sheet.getDataRange().getValues();
  var targetRow = -1;
  
  for (var i = 1; i < rows.length; i++) {
    if (data.rowIndex && Number(data.rowIndex) === i + 1) {
      targetRow = i + 1;
      break;
    } else if (data.datetime && String(rows[i][1]) === String(data.datetime)) {
      targetRow = i + 1;
      break;
    }
  }
  
  if (targetRow === -1) {
    return { success: false, error: "Note not found to delete" };
  }
  
  sheet.deleteRow(targetRow);
  return { success: true, message: "Deleted successfully" };
}

function reorderNotes(sheet, data) {
  // data.orders = [{ datetime: "...", order: 1 }, ...]
  if (!data.orders || !data.orders.length) {
    return { success: false, error: "No orders array" };
  }
  
  var rows = sheet.getDataRange().getValues();
  var orderMap = {};
  for (var k = 0; k < data.orders.length; k++) {
    orderMap[String(data.orders[k].datetime)] = data.orders[k].order;
  }
  
  for (var i = 1; i < rows.length; i++) {
    var dt = String(rows[i][1]);
    if (orderMap[dt] !== undefined) {
      sheet.getRange(i + 1, 7).setValue(orderMap[dt]);
    }
  }
  
  return { success: true, message: "Reordered successfully" };
}
