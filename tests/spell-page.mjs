import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { parseCatalog, sheetWithCombatSpells } from '../src/utils/Catalog.ts'
import { newCharacterSheet, parseCharacterSheets } from '../src/utils/CharacterSheets.ts'
import { applyCreation, characterFieldValue, spellRules, spellSelection, translatedCreationData, updateCharacterField, withWizardCatalog } from '../src/utils/PlayerCreation.ts'
import { randomCharacter } from '../src/utils/RandomCharacter.ts'
import { favoriteSpellCapacity, favoriteSpellOptions, favoriteSpellSlots, setFavoriteSpell, hasOtherSpell, spellNameLookup, spellNameRoots } from '../src/utils/SpellPage.ts'
import { spellRowState } from '../src/utils/Spellcasting.ts'

const json = (name) => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'))
const catalog=parseCatalog(json('database'))
const data=translatedCreationData(withWizardCatalog({...json('character-options'),...json('character-equipment'),skills:json('character-rules').skills},json('wizard-catalog')),catalog)
const label=spellNameLookup(catalog)
const oldLabel=(name) => catalog.abilities.find((entry)=>typeof entry.data.level==='number' && Array.isArray(entry.data.aliases) && entry.data.aliases.some((alias)=>typeof alias==='string' && alias.toLowerCase()===name.toLowerCase()))?.name ?? name
for (const entry of catalog.abilities) for (const alias of entry.data.aliases ?? []) if (typeof alias==='string') assert.equal(label(alias.toUpperCase()),oldLabel(alias.toUpperCase()))
assert.equal(label('Magia personale'),'Magia personale')
assert.equal(spellNameLookup()('Fireball'),'Fireball')
assert.equal(spellNameLookup({abilities:[{name:'Prima',data:{level:1,aliases:['Alias']}},{name:'Seconda',data:{level:2,aliases:['alias']}}]})('ALIAS'),'Prima')
let aliasReads=0
const indexedLabel=spellNameLookup({abilities:[{name:'Magia',data:{level:1,get aliases() {aliasReads++;return ['Spell']} }}]})
const initialReads=aliasReads
for (let i=0;i<1000;i++) assert.equal(indexedLabel('SPELL'),'Magia')
assert.equal(aliasReads,initialReads,'Repeated option lookups must not rescan the catalogue')
assert.ok(!hasOtherSpell(new Set(),'spell.1.0'))

let manual={...newCharacterSheet(),name:'Mago',characterClass:'Mago',level:'17',playerDetails:{'spell.1.0.name':'Fireball','spell.1.1.name':'Fireball','spell.1.2.name':'Fireball','spell.1.2.source':'item'}}
let roots=spellNameRoots(manual,label)
assert.ok(hasOtherSpell(roots.get('class').get(label('Fireball')),'spell.1.0'))
assert.ok(!hasOtherSpell(roots.get('item').get(label('Fireball')),'spell.1.2'),'A spell from a different source is independently selectable')
manual=updateCharacterField(manual,'spell.1.1.name','')
roots=spellNameRoots(manual,label)
assert.ok(!hasOtherSpell(roots.get('class').get(label('Fireball')),'spell.1.0'),'Clearing a duplicate must immediately free its option')
assert.ok(hasOtherSpell(roots.get('class').get(label('Fireball')),'spell.1.1'))

