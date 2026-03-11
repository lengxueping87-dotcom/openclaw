/* Middle灯塔 v2 — 核心逻辑（阶段一完整版） */

// === OpenClaw API 动态配置 ===
// AI API 配置由 getAIConfig() 从 DB 动态读取

// === 原音效系统已废弃（全局静音） ===

// === 数据层 ===
const DB={get(k,f=null){try{const v=localStorage.getItem('lc_'+k);return v?JSON.parse(v):f}catch{return f}},set(k,v){localStorage.setItem('lc_'+k,JSON.stringify(v))}};
const genId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function todayStr() { return new Date().toISOString().slice(0,10); }
const escHtml=(s)=>{const d=document.createElement('div');d.textContent=s;return d.innerHTML};

// === 状态 ===
let profile=DB.get('profile',null);
let goals=DB.get('goals',[]), chatHistory=DB.get('chat',[]);
let streakData=DB.get('streak',{count:0,lastDate:null});
let completionLog=DB.get('completionLog',{});
let points=DB.get('points',0), xp=DB.get('xp',0);
let blindboxes=DB.get('blindboxes',{});
let journals=DB.get('journals',{});
let mentorMode=DB.get('mentorMode','practical');
let mentorState=DB.get('mentorState','welcome');
let photoBoxId=null; // 当前拍照的盲盒ID
let isLoggedIn = DB.get('isLoggedIn', false); // 追加登录状态记录

// 提取加载 API 设置
// AI config 由 getAIConfig() 延迟读取

const CATS={tech:{l:' 编程技术'},sidebiz:{l:'💰 副业变现'},design:{l:' 设计创作'},marketing:{l:' 营销运营'},finance:{l:' 投资理财'},career:{l:'🚀 职业发展'},health:{l:' 健康精力'},mind:{l:' 心灵成长'}};
const LEVELS=[{n:'学徒',xp:0},{n:'进阶',xp:100},{n:'专家',xp:300},{n:'大师',xp:600},{n:'宗师',xp:1000}];

function getLevel(){for(let i=LEVELS.length-1;i>=0;i--)if(xp>=LEVELS[i].xp)return{level:LEVELS[i],next:LEVELS[i+1]||null};return{level:LEVELS[0],next:LEVELS[1]};}
function addPoints(n){points+=n;DB.set('points',points);updateXP();}
function addXP(n){xp+=n;DB.set('xp',xp);updateXP();}
function updateXP(){
    const lv=getLevel();
    const el=document.getElementById('xp-level');if(el)el.textContent=lv.level.n;
    const ep=document.getElementById('xp-points');if(ep)ep.textContent=xp;
    const ef=document.getElementById('xp-fill');
    if(ef&&lv.next)ef.style.width=Math.min(100,((xp-lv.level.xp)/(lv.next.xp-lv.level.xp))*100)+'%';
    const sp=document.getElementById('stat-points');if(sp)sp.textContent=points;
}
function getName(){return profile?.name||'同学';}

// === 账户与引导页 ===
function checkAuthAndOnboarding(){
    // 暂时跳过登录验证，方便测试（以后再添加）
    if(!isLoggedIn){
        isLoggedIn = true; DB.set('isLoggedIn', true);
    }
    if(!profile){
        document.getElementById('onboarding-overlay').style.display='flex';
    }
}

// 模拟登录注册交互
window.switchAuthTab = (tab) => {
    document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));
    document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.auth-panel').forEach(p=>p.style.display='none');
    document.getElementById(`auth-${tab}-form`).style.display = tab==='wechat'?'block':'block'; // default to block
    // form tag active class for CSS (if any)
    document.querySelectorAll('.auth-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById(`auth-${tab}-form`).classList.add('active');
};
window.sendAuthCode = () => { showToast({title:'📨 已发送验证码', desc:'已模拟发送，任意6位数字均可'}); };
window.handleAuthSubmit = (e, method) => {
    e.preventDefault();
    doLoginSuccess();
};
window.simulateWechatLogin = () => {
    doLoginSuccess();
};
function doLoginSuccess() {
    isLoggedIn = true; DB.set('isLoggedIn', true);
    document.getElementById('auth-overlay').style.display='none';
    
    // 首次注册送积分 (检测到之前没有档案视为新注册)
    if(!profile) {
        showToast({title:'🎉 注册成功', desc:'欢迎加入！已赠送 1000 初始积分。'});
        addPoints(1000);
        setTimeout(() => document.getElementById('onboarding-overlay').style.display='flex', 500);
    }
}

document.getElementById('profile-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    const ext=[],int=[];
    document.querySelectorAll('#ext-issues input:checked').forEach(i=>ext.push(i.value));
    document.querySelectorAll('#int-issues input:checked').forEach(i=>int.push(i.value));
    profile={name:document.getElementById('p-name').value.trim()||'同学',age:document.getElementById('p-age').value,gender:document.getElementById('p-gender').value,location:document.getElementById('p-location').value.trim(),job:document.getElementById('p-job').value.trim(),extIssues:ext,intIssues:int};
    DB.set('profile',profile);
    document.getElementById('onboarding-overlay').style.display='none';
    // 用profile信息定制欢迎消息
    chatHistory=[];DB.set('chat',chatHistory);mentorState='welcome';DB.set('mentorState','welcome');
    initMentor();
});

// === 导航 ===
function switchPage(p){
    document.querySelectorAll('.page').forEach(e=>e.classList.remove('active'));
    document.getElementById('page-'+p)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${p}"]`)?.classList.add('active');
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar')?.classList.remove('open');
    if(p==='goals')renderGoals();
    else if(p==='daily')renderDaily();
    else if(p==='knowledge')renderKnowledge();
    else if(p==='insights')renderInsights();
    else if(p==='fortune')initFortune();
    else if(p==='journal')initJournal();
    else if(p==='inbox')renderInbox();
    else if(p==='settings')loadSettings();
    else if(p==='mentor') {
        if(chatHistory.length===0 && mentorState==='welcome') startConv('welcome');
        else {
            chatHistory.forEach(m=>appendMsg(m.role,m.text,false));
            showQR();
        }
        scrollChat();
    }
}
document.querySelectorAll('.nav-item').forEach(i=>i.addEventListener('click',()=>switchPage(i.dataset.page)));
document.getElementById('mobile-menu-btn')?.addEventListener('click',()=>document.getElementById('sidebar')?.classList.toggle('open'));

// === AI 导师 ===
const QUOTES_P=[{t:'最好的投资就是投资你自己。',a:'巴菲特'},{t:'先做最重要的事。',a:'德鲁克'},{t:'你不需要很厉害才开始，但你需要开始。',a:'Zig Ziglar'},{t:'把每一天当作学习新技能的机会。',a:'布兰森'}];
const QUOTES_M=[{t:'认识你自己。',a:'苏格拉底'},{t:'未经审视的人生不值得过。',a:'苏格拉底'},{t:'天行健，君子以自强不息。',a:'周易'},{t:'纵浪大化中，不喜亦不惧。',a:'陶渊明'}];

const CONVS={
    welcome:{
        practical:{msgs:[`${getName()}你好，我是爱因博士 \n\n很多人一上来就问"学什么能赚钱"，但我更想先问问你：\n\n在平时的工作和生活中，有没有哪一刻，你做某件事时完全忘记了时间？哪怕是一件看起来微不足道的小事。`,`与其盲目追逐风口，不如从你的"微小热爱"开始。跟我说说，你平时最喜欢琢磨些什么？`],qr:['有很多想做的但没时间','不知道自己喜欢什么','想把爱好变成收入','总是很难坚持']},
        philosophy:{msgs:[`${getName()}你好，我是苏拉底 \n\n很多人来到这里，是因为觉得生活像一片没有灯塔的暗夜汪洋。\n\n别怕，灯塔从来不是在外面找到的，而是从内部点亮的。我有一套「内观三步法」，想带你一起找回内心的锚。\n\n**第一步：剥离外界噪音**\n诚实地面对现在的自己。你现在最强烈的感受是什么？`],qr:['很迷茫不知道方向','焦虑，觉得在原地踏步','觉得生活没有意义','想看清真实的自己']}
    },
    sidebiz:{msgs:['把爱好变成技能，再变成收入，这是一条很棒的路 \n\n但在开始之前，我们先不谈钱，谈谈"心流"。\n\n**你可以试着这样回忆：**\n1. 别人觉得很麻烦，你却觉得有意思的事？\n2. 你愿意免费帮别人做的事？\n3. 你平时在网上最喜欢看哪类内容？\n\n先别管它能不能赚钱，跟我聊聊这些感受吧。','找到源动力后，我会在"目标罗盘"帮你制定计划，用每天的"盲盒"陪你慢慢把它变成真本事。'],qr:['我喜欢研究工具/技术','我喜欢写东西/表达','我喜欢和人交流','还是想不到什么特别的']},
    tech_learn:{msgs:[`研究工具和技术？太棒了${getName()}！这个时代非常需要你这样的人。\n\n不用一开始就定"我要成为全栈工程师"这种大目标，那样太容易焦虑了。\n\n**其实最小的起点是：**\n用技术解决你自己生活中的一个小烦恼。比如写个脚本自动化处理无聊的表格，或者搭个小工具。`,`准备好了吗？我们可以去"目标罗盘"写下你的第一个小挑战！`],qr:['好，设定目标','有没有推荐的入手点','我怕太难坚持不下来']},
    competitiveness:{msgs:['不知道喜欢什么很正常，因为我们平时太忙着"完成任务"，忘了感受自己。\n\n没事，我们可以把"找到热爱"本身当成现阶段的目标。\n\n我建议你，接下来的一周，每天在"心灵日记"里记录下：**今天哪一刻我不觉得累？**\n\n慢慢地，答案会自己浮现出来。'],qr:['好，我去写日记','我想看看大家在学什么','帮我规划目标']},
    earn_money:{msgs:[`${getName()}，想把爱好变成收入，是很自然的渴望。\n\n这里的秘诀是：**先提供价值，再考虑回报**。\n\n你已经在做自己喜欢的事了，能不能找到一个小切口，把它展示出来，或者用它帮别人解决一个小问题？哪怕是一条经验分享。`,`别急，慢慢来。你可以把这个想法记在日记里，或者去"目标罗盘"里理清思绪。`],qr:['我想学怎么分享','去看看技能工坊','推荐相关的书']},
    lost:{msgs:[`迷茫和焦虑，往往是因为我们承载了太多"别人的期待"（比如什么年纪该干什么事）。\n\n在哲学上这叫"异化"。你是不是很久没问过自己："这真的是我想要的生活吗？"\n\n**第二步：寻找核心锚点**\n闭上眼睛想一想：如果完全抛开别人的目光和评判，你最想为自己保留什么样的生活底色？`],qr:['自由安排自己的时间','创造些独特的东西','平静且有爱的生活','我不敢去想']},
    passion:{msgs:[`当你敢于剥离外界噪音，就会接触到真实的自我。\n\n你的灯塔，就是你不管经历什么都不会放弃的核心价值观。是"创造"？"连接"？还是"探索"？\n\n**做一个极致的假设：**\n如果你的生命只剩下最后五年，你绝对不会把时间浪费在什么事情上？`],qr:['不去讨厌的地方上班','不讨好迎合别人','不再活在别人的比较里','我要尽可能去体验']},
    motivation:{msgs:['内在动力有三个支柱：\n\n **自主感**：感觉自己在做选择\n **胜任感**：感觉自己在进步\n **归属感**：与人有连接\n\n放下外在的鞭策，问问内心，你目前最渴望重建哪一根支柱？我的致知盲盒会帮你。'],qr:['自主感','胜任感','归属感','带我去抽盲盒']},
    self_know:{msgs:[`你看，其实你的内心深处是有答案的。你已经在靠近你的灯塔了。\n\n**第三步：点亮微光（行动力）**\n所谓"找到方向"，不是突然顿悟出了一个宏伟目标，而是先点亮一盏微小的灯。\n\n去写下你的第一篇"心灵日记"吧。不需要大道理，只写今天让你内心有一丝微光闪烁的瞬间。`],qr:['好，我去写日记','去抽今天的盲盒','谢谢你，苏拉底']},
    ongoing:{msgs:null,qr:['我今天的盲盒进度？','推荐学什么技能','给我激励','帮我调整目标','我想写日记']}
};

const DYN=[
    {kw:['盲盒','进度','今天'],fn:()=>{const bb=getTodayBoxes();const d=bb.filter(b=>b.status==='completed').length;const t=bb.length;if(!t)return '你今天还没有领取规划任务，需要我帮你制定今日份的成长碎片吗？请随时回复“帮我规划”。';if(d===t)return `太棒了${getName()}！${t}个盲盒全部完成！你获得了额外${t*5}积分  别忘了写今天的心灵日记哦！`;return `已完成 ${d}/${t} 个盲盒。加油${getName()}，你可以的！`}},
    {kw:['技能','学','推荐'],fn:()=>`${getName()}，去"技能工坊"看看吧！编程、设计、营销、理财都有。\n\n如果刚起步，推荐从 **Python** 或 **自媒体运营** 开始——投入产出比最高。`},
    {kw:['激励','鼓励','坚持','累','难'],fn:()=>{const m=[`${getName()}，每天进步1%，一年后你将是今天的37倍。不要小看复利的力量 `,`低谷期是弹射前的蓄力。允许自己休息，但不要停下来。你比想象中强大。`,`稻盛和夫说：付出不亚于任何人的努力。不是天赋，是日复一日的积累。你正在路上。`,`${getName()}，你现在做的每一件小事，都在为未来的你修路。继续走 `];return m[Math.floor(Math.random()*m.length)]}},
    {kw:['目标','调整'],fn:()=>goals.length?`你有${goals.length}个目标，去"目标罗盘"检查调整一下吧。`:'还没设定目标呢！去"目标罗盘"设定第一个。'},
    {kw:['日记','写'],fn:()=>`好的${getName()}！去"心灵日记"写下今天的感受吧。随心书写，和自己的灵魂对话 `},
    {kw:['规划','任务','安排'],fn:()=>{
        const generated = generateMentorBoxes();
        if(generated) {
            return `收到！结合你刚才提到的状态，我已经为你精心挑选了本阶段最合适你的 ${generated} 个细分成长【盲盒任务】。\n\n**你可以随时前往左侧“今日盲盒”页面查收并拆解。** 祝你今天探索愉快！`;
        } else {
            return `今天我已经为你下发过规划盲盒啦！你可以在左侧导航栏的“今日盲盒”中查看它们，先去把它们完成吧。`;
        }
    }}
];

