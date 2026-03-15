/**
 * player_test.ts — JobCertInstance + createPlayerUnit 驗證
 *
 * 驗證：
 *   1. warrior.json schema 完整性
 *   2. rollJobCert：產生合法範圍內的 instance
 *   3. createPlayerUnit + instance：deterministic（無 rng）
 *   4. 相同 instance → 相同 Unit（不論 rng）
 *   5. mage MP 公式正確
 *   6. ranger SP 公式正確
 *   7. 種子化 rollJobCert 可重現
 *   8. WARRIOR_CERT fixture 數值驗證（base + min bonus）
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { rollJobCert, createPlayerUnit } from '../player'
import type { JobCertDef } from '../player'
import { WARRIOR_CERT, MAGE_CERT, RANGER_CERT } from './fixtures'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else           { console.error(`  ❌ ${label}`); failed++ }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '../../data/job_certs')

function loadJobCert(filename: string): JobCertDef {
  return JSON.parse(readFileSync(join(dataDir, filename), 'utf-8')) as JobCertDef
}

function makeSeededRng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0x100000000
  }
}

// ─── 載入 JSON ────────────────────────────────────────────────────────────────

const warriorDef = loadJobCert('warrior.json')
const mageDef    = loadJobCert('mage.json')
const rangerDef  = loadJobCert('ranger.json')

// ─── Test 1：warrior.json schema 完整性 ─────────────────────────────────────

console.log('\n【Test 1】warrior.json schema 完整性')

assert(warriorDef.id === 'warrior',              'id = warrior')
assert(warriorDef.tier === 'basic',              'tier = basic')
assert(Array.isArray(warriorDef.tags),           'tags 是陣列')
assert(warriorDef.allowedArmorTypes.includes('重甲'), 'allowedArmorTypes 含重甲')
assert(typeof warriorDef.stats.str.base === 'number',              'stats.str.base 是數字')
assert(typeof warriorDef.stats.str.randomBonus.max === 'number',   'randomBonus.max 是數字')
assert(typeof warriorDef.resources.hp.strMult === 'number',        'resources.hp.strMult 是數字')
assert(typeof warriorDef.moveRange === 'number',                   'moveRange 是數字')

// ─── Test 2：rollJobCert — 產生合法範圍的 instance ───────────────────────────

console.log('\n【Test 2】rollJobCert 屬性範圍驗證')

const inst = rollJobCert(warriorDef, 'test_inst_1', makeSeededRng(42))

assert(inst.defId === 'warrior',   'defId = warrior')
assert(inst.instanceId === 'test_inst_1', 'instanceId 正確')

const strMin = warriorDef.stats.str.base + warriorDef.stats.str.randomBonus.min
const strMax = warriorDef.stats.str.base + warriorDef.stats.str.randomBonus.max
assert(inst.rolledStats.str >= strMin && inst.rolledStats.str <= strMax,
  `rolledStats.str=${inst.rolledStats.str} 在 [${strMin}, ${strMax}]`)

const agiMin = warriorDef.stats.agi.base + warriorDef.stats.agi.randomBonus.min
const agiMax = warriorDef.stats.agi.base + warriorDef.stats.agi.randomBonus.max
assert(inst.rolledStats.agi >= agiMin && inst.rolledStats.agi <= agiMax,
  `rolledStats.agi=${inst.rolledStats.agi} 在 [${agiMin}, ${agiMax}]`)

// ─── Test 3：createPlayerUnit + instance → deterministic ─────────────────────

console.log('\n【Test 3】instance → createPlayerUnit deterministic')

const unit1 = createPlayerUnit({ id: 'u1', jobCertDef: warriorDef, jobCertInstance: inst, pos: { x: 3, y: 3 } })
const unit2 = createPlayerUnit({ id: 'u2', jobCertDef: warriorDef, jobCertInstance: inst, pos: { x: 3, y: 3 }, rng: makeSeededRng(9999) })

assert(unit1.stats.str === inst.rolledStats.str, `unit.stats.str = instance.str（${inst.rolledStats.str}）`)
assert(unit1.stats.str === unit2.stats.str,      '兩次建立 str 相同（instance 凍結）')
assert(unit1.maxHP     === unit2.maxHP,          '兩次建立 maxHP 相同')
assert(unit1.kind === 'player',                  'kind = player')
assert(unit1.jobId === 'warrior',                'jobId = warrior')
assert(unit1.jobCertInstanceId === 'test_inst_1', 'jobCertInstanceId 正確')

// ─── Test 4：不同 instance → 不同 Unit（個體差異）──────────────────────────

console.log('\n【Test 4】不同 instance 個體差異')

const instA = rollJobCert(warriorDef, 'cert_A', makeSeededRng(1))
const instB = rollJobCert(warriorDef, 'cert_B', makeSeededRng(999))
const unitA = createPlayerUnit({ id: 'uA', jobCertDef: warriorDef, jobCertInstance: instA, pos: { x: 0, y: 0 } })
const unitB = createPlayerUnit({ id: 'uB', jobCertDef: warriorDef, jobCertInstance: instB, pos: { x: 0, y: 0 } })

const statsDiffer = unitA.stats.str !== unitB.stats.str
                 || unitA.stats.agi !== unitB.stats.agi
                 || unitA.stats.int !== unitB.stats.int
                 || unitA.stats.lck !== unitB.stats.lck
assert(statsDiffer, '不同 seed 的 instance 產生不同屬性（個體差異）')

// ─── Test 5：mage — MP 公式正確 ───────────────────────────────────────────────

console.log('\n【Test 5】mage MP 公式（instance）')

const mageInst = rollJobCert(mageDef, 'mage_inst', makeSeededRng(77))
const mage = createPlayerUnit({ id: 'p_mage', jobCertDef: mageDef, jobCertInstance: mageInst, pos: { x: 1, y: 1 } })

const expectedMP = Math.round(mageDef.resources.mp.base + mageInst.rolledStats.int * (mageDef.resources.mp.intMult ?? 0))
assert(mage.maxMP === expectedMP,
  `maxMP=${mage.maxMP} = ${mageDef.resources.mp.base} + ${mageInst.rolledStats.int} × ${mageDef.resources.mp.intMult} = ${expectedMP}`)

const mIntMin = mageDef.stats.int.base + mageDef.stats.int.randomBonus.min
const mIntMax = mageDef.stats.int.base + mageDef.stats.int.randomBonus.max
const mpMin = Math.round(mageDef.resources.mp.base + mIntMin * (mageDef.resources.mp.intMult ?? 0))
const mpMax = Math.round(mageDef.resources.mp.base + mIntMax * (mageDef.resources.mp.intMult ?? 0))
assert(mage.maxMP >= mpMin && mage.maxMP <= mpMax,
  `maxMP=${mage.maxMP} 在合法範圍 [${mpMin}, ${mpMax}]`)

// ─── Test 6：ranger — SP 公式正確 ─────────────────────────────────────────────

console.log('\n【Test 6】ranger SP 公式（instance）')

const rangerInst = rollJobCert(rangerDef, 'ranger_inst', makeSeededRng(99))
const ranger = createPlayerUnit({ id: 'p_ranger', jobCertDef: rangerDef, jobCertInstance: rangerInst, pos: { x: 5, y: 5 } })

const expectedSP = Math.round(rangerDef.resources.sp.base + rangerInst.rolledStats.agi * (rangerDef.resources.sp.agiMult ?? 0))
assert(ranger.maxSP === expectedSP,
  `maxSP=${ranger.maxSP} = ${rangerDef.resources.sp.base} + ${rangerInst.rolledStats.agi} × ${rangerDef.resources.sp.agiMult}`)

// ─── Test 7：種子化 rollJobCert 可重現 ───────────────────────────────────────

console.log('\n【Test 7】相同 seed → 相同 instance')

const r1 = rollJobCert(warriorDef, 'r1', makeSeededRng(1234))
const r2 = rollJobCert(warriorDef, 'r2', makeSeededRng(1234))

assert(r1.rolledStats.str === r2.rolledStats.str, `str 一致（${r1.rolledStats.str}）`)
assert(r1.rolledStats.agi === r2.rolledStats.agi, `agi 一致（${r1.rolledStats.agi}）`)
assert(r1.rolledStats.int === r2.rolledStats.int, `int 一致（${r1.rolledStats.int}）`)
assert(r1.rolledStats.lck === r2.rolledStats.lck, `lck 一致（${r1.rolledStats.lck}）`)

// ─── Test 8：WARRIOR_CERT fixture 驗證（base + min bonus）────────────────────

console.log('\n【Test 8】fixtures.ts 預設 WARRIOR_CERT / MAGE_CERT / RANGER_CERT')

// WARRIOR_CERT: str=20(base) agi=10 int=5 lck=8  → HP=80+20*2=120
assert(WARRIOR_CERT.defId === 'warrior',    'WARRIOR_CERT.defId')
assert(WARRIOR_CERT.rolledStats.str === warriorDef.stats.str.base + warriorDef.stats.str.randomBonus.min,
  `WARRIOR_CERT.str = base + min = ${WARRIOR_CERT.rolledStats.str}`)

const wUnit = createPlayerUnit({ id: 'w', jobCertDef: warriorDef, jobCertInstance: WARRIOR_CERT, pos: { x: 0, y: 0 } })
const expectedWHP = Math.round(warriorDef.resources.hp.base + WARRIOR_CERT.rolledStats.str * (warriorDef.resources.hp.strMult ?? 0))
assert(wUnit.maxHP === expectedWHP, `WARRIOR_CERT → maxHP=${wUnit.maxHP}（= ${expectedWHP}）`)

// MAGE_CERT: int=24 → MP=50+24*3=122
assert(MAGE_CERT.defId === 'mage', 'MAGE_CERT.defId')
const mUnit = createPlayerUnit({ id: 'm', jobCertDef: mageDef, jobCertInstance: MAGE_CERT, pos: { x: 0, y: 0 } })
const expectedMMP = Math.round(mageDef.resources.mp.base + MAGE_CERT.rolledStats.int * (mageDef.resources.mp.intMult ?? 0))
assert(mUnit.maxMP === expectedMMP, `MAGE_CERT → maxMP=${mUnit.maxMP}（= ${expectedMMP}）`)

// RANGER_CERT: agi=22 → SP=60+22*2=104
assert(RANGER_CERT.defId === 'ranger', 'RANGER_CERT.defId')
const rUnit = createPlayerUnit({ id: 'r', jobCertDef: rangerDef, jobCertInstance: RANGER_CERT, pos: { x: 0, y: 0 } })
const expectedRSP = Math.round(rangerDef.resources.sp.base + RANGER_CERT.rolledStats.agi * (rangerDef.resources.sp.agiMult ?? 0))
assert(rUnit.maxSP === expectedRSP, `RANGER_CERT → maxSP=${rUnit.maxSP}（= ${expectedRSP}）`)

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) process.exit(1)
