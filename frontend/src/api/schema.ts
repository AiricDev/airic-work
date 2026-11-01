export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface paths {
    "/api/v1/auth/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["session"];
        put?: never;
        post: operations["login"];
        delete: operations["logout"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["profile"];
        trace?: never;
    };
    "/api/v1/me/preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["preferences"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["projects"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["project"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/executions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["executions"];
        put?: never;
        post: operations["create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/executions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["execution"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/executions/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["cancel"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/executions/{id}/steering": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["steering"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/decision-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["requests"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/executions/{id}/decision-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["executionRequests"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/decision-requests/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["request"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/decision-requests/{id}/user-decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["decisions"];
        put?: never;
        post: operations["answer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/executions/{id}/inputs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["inputs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/executions/{id}/uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["upload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/input-files/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["file"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/executions/{id}/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["history"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/episodes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["episode"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["users"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["user"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["manage"];
        trace?: never;
    };
    "/api/v1/admin/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["settings"];
        put: operations["configure"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/executions/{id}/mcp-calls": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["calls"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/executions/{id}/mcp-calls/{callId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["call"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/om/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["methodStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/om/snapshot": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["methodSnapshot"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/om/tree": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["methodTree"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/om/file": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["methodFile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/om/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["methodSearch"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/om/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["methodHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/om/commits/{sha}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["methodCommit"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/om/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["methodSync"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/executions/{id}/connections/{connection}/credential": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["connect"];
        delete: operations["revoke"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/executions/{id}/connections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["connections"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/input-files/{id}/content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Verified fixed file bytes; requires current ownership */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": string;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Invalidation hints only; reconnect must refresh queries */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/event-stream": string;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Schema1: {
            user: {
                id: string;
                name: string;
                enabled: boolean;
                admin: boolean;
                version: number;
                preferences?: {
                    language: string;
                    timezone: string;
                    notify: {
                        decision: boolean;
                        anomaly: boolean;
                        result: boolean;
                    };
                };
            };
            csrfToken: string;
        };
        Schema2: {
            code: string;
            message: string;
            requestId: string;
            issues?: {
                path: string;
                message: string;
            }[];
        };
        Schema3: {
            /** @constant */
            ok: true;
        };
        Schema4: {
            id: string;
            name: string;
            enabled: boolean;
            admin: boolean;
            version: number;
            preferences?: {
                language: string;
                timezone: string;
                notify: {
                    decision: boolean;
                    anomaly: boolean;
                    result: boolean;
                };
            };
        };
        Schema5: {
            name: string;
        };
        Schema6: {
            language: string;
            timezone: string;
            notify: {
                decision: boolean;
                anomaly: boolean;
                result: boolean;
            };
        };
        Schema7: {
            items: {
                id: string;
                source: string;
                externalId: string;
                name: string;
                executionCount: number;
            }[];
            cursor?: string;
        };
        Schema8: {
            id: string;
            source: string;
            externalId: string;
            name: string;
            executionCount: number;
            executions: {
                id: string;
                projectId: string;
                ownerId: string;
                creation: {
                    project_id: string;
                    project_name: string;
                    task: {
                        [key: string]: components["schemas"]["Schema8___schema0"];
                    };
                    instruction: string;
                    source: string;
                };
                sessionId: string;
                method?: {
                    source: string;
                    sha: string;
                    root: string;
                    runtimeVersion: string;
                    skillVersion: string;
                };
                /** @enum {string} */
                phase: "new" | "running" | "ended" | "stopping" | "stopped" | "failed";
                generation: number;
                version: number;
            }[];
        };
        Schema8___schema0: JsonValue;
        Schema9: {
            items: {
                id: string;
                projectId: string;
                ownerId: string;
                creation: {
                    project_id: string;
                    project_name: string;
                    task: {
                        [key: string]: components["schemas"]["Schema9___schema0"];
                    };
                    instruction: string;
                    source: string;
                };
                sessionId: string;
                method?: {
                    source: string;
                    sha: string;
                    root: string;
                    runtimeVersion: string;
                    skillVersion: string;
                };
                /** @enum {string} */
                phase: "new" | "running" | "ended" | "stopping" | "stopped" | "failed";
                generation: number;
                version: number;
            }[];
            cursor?: string;
        };
        Schema9___schema0: JsonValue;
        Schema10: {
            project_id: string;
            project_name: string;
            task: {
                [key: string]: components["schemas"]["Schema10___schema0"];
            };
            instruction: string;
        };
        Schema10___schema0: JsonValue;
        Schema11: {
            id: string;
            projectId: string;
            ownerId: string;
            creation: {
                project_id: string;
                project_name: string;
                task: {
                    [key: string]: components["schemas"]["Schema11___schema0"];
                };
                instruction: string;
                source: string;
            };
            sessionId: string;
            method?: {
                source: string;
                sha: string;
                root: string;
                runtimeVersion: string;
                skillVersion: string;
            };
            /** @enum {string} */
            phase: "new" | "running" | "ended" | "stopping" | "stopped" | "failed";
            generation: number;
            version: number;
        };
        Schema11___schema0: JsonValue;
        Schema12: {
            /** @default  */
            text: string;
            /** @default [] */
            files: string[];
        };
        Schema13: {
            id: string;
            executionId: string;
            userId: string;
            text: string;
            files: string[];
            at: string;
        };
        Schema14: {
            items: {
                id: string;
                executionId: string;
                summary?: string;
                question: string;
                options: {
                    id: string;
                    label: string;
                    description: string;
                }[];
                contexts: {
                    revision: number;
                    content: components["schemas"]["Schema14___schema0"];
                    sources: {
                        system: string;
                        objectId: string;
                        version?: string;
                        location?: string;
                    }[];
                }[];
                /** @enum {string} */
                status: "pending" | "answered";
                createdAt: string;
                answeredAt?: string;
                version: number;
            }[];
            cursor?: string;
        };
        Schema14___schema0: JsonValue;
        Schema15: {
            items: {
                id: string;
                executionId: string;
                summary?: string;
                question: string;
                options: {
                    id: string;
                    label: string;
                    description: string;
                }[];
                contexts: {
                    revision: number;
                    content: components["schemas"]["Schema15___schema0"];
                    sources: {
                        system: string;
                        objectId: string;
                        version?: string;
                        location?: string;
                    }[];
                }[];
                /** @enum {string} */
                status: "pending" | "answered";
                createdAt: string;
                answeredAt?: string;
                version: number;
            }[];
            cursor?: string;
        };
        Schema15___schema0: JsonValue;
        Schema16: {
            id: string;
            executionId: string;
            summary?: string;
            question: string;
            options: {
                id: string;
                label: string;
                description: string;
            }[];
            contexts: {
                revision: number;
                content: components["schemas"]["Schema16___schema0"];
                sources: {
                    system: string;
                    objectId: string;
                    version?: string;
                    location?: string;
                }[];
            }[];
            /** @enum {string} */
            status: "pending" | "answered";
            createdAt: string;
            answeredAt?: string;
            version: number;
        };
        Schema16___schema0: JsonValue;
        Schema17: {
            id: string;
            requestId: string;
            userId: string;
            text: string;
            optionId?: string;
            contextRevision: number;
            files: string[];
            correctionOf?: string;
            at: string;
        }[];
        Schema18: {
            /** @default  */
            text: string;
            optionId?: string;
            contextRevision: number;
            /** @default [] */
            files: string[];
            correctionOf?: string;
        };
        Schema19: {
            id: string;
            requestId: string;
            userId: string;
            text: string;
            optionId?: string;
            contextRevision: number;
            files: string[];
            correctionOf?: string;
            at: string;
        };
        Schema20: {
            id: string;
            executionId: string;
            sourceId: string;
            /** @enum {string} */
            kind: "start" | "user-decision" | "steering";
            sequence: number;
            /** @enum {string} */
            status: "pending" | "delivered";
            files: string[];
        }[];
        Schema21: {
            id: string;
            executionId: string;
            name: string;
            size: number;
            hash: string;
        };
        Schema22: {
            items: {
                id: string;
                at: string;
                kind: string;
                data: components["schemas"]["Schema22___schema0"];
                inputId?: string;
                requestId?: string;
                userDecisionId?: string;
            }[];
            cursor?: string;
            complete: boolean;
            limitations: string[];
        };
        Schema22___schema0: JsonValue;
        Schema23: {
            id: string;
            request: {
                id: string;
                executionId: string;
                summary?: string;
                question: string;
                options: {
                    id: string;
                    label: string;
                    description: string;
                }[];
                contexts: {
                    revision: number;
                    content: components["schemas"]["Schema23___schema0"];
                    sources: {
                        system: string;
                        objectId: string;
                        version?: string;
                        location?: string;
                    }[];
                }[];
                /** @enum {string} */
                status: "pending" | "answered";
                createdAt: string;
                answeredAt?: string;
                version: number;
            };
            decisions: {
                id: string;
                requestId: string;
                userId: string;
                text: string;
                optionId?: string;
                contextRevision: number;
                files: string[];
                correctionOf?: string;
                at: string;
            }[];
            inputs: {
                id: string;
                executionId: string;
                sourceId: string;
                /** @enum {string} */
                kind: "start" | "user-decision" | "steering";
                sequence: number;
                /** @enum {string} */
                status: "pending" | "delivered";
                files: string[];
            }[];
            sessionId: string;
            method?: {
                source: string;
                sha: string;
                root: string;
                runtimeVersion: string;
                skillVersion: string;
            };
        };
        Schema23___schema0: JsonValue;
        Schema24: {
            items: {
                id: string;
                name: string;
                enabled: boolean;
                admin: boolean;
                version: number;
                preferences?: {
                    language: string;
                    timezone: string;
                    notify: {
                        decision: boolean;
                        anomaly: boolean;
                        result: boolean;
                    };
                };
            }[];
            cursor?: string;
        };
        Schema25: {
            enabled?: boolean;
            admin?: boolean;
            name?: string;
        };
        Schema26: {
            omSource: string;
            branch: string;
            root: string;
            connections: string[];
            version: number;
        };
        Schema27: {
            expected: number;
            omSource: string;
            branch: string;
            root: string;
            connections: string[];
        };
        Schema28: {
            items: {
                id: string;
                connection: string;
                tool: string;
                at: string;
                /** @enum {string} */
                type: "read" | "write" | "unknown";
                classificationSource?: string;
                schemaRevision: string;
                parameters: components["schemas"]["Schema28___schema0"];
                result?: components["schemas"]["Schema28___schema0"];
                /** @enum {string} */
                status: "calling" | "success" | "failed" | "unknown";
                retryOf?: string;
                requestId?: string;
                userDecisionId?: string;
            }[];
            cursor?: string;
            complete: boolean;
            limitations: string[];
            unknownCount: number | null;
        };
        Schema28___schema0: JsonValue;
        Schema29: {
            id: string;
            connection: string;
            tool: string;
            at: string;
            /** @enum {string} */
            type: "read" | "write" | "unknown";
            classificationSource?: string;
            schemaRevision: string;
            parameters: components["schemas"]["Schema29___schema0"];
            result?: components["schemas"]["Schema29___schema0"];
            /** @enum {string} */
            status: "calling" | "success" | "failed" | "unknown";
            retryOf?: string;
            requestId?: string;
            userDecisionId?: string;
        };
        Schema29___schema0: JsonValue;
        Schema30: {
            source: string;
            /** @enum {string} */
            kind: "managed" | "local";
            sync: {
                enabled: boolean;
                remote?: string;
                branch?: string;
                reason?: string;
                message?: string;
            };
        };
        Schema31: {
            source: string;
            sha: string;
            root: string;
            runtimeVersion: string;
            skillVersion: string;
        };
        Schema32: {
            method: {
                source: string;
                sha: string;
                root: string;
                runtimeVersion: string;
                skillVersion: string;
            };
            files: {
                path: string;
                size: number;
                text: boolean;
            }[];
        };
        Schema33: {
            method: {
                source: string;
                sha: string;
                root: string;
                runtimeVersion: string;
                skillVersion: string;
            };
            path: string;
            content: string;
        };
        Schema34: {
            method: {
                source: string;
                sha: string;
                root: string;
                runtimeVersion: string;
                skillVersion: string;
            };
            items: {
                path: string;
                excerpt: string;
            }[];
        };
        Schema35: {
            source: string;
            scope: string;
            commits: {
                sha: string;
                parents: string[];
                at: string;
                subject: string;
            }[];
            complete: boolean;
            limitations: string[];
        };
        Schema36: {
            sha: string;
            parents: string[];
            at: string;
            subject: string;
            files: string[];
            diff: string;
        };
        Schema37: {
            expiresAt: string;
        };
        Schema38: {
            /** @constant */
            ok: true;
        };
        Schema39: string[];
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    session: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema1"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema1"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema3"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema4"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    profile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Schema5"];
            };
        };
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema4"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    preferences: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Schema6"];
            };
        };
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema4"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    projects: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
                projectId?: string;
                status?: "pending" | "answered";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema7"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    project: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema8"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    executions: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
                projectId?: string;
                status?: "pending" | "answered";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema9"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    create: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Schema10"];
            };
        };
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema11"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    execution: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema11"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    cancel: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema11"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    steering: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Schema12"];
            };
        };
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema13"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    requests: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
                projectId?: string;
                status?: "pending" | "answered";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema14"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    executionRequests: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
                projectId?: string;
                status?: "pending" | "answered";
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema15"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    request: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema16"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    decisions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema17"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    answer: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Schema18"];
            };
        };
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema19"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    inputs: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema20"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    upload: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                };
            };
        };
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema21"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    file: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema21"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    history: {
        parameters: {
            query?: {
                cursor?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema22"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    episode: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema23"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    users: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
                projectId?: string;
                status?: "pending" | "answered";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema24"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    user: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema4"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    manage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Schema25"];
            };
        };
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema4"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    settings: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema26"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    configure: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Schema27"];
            };
        };
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema26"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    calls: {
        parameters: {
            query?: {
                type?: "read" | "write" | "unknown";
                cursor?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema28"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    call: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                callId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema29"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    methodStatus: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema30"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    methodSnapshot: {
        parameters: {
            query?: {
                sha?: string;
                executionId?: string;
                path?: string;
                q?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema31"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    methodTree: {
        parameters: {
            query?: {
                sha?: string;
                executionId?: string;
                path?: string;
                q?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema32"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    methodFile: {
        parameters: {
            query: {
                sha?: string;
                executionId?: string;
                path: string;
                q?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema33"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    methodSearch: {
        parameters: {
            query: {
                sha?: string;
                executionId?: string;
                path?: string;
                q: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema34"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    methodHistory: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema35"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    methodCommit: {
        parameters: {
            query?: {
                sha?: string;
                executionId?: string;
                path?: string;
                q?: string;
            };
            header?: never;
            path: {
                sha: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema36"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    methodSync: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema31"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    connect: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                connection: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema37"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    revoke: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                connection: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema38"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
    connections: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved or current representation, not proof of background execution */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema39"];
                };
            };
            /** @description Request failed or outcome unknown */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Schema2"];
                };
            };
        };
    };
}
