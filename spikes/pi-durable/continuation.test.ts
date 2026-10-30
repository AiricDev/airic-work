/**
 * Pi v1.4.0 capability probes, not production adapters or Agent-quality tests.
 * Run in the pinned upstream checkout as documented in docs/pi-durable-capability-review.md.
 * Every model response comes from fauxProvider; no real model or business service is called.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import { createModels, fauxProvider, fauxAssistantMessage, fauxText, fauxToolCall, Type } from '@earendil-works/pi-ai';
import {
  Harness, MemoryStorage, createRegistry, defineDoc, defineExtension, defineTask, defineTool,
  GenerationTask, hook, LiveDoc, type Conversation, type ConversationId, type Storage, type TaskId,
} from '@earendil-works/pi-durable';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';
import { afterEach, expect, it } from 'vitest';

const harnesses = new Set<Harness>();
const directories = new Set<string>();
afterEach(async () => {
  for (const h of harnesses) await h.close(context);
  harnesses.clear();
  for (const directory of directories) await rm(directory, { recursive: true, force: true });
  directories.clear();
});
const answer = (text: string) => fauxAssistantMessage([fauxText(text)]);
const call = (name: string, arguments_: Record<string, string>, id: string) =>
  fauxAssistantMessage([fauxToolCall(name, arguments_, { id })], { stopReason: 'toolUse' });
const output = (text: string) => [{ type: 'text' as const, text }];
function setup() {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  return { faux, models, registry: createRegistry() };
}
async function open(s: ReturnType<typeof setup>, storage: Storage = new MemoryStorage()) {
  const h = await Harness.open(storage, { models: s.models, registry: s.registry }, context);
  harnesses.add(h);
  const root = await h.root(context, { agent: { model: { provider: 'faux', modelId: 'faux-1' } } });
  return { h, root };
}
async function entries(c: Conversation) {
  return (await c.entries({ order: 'ascending' }, 1000, undefined, context)).items;
}

it('P01 accumulates questions, completes independent work, and resumes B then A at their own tool-result anchors', async () => {
  const s = setup();
  const questions: string[] = [];
  s.registry.install(defineExtension({ name: 'probe.questions', tools: [defineTool({
    name: 'ask', description: 'Record a question', parameters: Type.Object({ part: Type.String() }),
    execute: async ({ part }) => { questions.push(part); return { output: output(`DecisionRequest-${part}`) }; },
  })] }));
  s.faux.setResponses([call('ask', { part: 'A' }, 'ask-A'), call('ask', { part: 'B' }, 'ask-B'), answer('C completed')]);
  const { h, root } = await open(s);
  await (await root.submit({ type: 'input', content: 'Review A, B, C', requestId: 'start' }, context)).wait(context);
  expect(questions).toEqual(['A', 'B']);
  const source = await entries(root);
  const anchor = (id: string) => source.find(e => e.model?.some(m => m.role === 'toolResult' && m.toolCallId === id))!.id;
  const childB = await root.fork(anchor('ask-B'), { ownership: { kind: 'ownerless' } }, context);
  const childA = await root.fork(anchor('ask-A'), { ownership: { kind: 'ownerless' } }, context);
  const aContext = JSON.stringify((await childA.context(context)).messages);
  expect(aContext).toContain('DecisionRequest-A');
  expect(aContext).not.toContain('DecisionRequest-B');
  expect(aContext).not.toContain('C completed');
  s.faux.setResponses([answer('B continued'), answer('A continued')]);
  await (await childB.submit({ type: 'input', content: 'UserDecision B; C is already completed. Only continue B.', requestId: 'decision-B' }, context)).wait(context);
  await (await childA.submit({ type: 'input', content: 'UserDecision A; B and C are already completed. Only continue A.', requestId: 'decision-A' }, context)).wait(context);
  expect(JSON.stringify((await childA.context(context)).messages)).toContain('A continued');
  expect(questions).toEqual(['A', 'B']);
  await h.close(context);
});

it('P02 terminate ends a run without a reset, but mixed tool controls do not terminate', async () => {
  const s = setup();
  const end = defineTool({ name: 'yield', description: 'Yield', parameters: Type.Object({}),
    execute: async () => ({ output: output('yielded'), control: { terminate: true } }) });
  const keep = defineTool({ name: 'keep', description: 'Ordinary tool', parameters: Type.Object({}),
    execute: async () => ({ output: output('kept') }) });
  s.registry.install(defineExtension({ name: 'probe.yield', tools: [end, keep] }));
  const { root } = await open(s);
  s.faux.setResponses([call('yield', {}, 'yield-only')]);
  const first = await (await root.submit({ type: 'input', content: 'First slice' }, context)).wait(context);
  expect(first.status).toBe('done');
  expect((await entries(root)).at(-1)?.kind).toBe('pi.tool-result');
  expect((await entries(root)).some(e => e.kind === 'pi.reset')).toBe(false);
  s.faux.setResponses([
    fauxAssistantMessage([fauxToolCall('yield', {}, { id: 'yield-mixed' }), fauxToolCall('keep', {}, { id: 'keep-mixed' })], { stopReason: 'toolUse' }),
    answer('mixed round continued'),
  ]);
  await (await root.submit({ type: 'input', content: 'Second slice' }, context)).wait(context);
  expect(JSON.stringify((await entries(root)).at(-1)?.model)).toContain('mixed round continued');
});

const Bindings = defineDoc<{ targets: Record<string, ConversationId>; world: number }>({
  kind: 'probe.bindings', version: 1, scope: 'session', initial: () => ({ targets: {}, world: 1 }), checkpointWhen: () => false,
});
const Local = defineDoc<{ value: number }>({
  kind: 'probe.local', version: 1, scope: 'conversation', history: 'rewindable', fork: 'asOf',
  initial: () => ({ value: 1 }), checkpointWhen: () => false,
});
it('P03 atomically binds one fork under retries and reopens SQLite with historical local state plus current shared state', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'airic-pi-probe-'));
  directories.add(directory);
  const path = join(directory, 'pi.sqlite');
  const s = setup();
  let { h, root } = await open(s, await openNodeSqliteStorage(path));
  const at = await root.commit(async tx => {
    await tx.doc(Local, root.id);
    await tx.doc(Bindings);
    return (await tx.appendEntry(root.id, { kind: 'probe.anchor', model: [{ role: 'user', content: 'original question', timestamp: 1 }] })).id;
  }, context);
  await root.commit(async tx => {
    (await tx.doc(Local, root.id)).value = 2;
    (await tx.doc(Bindings)).world = 2;
  }, context);
  const bind = () => h.commit(async tx => {
    const b = await tx.doc(Bindings);
    if (b.targets.inputA !== undefined) return b.targets.inputA;
    const child = await tx.forkConversation(root.id, at, { ownership: { kind: 'ownerless' } });
    b.targets.inputA = child.id;
    return child.id;
  }, context);
  const [a, b] = await Promise.all([bind(), bind()]);
  expect(a).toBe(b);
  await h.close(context);
  ({ h, root } = await open(s, await openNodeSqliteStorage(path)));
  expect((await h.snapshot(Bindings, context))?.targets.inputA).toBe(a);
  expect((await h.snapshot(Bindings, context))?.world).toBe(2);
  expect((await h.snapshot(Local, a, context))?.value).toBe(1);
  const child = (await h.conversation(a, context))!;
  s.faux.setResponses([answer('first'), answer('different conversation')]);
  const one = await child.submit({ type: 'input', content: 'A answer', requestId: 'same-key' }, context);
  await one.wait(context);
  const duplicate = await child.submit({ type: 'input', content: 'A answer', requestId: 'same-key' }, context);
  expect(duplicate.id).toBe(one.id);
  const other = await root.submit({ type: 'input', content: 'not deduplicated across conversations', requestId: 'same-key' }, context);
  expect(other.id).not.toBe(one.id);
  await other.wait(context);
});

const Anchor = defineTask<null, { phase: 'done' }, null>({
  name: 'probe.anchor', version: 1, initial: () => ({ phase: 'done' }),
  phases: { done: (_t, api, c) => api.commit(() => ({ status: 'terminal', outcome: { status: 'completed', result: null } }), c) },
  abort: (_t, api, c) => api.commit(() => ({ status: 'terminal', outcome: { status: 'aborted' } }), c),
});
it('P04 a background ownership anchor survives ordinary root abort but full-scope abort reaches its fork', async () => {
  const s = setup();
  s.registry.install(defineExtension({ name: 'probe.anchor', tasks: [Anchor] }));
  const { h, root } = await open(s);
  const at = await root.commit(async tx => (await tx.appendEntry(root.id, { kind: 'probe.anchor-site' })).id, context);
  const childId = await root.commit(async tx => {
    const anchor = await tx.createTask(Anchor, null, { ownership: { kind: 'conversation' }, background: true });
    return (await tx.forkConversation(root.id, at, { ownership: { kind: 'task', taskId: anchor } })).id;
  }, context);
  let reached!: () => void;
  const entered = new Promise<void>(resolve => { reached = resolve; });
  s.faux.setResponses([(_request, options) => new Promise((_resolve, reject) => {
    reached();
    options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), { once: true });
  })]);
  const child = (await h.conversation(childId, context))!;
  const input = await child.submit({ type: 'input', content: 'hold this scripted request' }, context);
  await entered;
  await root.abort(context);
  expect((await h.snapshot(LiveDoc, child.id, context))?.run).toBeDefined();
  await root.abort(context, { background: true });
  expect((await input.wait(context)).status).toBe('unanswered');
  expect((await h.snapshot(LiveDoc, child.id, context))?.run).toBeUndefined();
  s.faux.setResponses([answer('continued after stop')]);
  expect((await (await child.submit({ type: 'input', content: 'new authorized input after stop', requestId: 'new-generation' }, context)).wait(context)).status).toBe('done');
});

it('P05 afterTools observer exceptions are reported but do not prevent the next model request', async () => {
  const s = setup();
  const reports: unknown[] = [];
  s.registry.install(defineExtension({ name: 'probe.hook',
    tools: [defineTool({ name: 'read', description: 'Read', parameters: Type.Object({}), execute: async () => ({ output: [] }) })],
    hooks: [hook(GenerationTask, { afterTools: () => { throw new Error('anchor write failed'); } })],
  }));
  s.faux.setResponses([call('read', {}, 'read-1'), answer('still continued')]);
  const h = await Harness.open(new MemoryStorage(), { models: s.models, registry: s.registry, onReport: r => reports.push(r) }, context);
  harnesses.add(h);
  const root = await h.root(context, { agent: { model: { provider: 'faux', modelId: 'faux-1' } } });
  expect((await (await root.submit({ type: 'input', content: 'go' }, context)).wait(context)).status).toBe('done');
  expect(reports.length).toBeGreaterThan(0);
  expect(JSON.stringify((await entries(root)).at(-1)?.model)).toContain('still continued');
});

it('P06 a serial slice gate can use native waiting/checkpoints and resume from SQLite without a second scheduler', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'airic-pi-gate-'));
  directories.add(directory);
  const path = join(directory, 'pi.sqlite');
  const Slot = defineDoc<{ active: TaskId | null; finished: string[] }>({
    kind: 'probe.slot', version: 1, scope: 'session', initial: () => ({ active: null, finished: [] }), checkpointWhen: () => false,
  });
  let hold = true;
  const Step = defineTask<{ name: string }, { phase: 'acquire' | 'execute' }, null>({
    name: 'probe.slice', version: 1, initial: () => ({ phase: 'acquire' }),
    phases: {
      acquire: (task, api, c) => api.commit(async tx => {
        const slot = await tx.doc(Slot);
        if (slot.active !== null && slot.active !== task.id) {
          return { status: 'waiting', checkpoint: { phase: 'acquire' }, on: [slot.active], policy: 'allSettled' } as const;
        }
        slot.active = task.id;
        return { status: 'running', checkpoint: { phase: 'execute' } } as const;
      }, c),
      execute: async (task, api, c) => {
        if (hold && task.input.name === 'A') await new Promise((_resolve, reject) => {
          c.abortSignal!.addEventListener('abort', () => reject(c.abortSignal!.reason), { once: true });
        });
        await api.commit(async tx => {
          const slot = await tx.doc(Slot);
          slot.finished.push(task.input.name);
          slot.active = null;
          return { status: 'terminal', outcome: { status: 'completed', result: null } } as const;
        }, c);
      },
    },
    abort: (task, api, c) => api.commit(async tx => {
      const slot = await tx.doc(Slot);
      if (slot.active === task.id) slot.active = null;
      return { status: 'terminal', outcome: { status: 'aborted' } } as const;
    }, c),
  });
  const s = setup();
  s.registry.install(defineExtension({ name: 'probe.slices', tasks: [Step] }));
  let { h, root } = await open(s, await openNodeSqliteStorage(path));
  const ids = await root.commit(async tx => {
    const options = { ownership: { kind: 'conversation' as const }, background: true };
    return [await tx.createTask(Step, { name: 'A' }, options), await tx.createTask(Step, { name: 'B' }, options)];
  }, context);
  h.resume();
  await expect.poll(async () => (await h.commit(tx => tx.task(ids[1]!), context))?.state.status).toBe('waiting');
  await h.close(context);
  hold = false;
  ({ h, root } = await open(s, await openNodeSqliteStorage(path)));
  h.resume();
  await Promise.all(ids.map(id => h.waitForTask(id, context)));
  expect((await h.snapshot(Slot, context))?.finished).toEqual(['A', 'B']);
  expect((await h.snapshot(Slot, context))?.active).toBeNull();
});
