import { readFileSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { Session } from 'node:inspector'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { randomCharacter } from '../src/utils/RandomCharacter.ts'
import { translatedCreationData, withWizardCatalog } from '../src/utils/PlayerCreation.ts'
import { parseCatalog } from '../src/utils/Catalog.ts'

const json = (name) => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'))
const catalog = parseCatalog(json('database'))
const data = translatedCreationData(withWizardCatalog({...json('character-options'),...json('character-equipment'),skills:json('character-rules').skills,experienceThresholds:json('character-rules').experienceThresholds},json('wizard-catalog')),catalog)
function seeded(seed) { return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32 } }
const server = await createServer({server:{middlewareMode:true},appType:'custom'})
const result = { measurement:'React server rendering of spell page: CPU work and markup; excludes browser DOM, layout and network', cases:[] }
const profiler = new Session()
profiler.connect()
const post = (method) => new Promise((resolve,reject) => profiler.post(method,(error,value) => error ? reject(error) : resolve(value)))
try {
    const { PlayerSheet } = await server.ssrLoadModule('/src/components/PlayerSheet.tsx')
    for (const [characterClass,level,templates] of [['wizard',1,['generic','wizard','wizard-pdf']],['wizard',17,['generic','wizard','wizard-pdf']],['cleric',17,['generic']]]) {
        const base = randomCharacter(data,{characterClass,race:'human',level,skipReview:true},seeded(42))
        for (const template of templates) {
            const sheet={...base,playerDetails:{...base.playerDetails,'sheet.template':template}}
            const render = (page,source=sheet) => renderToStaticMarkup(createElement(PlayerSheet,{sheet:source,creationData:data,catalog,onChange:()=>{},exportPage:page}))
            const start=performance.now();render(1);const page2Ms=performance.now()-start
            const times=[]
            let html=''
            await post('Profiler.enable');await post('Profiler.start')
            for (let i=0;i<3;i++) { const started=performance.now();html=render(2);times.push(performance.now()-started) }
            const {profile}=await post('Profiler.stop')
            const samples=new Map()
            for (const id of profile.samples ?? []) samples.set(id,(samples.get(id) ?? 0)+1)
            const functions=new Map()
            for (const node of profile.nodes) { const name=node.callFrame.functionName || '(anonymous)';functions.set(name,(functions.get(name) ?? 0)+(samples.get(node.id) ?? 0)) }
            const root=Object.keys(sheet.playerDetails).find((key) => /^spell\.[1-9]\.\d+\.name$/.test(key))?.slice(0,-5)
            const changed={...sheet,playerDetails:{...sheet.playerDetails,...(root ? {[`${root}.prepared`]:sheet.playerDetails[`${root}.prepared`]==='true' ? 'false' : 'true'} : {}),'slots.1.used':'1'}}
            const editStart=performance.now();render(2,changed);const editMs=performance.now()-editStart
            const row={characterClass,level,template,savedSpells:Object.keys(sheet.playerDetails).filter((key)=>/^spell\.\d+\.\d+\.name$/.test(key)).length,page2Ms,spellPageMs:times,medianMs:[...times].sort((a,b)=>a-b)[1],editMs,rows:(html.match(/class="player-spell-entry"/g) ?? []).length,options:(html.match(/<option/g) ?? []).length,topSamples:[...functions].sort((a,b)=>b[1]-a[1]).slice(0,8)}
            result.cases.push(row)
            console.log(JSON.stringify(row))
        }
    }
    if (process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n')
} finally { profiler.disconnect();await server.close() }
