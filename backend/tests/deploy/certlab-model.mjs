import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { join } from 'node:path';
import { createModels, fauxProvider, fauxAssistantMessage, fauxToolCall, fauxText } from '@earendil-works/pi-ai';

// Substitute only the model registry. The services use their normal startup and HTTP paths.
registerHooks({
    resolve(specifier, context, nextResolve) {
        return nextResolve(specifier === '@earendil-works/pi-ai/providers/all' ? import.meta.url : specifier, context);
    },
});

const { report, assessment } = JSON.parse(await readFile(join(process.env.AIRIC_CERTLAB_SMOKE_DIR, 'fixture.json')));
export function builtinModels() {
    const models = createModels();
    const faux = fauxProvider();
    models.setProvider(faux.provider);
    let calls = 0;
    let fieldId;
    const tool = (name, args) => fauxAssistantMessage([fauxToolCall(name, args, { id: 'call-' + ++calls })], { stopReason: 'toolUse' });
    faux.setResponses([
        tool('work_request_decision', { question: 'Proceed with fieldwork?', scope: 'fieldwork' }),
        fauxAssistantMessage([fauxText('Waiting for engineer')]),
        tool('work_discover_mcp', { connection: 'certlab', tool: 'test-task.create' }),
        (context) => {
            const message = context.messages.findLast(item => item.role === 'toolResult');
            const [definition] = JSON.parse(message.content[0].text);
            return tool('work_call_mcp', {
                connection: 'certlab', tool: definition.name, schemaRevision: definition.schemaRevision,
                parameters: {
                    report_id: report, assessment_id: assessment, expected_record_no: 0,
                    requirements: 'Verify protective bonding', asset_revision_ids: [], register_blocker: false,
                    domain_release: 'certlab/v4', command_id: 'test-item',
                },
            });
        },
        (context) => {
            const response = JSON.parse(context.messages.findLast(item => item.role === 'toolResult').content[0].text);
            fieldId = response.result.structuredContent.receipt.response.test_task.id;
            return fauxAssistantMessage([fauxText('Fieldwork assigned')]);
        },
        tool('work_discover_mcp', { connection: 'certlab', tool: 'work-item.context' }),
        (context) => {
            const [definition] = JSON.parse(context.messages.findLast(item => item.role === 'toolResult').content[0].text);
            return tool('work_call_mcp', {
                connection: 'certlab', tool: definition.name, schemaRevision: definition.schemaRevision,
                parameters: { report_id: report, item_id: fieldId, item_kind: 'test-task', domain_release: 'certlab/v4' },
            });
        },
        (context) => {
            const response = JSON.parse(context.messages.findLast(item => item.role === 'toolResult').content[0].text);
            const item = response.result.structuredContent.item;
            if (item.id !== fieldId || item.status !== 'completed') throw Error('Field completion was not read');
            return fauxAssistantMessage([fauxText('Verified the completed CertLab field work')]);
        },

    ]);
    return models;
}
