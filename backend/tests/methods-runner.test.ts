import { describe, expect, it } from 'vitest';
import { repositoryValid, runGit } from '../src/adapters/driven/methods/git';
import { createMethods } from '../src/bootstrap/methods';

describe('Git process boundary', () => {
    it.each(['ext::sh -c unwanted', 'http://host/repo', 'relative/path', '--upload-pack=unwanted', 'file:///somewhere', 'https://token@host/repo', 'ssh://git:secret@host/repo', 'https://host/repo?token=private', 'ssh://git@host/repo#fragment'])('rejects unsupported source %j', source => {
        expect(() => repositoryValid(source)).toThrow();
    });
    it('supports explicitly allowed absolute paths, HTTPS and SSH URLs', () => {
        for (const source of ['/absolute/repository', 'https://example.com/om.git', 'ssh://git@example.com/om.git']) expect(() => repositoryValid(source)).not.toThrow();
    });
    it('kills the Git process group at a configured deadline', async () => {
        const before = Date.now();
        await expect(runGit(['-c', 'alias.pause=!sleep 10', 'pause'], 100, 1024)).rejects.toMatchObject({ code: 'blocked', message: 'Git unavailable' });
        expect(Date.now() - before).toBeLessThan(3000);
    });
    it('rejects output beyond the limit rather than returning a truncated result', async () => {
        await expect(runGit(['--version'], 5000, 1)).rejects.toMatchObject({ code: 'blocked' });
    });
    it('does not expose stderr or arguments in failures', async () => {
        await expect(runGit(['--git-dir=/private/not-a-repository', 'rev-parse', 'HEAD'], 5000, 1024)).rejects.toMatchObject({ code: 'blocked', message: 'Git unavailable' });
    });
    it('requires explicit sources, versions and positive resource limits', async () => {
        await expect(createMethods({ directory: '/unused', sources: {}, runtimeVersion: 'r', skillVersion: 's', limits: { commandTimeoutMs: 1, maxTreeBytes: 1, maxFileBytes: 1, maxSnapshotBytes: 1, historyEntries: 1 } })).rejects.toMatchObject({ code: 'invalid' });
    });
});
