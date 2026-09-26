import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import {
  SUMMARY_TYPES,
  buildSummaryPayload,
  changeSummaryModule,
  createSummaryGenerationController,
  formatSummarySource,
  normalizeSummaryResponse,
  summaryErrorMessage,
} from './summary.js'

function response(overrides = {}) {
  return {
    summary_type: 'standard', title: 'Grounded Summary', overview: 'Backend overview',
    key_points: [{ text: 'First key point', source_ids: ['S1'] }],
    important_terms: [{ term: 'Term', definition: 'Definition', source_ids: ['S1'] }],
    concept_relationships: [],
    sources: [{ source_id: 'S1', chunk_id: 'chunk-1', lecture_title: 'Lecture One', page_number: 8 }],
    ...overrides,
  }
}

test('default payload uses all modules, all lectures, and standard type', () => {
  assert.deepEqual(buildSummaryPayload(), { module_id: null, lecture_id: null, summary_type: 'standard' })
})

test('selected module and lecture IDs are sent exactly', () => {
  assert.deepEqual(buildSummaryPayload({ moduleId: 'module-1', lectureId: 'lecture-2' }), {
    module_id: 'module-1', lecture_id: 'lecture-2', summary_type: 'standard',
  })
})

test('changing module clears an incompatible lecture', () => {
  assert.deepEqual(changeSummaryModule('module-2'), { selectedModuleId: 'module-2', selectedLectureId: '' })
})

test('short, standard, and detailed map exactly while invalid types are rejected', () => {
  for (const summaryType of SUMMARY_TYPES) assert.equal(buildSummaryPayload({ summaryType }).summary_type, summaryType)
  assert.throws(() => buildSummaryPayload({ summaryType: 'long' }), /valid summary type/)
})

test('successful standard summary preserves all backend-provided display sections', () => {
  const summary = normalizeSummaryResponse(response())
  assert.equal(summary.title, 'Grounded Summary')
  assert.equal(summary.overview, 'Backend overview')
  assert.equal(summary.key_points[0].text, 'First key point')
  assert.equal(summary.important_terms[0].definition, 'Definition')
  assert.equal(summary.sources[0].source_id, 'S1')
})

test('short summary with empty optional sections stays clean', () => {
  const summary = normalizeSummaryResponse(response({ summary_type: 'short', important_terms: [], concept_relationships: [] }))
  assert.deepEqual(summary.important_terms, [])
  assert.deepEqual(summary.concept_relationships, [])
})

test('detailed concept relationships remain available for rendering', () => {
  const relationships = [{ text: 'A supports B', source_ids: ['S1'] }]
  assert.deepEqual(normalizeSummaryResponse(response({ summary_type: 'detailed', concept_relationships: relationships })).concept_relationships, relationships)
})

test('invalid optional sections normalize to empty arrays without crashing', () => {
  const summary = normalizeSummaryResponse(response({ important_terms: null, concept_relationships: 'bad', sources: undefined }))
  assert.deepEqual(summary.important_terms, [])
  assert.deepEqual(summary.concept_relationships, [])
  assert.deepEqual(summary.sources, [])
})

test('PDF source shows its real page and null page shows no fabricated page', () => {
  assert.equal(formatSummarySource(response().sources[0]), 'S1 · Lecture One · Page 8')
  const label = formatSummarySource({ source_id: 'S2', lecture_title: 'Notes', page_number: null })
  assert.equal(label, 'S2 · Notes')
  assert.equal(label.includes('Page 1'), false)
})

test('422 and 502 produce safe messages without response content', () => {
  assert.match(summaryErrorMessage({ status: 422 }), /Not enough study material/)
  assert.match(summaryErrorMessage({ status: 422 }), /Upload more lecture material/)
  assert.equal(summaryErrorMessage({ status: 502, message: 'provider stack trace' }), 'The summary service is temporarily unavailable.')
})

test('only one authenticated generation request starts while active', async () => {
  let release
  let calls = 0
  let capturedToken
  const pending = new Promise((resolve) => { release = resolve })
  const controller = createSummaryGenerationController()
  const args = { payload: buildSummaryPayload(), token: 'access-token', request: async (_payload, token) => {
    calls += 1; capturedToken = token; await pending; return response()
  } }
  const first = controller.generate(args)
  assert.deepEqual(await controller.generate(args), { started: false })
  assert.equal(calls, 1)
  assert.equal(capturedToken, 'access-token')
  release()
  assert.equal((await first).response.title, 'Grounded Summary')
})

test('summary page uses safe React rendering and exposes loading controls', async () => {
  const source = await readFile(path.resolve(import.meta.dirname, 'SummaryPage.jsx'), 'utf8')
  assert.equal(source.includes('dangerouslySetInnerHTML'), false)
  assert.match(source, /Generating summary from your study materials\.\.\./)
  assert.match(source, /disabled=\{generating\}/)
  assert.match(source, /important_terms\.length > 0/)
  assert.match(source, /concept_relationships\.length > 0/)
})