const favoriteSeed={...newCharacterSheet(),name:'Preferiti',playerDetails:{
    'spell.1.0.name':'Shield','spell.1.0.index':'shield','spell.1.0.prepared':'false',
    'spell.1.1.name':label('Shield'),'spell.1.1.source':'item',
    'spell.0.0.name':'Fire Bolt','spell.0.0.index':'fire-bolt',
    'spell.1.7.name':'Magia personale','slots.1.used':'2','favoriteSpell.0.effect':'Appunti manuali da conservare',
}}
assert.equal(favoriteSpellOptions(favoriteSeed,catalog).length,3,'The picker lists owned spells and collapses duplicate sources and translated aliases')
assert.equal(favoriteSpellOptions(favoriteSeed,catalog)[0].level,0)
const favored=setFavoriteSpell(favoriteSeed,'spell.1.1',data,catalog)
assert.equal(favored.playerDetails['favoriteSpell.1.name'],label('Shield'),'A partial manual favorite occupies its slot')
assert.equal(favored.playerDetails['favoriteSpell.0.effect'],'Appunti manuali da conservare')
assert.equal(favored.playerDetails['favoriteSpell.1.level'],'1')
assert.ok(favored.playerDetails['favoriteSpell.1.castingTime'])
assert.ok(favored.playerDetails['favoriteSpell.1.components'].includes('V'))
assert.ok(favored.playerDetails['favoriteSpell.1.effect'])
assert.deepEqual(Object.fromEntries(Object.entries(favored.playerDetails).filter(([key])=>!key.startsWith('favoriteSpell.1.'))),favoriteSeed.playerDetails,'Favorites do not change preparation, spell ownership, notes or spent slots')
assert.equal(parseCharacterSheets(JSON.stringify([favored]))[0].playerDetails['favoriteSpell.1.name'],label('Shield'))
assert.throws(()=>setFavoriteSpell(favored,'spell.1.0',data,catalog),/già/)
assert.throws(()=>setFavoriteSpell(favored,'spell.9.99',data,catalog),/presente/)
for (const index of [-1,7,1.5,NaN]) assert.throws(()=>setFavoriteSpell(favored,'spell.0.0',data,catalog,index),/non valido/)
const full={...favoriteSeed,playerDetails:{...favoriteSeed.playerDetails,...Object.fromEntries(Array.from({length:favoriteSpellCapacity},(_,i)=>[`favoriteSpell.${i}.name`,`Preferito ${i}`]))}}
const fullBefore=JSON.stringify(full)
assert.throws(()=>setFavoriteSpell(full,'spell.0.0',data,catalog),/occupati/)
assert.equal(JSON.stringify(full),fullBefore,'A full list is never overwritten by Add to favorites')
const replaced=setFavoriteSpell(full,'spell.0.0',data,catalog,3)
assert.equal(replaced.playerDetails['favoriteSpell.3.name'],label('Fire Bolt'),'Choosing a slot explicitly replaces only that favorite')
assert.equal(replaced.playerDetails['favoriteSpell.2.name'],'Preferito 2')
assert.equal(setFavoriteSpell(favoriteSeed,'spell.1.7').playerDetails['favoriteSpell.1.name'],'Magia personale','Custom spells remain selectable without a catalog')
assert.equal(favoriteSpellSlots({...newCharacterSheet(),playerDetails:{'favoriteSpell.0.ritual':'false'}})[0].occupied,false)
const granted={...favoriteSeed,playerDetails:{...favoriteSeed.playerDetails,spellGrants:JSON.stringify([{index:'light',name:'Light',level:0,source:'racial',note:'Trucchetto razziale'}])}}
assert.equal(favoriteSpellOptions(granted,catalog).length,4,'Granted racial and subclass spells are also owned spells')
assert.equal(setFavoriteSpell(granted,'grant:light',data,catalog).playerDetails['favoriteSpell.1.name'],label('Light'))
assert.throws(()=>setFavoriteSpell(granted,'grant:unknown',data,catalog),/presente/)

function seeded(seed) { return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32 } }
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try {
    const {PlayerSheet}=await server.ssrLoadModule('/src/components/PlayerSheet.tsx')
    for (const template of ['generic','wizard','wizard-pdf']) {
        let sheet=randomCharacter(data,{characterClass:'wizard',race:'human',level:17,skipReview:true},seeded(42))
        sheet={...sheet,playerDetails:{...sheet.playerDetails,'sheet.template':template}}
        const original=JSON.stringify(sheet)
        const render=(source)=>renderToStaticMarkup(createElement(PlayerSheet,{sheet:source,catalog,creationData:data,exportPage:2,onChange:()=>{}}))
        const html=render(sheet)
        if (template!=='generic') {
            assert.ok(html.includes('Aggiungi ai preferiti'),'The spell details menu offers favorites')
            const fullMarkup=render({...sheet,playerDetails:{...sheet.playerDetails,...Object.fromEntries(Array.from({length:favoriteSpellCapacity},(_,i)=>[`favoriteSpell.${i}.name`,`Preferito ${i}`]))}})
            assert.ok(fullMarkup.includes('Tutti i 7 posti sono occupati'),'Full favorites explain how to free a slot')
        }
        assert.equal(JSON.stringify(sheet),original,'Rendering must not mutate saved character data')
        assert.equal((html.match(/class="player-spell-entry"/g) ?? []).length,72,'Retain every existing row and the page layout')
        const candidate=spellRules(sheet,data).spells.find((spell)=>spell.level===1)
        const edited={...sheet,playerDetails:{...sheet.playerDetails,'spell.1.0.name':candidate.nameIt ?? candidate.name,'spell.1.0.index':candidate.index,'spell.1.0.prepared':'true','spell.1.0.source':'class'}}
        const updated=applyCreation(updateCharacterField(edited,'slots.1.used','1'),data)
        const reopened=parseCharacterSheets(JSON.stringify([updated]))[0]
        assert.equal(characterFieldValue(reopened,'slots.1.used'),'1')
        assert.equal(spellRowState(reopened,1,0).checked,true)
        assert.ok(sheetWithCombatSpells({...reopened,abilities:[]},catalog).abilities.some((spell)=>spell.name===label(candidate.name)))
        assert.ok(render(reopened).includes(`value="${label(candidate.name)}"`),'Edited spell choices must survive saving and rendering')
        assert.ok(Number.isFinite(spellSelection(reopened,data).prepared))
    }
} finally { await server.close() }
console.log('Spell page checks passed: translations, duplicates, favorites and seven-slot capacity, catalog details, manual notes, preparation, slots, layout, persistence and combat spells.')
