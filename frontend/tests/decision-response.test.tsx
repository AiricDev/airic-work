import { afterEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createEmptyDraft, validateDraft } from '../src/utils/decisionService';
import { decisionPayload, responsePatch, selectResponse, responseText } from '../src/utils/decisionResponse';
import { requestView, executionView } from '../src/api/views';
import { UserDecisionForm } from '../src/components/decision/UserDecisionForm';
import { sourceReferenceLink } from '../src/utils/sourceReference';
const execution=executionView({id:'e',projectId:'p',ownerId:'u',sessionId:'s',creation:{source:'biz',project_id:'p',project_name:'Project',instruction:'Review',task:{}},phase:'new',version:0,generation:0});
const request=requestView({id:'r',executionId:'e',question:'Choose?',options:[{id:'yes',label:'支持该方案',description:'说明当前方案的作用'}],contexts:[{revision:1,content:{},sources:[]}],status:'pending',createdAt:'now',version:0},execution,'User',[],[]);
afterEach(()=>vi.unstubAllEnvs());
it('selects a real option directly, preserves optional content while switching and never sends a stale option on investigation',()=>{
 let d=createEmptyDraft(request);
 expect(d.action).toBeNull();expect(d.choiceId).toBe('');
 d={...d,...responsePatch('仅限当前设备', 'fact')};
 d={...d,...selectResponse(d,'judgment','yes')};
 expect(validateDraft(d,request)).toEqual({});
 expect(decisionPayload(d,request)).toMatchObject({optionId:'yes',text:'仅限当前设备',contextRevision:1});
 d={...d,...selectResponse(d,'investigation')};
 expect(responseText(d)).toBe('仅限当前设备');
 expect(decisionPayload(d,request)).toEqual({text:'需要进一步调查：仅限当前设备',contextRevision:1,files:[]});
 d={...d,...selectResponse(d,'fact')};
 expect(decisionPayload(d,request)).toEqual({text:'仅限当前设备',contextRevision:1,files:[]});
});
it('allows option-only or investigation-only answers and free-text-only facts, but blocks an empty response',()=>{
 const d=createEmptyDraft(request);
 expect(validateDraft(d,request).action).toBeTruthy();
 const choice={...d,...selectResponse(d,'judgment','yes')};
 expect(validateDraft(choice,request)).toEqual({});expect(decisionPayload(choice,request)).toMatchObject({optionId:'yes',text:''});
 const investigation={...d,...selectResponse(d,'investigation')};
 expect(validateDraft(investigation,request)).toEqual({});expect(decisionPayload(investigation,request).text).toBe('需要进一步调查');
 const fact={...d,...responsePatch('实测情况待补', 'fact')};
 expect(validateDraft(fact,request)).toEqual({});expect(decisionPayload(fact,request)).not.toHaveProperty('optionId');
 expect(validateDraft({...choice,choiceId:'not-published'},request).choiceId).toBeTruthy();
});
it('keeps an unknown submission exactly as originally frozen',()=>{
 const d={...createEmptyDraft(request),pending:{text:'原文',contextRevision:1,files:[],optionId:'yes'}};
 expect(decisionPayload({...d,action:'investigation',investigation:'新内容'},request)).toBe(d.pending);
});
it('renders one selection group containing the candidates and investigation, with no nested action chooser or preselection',()=>{
 const html=renderToStaticMarkup(createElement(UserDecisionForm,{request,value:createEmptyDraft(request),errors:{},showErrors:false,onChange:()=>{}}));
 expect((html.match(/role="radiogroup"/g)??[])).toHaveLength(1);
 expect(html).toContain('支持该方案');expect(html).toContain('需要进一步调查');expect(html).toContain('补充内容（可选）');
 expect(html).not.toContain('选择处理方式');expect(html).not.toContain('你的判断');expect(html).not.toContain('checked=""');
});
it('links pinned OM files and explicitly configured business routes without guessing or accepting unsafe URLs',()=>{
 const sha='a'.repeat(40),templates={'business':{report:'https://business.example/reports/{id}',assessment:'https://business.example/reports/{report_id}/{id}'}};
 expect(sourceReferenceLink({system:'git:repo@'+sha,objectId:'decisions/topic.md#section'},'e',sha,'{}',templates)).toContain('path=decisions%2Ftopic.md');
 expect(sourceReferenceLink({system:'business',objectId:'report/a b'},'e',sha,'{}',templates)).toBe('https://business.example/reports/a%20b');
 expect(sourceReferenceLink({system:'business',objectId:'assessment/x'},'e',sha,'{"report_id":"r"}',templates)).toBe('https://business.example/reports/r/x');
 expect(sourceReferenceLink({system:'business',objectId:'assessment/x'},'e',sha,'{}',templates)).toBeUndefined();
 expect(sourceReferenceLink({system:'unknown',objectId:'report/x'},'e',sha,'{}',templates)).toBeUndefined();
 for(const objectId of ['javascript:alert(1)','https://secret:password@example.com/','../private'])expect(sourceReferenceLink({system:'git:repo@'+sha,objectId},'e',sha,'{}',templates)).toBeUndefined();
});

it('preserves attachment and correction identity and the Context revision actually read',()=>{
 const d={...createEmptyDraft(request),...responsePatch('仅更正本项事实','fact'),baseVersion:1,correctionOf:'original-decision',files:[{id:'upload',name:'note.txt'}]};
 expect(decisionPayload(d as any,{...request,version:2})).toEqual({text:'仅更正本项事实',contextRevision:1,files:['upload'],correctionOf:'original-decision'});
 const auth={...request,allowedActions:[...request.allowedActions,'authorization' as const],brief:{...request.brief,authorization:{object:'对象A',action:'保存草稿',scope:'本报告',note:''}}};
 const selected={...createEmptyDraft(auth),...selectResponse(createEmptyDraft(auth),'authorization')};
 expect(validateDraft(selected,auth).authorizeConfirm).toBeTruthy();
 expect(validateDraft({...selected,authorizeConfirm:true},auth)).toEqual({});
 expect(decisionPayload({...selected,authorizeConfirm:true},auth).text).toBe('授权：对象A · 保存草稿 · 本报告');
});
