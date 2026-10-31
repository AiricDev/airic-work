import {vi,afterEach} from 'vitest';
import {readDrafts,writeDrafts} from '../src/api/drafts';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {expect,it} from 'vitest';
import ts from 'typescript';
import {executionView,projectView,requestView,userView} from '../src/api/views';
import {formatTime} from '../src/utils/time';
import {createEmptyDraft,validateDraft} from '../src/utils/decisionService';
const root=resolve(import.meta.dirname,'../src');
it('keeps the original shell, pages and decision workflow in the entry graph without seed imports',()=>{
 const files=new Set<string>();
 function visit(file:string){if(files.has(file))return;files.add(file);const ast=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);for(const node of ast.statements){if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){const spec=node.moduleSpecifier.text;if(!spec.startsWith('.'))continue;const base=resolve(dirname(file),spec);const target=[base+'.ts',base+'.tsx',base+'/index.tsx'].find(existsSync);if(target)visit(target);}}}
 visit(resolve(root,'index.tsx'));
 for(const f of ['App.tsx','components/layout/AppShell.tsx','pages/ProjectList.tsx','pages/ExecutionWorkspace.tsx','components/decision/DecisionBrief.tsx','components/decision/UserDecisionForm.tsx','components/decision/ConfirmSubmission.tsx','pages/OMBrowser.tsx'])expect(files.has(resolve(root,f))).toBe(true);
 expect([...files].filter(f=>f.includes('/data/')||f.includes('/live/')||f.endsWith('/workbenchReducer.ts'))).toEqual([]);
});
it('maps actual control states without inventing runtime progress, outputs, timestamps or business approval',()=>{
 const e=executionView({id:'e',projectId:'p',ownerId:'u',creation:{source:'biz',project_id:'ext',project_name:'Project',instruction:'Check',task:{}},sessionId:'s',phase:'new',version:0,generation:0});
 expect(e.phase).toBe('new');expect(e.events).toEqual([]);expect(e.results).toEqual([]);expect(e.startedAt).toBe('');expect(formatTime(e.startedAt)).toBe('未提供');
 const r=requestView({id:'r',executionId:'e',question:'Enough?',options:[{id:'yes',label:'Yes',description:''}],contexts:[{revision:1,content:{uncertain:true},sources:[]}],status:'answered',createdAt:'2026-10-31T00:00:00Z',version:2},e,'User',[{id:'d',requestId:'r',userId:'u',contextRevision:1,text:'Conditional',files:[],at:'now'}],[]);
 expect(r.brief.rawContext).toEqual({uncertain:true});expect(r.brief.recommendation).toBe(null);expect(r.followUp?.status).toBe('recorded');expect(r.followUp?.message).toContain('尚待交付');
 const draft=createEmptyDraft(r);expect(draft.choiceId).toBe('');expect(validateDraft({...draft,action:'judgment',choiceId:'yes'},r)).toEqual({});
 expect(userView({id:'u',name:'Member',enabled:true,admin:false,version:1}).visibleProjectIds).toEqual([]);
 expect(projectView({id:'p',externalId:'external',name:'Project',source:'biz',executionCount:1}).businessRef).toBe('external');
});

afterEach(()=>vi.unstubAllGlobals());
it('persists unknown commands under their owner and rejects malformed drafts',()=>{
 const values=new Map<string,string>();
 vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)});
 const draft={requestId:'r',idempotencyKey:'same-key',action:'fact' as const,choiceId:'',reason:'',fact:'Original',factSource:'',investigation:'',note:'',authorizeConfirm:false,baseVersion:1,updatedAt:'now',pending:{text:'Original',contextRevision:1,files:['upload']}};
 writeDrafts('owner',{r:draft});expect(readDrafts('owner').r.pending).toEqual(draft.pending);expect(readDrafts('other')).toEqual({});
 values.set('airic-drafts-v1:broken',JSON.stringify({r:{requestId:'r',idempotencyKey:'key'}}));expect(readDrafts('broken')).toEqual({});
});
