import { readFileSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { randomCharacter } from '../src/utils/RandomCharacter.ts'
import { newTutorial } from '../src/utils/CharacterTutorial.ts'
import { withWizardCatalog } from '../src/utils/PlayerCreation.ts'

const json=(name)=>JSON.parse(readFileSync(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'))
const data=withWizardCatalog({...json('character-options'),...json('character-equipment'),skills:json('character-rules').skills},json('wizard-catalog'))
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
function seeded(seed) {return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32}}
const results=[]
try {
    const {CharacterTutorial}=await server.ssrLoadModule('/src/components/CharacterTutorial.tsx')
    for (const [kind,sheet,steps] of [
        ['blank',newTutorial(),[0]],
        ['wizard-1',randomCharacter(data,{characterClass:'wizard',race:'human'},seeded(42)),[0,3,6,7,8]],
        ['wizard-17',randomCharacter(data,{characterClass:'wizard',race:'human',level:17},seeded(42)),[0,6,8]],
    ]) for (const step of steps) {
        const current={...sheet,playerDetails:{...sheet.playerDetails,'tutorial.step':String(step)}}
        const times=[]
        for (let i=0;i<3;i++) {const start=performance.now();renderToStaticMarkup(createElement(CharacterTutorial,{sheet:current,data,onChange:()=>{}}));times.push(performance.now()-start)}
        const row={kind,step,medianMs:[...times].sort((a,b)=>a-b)[1],times};results.push(row);console.log(JSON.stringify(row))
    }
    if (process.argv[2]) writeFileSync(process.argv[2],JSON.stringify({measurement:'React server rendering, median of three runs; excludes browser DOM/layout',cases:results},null,2)+'\n')
} finally {await server.close()}