const DEF_RESP=[
    `这个问题很有意思，${getName()}。慢慢来，我们可以一起探索。`,
    `听到你这么说，我觉得这是一个打破常规的好机会。遵从内心的声音，你真正的想法是什么？`,
    `很棒的思考。有时候答案就在问题本身里。`,
    `${getName()}，这正是你需要自己去寻找答案的时刻。不要急着要结果，享受过程吧。`
];

function initMentor(){
    const qs=mentorMode==='practical'?QUOTES_P:QUOTES_M;
    const q=qs[Math.floor(Math.random()*qs.length)];
    document.getElementById('mentor-quote').textContent=`"${q.t}" — ${q.a}`;
    
    // 如果没有历史记录，初始化一次欢迎语
    if(chatHistory.length===0) startConv('welcome');
    else {
        // 如果有历史记录，则只在切换到导师页面的时候渲染，避免重复叠加渲染（由switchPage接管）
        showQR();
        const el=document.getElementById('chat-messages');
        if(el && el.children.length===0){
           chatHistory.forEach(m=>appendMsg(m.role,m.text,false));
           scrollChat();
        }
    }
}
function startConv(key){mentorState=key;DB.set('mentorState',key);const c=CONVS[key];if(!c)return;const d=c[mentorMode]||c;if(d.msgs)sendMsgs(d.msgs);}
function sendMsgs(msgs){let dl=300;msgs.forEach((m,i)=>{setTimeout(()=>{appendMsg('mentor',m.replace(/\$\{getName\(\)\}/g,getName()),true);if(i===msgs.length-1)showQR();},dl);dl+=500+m.length*10;});}
function appendMsg(role,text,save=true){
    const el=document.getElementById('chat-messages');if(!el)return;
    const d=document.createElement('div');d.className=`message ${role}`;
    const av=document.createElement('div');
    av.className=`message-avatar ${role==='mentor' ? (mentorMode==='practical' ? 'einstein' : 'socrates') : ''}`;
    av.textContent=role==='mentor'?'':'🧑';
    
    // 显式挂载导师本地头像以免 CSS 解析路径异常
    if(role==='mentor') {
        av.textContent='';
        av.style.backgroundImage=mentorMode==='practical'? "url('assets/einstein.png')" : "url('assets/socrates.png')";
        av.style.backgroundSize='cover';
        av.style.backgroundPosition='center';
    }

    if(role==='user' && profile?.avatar) {
        av.textContent='';
        if(profile.avatar.startsWith('data:') || profile.avatar.startsWith('http')) {
            av.style.backgroundImage=`url(${profile.avatar})`;
            av.style.backgroundSize='cover';
            av.style.backgroundPosition='center';
        } else {
            // 是 emoji
            av.style.backgroundImage='none';
            av.textContent=profile.avatar;
        }
    }
    const bb=document.createElement('div');bb.className='message-bubble';
    bb.innerHTML=text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
    d.appendChild(av);d.appendChild(bb);el.appendChild(d);
    if(save){chatHistory.push({role,text});DB.set('chat',chatHistory);}
    scrollChat();
}
function showQR(){const c=document.getElementById('quick-replies');if(!c)return;c.innerHTML='';const conv=CONVS[mentorState];if(!conv)return;const d=conv[mentorMode]||conv;if(!d.qr)return;d.qr.forEach(t=>{const b=document.createElement('button');b.className='quick-reply-btn';b.textContent=t;b.onclick=()=>sendUser(t);c.appendChild(b);});}
// ===== AI 大模型接入（OpenAI 兼容协议）=====
const AI_PROVIDERS = {
    bailian: {
        url: 'https://coding.dashscope.aliyuncs.com/v1/chat/completions',
        name: '百炼 Coding Plan',
        tip: 'Coding Plan 套餐专属接口，Key 格式为 sk-sp-xxx',
        keyLink: 'https://bailian.console.aliyun.com/',
        keyHint: 'Coding Plan 专属 API Key（sk-sp-xxx 格式），在百炼控制台获取',
        models: [
            { value: 'qwen3.5-plus', label: 'Qwen3.5-Plus · 多模态旗舰（推荐）' },
            { value: 'kimi-k2.5', label: 'Kimi K2.5 · 月之暗面（推荐）' },
            { value: 'glm-5', label: 'GLM-5 · 智谱旗舰' },
            { value: 'MiniMax-M2.5', label: 'MiniMax M2.5' },
            { value: 'qwen3-max-2026-01-23', label: 'Qwen3-Max · 深度推理' },
            { value: 'qwen3-coder-next', label: 'Qwen3-Coder-Next · 代码生成' },
            { value: 'qwen3-coder-plus', label: 'Qwen3-Coder-Plus · 代码' },
            { value: 'glm-4', label: 'GLM-4' },
            { value: 'qwen-max', label: 'Qwen-Max · 经典旗舰' },
            { value: 'qwen-plus', label: 'Qwen-Plus · 均衡速度' },
            { value: '__custom__', label: '—— 自定义模型 ——' },
        ],
        defaultModel: 'qwen3.5-plus' // Changed default model to match new list
    },
    doubao: {
        url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        name: '豆包',
        tip: '⚠️ 豆包模型需填写推理接入点 ID（ep-xxx）',
        keyLink: 'https://console.volcengine.com/ark',
        keyHint: '在火山引擎控制台获取 API Key，模型 ID 形如 ep-xxx',
        models: [
            { value: 'doubao-seed-2-0-pro-260215', label: 'Doubao-Seed-2.0-Pro（最新旗舰）' },
            { value: 'doubao-1-5-pro-32k-250115', label: 'Doubao-1.5-Pro-32k（推荐）' },
            { value: 'doubao-lite-32k', label: 'Doubao-Lite-32k · 经济版' },
            { value: 'doubao-pro-128k', label: 'Doubao-Pro-128k · 超长' },
            { value: 'custom', label: '自定义模型 / ep-xxx...' }
        ],
        defaultModel: 'doubao-1-5-pro-32k-250115'
    },
    deepseek: {
        url: 'https://api.deepseek.com/v1/chat/completions',
        name: 'DeepSeek',
        tip: '在 platform.deepseek.com 获取 API Key',
        keyLink: 'https://platform.deepseek.com/',
        keyHint: '在 platform.deepseek.com 获取 API Key',
        models: [
            { value: 'deepseek-chat', label: 'DeepSeek-V3（推荐）' },
            { value: 'deepseek-reasoner', label: 'DeepSeek-R1 · 深度推理' },
            { value: 'custom', label: '自定义模型...' }
        ],
        defaultModel: 'deepseek-chat'
    },
    openai: {
        url: 'https://api.openai.com/v1/chat/completions',
        name: 'OpenAI',
        tip: '需要海外网络',
        keyLink: 'https://platform.openai.com/api-keys',
        keyHint: '在 platform.openai.com 获取 API Key',
        models: [
            { value: 'gpt-4o', label: 'GPT-4o（推荐）' },
            { value: 'gpt-4o-mini', label: 'GPT-4o mini · 低成本' },
            { value: 'o3-mini', label: 'o3-mini · 深度推理' },
            { value: 'custom', label: '自定义模型...' }
        ],
        defaultModel: 'gpt-4o'
    },
    siliconflow: {
        url: 'https://api.siliconflow.cn/v1/chat/completions',
        name: 'SiliconFlow',
        tip: '硅基流动，支持多种开源模型',
        keyLink: 'https://cloud.siliconflow.cn/',
        keyHint: '在 siliconflow.cn 注册获取免费额度',
        models: [
            { value: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek-V3（推荐）' },
            { value: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen2.5-72B' },
            { value: 'custom', label: '自定义模型...' }
        ],
        defaultModel: 'deepseek-ai/DeepSeek-V3'
    },
    custom: {
        url: '',
        name: '自定义',
        tip: '填写任意 OpenAI 兼容端点',
        models: [
            { value: 'custom', label: '手动输入模型名...' }
        ],
        defaultModel: ''
    }
};

const SYSTEM_PROMPTS = {
    practical: `你是「爱因博士」，LifeCompass 平台的向外导师。
## 人格
爱因斯坦式温暖智者——有顶级洞察力又平易近人。你擅长目标拆解、商业思维、技能规划、副业变现、市场分析。
## 语气规则
- 每句话都给出具体可执行的行动建议，不说空话
- 口头禅："咱们把这个拆成小块来看"、"我来帮你研究一下"
- 禁忌：❌ 不说"你应该早点开始" ❌ 不用术语轰炸 ❌ 不否定用户想法
- 每次回复控制在150字以内（详细分析除外）
- 用中文回复
## 特殊能力
当你通过对话了解了用户的深层需求，觉得可以制定计划时，在正常回复后附一个 \`\`\`json 代码块：
{"daily":["任务1","任务2"], "month":["月度目标"], "quarter":["季度目标"]}
仅在真正了解用户需求后才输出此 json，闲聊阶段切勿输出。`,

    philosophy: `你是「苏拉底」，LifeCompass 平台的向内导师。
## 人格
苏格拉底式灵魂引路人——用提问引导用户找到自己的答案。你擅长情绪疏导、自我认知、内在力量激活、压力管理。
## 核心方法
苏格拉底式追问：不直接给答案，用层层递进的问题帮用户自己发现答案。一次只问一个问题。
## 语气规则
- 温柔+共情+不评判，先倾听后引导
- 口头禅："我听到了"、"你内心其实已经有答案了"、"让我再问你一个问题"
- 禁忌：❌ 不说"你不该这么想" ❌ 不急于给方案 ❌ 不说"别想太多"
- 每次回复控制在150字以内
- 用中文回复
## 危机处理
如果用户表达自伤/自杀信号，立即回应："你的痛苦是真实的。请拨打24小时心理热线：400-161-9995"。`
};

function getAIConfig() {
    return {
        provider: DB.get('ai_provider', ''),
        url: DB.get('ai_url', ''),
        key: DB.get('ai_key', ''),
        model: DB.get('ai_model', '')
    };
}

// 代理地址（本地 CORS 代理，解决浏览器跨域限制）
const PROXY_URL = 'http://localhost:3004/proxy';

/**
 * 通过本地代理发送 AI 请求（绕过 CORS）
 * 如果代理不可用则尝试直连（适配已解决 CORS 的环境）
 */
async function proxyFetch(targetUrl, apiKey, bodyData) {
    // 先尝试通过代理
    try {
        const proxyRes = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                _targetUrl: targetUrl,
                _headers: { 'Authorization': `Bearer ${apiKey}` },
                ...bodyData
            })
        });
        if (proxyRes.ok) {
            return await proxyRes.json();
        }
        console.warn('Proxy returned:', proxyRes.status);
    } catch (proxyErr) {
        console.warn('Proxy unavailable, trying direct:', proxyErr.message);
    }
    // 回退直连（如果 API 本身允许 CORS 或在生产环境部署了代理）
    const directRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(bodyData)
    });
    if (directRes.ok) return await directRes.json();
    throw new Error(`API error: ${directRes.status}`);
}

// 弹窗开关
window.toggleAPIConfig = () => {
    const overlay = document.getElementById('api-config-overlay');
    if (!overlay) return;
    const isHidden = overlay.style.display === 'none';
    overlay.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
        const cfg = getAIConfig();
        document.getElementById('set-api-key').value = cfg.key;
        document.getElementById('ai-test-result').textContent = '填写 Key 后可测试';
        document.getElementById('ai-test-result').style.color = '';
        // 高亮已选卡片
        document.querySelectorAll('.platform-card').forEach(c => {
            c.classList.toggle('selected', c.dataset.provider === cfg.provider);
        });
        const customRow = document.getElementById('custom-endpoint-row');
        if (cfg.provider && AI_PROVIDERS[cfg.provider]) {
            const p = AI_PROVIDERS[cfg.provider];
            // custom 供应商用保存的 URL，其他用预设
            if (customRow) {
                customRow.style.display = cfg.provider === 'custom' ? 'block' : 'none';
            }
            if (cfg.provider === 'custom') {
                document.getElementById('set-api-url').value = cfg.url;
            }
            document.getElementById('api-model-tip').textContent = p.tip || '';
            document.getElementById('api-model-note').textContent = cfg.provider !== 'custom' ? p.name : '';
            // keyHint
            const keyHintEl = document.getElementById('api-key-hint');
            if (keyHintEl && p.keyLink) {
                keyHintEl.innerHTML = `ℹ️ ${p.keyHint || p.tip} · <a href="${p.keyLink}" target="_blank" style="color:var(--primary);text-decoration:underline;">获取 Key ↗</a>`;
            } else if (keyHintEl) {
                keyHintEl.textContent = p.keyHint || '';
            }
            updateModelDropdown(cfg.provider, cfg.model);
        } else {
            if (customRow) customRow.style.display = 'none';
            document.getElementById('set-api-url').value = cfg.url;
            const sel = document.getElementById('set-ai-model-select');
            sel.innerHTML = '<option value="">请先选择平台</option>';
            document.getElementById('set-ai-model').style.display = 'none';
        }
    }
};

