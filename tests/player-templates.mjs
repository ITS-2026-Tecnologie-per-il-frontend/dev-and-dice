import assert from 'node:assert/strict'
import { newCharacterSheet, parseCharacterSheets, turnFromSheet } from '../src/utils/CharacterSheets.ts'
import { playerTemplate, sheetTemplates, featuresAtLevel, updateFeaturesAtLevel } from '../src/utils/PlayerTemplates.ts'

const legacy = { ...newCharacterSheet(),name:'Mago precedente',characterClass:'Mago' }
assert.equal(playerTemplate(legacy),'wizard')
assert.equal(playerTemplate({ ...legacy,characterClass:'Guerriero' }),'generic')
assert.equal(playerTemplate({ ...legacy,characterClass:'Nome personale',playerDetails:{'creation.class':'wizard'} }),'wizard')
assert.equal(playerTemplate({ ...legacy,playerDetails:{'sheet.template':'generic'} }),'generic')
assert.equal(playerTemplate({ ...legacy,characterClass:'Guerriero',playerDetails:{'sheet.template':'wizard'} }),'wizard')
assert.equal(playerTemplate({ ...legacy,playerDetails:{'sheet.template':'unknown'} }),'wizard')
assert.equal(sheetTemplates.wizard.pages.length,4)
assert.equal(sheetTemplates.generic.pages.length,3)
const features = 'Spellcasting (livello 1)\nLibro.\n\nArcane Ward (livello 2)\nBarriera.\n\nAbjuration Savant (livello 2)\nCopie.\n\nProjected Ward (livello 6)\nReazione.'
assert.ok(featuresAtLevel(features,2).includes('Arcane Ward'))
assert.ok(featuresAtLevel(features,2).includes('Abjuration Savant'))
assert.ok(!featuresAtLevel(features,2).includes('Projected Ward'))
assert.equal(featuresAtLevel(features,20),'')
const edited = updateFeaturesAtLevel(features,2,'Nuovo privilegio (livello 2)\nEffetto.')
assert.ok(edited.includes('Projected Ward') && edited.includes('Spellcasting'))
assert.ok(!edited.includes('Arcane Ward'))
assert.equal(featuresAtLevel(edited,2),'Nuovo privilegio (livello 2)\nEffetto.')
assert.equal(featuresAtLevel(updateFeaturesAtLevel(features,2,''),2),'')
assert.equal(featuresAtLevel(updateFeaturesAtLevel(features,2,'Testo libero'),2),'Privilegio di classe (livello 2)\nTesto libero')
const sheet = { ...legacy,hitPoints:'20',playerDetails:{'sheet.template':'wizard','classFeatures':edited,'worn.Testa':'Cappello','magicItem.0.name':'Bacchetta','magicItem.0.attuned':'true','favoriteSpell.0.name':'Scudo','favoriteSpell.0.level':'1','inventory.0.2':'3','slots.1.used':'2'} }
assert.deepEqual(parseCharacterSheets(JSON.stringify([sheet]))[0],sheet)
assert.deepEqual(turnFromSheet(sheet,1).sheet.playerDetails,sheet.playerDetails)
const generic = { ...sheet,playerDetails:{...sheet.playerDetails,'sheet.template':'generic'} }
assert.equal(playerTemplate(generic),'generic')
assert.equal(generic.playerDetails['worn.Testa'],'Cappello','Changing only the template must preserve class-specific details')
console.log('Template checks passed: automatic/explicit selection, four pages, privilege editing, persistence and combat data.')
