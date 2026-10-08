"""Apply narrow, checked edits to the CURRENT Apps Script Codice.gs export."""
from pathlib import Path
import re
import sys

source = Path(sys.argv[1]).read_text()

def replace(old, new):
    global source
    if source.count(old) != 1:
        raise RuntimeError('Expected one matching integration anchor: ' + old[:100])
    source = source.replace(old, new)

replace('function doGet(e) {', "function doGet(e) {\n  if (e && e.parameter && e.parameter.view === 'paga-quota') {\n    return paginaWebQuotaSumUp_(e.parameter.token);\n  }")
replace('function doPost(e) {', "function doPost(e) {\n  if (e && e.parameter && e.parameter.view === 'sumup-callback') {\n    return sumupQuotaCallback_(e);\n  }")
replace('      sociWebPaymentLink_(expectedAmount);', '      sumupQuotaPrepara_(id, expectedAmount);')
replace("payment = sociWebPaymentLink_(sociWebValue_(member.row, sheets.l, 'Quota prevista'));", "payment = sumupQuotaPrepara_(id, sociWebValue_(member.row, sheets.l, 'Quota prevista'));")
replace('function leggiElencoSociWeb() {\n  controllaAccessoRichiesteWeb_();', 'function leggiElencoSociWeb() {\n  controllaAccessoRichiesteWeb_();\n  sumupQuotaSincronizza_();')
# Protect administrative editor utilities when the same current code is used publicly.
for function in ['setup', 'testInvioAliasInfo', 'testMailContatti', 'testRichiestaSocioConQuota', 'testContattoModulo', 'testAutorizzazioneGmail']:
    replace('function ' + function + '() {', 'function ' + function + '() {\n  controllaAccessoRichiesteWeb_();')

Path(sys.argv[2]).write_text(source)
print('Patched current Codice.gs; all integration anchors matched exactly.')