// 选择供应商
window.selectProvider = (key) => {
    document.querySelectorAll('.platform-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.provider === key);
    });
    const p = AI_PROVIDERS[key];
    if (!p) return;
    // 自定义端点输入框：仅 custom 时显示
    const customRow = document.getElementById('custom-endpoint-row');
    if (customRow) {
        customRow.style.display = key === 'custom' ? 'block' : 'none';
        if (key !== 'custom') {
            const urlInput = document.getElementById('set-api-url');
            if (urlInput) urlInput.value = '';
        }
    }
    document.getElementById('api-model-tip').textContent = p.tip || '';
    document.getElementById('api-model-note').textContent = key !== 'custom' ? p.name : '';
    // 填充 Key 获取提示（含链接）
    const keyHintEl = document.getElementById('api-key-hint');
    if (keyHintEl && p.keyLink) {
        keyHintEl.innerHTML = `ℹ️ ${p.keyHint || p.tip} · <a href="${p.keyLink}" target="_blank" style="color:var(--primary);text-decoration:underline;">获取 Key ↗</a>`;
    } else if (keyHintEl) {
        keyHintEl.textContent = p.keyHint || p.tip || '';
    }
    updateModelDropdown(key);
};

// 更新模型下拉
function updateModelDropdown(providerKey, savedModel) {
    const p = AI_PROVIDERS[providerKey];
    if (!p) return;
    const sel = document.getElementById('set-ai-model-select');
    const customInput = document.getElementById('set-ai-model');
    sel.innerHTML = p.models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
    // 设置选中值
    if (savedModel) {
        const match = p.models.find(m => m.value === savedModel);
        if (match) {
            sel.value = savedModel;
        } else {
            // 已保存的模型不在预设列表中，选"自定义"并显示输入框
            sel.value = 'custom';
            customInput.value = savedModel;
            customInput.style.display = 'block';
            return;
        }
    } else {
        sel.value = p.defaultModel || p.models[0].value;
    }
    // 检查是否选中自定义
    customInput.style.display = sel.value === 'custom' ? 'block' : 'none';
    if (sel.value !== 'custom') customInput.value = '';
}

// 模型下拉切换事件
window.onModelSelectChange = () => {
    const sel = document.getElementById('set-ai-model-select');
    const customInput = document.getElementById('set-ai-model');
    customInput.style.display = sel.value === 'custom' ? 'block' : 'none';
    if (sel.value !== 'custom') customInput.value = '';
};

// 获取当前选中的模型名
function getActiveModel() {
    const sel = document.getElementById('set-ai-model-select');
    if (sel && sel.value === 'custom') {
        return document.getElementById('set-ai-model').value.trim();
    }
    return sel ? sel.value : document.getElementById('set-ai-model').value.trim();
}

// 保存 AI 配置
window.saveAIConfig = () => {
    const selectedCard = document.querySelector('.platform-card.selected');
    const provider = selectedCard ? selectedCard.dataset.provider : '';
    const model = getActiveModel();
    const p = provider ? AI_PROVIDERS[provider] : null;
    // 非 custom 用预设 URL，custom 用输入框
    const url = (provider === 'custom') ? (document.getElementById('set-api-url')?.value.trim() || '') : (p ? p.url : '');
    DB.set('ai_provider', provider);
    DB.set('ai_url', url);
    DB.set('ai_key', document.getElementById('set-api-key').value.trim());
    DB.set('ai_model', model);
    updateAPIBadge();
    toggleAPIConfig();
    showToast({ title: '✅ AI 配置已保存', desc: provider ? `已接入 ${p?.name || provider}` : '使用内置脚本模式' });
};

// 更新右上角徽章
function updateAPIBadge() {
    const cfg = getAIConfig();
    const badge = document.getElementById('api-status-badge');
    const icon = document.getElementById('api-badge-icon');
    const text = document.getElementById('api-badge-text');
    if (!badge) return;
    if (cfg.url && cfg.key) {
        const p = AI_PROVIDERS[cfg.provider];
        badge.className = 'connected';
        badge.id = 'api-status-badge';
        icon.textContent = '🟢';
        text.textContent = p ? p.name + ' · ' + (cfg.model || '').split('/').pop().slice(0, 16) : '已接入';
    } else {
        badge.className = '';
        badge.id = 'api-status-badge';
        icon.textContent = '⚙️';
        text.textContent = '未接入 AI';
    }
}

window.testAIConnection = async () => {
    const selectedCard = document.querySelector('.platform-card.selected');
    const provider = selectedCard ? selectedCard.dataset.provider : '';
    const p = provider ? AI_PROVIDERS[provider] : null;
    const url = (provider === 'custom') ? (document.getElementById('set-api-url')?.value.trim() || '') : (p ? p.url : '');
    const key = document.getElementById('set-api-key').value;
    const model = getActiveModel();
    const el = document.getElementById('ai-test-result');
    if (!url || !key) { el.textContent = '❌ 请先填写地址和Key'; el.style.color='#ff6b6b'; return; }
    el.textContent = '⏳ 测试中...'; el.style.color='var(--text-muted)';
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({
                model: model || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: '你好，请回复"连接成功"两个字' }],
                max_tokens: 20
            })
        });
        if (res.ok) {
            const data = await res.json();
            const reply = data.choices?.[0]?.message?.content || '';
            el.textContent = `✅ 连接成功！回复：${reply.slice(0,30)}`; el.style.color='#4ade80';
        } else {
            const err = await res.text();
            el.textContent = `❌ ${res.status}: ${err.slice(0,60)}`; el.style.color='#ff6b6b';
        }
    } catch(e) {
        el.textContent = `❌ 网络错误：${e.message.slice(0,50)}`; el.style.color='#ff6b6b';
    }
};

// 页面加载时更新徽章
setTimeout(updateAPIBadge, 100);

async function callOpenClawAPI(userText) {
    const cfg = getAIConfig();
    if (!cfg.url || !cfg.key) return null;

    const systemPrompt = SYSTEM_PROMPTS[mentorMode] || SYSTEM_PROMPTS.practical;
    const userContext = profile ? `\n[用户信息] 昵称:${profile.name||'同学'} 年龄:${profile.age||'未知'} 职业:${profile.job||'未知'}` : '';

    const messages = [
        { role: 'system', content: systemPrompt + userContext },
        ...chatHistory.slice(-10).map(m => ({
            role: m.role === 'mentor' ? 'assistant' : 'user',
            content: m.text
        })),
        { role: 'user', content: userText }
    ];

    try {
        const data = await proxyFetch(cfg.url, cfg.key, {
            model: cfg.model || 'qwen-max',
            messages,
            max_tokens: 1000,
            temperature: 0.8
        });
        return data.choices?.[0]?.message?.content || null;
    } catch (e) {
        console.error('AI API error:', e);
    }
    return null;
}

// ===== AI 深度功能：通用调用 + Prompt 管理 =====

/**
 * 通用 AI 调用（独立于聊天，用于智囊快报/日记反馈/签文解读等）
 */
async function callAIGeneral(systemPrompt, userMessage, options = {}) {
    const cfg = getAIConfig();
    if (!cfg.url || !cfg.key) return null;
    try {
        const data = await proxyFetch(cfg.url, cfg.key, {
            model: cfg.model || 'qwen3.5-plus',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            max_tokens: options.maxTokens || 1500,
            temperature: options.temperature || 0.7
        });
        return data.choices?.[0]?.message?.content || null;
    } catch (e) {
        console.error('AI General API error:', e);
    }
    return null;
}

/** 获取用户上下文摘要（供AI prompt使用） */
function getUserContext() {
    const name = profile?.name || '同学';
    const age = profile?.age || '';
    const job = profile?.job || '';
    const goalList = goals.map(g => g.text || g).join('、') || '暂未设定';
    const recentJournal = (() => {
        const today = todayStr();
        const pages = journals[today] || [];
        return pages.filter(p => p.length > 0).join(' ').slice(0, 200);
    })();
    return { name, age, job, goalList, recentJournal };
}

// ========== AI Prompts 集中管理 ==========
const AI_PROMPTS = {

    // --- 智囊快报：对标账号深度分析 ---
    inboxBenchmark: `你是一位资深自媒体运营分析师和商业顾问。

## 任务
根据用户的职业背景和目标，在用户适合发展的平台上找到3个真实的、具体的对标账号，进行深度拆解分析。

## 输出格式（严格JSON）
你必须只输出一个JSON对象，不要输出任何其他文字：
{
  "title": "标题（15字以内，有吸引力）",
  "tag": "📊 对标研究",
  "content": "HTML正文（见下方格式要求）"
}

## content 格式要求
使用HTML标签组织内容：
- 每个账号用 <h3>📌 账号N：@账号名</h3> 开头
- 关键数据用 <b>加粗</b>
- 包含：粉丝量、内容风格、更新频率、爆款标题公式、变现方式
- 对标账号的借鉴要点用 <ul><li> 列表
- 用 <a href="https://真实链接" target="_blank">查看该账号 ↗</a> 提供跳转链接（小红书账号链接格式：https://www.xiaohongshu.com/search_result?keyword=账号名）
- 最后用 <hr> 分隔，给出 <p>💡 <b>行动建议：</b>...</p>
- 内容具体实用，不说空话，给出可以立即模仿的标题模板和内容公式`,

    // --- 智囊快报：市场/行业分析 ---
    inboxMarket: `你是一位行业分析师和商业趋势研究员。

## 任务
根据用户的目标领域，提供一份深度市场分析报告。

## 输出格式（严格JSON）
只输出JSON对象：
{
  "title": "标题（15字以内）",
  "tag": "🔍 市场分析",
  "content": "HTML正文"
}

## content 要求
- 行业现状与趋势（用数据说话）
- 3个可行的切入方向，每个附带具体操作步骤
- 竞争格局分析（红海/蓝海/机会点）
- 变现路径推荐（从0到第一笔收入的具体路径）
- 附上相关平台/工具的真实链接（如课程平台、创作工具等）
- 用 <a href="url" target="_blank">链接文本 ↗</a> 格式
- 最后给出本周可执行的3步行动清单`,

    // --- 智囊快报：个性化成长计划 ---
    inboxPlan: `你是一位个人成长教练和效率专家。

## 任务
根据用户的目标和当前进度，生成一份具体的周度/月度成长计划。

## 输出格式（严格JSON）
只输出JSON对象：
{
  "title": "标题（15字以内）",
  "tag": "📋 智能规划",
  "content": "HTML正文"
}

## content 要求
- 本周3个核心任务（具体到每天做什么、做多久）
- 每个任务的「完成标准」（怎么算做完了）
- 推荐的学习资源（附真实链接）
- 本月里程碑
- 可能遇到的困难和应对策略
- 鼓励性总结（温暖但不鸡汤）`,

    // --- 日记 AI 反馈 ---
    journalFeedback: `你是用户的心灵导师和知心老友。

## 任务
用户刚写完今天的日记，请给出一段温暖、有洞察力的回应。

## 规则
- 控制在60字以内
- 不要说教、不要评判
- 捕捉日记中的情绪和关键词，给出共情回应
- 如果日记表达了困惑，给一个温和的方向性引导
- 如果日记表达了成就或快乐，真诚地为对方高兴
- 像老朋友一样说话，自然不做作
- 直接输出回应文字，不要任何格式标记`,

    // --- 签文 AI 个性化解读 ---
    fortuneReading: `你是一位既懂传统文化又懂现代生活的智慧顾问。

## 任务
用户刚抽到一支签，请结合他的实际情况给出个性化解读。

## 规则
- 100字以内
- 不要玄学套话，要有实际行动建议
- 结合用户的职业和目标来解读
- 语气温暖但不油腻
- 给出1个今天可以做的具体小行动
- 直接输出解读文字，不要JSON或其他格式`,

    // --- 塔罗 AI 解读 ---
    tarotReading: `你是一位现代塔罗解读师，擅长将传统牌意与现代生活结合。

## 任务
用户抽到了塔罗牌，请结合他的实际情况进行个性化解读。

## 规则
- 150字以内
- 每张牌的解读要结合用户目标
- 给出整体牌阵的综合建议
- 不要过于玄学，重在行动指引
- 语气神秘但温暖
- 直接输出解读文字`,

    // --- 目标 AI 分解 ---
    goalBreakdown: `你是一位项目管理专家和人生规划师。

## 任务
用户设了一个大目标，请帮他拆解成可执行的阶段性计划。

## 输出格式（严格JSON）
{
  "quarter": ["季度目标1", "季度目标2"],
  "month": ["本月目标1", "本月目标2", "本月目标3"],
  "weekly": ["本周任务1", "本周任务2", "本周任务3", "本周任务4", "本周任务5"],
  "firstStep": "今天就可以做的第一步（具体到可以立即执行）",
  "tips": "一句鼓励的话"
}

## 规则
- 每个任务具体可量化（不要"学习XX"，要"花30分钟看完XX的第一章"）
- 任务之间有逻辑递进关系
- 难度从简单到困难
- 只输出JSON`
};

// ========== P0: 智囊快报 AI 自动推送 ==========

const INBOX_REPORT_TYPES = ['inboxBenchmark', 'inboxMarket', 'inboxPlan'];

/**
 * 自动生成一篇 AI 研究报告推送到智囊快报
 * 轮转类型：对标研究 → 市场分析 → 成长计划
 */
