import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Context, Creation, Method, Option, Preferences } from '../../../domain/model';

// SQL 约束及索引见 migrations.ts；此处只提供外层查询映射。
export const users = sqliteTable('users', {
    id: text().primaryKey(), issuer: text().notNull(), subject: text().notNull(), name: text().notNull(),
    enabled: integer({ mode: 'boolean' }).notNull(), admin: integer({ mode: 'boolean' }).notNull(),
    version: integer().notNull(), preferences: text({ mode: 'json' }).$type<Preferences>(),
});
export const projects = sqliteTable('projects', {
    id: text().primaryKey(), source: text().notNull(), externalId: text('external_id').notNull(), name: text().notNull(),
});
export const executions = sqliteTable('executions', {
    id: text().primaryKey(), projectId: text('project_id').notNull(), ownerId: text('owner_id').notNull(),
    sessionId: text('session_id').notNull(), workspaceId: text('workspace_id').notNull(),
    creation: text({ mode: 'json' }).$type<Creation>().notNull(), method: text({ mode: 'json' }).$type<Method>(),
    phase: text({ enum: ['new', 'running', 'ended', 'stopping', 'stopped', 'failed'] }).notNull(),
    generation: integer().notNull(), version: integer().notNull(),
});
export const requests = sqliteTable('decision_requests', {
    id: text().primaryKey(), executionId: text('execution_id').notNull(), question: text().notNull(),
    options: text({ mode: 'json' }).$type<Option[]>().notNull(), contexts: text({ mode: 'json' }).$type<Context[]>().notNull(),
    status: text({ enum: ['pending', 'answered'] }).notNull(), createdAt: text('created_at').notNull(),
    answeredAt: text('answered_at'), version: integer().notNull(),
});
export const decisions = sqliteTable('user_decisions', {
    id: text().primaryKey(), requestId: text('request_id').notNull(), userId: text('user_id').notNull(),
    text: text().notNull(), optionId: text('option_id'), contextRevision: integer('context_revision').notNull(),
    files: text({ mode: 'json' }).$type<string[]>().notNull(), correctionOf: text('correction_of'), at: text().notNull(),
});
export const steering = sqliteTable('steering_inputs', {
    id: text().primaryKey(), executionId: text('execution_id').notNull(), userId: text('user_id').notNull(),
    text: text().notNull(), files: text({ mode: 'json' }).$type<string[]>().notNull(), at: text().notNull(),
});
export const inputs = sqliteTable('inputs', {
    id: text().primaryKey(), executionId: text('execution_id').notNull(), sessionId: text('session_id').notNull(),
    userId: text('user_id').notNull(), kind: text({ enum: ['start', 'user-decision', 'steering'] }).notNull(),
    sourceId: text('source_id').notNull(), text: text().notNull(), files: text({ mode: 'json' }).$type<string[]>().notNull(),
    sequence: integer().notNull(), status: text({ enum: ['pending', 'delivered'] }).notNull(), receipt: text(),
});
export const uploads = sqliteTable('uploads', {
    id: text().primaryKey(), userId: text('user_id').notNull(), executionId: text('execution_id').notNull(),
    name: text().notNull(), hash: text().notNull(), size: integer().notNull(), contentRef: text('content_ref').notNull(),
});
export const inputFiles = sqliteTable('input_files', {
    inputId: text('input_id').notNull(), uploadId: text('upload_id').notNull(),
    userId: text('user_id').notNull(), executionId: text('execution_id').notNull(),
});
export const commands = sqliteTable('command_results', {
    userId: text('user_id').notNull(), operation: text().notNull(), key: text().notNull(), fingerprint: text().notNull(),
    executionId: text('execution_id').notNull(), result: text({ mode: 'json' }).$type<unknown>().notNull(),
});
export const settings = sqliteTable('settings', {
    id: integer().primaryKey(), version: integer().notNull(), omSource: text('om_source').notNull(),
    branch: text().notNull(), root: text().notNull(), connections: text({ mode: 'json' }).$type<string[]>().notNull(),
});
