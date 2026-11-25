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
    let domainRelease;
    const tool = (name, args) => fauxAssistantMessage([fauxToolCall(name, args, { id: 'call-' + ++calls })], { stopReason: 'toolUse' });
    faux.setResponses([
        tool('work_request_decision', { question: 'Proceed with fieldwork?', scope: 'fieldwork' }),
        fauxAssistantMessage([fauxText('Waiting for engineer')]),
        tool('work_discover_mcp', { connection: 'certlab', tool: 'integration.info' }),
        (context) => {
            const [definition] = JSON.parse(context.messages.findLast(item => item.role === 'toolResult').content[0].text);
            return tool('work_call_mcp', {
                connection: 'certlab', tool: definition.name, schemaRevision: definition.schemaRevision,
                parameters: {},
            });
        },
        (context) => {
            const response = JSON.parse(context.messages.findLast(item => item.role === 'toolResult').content[0].text);
            domainRelease = response.result.structuredContent.domain.release;
            return tool('work_discover_mcp', { connection: 'certlab', tool: 'test-task.create' });
        },
        (context) => {
            const message = context.messages.findLast(item => item.role === 'toolResult');
            const [definition] = JSON.parse(message.content[0].text);
            return tool('work_call_mcp', {
                connection: 'certlab', tool: definition.name, schemaRevision: definition.schemaRevision,
                parameters: {
                    report_id: report, assessment_id: assessment, expected_record_no: 0,
                    requirements: 'Verify protective bonding', register_wait: false,
                    domain_release: domainRelease, command_id: 'test-item',
                },
            });
        },
        (context) => {
            const response = JSON.parse(context.messages.findLast(item => item.role === 'toolResult').content[0].text);
            fieldId = response.result.structuredContent.receipt.response.test_task.id;
            return fauxAssistantMessage([fauxText('Fieldwork assigned')]);
        },
        tool('work_discover_mcp', { connection: 'certlab', tool: 'test-task.context' }),
        (context) => {
            const [definition] = JSON.parse(context.messages.findLast(item => item.role === 'toolResult').content[0].text);
            return tool('work_call_mcp', {
                connection: 'certlab', tool: definition.name, schemaRevision: definition.schemaRevision,
                parameters: { report_id: report, test_task_id: fieldId, domain_release: domainRelease },
            });
        },
        (context) => {
            const response = JSON.parse(context.messages.findLast(item => item.role === 'toolResult').content[0].text);
            const item = response.result.structuredContent.test_task;
            if (item.id !== fieldId || item.status !== 'completed') throw Error('Field completion was not read');
            return fauxAssistantMessage([fauxText('Verified the completed CertLab field work')]);
        },

    ]);
    return models;
}