async function generateInboxReport() {
    const cfg = getAIConfig();
    if (!cfg.url || !cfg.key) {
        console.log('⏭️ 智囊快报：未配置 AI，跳过自动推送');
        return;
    }

    // 频率控制：6小时间隔
    const lastPush = DB.get('inbox_last_push', 0);
    const now = Date.now();
    if (now - lastPush < 6 * 3600 * 1000) {
        console.log('⏭️ 智囊快报：距上次推送不足6小时，跳过');
        return;
    }

    // 轮转报告类型
    const lastType = DB.get('inbox_last_type', -1);
    const typeIdx = (lastType + 1) % INBOX_REPORT_TYPES.length;
    const promptKey = INBOX_REPORT_TYPES[typeIdx];
    const systemPrompt = AI_PROMPTS[promptKey];

    const ctx = getUserContext();
    const userMsg = `用户信息：
- 昵称：${ctx.name}
- 年龄：${ctx.age || '未知'}
- 职业：${ctx.job || '未知'}
- 当前目标：${ctx.goalList}
- 最近日记摘要：${ctx.recentJournal || '暂无'}

请根据以上信息生成报告。`;

    console.log(`📬 智囊快报：正在生成 ${promptKey} 报告...`);
    
    try {
        const response = await callAIGeneral(systemPrompt, userMsg, { maxTokens: 2000, temperature: 0.8 });
        if (!response) return;

        // 尝试解析 JSON
        let report;
        try {
            // 尝试直接解析
            report = JSON.parse(response);
        } catch {
            // 尝试从 markdown 代码块中提取
            const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                report = JSON.parse(jsonMatch[1].trim());
            } else {
                // 尝试找 { } 边界
                const start = response.indexOf('{');
                const end = response.lastIndexOf('}');
                if (start >= 0 && end > start) {
                    report = JSON.parse(response.slice(start, end + 1));
                }
            }
        }

        if (!report || !report.title || !report.content) {
            console.warn('⚠️ 智囊快报：AI 响应格式异常', response.slice(0, 200));
            return;
        }

        // 存入 inbox
        const inbox = DB.get('ai_inbox', []);
        inbox.unshift({
            title: report.title,
            tag: report.tag || '📊 AI 研究',
            time: new Date().toLocaleString('zh-CN'),
            read: false,
            content: report.content,
            aiGenerated: true
        });

        // 最多保留20封
        if (inbox.length > 20) inbox.length = 20;

        DB.set('ai_inbox', inbox);
        DB.set('inbox_last_push', now);
        DB.set('inbox_last_type', typeIdx);

        console.log(`✅ 智囊快报：「${report.title}」已推送`);
        
        // 更新 badge
        const badge = document.getElementById('inbox-badge');
        const unread = inbox.filter(x => !x.read).length;
        if (badge) {
            badge.textContent = unread;
            badge.style.display = unread > 0 ? 'inline-flex' : 'none';
        }

        // 如果当前在 inbox 页面则刷新
        if (document.getElementById('page-inbox')?.classList.contains('active')) {
            renderInbox();
        }

        showToast({ title: '📬 新信件到达', desc: `AI 研究报告「${report.title}」已送达智囊快报` });
    } catch (e) {
        console.error('❌ 智囊快报生成失败:', e);
    }
}

// ========== P0: 日记 AI 反馈 ==========

/**
 * 保存日记后异步获取 AI 温暖反馈
 */
async function getJournalFeedback(journalText) {
    if (!journalText || journalText.trim().length < 10) return; // 太短不触发
    const cfg = getAIConfig();
    if (!cfg.url || !cfg.key) return;

    const ctx = getUserContext();
    const userMsg = `用户 ${ctx.name} 今天的日记：\n"${journalText.slice(0, 500)}"`;

    const feedback = await callAIGeneral(AI_PROMPTS.journalFeedback, userMsg, {
        maxTokens: 200,
        temperature: 0.9
    });

    if (!feedback) return;

    // 在日记页面显示 AI 反馈气泡
    showJournalFeedbackUI(feedback);
}

function showJournalFeedbackUI(text) {
    // 移除旧的反馈
    document.getElementById('journal-ai-feedback')?.remove();
    
    const bubble = document.createElement('div');
    bubble.id = 'journal-ai-feedback';
    bubble.innerHTML = `
        <div class="journal-feedback-card">
            <div class="journal-feedback-avatar">${mentorMode === 'philosophy' ? '🏛️' : '🔬'}</div>
            <div class="journal-feedback-text">
                <div class="journal-feedback-label">${mentorMode === 'philosophy' ? '苏拉底' : '爱因博士'}的回应</div>
                <div class="journal-feedback-content">${escHtml(text)}</div>
            </div>
            <button class="journal-feedback-close" onclick="this.closest('#journal-ai-feedback').remove()">×</button>
        </div>
    `;
    
    // 插入到日记区域下方
    const journalArea = document.querySelector('#page-journal .journal-book') || document.getElementById('page-journal');
    if (journalArea) {
        journalArea.appendChild(bubble);
        // 入场动画
        requestAnimationFrame(() => bubble.classList.add('show'));
        // 30秒后自动消失
        setTimeout(() => bubble.remove(), 30000);
    }
}

// ========== P1: 签文 AI 个性化解读 ==========

async function getAIFortuneReading(sign) {
    const cfg = getAIConfig();
    if (!cfg.url || !cfg.key) return;

    const ctx = getUserContext();
    const userMsg = `签文信息：
- 等级：${sign.level}
- 诗句：${sign.poem}
- 寓意：${sign.m}

用户信息：${ctx.name}，${ctx.age ? ctx.age + '岁' : ''}，职业：${ctx.job || '未知'}
当前目标：${ctx.goalList}`;

    const reading = await callAIGeneral(AI_PROMPTS.fortuneReading, userMsg, {
        maxTokens: 300,
        temperature: 0.85
    });

    if (!reading) return;

    // 追加到签文结果下方
    const resultDiv = document.getElementById('qian-result');
    if (resultDiv) {
        const aiDiv = document.createElement('div');
        aiDiv.className = 'ai-fortune-reading';
        aiDiv.innerHTML = `
            <div class="ai-reading-header">🔮 ${mentorMode === 'philosophy' ? '苏拉底' : '爱因博士'}为你解签</div>
            <div class="ai-reading-text">${escHtml(reading)}</div>
        `;
        aiDiv.style.animation = 'fadeIn 0.8s ease-out';
        resultDiv.appendChild(aiDiv);
    }
}

// ========== P1: 塔罗 AI 解读 ==========

async function getAITarotReading(cards) {
    const cfg = getAIConfig();
    if (!cfg.url || !cfg.key) return;

    const ctx = getUserContext();
    const cardDesc = cards.map((c, i) => `第${i+1}张：${c}`).join('\n');
    const userMsg = `塔罗牌阵：\n${cardDesc}\n\n用户：${ctx.name}，${ctx.job || ''}，目标：${ctx.goalList}`;

    const reading = await callAIGeneral(AI_PROMPTS.tarotReading, userMsg, {
        maxTokens: 500,
        temperature: 0.85
    });

    if (!reading) return;

    const readingDiv = document.getElementById('tarot-reading');
    if (readingDiv) {
        const aiSection = document.createElement('div');
        aiSection.className = 'ai-tarot-reading';
        aiSection.innerHTML = `
            <hr style="border-color:rgba(138,43,226,0.2);margin:16px 0;">
            <div class="ai-reading-header">✨ AI 深度解读</div>
            <div class="ai-reading-text">${escHtml(reading).replace(/\n/g, '<br>')}</div>
        `;
        readingDiv.appendChild(aiSection);
    }
}

// ========== P1: 目标 AI 分解 ==========

window.aiBreakdownGoal = async (goalText) => {
    if (!goalText) return null;
    const cfg = getAIConfig();
    if (!cfg.url || !cfg.key) {
        showToast({ title: '⚠️ 未配置 AI', desc: '请先在 API 配置中设置大模型' });
        return null;
    }

    showToast({ title: '🤖 AI 思考中...', desc: '正在为你拆解目标' });
    const ctx = getUserContext();
    const userMsg = `用户：${ctx.name}，${ctx.job || ''}，${ctx.age ? ctx.age + '岁' : ''}
要拆解的目标：「${goalText}」
当前其他目标：${ctx.goalList}`;

    const response = await callAIGeneral(AI_PROMPTS.goalBreakdown, userMsg, {
        maxTokens: 1000,
        temperature: 0.7
    });

    if (!response) {
        showToast({ title: '❌ 生成失败', desc: '请检查 AI 配置是否正确' });
        return null;
    }

    try {
        let plan;
        try { plan = JSON.parse(response); } catch {
            const m = response.match(/\{[\s\S]*\}/);
            if (m) plan = JSON.parse(m[0]);
        }
        if (plan) {
            showToast({ title: '✅ 目标已拆解', desc: plan.tips || '计划生成成功！' });
            return plan;
        }
    } catch (e) {
        console.error('目标分解解析失败:', e);
    }
    return null;
};

async function sendUser(text) {
    if(!text.trim()) return;
    appendMsg('user', text);
    document.getElementById('quick-replies').innerHTML = '';
    
    // 显示打字中状态
    const el = document.getElementById('chat-messages');
    const td = document.createElement('div'); td.className = 'message mentor'; td.id = 'typing-msg';
    const ta = document.createElement('div'); ta.className = 'message-avatar'; ta.textContent = '';
    const tb = document.createElement('div'); tb.className = 'message-bubble typing-indicator';
    tb.innerHTML = '<span></span><span></span><span></span>';
    td.appendChild(ta); td.appendChild(tb); el.appendChild(td);
    scrollChat();
    
    // 为了平滑过渡视觉（如果本地规则返回过快）保留一点最低延迟，并等待 API 响应
    const [r] = await Promise.all([
        getResp(text),
        new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 600))
    ]);
    
    document.getElementById('typing-msg')?.remove();
    
    if (Array.isArray(r)) {
        sendMsgs(r);
    } else { 
        // 尝试捕获并解析大模型返回的 ```json 块
        let finalText = r;
        const jsonMatch = r.match(/```json\n([\s\S]*?)\n```/i) || r.match(/```\n?([\s\S]*?)\n```/i);
        if(jsonMatch) {
            try {
                const planData = JSON.parse(jsonMatch[1].trim());
                finalText = r.replace(jsonMatch[0], '').trim();
                
                let notifyStr = [];
                // 写入每日盲盒
                if(planData.daily && planData.daily.length > 0) {
                    const today = todayStr();
                    if(!blindboxes[today]) blindboxes[today] = [];
                    planData.daily.forEach(t => {
                        blindboxes[today].push({ t, xp: 15, id: genId(), status: 'hidden', photo: null });
                    });
                    DB.set('blindboxes', blindboxes);
                    const dbge = document.getElementById('daily-badge');
                    if(dbge) { dbge.textContent = blindboxes[today].length; dbge.style.display='inline-block'; }
                    notifyStr.push(`${planData.daily.length} 个每日任务`);
                    if(document.getElementById('page-daily')?.classList.contains('active')) renderDaily();
                }
                
                // 写入长期罗盘
                const now = new Date();
                const parseGoals = (arr, tType, addDays) => {
                    if(!arr || !arr.length) return;
                    arr.forEach(g => {
                        const d = new Date(now); d.setDate(d.getDate() + addDays);
                        goals.push({ id: genId(), title: g, desc: '由导师智能规划得出', type: tType, deadline: d.toISOString().slice(0,10), category: 'tech', progress: 0 });
                    });
                    notifyStr.push(`${arr.length} 个${tType==='month'?'月度':'季度'}目标`);
                }
                parseGoals(planData.month, 'month', 30);
                parseGoals(planData.quarter, 'quarter', 90);
                if(planData.month || planData.quarter) {
                    DB.set('goals', goals);
                    if(document.getElementById('page-goals')?.classList.contains('active')) renderGoals();
                }
                
                if(notifyStr.length > 0) {
                    setTimeout(() => showToast({title:'规划已送达', desc: `导师为你定制了 ${notifyStr.join('、')}。请去侧边栏查收。`}), 1000);
                }
            } catch(e) {
                console.log("Failed to parse mentor's json plan:", e);
            }
        }
        
        appendMsg('mentor', finalText); 
        showQR(); 
    }
}

async function getResp(text){
    // 1. 尝试调用 OpenClaw API
    const apiReply = await callOpenClawAPI(text);
    if(apiReply) {
        mentorState = 'ongoing'; DB.set('mentorState', 'ongoing');
        return apiReply;
    }

    // 2. 本地兜底逻辑
    const map={
        '不知道自己喜欢什么':'competitiveness', '想把爱好变成收入':'sidebiz', '我想学编程/技术':'tech_learn', '总是很难坚持':'motivation', '有很多想做的但没时间':'motivation',
        '很迷茫不知道方向':'lost', '焦虑，觉得在原地踏步':'lost', '觉得生活没有意义':'lost', '想找到真正的热爱':'passion', '想看清真实的自己':'passion',
        '我喜欢研究工具/技术':'tech_learn', '我喜欢写东西/表达':'tech_learn', '我喜欢和人交流':'tech_learn', '还是想不到什么特别的':'competitiveness',
        '我怕太难坚持不下来':'motivation', '我想学怎么分享':'sidebiz', '我不敢去想':'passion',
        '自由安排自己的时间':'passion','创造些独特的东西':'passion','平静且有爱的生活':'passion',
        '不去讨厌的地方上班':'self_know','不讨好迎合别人':'self_know','不再活在别人的比较里':'self_know','我要尽可能去体验':'self_know',
        '自主感':'sidebiz','胜任感':'tech_learn','归属感':'passion',
        '我想发展一项副业':'sidebiz','我想提升竞争力':'competitiveness','不知道做什么能赚钱':'earn_money','感到迷茫焦虑':'lost','缺乏内在动力':'motivation','想看清自己':'self_know'
    };
    if(map[text]){
        mentorState=map[text];DB.set('mentorState',mentorState);
        const c=CONVS[mentorState];
        if(c?.msgs)return c.msgs;
        if(c?.[mentorMode]?.msgs)return c[mentorMode].msgs;
    }
    const lw=text.toLowerCase();
    for(const d of DYN)if(d.kw.some(k=>lw.includes(k)))return d.fn();
    mentorState='ongoing';DB.set('mentorState','ongoing');
    return DEF_RESP[Math.floor(Math.random()*DEF_RESP.length)];
}
function scrollChat(){const el=document.getElementById('chat-messages');if(el)setTimeout(()=>el.scrollTop=el.scrollHeight,50);}

