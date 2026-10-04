/**
 * Raccolta anonima dei verbi nel foglio già collegato alla Web App Alma Tellus.
 * Nel doPost esistente, subito dopo la dichiarazione di p, inserire:
 * if (p.form_type === "ozosteam_verbo") return handleOzoSteamVerbPost_(p);
 * Il doPost esistente mantiene il LockService che serializza le scritture.
 */
function handleOzoSteamVerbPost_(p) {
  const requestId = String(p.request_id || "");
  const reply = { type: "ozosteam:verbo", requestId: requestId, saved: false };
  try {
    const verbo = String(p.verbo || "").trim().replace(/\s+/g, " ");
    if (p.website || !/^[a-zA-Z0-9-]{16,100}$/.test(requestId) || verbo.length < 2 || verbo.length > 40) {
      reply.message = "Inserisci un verbo da 2 a 40 caratteri.";
      return ozosteamVerbReply_(reply);
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error("Foglio non collegato");
    let sheet = ss.getSheetByName("Verbi OzoSteam");
    if (!sheet) {
      sheet = ss.insertSheet("Verbi OzoSteam");
      sheet.appendRow(["Data", "Verbo proposto", "ID invio", "Pagina"]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, 4).setFontWeight("bold");
      sheet.setColumnWidth(1, 170);
      sheet.setColumnWidth(2, 220);
      sheet.setColumnWidth(3, 280);
      sheet.setColumnWidth(4, 220);
    }
    const rows = sheet.getLastRow();
    const existing = rows > 1 ? sheet.getRange(2, 3, rows - 1, 1).createTextFinder(requestId).matchEntireCell(true).findNext() : null;
    if (!existing) {
      const safeVerb = /^[=+\-@]/.test(verbo) ? "'" + verbo : verbo;
      const pagina = String(p.pagina || "").slice(0, 120);
      const safePage = /^[=+\-@]/.test(pagina) ? "'" + pagina : pagina;
      sheet.appendRow([new Date(), safeVerb, requestId, safePage]);
      sheet.getRange(sheet.getLastRow(), 1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
      SpreadsheetApp.flush();
    }
    reply.saved = true;
  } catch (error) {
    console.error(error);
    reply.message = "Il verbo non è stato salvato. Riprova tra poco.";
  }
  return ozosteamVerbReply_(reply);
}

function ozosteamVerbReply_(reply) {
  const payload = JSON.stringify(reply).replace(/</g, "\\u003c");
  return htmlOutput_('<!doctype html><html lang="it"><head><meta charset="utf-8"></head><body><script>var reply=' + payload + ';var target=window.parent;for(var i=0;i<5;i++){target.postMessage(reply,"https://almatellus.github.io");if(target===target.parent)break;target=target.parent;}</script></body></html>');
}
