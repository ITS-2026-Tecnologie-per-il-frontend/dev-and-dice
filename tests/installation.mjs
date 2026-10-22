// Run: node tests/installation.mjs. Local checkout only; no network or user data.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { loadConfigFromFile } from 'vite'
import { loadActiveDatabase } from '../src/domain/dnd/ActiveRules.ts'
import { randomCharacter } from '../src/utils/RandomCharacter.ts'
import { tutorialIssues } from '../src/utils/CharacterTutorial.ts'

const project = resolve(import.meta.dirname, '..')
const git = promisify(execFile)
const temporary = await mkdtemp(join(tmpdir(), 'dev-and-dice-installation-'))
const checkout = join(temporary, 'checkout')
const originalFetch = globalThis.fetch
const originalFlag = process.env.VITE_AGENTATION
try {
    await git('git', ['clone', '--shared', '--quiet', '--no-checkout', project, checkout])
    await copyFile(join(project, '.gitattributes'), join(checkout, '.gitattributes'))
    await git('git', ['-C', checkout, '-c', 'core.autocrlf=true', 'checkout', '--quiet', 'HEAD', '--', 'public/data'])
    const directory = join(checkout, 'public/data/rules2014')
    const manifest = JSON.parse(await readFile(join(directory, 'RELEASE.json'), 'utf8'))
    for (const [file, hash] of Object.entries(manifest.files)) {
        assert.equal(createHash('sha256').update(await readFile(join(directory, file))).digest('hex'), hash,
            `A Windows checkout must preserve the release bytes: ${file}`)
    }
    globalThis.fetch = async url => new Response(await readFile(join(checkout, 'public', String(url).replace('/fresh-checkout/', ''))))
    const { creationData } = await loadActiveDatabase('/fresh-checkout/')
    assert.ok(creationData.verified, 'The clean checkout must load the verified creation database')
    const sheet = randomCharacter(creationData, { characterClass: 'fighter', race: 'human', level: 1 }, () => 0.5)
    assert.deepEqual(tutorialIssues(sheet, creationData, 8), [], 'The generated character must pass the creation review')

    // Only Vite and its React plugin are visible in this installation: Agentation is absent.
    await mkdir(join(checkout, 'node_modules'))
    for (const dependency of ['vite', '@vitejs']) {
        await symlink(join(project, 'node_modules', dependency), join(checkout, 'node_modules', dependency), 'junction')
    }
    await copyFile(join(project, 'vite.config.ts'), join(checkout, 'vite.config.ts'))
    await copyFile(join(project, 'package.json'), join(checkout, 'package.json'))
    const hasAgentation = config => config.plugins.some(plugin => plugin?.name === 'optional-agentation')
    process.env.VITE_AGENTATION = 'false'
    assert.equal(hasAgentation((await loadConfigFromFile({ command: 'serve', mode: 'development' }, join(checkout, 'vite.config.ts'))).config), false)
    process.env.VITE_AGENTATION = 'true'
    assert.equal(hasAgentation((await loadConfigFromFile({ command: 'serve', mode: 'development' }, join(checkout, 'vite.config.ts'))).config), false,
        'Even an explicit opt-in must allow startup when Agentation is absent')
    assert.equal(hasAgentation((await loadConfigFromFile({ command: 'build', mode: 'production' }, join(project, 'vite.config.ts'))).config), false,
        'Production must exclude developer annotations even when enabled locally')
    console.log('Installation checks passed: Windows checkout hashes, database loading, character generation and optional Agentation.')
} finally {
    globalThis.fetch = originalFetch
    if (originalFlag === undefined) delete process.env.VITE_AGENTATION
    else process.env.VITE_AGENTATION = originalFlag
    await rm(temporary, { recursive: true, force: true })
}