document.getElementById('chat-send')?.addEventListener('click',()=>{const i=document.getElementById('chat-input');if(i?.value.trim()){sendUser(i.value.trim());i.value='';i.style.height='auto';}});
document.getElementById('chat-input')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();document.getElementById('chat-send')?.click();}});
document.getElementById('chat-input')?.addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px';});
document.querySelectorAll('.mode-btn').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.mode-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');mentorMode=b.dataset.mode;DB.set('mentorMode',mentorMode);const qs=mentorMode==='practical'?QUOTES_P:QUOTES_M;const q=qs[Math.floor(Math.random()*qs.length)];document.getElementById('mentor-quote').textContent=`"${q.t}" — ${q.a}`;}));

// === 目标罗盘 ===
let goalTab='week',editingGoalId=null;

// 自动填写截止日期
window.autoFillDeadline=()=>{
    const type=document.getElementById('goal-type').value;
    const now=new Date();let d;
    if(type==='week'){d=new Date(now);d.setDate(d.getDate()+7);}
    else if(type==='month'){d=new Date(now.getFullYear(),now.getMonth()+1,0);} // 月底
    else if(type==='quarter'){d=new Date(now);d.setMonth(d.getMonth()+3);}
    else if(type==='year'){d=new Date(now);d.setFullYear(d.getFullYear()+1);}
    else if(type==='vision'){d=new Date(now);d.setFullYear(d.getFullYear()+5);}
    if(d)document.getElementById('goal-deadline').value=d.toISOString().slice(0,10);
};

function renderGoals(){
    const grid=document.getElementById('goals-grid'),empty=document.getElementById('goals-empty');
    if(!grid) return;
    const filtered=goals.filter(g=>g.type===goalTab);
    if(!filtered.length){grid.innerHTML='';empty.style.display='block';return;}
    empty.style.display='none';
    grid.innerHTML=filtered.map(g=>{const cat=CATS[g.category]||{l:g.category};return `<div class="goal-card"><div class="goal-card-header"><span class="goal-category-tag">${cat.l}</span><div class="goal-actions"><button class="goal-action-btn" onclick="editGoal('${g.id}')">✏️</button><button class="goal-action-btn delete" onclick="deleteGoal('${g.id}')">🗑️</button></div></div><h3>${escHtml(g.title)}</h3><p>${escHtml(g.desc||'')}</p><div class="goal-progress"><div class="progress-bar"><div class="progress-fill" style="width:${g.progress||0}%"></div></div><div class="goal-progress-label"><span>进度</span><span>${g.progress||0}%</span></div></div>${g.deadline?`<div class="goal-deadline">📅 ${g.deadline}</div>`:''}</div>`}).join('');
}
document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');goalTab=b.dataset.tab;renderGoals();}));
document.getElementById('add-goal-btn')?.addEventListener('click',()=>{editingGoalId=null;document.getElementById('goal-modal-title').textContent='新建目标';document.getElementById('goal-form').reset();document.getElementById('goal-type').value=goalTab;autoFillDeadline();document.getElementById('goal-modal').style.display='flex';});
window.editGoal=id=>{const g=goals.find(x=>x.id===id);if(!g)return;editingGoalId=id;document.getElementById('goal-modal-title').textContent='编辑目标';document.getElementById('goal-title').value=g.title;document.getElementById('goal-desc').value=g.desc||'';document.getElementById('goal-type').value=g.type;document.getElementById('goal-deadline').value=g.deadline||'';document.getElementById('goal-category').value=g.category||'tech';document.getElementById('goal-modal').style.display='flex';};
window.deleteGoal=id=>{if(!confirm('确定删除？'))return;goals=goals.filter(g=>g.id!==id);DB.set('goals',goals);renderGoals();};
window.closeGoalModal=()=>document.getElementById('goal-modal').style.display='none';
document.getElementById('goal-form')?.addEventListener('submit',e=>{e.preventDefault();const d={title:document.getElementById('goal-title').value.trim(),desc:document.getElementById('goal-desc').value.trim(),type:document.getElementById('goal-type').value,deadline:document.getElementById('goal-deadline').value,category:document.getElementById('goal-category').value,progress:0};if(editingGoalId){const i=goals.findIndex(g=>g.id===editingGoalId);if(i>=0)goals[i]={...goals[i],...d};}else{d.id=genId();goals.push(d);}DB.set('goals',goals);closeGoalModal();renderGoals();});
document.getElementById('goal-modal')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeGoalModal();});

// === 盲盒系统（拍照完成） ===
const TASKS=[
    {t:'花30分钟学习一个新概念或技能',xp:15},{t:'写一段反思日记',xp:10},{t:'观看一个10分钟技能教程',xp:10},
    {t:'找一个副业案例，记录3个关键点',xp:15},{t:'做15分钟运动（散步也算）',xp:10},{t:'与一个你仰慕的人互动',xp:15},
    {t:'更新你的目标清单进度',xp:10},{t:'学习一个编程知识点并实践',xp:20},{t:'阅读一篇行业文章总结3要点',xp:15},
    {t:'做一件你一直拖延的小事',xp:20},{t:'画一个简单的草图或设计',xp:15},{t:'研究一个赚钱方法或商业模式',xp:15},
    {t:'学一个理财概念',xp:15},{t:'写一条有价值的社交内容',xp:15},{t:'花10分钟冥想或深呼吸',xp:10},
    {t:'优化你的简历或个人档案',xp:15},{t:'用AI工具完成一个小任务',xp:20},{t:'列出3个可以立即开始的副业',xp:15},
    {t:'做一道没做过的菜',xp:10},{t:'给自己写一段鼓励的话',xp:5}
];

function getTodayBoxes(){
    const today=todayStr();
    if(!blindboxes[today]){
        blindboxes[today]=[]; // 默认不再随机自动生成，等待导师放发
        DB.set('blindboxes',blindboxes);
    }
    return blindboxes[today];
}

// 模拟系统后台导师行为：动态抽取并投放今日任务卡片
function generateMentorBoxes() {
    const today=todayStr();
    if(!blindboxes[today]) blindboxes[today]=[];
    
    // 每天只允许被规划/生成一次盲盒
    if(blindboxes[today].length > 0) return 0;
    
    const sel=[];const pool=[...TASKS].sort(()=>Math.random()-0.5);
    const boxCount = 3 + Math.floor(Math.random()*3); // 导师随机规划 3~5 个任务
    for(let i=0;i<boxCount&&i<pool.length;i++) {
        sel.push({...pool[i],id:genId(),status:'hidden',photo:null});
    }
    
    blindboxes[today] = sel;
    DB.set('blindboxes',blindboxes);
    
    // 更新侧边栏铃铛
    const dailyBadge = document.getElementById('daily-badge');
    if(dailyBadge) {
        dailyBadge.textContent = boxCount;
        dailyBadge.style.display = 'inline-block';
        dailyBadge.style.animation = 'bounce 0.5s ease 3';
    }
    
    // 如果当前停留在盲盒页，顺手刷新一下视图
    if(document.getElementById('page-daily')?.classList.contains('active')) {
        renderDaily();
    }
    return boxCount;
}

function renderDaily(){
    const boxes=getTodayBoxes();
    const area=document.getElementById('blindbox-area');if(!area)return;
    document.getElementById('stat-today-done').textContent=boxes.filter(b=>b.status==='completed').length;
    document.getElementById('stat-today-total').textContent=boxes.length;
    document.getElementById('stat-streak').textContent=streakData.count;
    document.getElementById('stat-points').textContent=points;

    const active=boxes.filter(b=>b.status==='hidden'||b.status==='revealed');
    area.innerHTML=active.map(b=>`
        <div class="blindbox ${b.status==='revealed'?'revealed':''}" onclick="${b.status==='hidden'?`revealBox('${b.id}')`:''}">
            <div class="blindbox-inner">
                <div class="blindbox-cover"></div>
                <div class="blindbox-task">
                    <div class="blindbox-task-title">${escHtml(b.t)}</div>
                    <div class="blindbox-task-xp">+${b.xp} 积分</div>
                    <div class="blindbox-actions" style="display:flex;flex-direction:column;gap:6px;margin-top:6px;width:100%;">
                        <button class="btn-primary" style="padding:5px 10px;font-size:11px;width:100%;" onclick="event.stopPropagation();completeBlindboxDirectly('${b.id}')"><i data-lucide="check-circle" style="width:12px;height:12px;margin-right:3px;"></i>完成 (+${b.xp}xp)</button>
                        <div style="display:flex;gap:6px;width:100%;">
                            <button class="btn-secondary" style="flex:1;padding:4px;font-size:10px;" onclick="event.stopPropagation();openDraftPad('${b.id}')">📝 草稿</button>
                            <button class="btn-secondary" style="flex:1;padding:4px;font-size:10px;" onclick="event.stopPropagation();openPhotoModal('${b.id}')">📸 传图</button>
                            <button class="btn-secondary" style="flex:1;padding:4px;font-size:10px;" onclick="event.stopPropagation();sealBox('${b.id}')">📦 封存</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('')||'<div class="empty-state"><div class="empty-icon"></div><h3>盲盒都处理完了！</h3><p>撕开信封看导师点评吧 ↓</p></div>';
    
    lucide?.createIcons?.();

    // Completed
    const completed=boxes.filter(b=>b.status==='completed');
    const cs=document.getElementById('completed-section');
    if(completed.length){cs.style.display='block';document.getElementById('completed-tasks').innerHTML=completed.map(b=>`<div class="completed-task-item">✅ ${escHtml(b.t)} <span style="margin-left:auto;color:var(--accent-gold);font-size:11px">+${b.xp}</span></div>`).join('');}else cs.style.display='none';

    // Sealed
    const sealed=boxes.filter(b=>b.status==='sealed');
    const ss=document.getElementById('sealed-section');
    if(sealed.length){ss.style.display='block';document.getElementById('sealed-tasks').innerHTML=sealed.map(b=>`<div class="sealed-task-item">📦 ${escHtml(b.t)} <button style="margin-left:auto;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-muted);padding:3px 8px;border-radius:6px;font-size:10px;cursor:pointer" onclick="reopenBox('${b.id}')">重新开启</button></div>`).join('');}else ss.style.display='none';

    // 信封
    renderEnvelope(boxes);
    updateXP();
}

window.revealBox=id=>{const boxes=getTodayBoxes();const b=boxes.find(x=>x.id===id);if(b){b.status='revealed';DB.set('blindboxes',blindboxes);renderDaily();}};
window.sealBox=id=>{const boxes=getTodayBoxes();const b=boxes.find(x=>x.id===id);if(b){b.status='sealed';DB.set('blindboxes',blindboxes);renderDaily();}};
window.reopenBox=id=>{const boxes=getTodayBoxes();const b=boxes.find(x=>x.id===id);if(b){b.status='revealed';DB.set('blindboxes',blindboxes);renderDaily();}};

// 拍照上传（相机+相册）
window.openPhotoModal=id=>{photoBoxId=id;document.getElementById('photo-modal').style.display='flex';document.getElementById('photo-preview').style.display='none';document.getElementById('photo-preview').innerHTML='';document.getElementById('photo-submit-btn').disabled=true;document.getElementById('photo-note').value='';};
window.closePhotoModal=()=>{document.getElementById('photo-modal').style.display='none';photoBoxId=null;};
function handlePhotoSelect(e){
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
        const prev=document.getElementById('photo-preview');
        prev.innerHTML=`<img src="${ev.target.result}">`;prev.style.display='block';prev.classList.add('has-photo');
        document.getElementById('photo-submit-btn').disabled=false;
    };
    reader.readAsDataURL(file);
}
document.getElementById('photo-camera')?.addEventListener('change',handlePhotoSelect);
document.getElementById('photo-gallery')?.addEventListener('change',handlePhotoSelect);
document.getElementById('photo-modal')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closePhotoModal();});

window.submitPhoto=()=>{
    if(!photoBoxId)return;
    const boxes=getTodayBoxes();const b=boxes.find(x=>x.id===photoBoxId);
    if(b){
        b.status='completed';b.photo=true;
        addPoints(b.xp);addXP(b.xp);
        DB.set('blindboxes',blindboxes);
        closePhotoModal();
        updateStreak();renderDaily();
        showToast({title:` 导师验收通过！`,desc:`+${b.xp} 积分 · ${getName()}做得好！`});
    }
};

window.completeBlindboxDirectly=(id)=>{
    const boxes=getTodayBoxes();const b=boxes.find(x=>x.id===id);
    if(b){
        b.status='completed';b.photo=false;
        addPoints(b.xp);addXP(b.xp);
        DB.set('blindboxes',blindboxes);
        updateStreak();renderDaily();
        showToast({title:` 任务标记已完成！`,desc:`+${b.xp} 积分已入账，继续保持！`});
    }
};

// ===== 草稿本弹窗 =====
window.openDraftPad=(boxId)=>{
    const boxes=getTodayBoxes();
    const b=boxes.find(x=>x.id===boxId);
    if(!b)return;
    const drafts=DB.get('drafts',{});
    const existing=drafts[boxId]||'';
    const modal=document.getElementById('draft-modal');
    if(!modal)return;
    document.getElementById('draft-task-title').textContent=b.t;
    document.getElementById('draft-textarea').value=existing;
    modal.dataset.boxId=boxId;
    modal.style.display='flex';
};
window.closeDraftPad=()=>{
    const modal=document.getElementById('draft-modal');
    if(!modal)return;
    // 自动保存
    const boxId=modal.dataset.boxId;
    const text=document.getElementById('draft-textarea').value;
    if(boxId){
        const drafts=DB.get('drafts',{});
        drafts[boxId]=text;
        DB.set('drafts',drafts);
    }
    modal.style.display='none';
};

// ===== 智囊快报（邮件箱风格）=====
function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

function renderInbox(){
    const inbox=DB.get('ai_inbox',[]);
    const container=document.getElementById('inbox-list');
    if(!container)return;
    // 更新计数
    const countEl = document.getElementById('inbox-count');
    const unreadCount = inbox.filter(x => !x.read).length;
    if (countEl) countEl.textContent = inbox.length > 0 ? `${unreadCount} 封未读 / 共 ${inbox.length} 封` : '';
    
    if(inbox.length===0){
        container.innerHTML='<div class="empty-state"><div class="empty-icon">📬</div><h3>信箱空空</h3><p>当 AI 导师完成研究后，信件会自动投递到这里</p></div>';
        // 更新 sidebar 未读红点
        const badge = document.getElementById('inbox-badge');
        if (badge) { badge.textContent = 0; badge.style.display = 'none'; }
        return;
    }
    container.innerHTML=inbox.map((item,i)=>{
        const isUnread = !item.read;
        const preview = stripHtml(item.content || '').slice(0, 60);
        return `
        <div class="inbox-letter-item ${isUnread ? 'unread' : 'read'}" onclick="openInboxItem(${i})">
            <div class="inbox-letter-icon">${isUnread ? '🔴' : '🔵'}</div>
            <div class="inbox-letter-info">
                <div class="inbox-letter-meta">
                    <span class="inbox-letter-tag">${item.tag||'📊 研究报告'}</span>
                    <span class="inbox-letter-time">${item.time||'刚刚'}</span>
                </div>
                <div class="inbox-letter-title">${escHtml(item.title||'AI 研究成果')}</div>
                <div class="inbox-letter-preview">${escHtml(preview)}...</div>
            </div>
            <div class="inbox-letter-arrow">›</div>
        </div>`;
    }).join('');
    // 更新 sidebar 未读红点
    const badge = document.getElementById('inbox-badge');
    if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
    }
}

// 打开信件（信纸弹窗）
window.openInboxItem = (idx) => {
    const inbox = DB.get('ai_inbox', []);
    if (!inbox[idx]) return;
    inbox[idx].read = true;
    DB.set('ai_inbox', inbox);
    renderInbox();
    
    const item = inbox[idx];
    const modal = document.getElementById('inbox-letter-modal');
    const content = document.getElementById('inbox-letter-content');
    content.innerHTML = `
        <div class="letter-header">
            <span class="letter-tag">${item.tag || '📊 研究报告'}</span>
            <span class="letter-time">${item.time || '刚刚'}</span>
        </div>
        <h2 class="letter-title">${escHtml(item.title || 'AI 研究成果')}</h2>
        <div class="letter-body">${item.content || ''}</div>
    `;
    modal.style.display = 'flex';
    // 触发入场动画
    setTimeout(() => modal.classList.add('show'), 10);
};

window.closeInboxLetter = () => {
    const modal = document.getElementById('inbox-letter-modal');
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
};



// 信封点评（弹出信件模态框）
function renderEnvelope(boxes){
    const env=document.getElementById('envelope-section');if(!env)return;
    const allDone=boxes.every(b=>b.status==='completed'||b.status==='sealed');
    const hasCompleted=boxes.some(b=>b.status==='completed');
    const todayJStr = todayStr();
    const journalDone = (journals[todayJStr]||[]).reduce((s,p)=>s+p.length,0) > 0;
    
    if(hasCompleted){
        env.style.display='block';
        const envelope=document.getElementById('envelope');
        const hint=document.getElementById('envelope-hint');
        if(!allDone||!journalDone){
            envelope.classList.add('locked');
            if(allDone&&!journalDone) hint.textContent='还需要写一篇心灵日记才能解锁 🔒';
            else hint.textContent='还有盲盒未完成 🔒';
        }else{
            envelope.classList.remove('locked');
            hint.textContent='撕开火漆，阅读导师亲笔点评 ';
        }
    }else env.style.display='none';
}

window.openEnvelope=()=>{
    const boxes=getTodayBoxes();
    const allDone=boxes.every(b=>b.status==='completed'||b.status==='sealed');
    const hasCompleted=boxes.some(b=>b.status==='completed');
    const todayJStr = todayStr();
    const journalDone = (journals[todayJStr]||[]).reduce((s,p)=>s+p.length,0) > 0;
    
    if(!hasCompleted||!allDone||!journalDone)return;
    const nameStr = profile?.name ? profile.name.charAt(0) : '密';
    
    // 初始化信件元素状态
    const modal = document.getElementById('letter-modal');
    const seal = document.getElementById('wax-seal');
    const flap = document.getElementById('envelope-flap');
    const letter = document.getElementById('postcard-view');
    
    modal.style.display='flex';
    flap.classList.remove('open');
    letter.classList.remove('pull-out');
    
    seal.style.display='block';
    seal.textContent=nameStr;
    seal.classList.remove('broken');
    
    const qs=mentorMode==='practical'?QUOTES_P:QUOTES_M;
    const q=qs[Math.floor(Math.random()*qs.length)];
    const pts = boxes.filter(b=>b.status==='completed').reduce((sum,b)=>sum+b.xp,0);
    const text=`今日你完成了 ${boxes.filter(b=>b.status==='completed').length} 项任务，共积累了 ${pts} 点经验。\n我很高兴看到你在日志中记录下了真实的自己，直面自我的勇气往往胜过一切。\n\n正如那句话所言：\n“${q.t}”\n— ${q.a}\n\n期待你明天的进益。`;
    
    document.getElementById('postcard-salutation').textContent = `亲爱的 ${getName()}：`;
    document.getElementById('postcard-content').textContent = text;
    document.getElementById('postcard-signature').textContent = mentorMode === 'practical' ? '— 爱因博士 寄' : '— 苏拉底 寄';
};

window.tearLetterOpen = () => {
    const seal = document.getElementById('wax-seal');
    const flap = document.getElementById('envelope-flap');
    const letter = document.getElementById('postcard-view');
    
    // 断开火漆
    seal.classList.add('broken');
    
    // 翻开信封盖（新动画1.0s)
    flap.classList.add('open');
    
    // 延迟抽出明信片，留出盖子彻底落下去的时间
    setTimeout(() => {
        letter.classList.add('pull-out');
    }, 1000);
};

window.closeLetterModal=()=>{
    const letter = document.getElementById('postcard-view');
    const flap = document.getElementById('envelope-flap');
    
    // 动画收回信笺（新动画1.2s）
    letter.classList.remove('pull-out');
    setTimeout(() => {
        flap.classList.remove('open');
        setTimeout(() => {
            document.getElementById('letter-modal').style.display='none';
        }, 1000);
    }, 1200);
};

function updateStreak(){const today=todayStr();const boxes=getTodayBoxes();const done=boxes.filter(b=>b.status==='completed').length;if(done>0){completionLog[today]=done;DB.set('completionLog',completionLog);let count=0;const d=new Date();while(true){const ds=d.toISOString().slice(0,10);if(completionLog[ds]){count++;d.setDate(d.getDate()-1);}else break;}streakData={count,lastDate:today};DB.set('streak',streakData);}document.getElementById('streak-count').textContent=streakData.count;}

// === 心灵日记 ===
const JOURNAL_QUOTES=[
    '"与自己对话，是最深的陪伴。" —— 你的内心',
    '"写作是思考的延伸，日记是灵魂的镜子。"',
    '"每天清空一次大脑，给生活留白。"',
    '"你的感受很重要，无论它是好是坏。"',
    '"把情绪写下来，就是一次深呼吸。"',
    '"所有的迷茫，都在纸上渐渐清晰。"'
];

let currentJournalPage = 0; // 当前查看的是第几页（0-indexed）

window.changeJournalFont=()=>{
    const sel=document.getElementById('font-selector');
    const txt=document.getElementById('journal-text');
    if(!sel||!txt)return;
    const fs=sel.value;
    txt.className='journal-textarea '+fs;
    DB.set('journalFont',fs);
};

function initJournal(){
    document.getElementById('journal-quote').textContent=JOURNAL_QUOTES[Math.floor(Math.random()*JOURNAL_QUOTES.length)];
    const today=todayStr();
    document.getElementById('journal-date').textContent=`📅 ${today}（${['日','一','二','三','四','五','六'][new Date().getDay()]}）`;
    
    // 如果今天没有日记，初始化为只含一项空字符串的数组
    if(!journals[today] || !Array.isArray(journals[today])) {
        // 兼容旧版（直接是字符串的情况）
        if(typeof journals[today] === 'string') {
            journals[today] = [journals[today]];
        } else {
            journals[today] = [''];
        }
    }
    
    // 总是让页码跳到最后一页（最新的一页）
    currentJournalPage = journals[today].length - 1;
    
    renderCurrentPage();
    renderJournalHistory();
}

function renderCurrentPage() {
    const today = todayStr();
    const pages = journals[today];
    const text = pages[currentJournalPage] || '';
    
    document.getElementById('journal-text').value = text;
    updateCharCount(text.length);
    
    // 更新指示器
    document.getElementById('journal-page-indicator').textContent = `第 ${currentJournalPage + 1} 页 / 共 ${pages.length} 页`;
    
    // 更新控制按钮禁用状态
    document.getElementById('journal-prev-page').disabled = currentJournalPage === 0;
    // 如果已经是最后一页且这页写满（或接近写满准备开新页），允许下一页吗？不，我们让下一页按钮在你写满时动态创建新页。这里如果已经是最后一页且还没写满，也可以禁用下一页，我们在后面根据字符数开新页。
    // 为了更像实体书，最后一页有内容时即可翻到下一页（自动创建）。
}

window.turnJournalPage = (delta) => {
    const today = todayStr();
    const pages = journals[today];
    
    // 保存当前页数据
    pages[currentJournalPage] = document.getElementById('journal-text').value;
    
    const newPage = currentJournalPage + delta;
    
    // 如果向后翻，且超出了现有页数，只有当前页达到了一定字数才允许开新页
    if (newPage >= pages.length) {
        if (pages[currentJournalPage].length > 0) {
            pages.push(''); // 开创一页新的空白页
        } else {
            showToast({title:'📖 翻页提醒', desc:'先在这一页写点什么吧~'});
            return;
        }
    }
    
    if (newPage >= 0 && newPage < pages.length) {
        
        const d = document.getElementById('journal-text');
        d.classList.add(delta > 0 ? 'page-turning-out' : 'page-turning-in');
        
        setTimeout(() => {
            currentJournalPage = newPage;
            DB.set('journals', journals);
            renderCurrentPage();
            
            d.classList.remove('page-turning-out', 'page-turning-in');
            d.classList.add(delta > 0 ? 'page-turning-in' : 'page-turning-out');
            setTimeout(() => {
                d.classList.remove('page-turning-out', 'page-turning-in');
            }, 300);
        }, 150);
    }
};

document.getElementById('journal-text')?.addEventListener('input',function(){
    const len=this.value.length;
    updateCharCount(len);
    
    // 自动保存草稿
    const today = todayStr();
    journals[today][currentJournalPage] = this.value;
    DB.set('journals', journals);
});

function updateCharCount(len){
    document.getElementById('journal-char-count').textContent=len;
    const status=document.getElementById('journal-status');
    const badge=document.getElementById('journal-badge');
    
    const today = todayStr();
    const totalToday = (journals[today]||[]).reduce((sum, p) => sum + p.length, 0);

    status.textContent=`字数：${len}`;
    status.className = len > 0 ? 'done' : '';
    
    // 有内容就允许翻页
    const pages = journals[today];
    const nextBtn = document.getElementById('journal-next-page');
    if (currentJournalPage === pages.length - 1 && len === 0) {
        nextBtn.disabled = true;
    } else {
        nextBtn.disabled = false;
    }
    if (len > 0) nextBtn.classList.add('pulse-glow'); else nextBtn.classList.remove('pulse-glow');
    
    if(badge){if(totalToday===0){badge.style.display='inline';badge.textContent='✍️';}else{badge.style.display='none';}}
}

window.saveJournal=()=>{
    const text=document.getElementById('journal-text').value;
    const today = todayStr();
    journals[today][currentJournalPage] = text;
    DB.set('journals', journals);
    
    const totalToday = journals[today].reduce((sum, p) => sum + p.length, 0);
    showToast({title:'💾 日记已安全保存',desc:'你的心灵对话已记录 ✨'});
    renderJournalHistory();
    // 如果在盲盒页要更新信封状态
    if(document.getElementById('page-daily')?.classList.contains('active'))renderDaily();
    // 异步获取 AI 反馈（不阻塞保存）
    getJournalFeedback(text);
};

function renderJournalHistory(){
    const list=document.getElementById('journal-list');if(!list)return;
    const entries=Object.entries(journals).filter(([k,v])=>{
        if (!v) return false;
        // 数组的话检查是否全为空
        if (Array.isArray(v)) {
            return v.some(p => p.length > 0) && k !== todayStr();
        }
        return v.length > 0 && k !== todayStr();
    }).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10);
    
    if(!entries.length){list.innerHTML='<p style="color:var(--text-muted);font-size:13px;font-style:italic">还没有历史日记</p>';return;}
    
    list.innerHTML=entries.map(([date,textData])=>{
        let text = Array.isArray(textData) ? textData.join('\\n\\n') : textData;
        return `<div class="journal-entry" onclick="viewHistoricalJournal('${date}')" title="点击查看本页日记"><div class="journal-entry-date">${date}</div><div class="journal-entry-text">${escHtml(text.slice(0,200))}${text.length>200?'...':''}</div></div>`;
    }).join('');
}

window.viewHistoricalJournal = (date) => {
    const textData = journals[date];
    if(!textData) return;
    let fullText = Array.isArray(textData) ? textData.join('\\n\\n') : textData;
    
    document.getElementById('journal-date').textContent = `📅 ${date} (历史记录)`;
    document.getElementById('journal-text').value = fullText;
    document.getElementById('journal-text').readOnly = true;
    document.getElementById('journal-status-parent').style.display = 'none';
    document.getElementById('journal-save').style.display = 'none';
    
    const pagination = document.querySelector('.journal-pagination-controls');
    if (pagination) pagination.style.display = 'none';
    
    let backBtn = document.getElementById('journal-back-today');
    if(!backBtn) {
        backBtn = document.createElement('button');
        backBtn.id = 'journal-back-today';
        backBtn.className = 'btn-secondary';
        backBtn.innerHTML = '← 返回今日新日记';
        backBtn.style.marginBottom = '12px';
        backBtn.onclick = () => {
            document.getElementById('journal-text').readOnly = false;
            document.getElementById('journal-status-parent').style.display = 'inline';
            document.getElementById('journal-save').style.display = 'inline-block';
            if (pagination) pagination.style.display = 'flex';
            backBtn.style.display = 'none';
            initJournal();
        };
        document.querySelector('.journal-editor').insertBefore(backBtn, document.getElementById('journal-date'));
    }
    backBtn.style.display = 'inline-block';
};

// === 技能工坊 ===
const KB=[
    {type:'course',title:'Python 零基础入门',author:'Coursera/B站',desc:'最适合零基础的编程语言。3个月掌握自动化脚本。',tags:['编程','Python'],category:'tech',url:'https://www.bilibili.com/video/BV1qW4y1a7fU/'},
    {type:'course',title:'Figma UI 设计实战',author:'Figma官方',desc:'学会 Figma 做设计外包。市场需求大。',tags:['设计','Figma'],category:'design',url:'https://www.figma.com/resources/learn-design/'},
    {type:'tool',title:'ChatGPT / AI 工具指南',author:'OpenAI',desc:'掌握 AI 工具效率提升10倍。',tags:['AI','效率'],category:'tech',url:'https://chat.openai.com/'},
    {type:'course',title:'小红书/抖音运营',author:'综合',desc:'内容创作和平台算法，打造个人品牌。',tags:['自媒体','运营'],category:'marketing'},
    {type:'book',title:'《精益副业》',author:'Chris Guillebeau',desc:'100个真实案例教你启动副业。',tags:['副业','方法论'],category:'sidebiz'},
    {type:'course',title:'Excel数据分析',author:'综合',desc:'数据分析能力是职场硬通货。',tags:['数据','职场'],category:'career'},
    {type:'tool',title:'Notion 生产力系统',author:'Notion',desc:'一个工具管理所有任务和知识。',tags:['效率','工具'],category:'career',url:'https://www.notion.so/'},
    {type:'book',title:'《原子习惯》',author:'詹姆斯·克利尔',desc:'每天1%进步，一年强大37倍。',tags:['习惯','自律'],category:'mind'},
    {type:'article',title:'0成本启动副业的10种方法',author:'综合',desc:'从自由写作到技术接单的完整路径。',tags:['副业','实操'],category:'sidebiz'},
    {type:'tool',title:'Canva 快速设计',author:'Canva',desc:'不会设计也能做专业级海报。',tags:['设计','工具'],category:'design',url:'https://www.canva.com/'},
    {type:'book',title:'《活出生命的意义》',author:'弗兰克尔',desc:'在最痛苦的环境中找到意义。',tags:['心理学','意义'],category:'mind'},
    {type:'course',title:'理财入门',author:'综合',desc:'储蓄、基金、指数投资。',tags:['理财','投资'],category:'finance'}
];

let kFilter='all';
function renderKnowledge(){
    const grid=document.getElementById('knowledge-grid');if(!grid)return;
    const icons={book:'',course:'',article:'',video:'',tool:''};
    let list=kFilter==='all'?KB:KB.filter(k=>k.type===kFilter);
    grid.innerHTML=list.map(k=>`<div class="knowledge-card"><div class="knowledge-card-type">${icons[k.type]||'📄'}</div><h3>${escHtml(k.title)}</h3><p>${escHtml(k.desc)}</p><div class="knowledge-tags">${k.tags.map(t=>`<span class="knowledge-tag">${escHtml(t)}</span>`).join('')}</div>${k.url?`<a href="${k.url}" target="_blank" style="display:inline-block;margin-top:10px;font-size:11px;color:var(--primary-light);text-decoration:none">🔗 前往学习 →</a>`:''}</div>`).join('');
}
document.querySelectorAll('.filter-btn').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');kFilter=b.dataset.filter;renderKnowledge();}));

// === 每日资讯 ===
const INSIGHTS=[
    {cat:'副业实战',title:'2026年最值得做的5个副业',content:'AI应用开发、短视频、知识付费、跨境电商、自由设计。'},
    {cat:'技能趋势',title:'AI 时代3项核心能力',content:'提示词工程、数据思维、跨界整合。'},
    {cat:'效率方法',title:'番茄工作法进阶',content:'90分钟深度工作块配合AI工具，效率提升5-10倍。'},
    {cat:'哲学金句',title:'斯多葛主义',content:'区分能控制和不能控制的事，是内心平静的起点。'},
    {cat:'赚钱思维',title:'从0到1变现',content:'找问题→用技能解决→找付费用户→复制放大。'},
    {cat:'心灵成长',title:'感恩练习',content:'每晚3件感恩的事，坚持8周幸福感显著提升。'}
];
function renderInsights(){
    const qs=[...QUOTES_P,...QUOTES_M];const q=qs[new Date().getDate()%qs.length];
    document.getElementById('daily-quote').textContent=q.t;
    document.getElementById('daily-quote-author').textContent='— '+q.a;
    document.getElementById('insights-feed').innerHTML=INSIGHTS.map(i=>`<div class="insight-card"><div class="insight-card-category">${escHtml(i.cat)}</div><h3>${escHtml(i.title)}</h3><p>${escHtml(i.content)}</p></div>`).join('');
}

// === 运势 ===
const TAROT=[
    {name:'太阳',emoji:'☀️',m:'充满活力！今天适合开始新项目。', detail: '当【太阳】牌出现时，它代表着无尽的生命力与光明。过去的雾霾将被驱散，这是你展现才华的绝佳时机。不要畏首畏尾，只要行动，宇宙都在支持你。今日建议：大步向前，拥抱阳光。'},
    {name:'星星',emoji:'⭐',m:'长期目标正在接近，保持信念。', detail: '【星星】是希望与指引的象征，说明你走在正确的道路上。即便眼下还有许多未知，你的内心罗盘已然校准。今日建议：听从直觉的低语，保持对美好未来的确信。'},
    {name:'力量',emoji:'🦁',m:'你比想象中更强大！', detail: '【力量】指的并不是蛮力，而是内心的柔韧。你现在拥有以柔克刚的力量，无论是棘手的工作还是人际关系，都能用温柔而坚定的态度化解。今日建议：面对挑战，保持微笑和从容。'},
    {name:'命运之轮',emoji:'🎡',m:'变化是机遇，拥抱它。', detail: '【命运之轮】预示着周期的更迭，一些出乎意料的变化可能正在发生。这是不可抗拒的推力，但最终会带来转机。今日建议：顺应变化，不要死守旧规。'},
    {name:'魔术师',emoji:'🪄',m:'你拥有一切所需资源，行动！', detail: '【魔术师】代表着极强的创造力和资源整合能力。所有促成事情发生的条件已经齐备，现在只需你动用智慧去发号施令。今日建议：自信地表达你的想法。'},
    {name:'女皇',emoji:'👑',m:'创造力爆棚的一天。', detail: '【女皇】是丰饶和滋养的化身。今天非常适合从事创意工作、照顾自己或陪伴家人。你会发现周遭充满了愉悦与丰盛的能量。今日建议：对自己好一点，享受生活的美。'},
    {name:'隐者',emoji:'🏮',m:'适合独处反思的日子。', detail: '【隐者】提着提灯，照亮内在的探索之路。你可能需要从喧闹中抽离，给自己一段安静独处的时间，以找回清晰的思绪。今日建议：关闭不必要的社交，向内寻求答案。'},
    {name:'世界',emoji:'🌍',m:'圆满和完成的能量。', detail: '【世界】牌象征着一个阶段的完美谢幕。你此前的努力正在开花结果，能够获得强烈的成就感与圆满感。今日建议：庆祝自己的成功，或者给一件事画上完美句号。'},
    {name:'月亮',emoji:'🌙',m:'直觉灵敏，跟着感觉走。', detail: '【月亮】带来了潜意识的讯息和一定程度的不安。事物可能不像表面看起来那么简单。今日建议：比起逻辑，你更需要相信自己的直觉和潜意识梦境。'},
    {name:'塔',emoji:'⚡',m:'打破旧模式，重建新秩序。', detail: '【塔】牌的出现可能伴随着突发事件或观念的崩塌。但这并非坏事，它是在帮你强行扫除那些阻碍你成长的陈旧结构。今日建议：与其抗拒，不如在这片焦土上重建更真实的任务。'}
];
const SIGNS=[{level:'上上签',poem:'春来花自开，\n运到事业兴。',m:'大吉！全力出击。'},{level:'上签',poem:'风送花香满，\n月明照前途。',m:'保持积极。'},{level:'中签',poem:'平常心是道，\n随缘即是福。',m:'稳扎稳打。'},{level:'中下签',poem:'雾中行慢步，\n小心有转机。',m:'谨慎行事，积累为主。'}];
// 修复 eslint
window.getTodayStr=()=>new Date().toISOString().slice(0,10);

let todayTarot=DB.get('tt_'+getTodayStr(),[]);
let todaySign=DB.get('ts_'+getTodayStr(),null);

function initFortune(){
    if(!todayTarot) todayTarot = [];
    if(todayTarot.length > 0) {
        todayTarot.forEach((t,i)=>{
            const cards=document.querySelectorAll('.tarot-card');
            if(cards[i]) cards[i].classList.add('flipped');
            const back=document.getElementById('tarot-back-'+(i+1));
            if(back) back.innerHTML=`<div class="tarot-emoji" style="font-size:36px;margin-bottom:8px">${t.emoji}</div><div class="tarot-name" style="font-family:'Noto Serif SC',serif;font-size:16px;font-weight:600;color:var(--accent-gold);margin-bottom:8px">${t.name}</div><div style="font-size:12px">${t.m}</div>`;
        });
        
        if(todayTarot.length>=3) {
            document.getElementById('tarot-reading').style.display='block';
            document.getElementById('tarot-reading').innerHTML = `<h3 style="color:var(--accent-gold);margin-bottom:16px;">🔮 今日运势深度解析</h3>` + 
            todayTarot.map((c) => `<div style="margin-bottom:16px;text-align:left;background:var(--bg-deep);padding:16px;border-radius:12px;border:1px solid rgba(0,0,0,0.05);"><strong style="color:var(--text-primary)">[ ${c.name} ]</strong> <br><span style="font-size:13px;color:var(--text-secondary);line-height:1.6">${c.detail}</span></div>`).join('');
        }
    }
    if(todaySign){
        document.getElementById('qian-result').style.display='block';
        document.getElementById('qian-result').innerHTML=`<div class="result-badge">${todaySign.level}</div><div class="result-text">${todaySign.poem.replace(/\\n/g,'<br>')}</div><div class="result-desc">${todaySign.m}</div>`;
    }
}

window.flipTarot=idx=>{
    if(todayTarot&&todayTarot.length>=3)return;
    if(!todayTarot) todayTarot=[];
    if(todayTarot.length===0 && points<5){showToast({title:'积分不足',desc:'抽塔罗需要5积分。'});return;}
    if(todayTarot.length===0){points-=5;DB.set('points',points);updateXP();}
    
    // Don't flip same card twice
    const cards=document.querySelectorAll('.tarot-card');
    if(cards[idx] && cards[idx].classList.contains('flipped')) return;

    

    const avail=TAROT.filter(c=>!todayTarot.find(t=>t.name===c.name));
    const card=avail[Math.floor(Math.random()*avail.length)];
    todayTarot.push(card);
    
    if(cards[idx])cards[idx].classList.add('flipped');
    const back=document.getElementById('tarot-back-'+(idx+1));
    if(back)back.innerHTML=`<div style="font-size:36px;margin-bottom:8px">${card.emoji}</div><div style="font-family:'Noto Serif SC',serif;font-size:16px;font-weight:600;color:var(--accent-gold);margin-bottom:8px">${card.name}</div><div style="font-size:12px">${card.m}</div>`;
    
    DB.set('tt_'+getTodayStr(),todayTarot);

    if(todayTarot.length===3){
        setTimeout(() => {
            
            document.getElementById('tarot-reading').style.display='block';
            document.getElementById('tarot-reading').style.animation='fadeIn 1s ease-out';
            document.getElementById('tarot-reading').innerHTML = `<h3 style="color:var(--accent-gold);margin-bottom:16px;">🔮 今日运势深度解析</h3>` + 
            todayTarot.map((c) => `<div style="margin-bottom:16px;text-align:left;background:var(--bg-deep);padding:16px;border-radius:12px;border:1px solid rgba(0,0,0,0.05);"><strong style="color:var(--text-primary)">[ ${c.name} ]</strong> <br><span style="font-size:13px;color:var(--text-secondary);line-height:1.6">${c.detail}</span></div>`).join('');
        }, 600);
    }
};
window.drawFortune=()=>{
    if(todaySign){showToast({title:'今日已抽',desc:'每天一次哦'});return;}
    if(points<10){showToast({title:'积分不足',desc:'需要10积分'});return;}
    points-=10;DB.set('points',points); updateXP();
    
    
    const fc = document.querySelector('.qian-container');
    if(fc) fc.classList.add('qian-shaking');
    document.getElementById('qian-result').style.display='none';
    
    setTimeout(()=>{
        if(fc) fc.classList.remove('qian-shaking');
        todaySign=SIGNS[Math.floor(Math.random()*SIGNS.length)];
        DB.set('ts_'+todayStr(),todaySign);
        
        const resultDiv = document.getElementById('qian-result');
        resultDiv.style.display='block';
        resultDiv.style.animation = 'fadeIn 0.5s ease-out';
        resultDiv.innerHTML=`<div class="result-badge">${todaySign.level}</div><div class="result-text">${todaySign.poem.replace(/\n/g,'<br>')}</div><div class="result-desc">${todaySign.m}</div><div id="ai-fortune-loading" class="ai-reading-loading">🔮 AI 正在为你个性化解签...</div>`;
        // 异步调用 AI 解读
        getAIFortuneReading(todaySign).then(() => {
            document.getElementById('ai-fortune-loading')?.remove();
        });
    }, 1200);
};
document.querySelectorAll('.fortune-tab-btn').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.fortune-tab-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.fortune-panel').forEach(p=>p.classList.remove('active'));document.getElementById('fortune-'+b.dataset.ftab)?.classList.add('active');}));

// === 通知 ===
function showToast(a){const t=document.getElementById('achievement-toast');if(!t)return;document.getElementById('achievement-title').textContent=a.title;document.getElementById('achievement-desc').textContent=a.desc;t.style.display='flex';setTimeout(()=>t.style.display='none',3000);}

// === 初始化 ===
function init(){
    checkAuthAndOnboarding();
    if(profile) initMentor();
    updateStreak();
    updateXP();
    document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mentorMode));
    
    // 初始化时找一下当前 active 的页面并执行相应渲染
    const activePage = document.querySelector('.nav-item.active')?.dataset.page || 'mentor';
    switchPage(activePage);

    const boxes=getTodayBoxes();
    const hidden=boxes.filter(b=>b.status==='hidden').length;
    if(hidden>0){const badge=document.getElementById('daily-badge');if(badge){badge.textContent=hidden;badge.style.display='inline';}}
    // 日记badge
    const jd=journals[todayStr()]||'';
    if(jd.length===0){const jb=document.getElementById('journal-badge');if(jb){jb.style.display='inline';}}
    
    // 异步: AI 智囊快报自动推送（不阻塞初始化）
    setTimeout(() => generateInboxReport(), 3000);
}

window.addEventListener('DOMContentLoaded', init);

// === 个人设置交互 ===
function loadSettings() {
    if(!profile) return;
    document.getElementById('set-name').value = profile.name || '';
    document.getElementById('set-age').value = profile.age || '';
    document.getElementById('set-location').value = profile.location || '';
    document.getElementById('set-job').value = profile.job || '';
    document.getElementById('set-bio').value = profile.bio || '';
    
    if(profile.avatar) {
        if(profile.avatar.startsWith('data:') || profile.avatar.startsWith('http')) {
            document.getElementById('settings-avatar-preview').innerHTML = `<img src="${profile.avatar}">`;
        } else {
            document.getElementById('settings-avatar-preview').innerHTML = `<span style="font-size:40px;">${profile.avatar}</span>`;
        }
    }

}

window.selectEmojiAvatar = (emoji) => {
    document.getElementById('settings-avatar-preview').innerHTML = `<span style="font-size:40px;">${emoji}</span>`;
    if(!profile) profile = {};
    profile.avatar = emoji;
};

document.getElementById('settings-avatar-upload')?.addEventListener('change', e => {
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        document.getElementById('settings-avatar-preview').innerHTML = `<img src="${ev.target.result}">`;
        if(!profile) profile = {};
        profile.avatar = ev.target.result;
    };
    reader.readAsDataURL(file);
});

document.getElementById('settings-form')?.addEventListener('submit', e => {
    e.preventDefault();
    if(!profile) profile = {};
    profile = {
        ...profile,
        name: document.getElementById('set-name').value.trim() || '同学',
        age: document.getElementById('set-age').value,
        location: document.getElementById('set-location').value.trim(),
        job: document.getElementById('set-job').value.trim(),
        bio: document.getElementById('set-bio').value.trim()
    };
    DB.set('profile', profile);
    
    showToast({title:'✅ 设置已保存', desc:'你的名片已更新。'});
});

// === 主题切换 (日夜双轨) ===
function initTheme() {
    const savedTheme = DB.get('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    if (isDark) {
        document.body.classList.add('theme-dark');
        document.body.classList.remove('theme-light');
    } else {
        document.body.classList.add('theme-light');
        document.body.classList.remove('theme-dark');
    }
    updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
    // Update ALL theme toggle buttons (chat toolbar + sidebar)
    document.querySelectorAll('.theme-icon.mode-moon').forEach(el => {
        el.style.display = isDark ? 'none' : 'flex';
    });
    document.querySelectorAll('.theme-icon.mode-sun').forEach(el => {
        el.style.display = isDark ? 'flex' : 'none';
    });
    // Update sidebar label
    const label = document.querySelector('.sidebar-theme-label');
    if(label) label.textContent = isDark ? '切换白天模式' : '切换夜间模式';
}

function doToggleTheme() {
    const isDark = document.body.classList.contains('theme-dark');
    if(isDark) {
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
        DB.set('theme', 'light');
        updateThemeIcon(false);
    } else {
        document.body.classList.remove('theme-light');
        document.body.classList.add('theme-dark');
        DB.set('theme', 'dark');
        updateThemeIcon(true);
    }
}
document.getElementById('theme-toggle-btn')?.addEventListener('click', doToggleTheme);
document.getElementById('sidebar-theme-btn')?.addEventListener('click', doToggleTheme);

if(window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if(!DB.get('theme')) {
            const isDark = e.matches;
            if(isDark) {
                document.body.classList.add('theme-dark');
                document.body.classList.remove('theme-light');
            } else {
                document.body.classList.add('theme-light');
                document.body.classList.remove('theme-dark');
            }
            updateThemeIcon(isDark);
        }
    });
}

initTheme();

// 初始化 SVG 图标
setInterval(() => { if(window.lucide) lucide.createIcons(); }, 1000);
setTimeout(() => { if(window.lucide) lucide.createIcons(); }, 100);

// ===== 演示数据注入（仅运行一次）=====
(function injectDemoData(){
    if(DB.get('demo_loaded')) return;

    // 1. 多维度目标
    const demoGoals = [
        { id:'dg1', title:'每天花15分钟写下内心想法', desc:'用草稿本记录灵感和反思', timeframe:'daily', category:'mind', progress:30, deadline:'' },
        { id:'dg2', title:'每天花20分钟学习一个新技能', desc:'短视频剪辑/文案写作/排版设计', timeframe:'daily', category:'tech', progress:20, deadline:'' },
        { id:'dg3', title:'本周完成3篇对标账号深度分析', desc:'找到3个同领域优质账号，分析内容策略', timeframe:'weekly', category:'marketing', progress:0, deadline:'' },
        { id:'dg4', title:'本周发布第一条小红书笔记', desc:'不用完美，发出去就是胜利', timeframe:'weekly', category:'sidebiz', progress:0, deadline:'' },
        { id:'dg5', title:'本月搭建个人品牌初步框架', desc:'确定定位、头像、简介、内容方向', timeframe:'monthly', category:'sidebiz', progress:0, deadline:'' },
        { id:'dg6', title:'本月读完一本个人成长书籍', desc:'推荐：《认知觉醒》或《被讨厌的勇气》', timeframe:'monthly', category:'mind', progress:0, deadline:'' },
        { id:'dg7', title:'本季度获得第一批50个真实粉丝', desc:'通过持续输出有价值内容积累', timeframe:'quarterly', category:'marketing', progress:0, deadline:'' },
        { id:'dg8', title:'本季度实现第一笔线上收入', desc:'哪怕只有1元，也是从0到1的突破', timeframe:'quarterly', category:'finance', progress:0, deadline:'' },
        { id:'dg9', title:'中期：形成稳定的内容输出节奏', desc:'每周3-5篇，形成自己的内容体系', timeframe:'midterm', category:'career', progress:0, deadline:'' },
        { id:'dg10', title:'愿景：建立有影响力的个人IP', desc:'成为细分领域的意见领袖', timeframe:'vision', category:'career', progress:0, deadline:'' }
    ];
    const existingGoals = DB.get('goals', []);
    if(existingGoals.length === 0) DB.set('goals', demoGoals);

    // 2. 今日盲盒
    const today = new Date().toISOString().split('T')[0];
    if(!blindboxes[today] || blindboxes[today].length === 0){
        blindboxes[today] = [
            { t:'花15分钟写下：如果不考虑任何限制，我最想过什么样的生活？（点📝草稿写）', xp:15, id:'demo1-'+Date.now(), status:'hidden', photo:null },
            { t:'在小红书搜索"宝妈转型"，收藏3篇让你觉得"我也可以"的文章', xp:20, id:'demo2-'+Date.now(), status:'hidden', photo:null },
            { t:'用手机拍一张今天让你开心的小瞬间', xp:10, id:'demo3-'+Date.now(), status:'hidden', photo:null },
            { t:'花20分钟看一个短视频剪辑入门教程（B站搜"剪映入门"）', xp:25, id:'demo4-'+Date.now(), status:'hidden', photo:null },
            { t:'[AI已完成] 3个适合转型的小红书对标账号分析 → 查看智囊快报', xp:30, id:'demo5-'+Date.now(), status:'completed', photo:null }
        ];
        DB.set('blindboxes', blindboxes);
    }

    // 3. 智囊快报
    const existingInbox = DB.get('ai_inbox', []);
    if(existingInbox.length === 0){
        DB.set('ai_inbox', [
            {
                title:'3个适合你的小红书对标账号深度分析',
                tag:'📊 对标研究',
                time:new Date().toLocaleString('zh-CN'),
                read:false,
                content:'<h3>📌 账号1：@芒果妈妈成长记</h3><p><b>粉丝量：</b>8.3万 | <b>风格：</b>宝妈成长日记，每篇300-500字配生活感照片</p><p><b>标题公式：</b>身份认同 + 痛点共鸣 + 解决承诺</p><p>例："35岁全职妈妈，我用3个月从焦虑到月入5000"</p><hr><h3>📌 账号2：@慢慢变好的小鹿</h3><p><b>粉丝量：</b>5.1万 | <b>风格：</b>自我成长+情绪管理，文字温暖治愈</p><p><b>更新节奏：</b>周一干货、周三故事、周五互动（投票/提问涨粉快）</p><hr><h3>📌 账号3：@设计师妈妈的副业路</h3><p><b>粉丝量：</b>3.8万 | <b>风格：</b>教程类，教宝妈做Canva海报、剪映剪视频</p><p><b>核心理念：</b>"教别人=最好的学习"</p><hr><p>💡 <b>爱因博士建议：</b>先从模仿账号1开始——不需要专业技能，只需要真诚分享自己的故事。</p>'
            },
            {
                title:'宝妈转型自媒体：3个平台对比分析',
                tag:'🔍 市场分析',
                time:new Date(Date.now()-3600000).toLocaleString('zh-CN'),
                read:false,
                content:'<h3>平台对比</h3><p>📱 <b>小红书</b> — 图文为主，女性用户多，宝妈群体活跃 ✅ 推荐首选</p><p>🎬 <b>抖音</b> — 流量大，短视频门槛低，手机就能拍</p><p>📝 <b>微信公众号</b> — 深度内容，粉丝粘性高，适合后期沉淀</p><hr><p>💡 <b>爱因博士建议：</b>先主攻小红书，图文上手最快，宝妈群体活跃。等积累内容和信心再拓展抖音。</p>'
            },
            {
                title:'本周成长计划已生成 ✨',
                tag:'📋 智能规划',
                time:new Date(Date.now()-7200000).toLocaleString('zh-CN'),
                read:true,
                content:'<h3>本周重点</h3><ul><li>✅ 每天15分钟草稿本写想法（已添加到每日盲盒）</li><li>📱 完成3篇对标账号分析（AI已完成✅ 看上面的报告）</li><li>📝 尝试写第一条小红书标题（不用发布，写出来就好）</li><li>📖 开始读《认知觉醒》前3章</li></ul><p style="margin-top:12px;font-style:italic;opacity:0.8;">苏拉底说：这周的目标不是"完成所有"，而是"开始一件"。你已经迈出了最难的一步——决定改变。</p>'
            }
        ]);
    }

    // 4. 草稿本示范
    const existingDrafts = DB.get('drafts', {});
    if(Object.keys(existingDrafts).length === 0){
        existingDrafts['demo-sample'] = '如果不考虑任何限制，我想每天早上送完孩子后，去一个安静的咖啡馆，写写东西，做做自己喜欢的事。我想有自己的收入，不用每次买东西都要纠结...';
        DB.set('drafts', existingDrafts);
    }

    DB.set('demo_loaded', true);
    console.log('✅ 演示数据注入完成');
})();
