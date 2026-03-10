import re
import os

html_path = '/Users/eillen/AI STUDIO/openclaw/apps/lifecompass/index.html'
css_path = '/Users/eillen/AI STUDIO/openclaw/apps/lifecompass/styles.css'
js_path = '/Users/eillen/AI STUDIO/openclaw/apps/lifecompass/app.js'

def replace_in_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

html_replacements = [
    ('🏗️', '<i data-lucide="compass"></i>'),
    ('<span class="nav-icon">🎓</span>', '<span class="nav-icon"><i data-lucide="message-square"></i></span>'),
    ('<span class="nav-icon">🎯</span>', '<span class="nav-icon"><i data-lucide="target"></i></span>'),
    ('<span class="nav-icon">🎁</span>', '<span class="nav-icon"><i data-lucide="package"></i></span>'),
    ('<span class="nav-icon">📔</span>', '<span class="nav-icon"><i data-lucide="book-open"></i></span>'),
    ('<span class="nav-icon">🔧</span>', '<span class="nav-icon"><i data-lucide="wrench"></i></span>'),
    ('<span class="nav-icon">📡</span>', '<span class="nav-icon"><i data-lucide="radio"></i></span>'),
    ('<span class="nav-icon">🔮</span>', '<span class="nav-icon"><i data-lucide="star"></i></span>'),
    ('<div class="streak-flame">🔥</div>', '<div class="streak-flame"><i data-lucide="flame"></i></div>'),
    ('<div class="avatar-icon">🎓</div>', '<div class="avatar-icon"><i data-lucide="bot"></i></div>'),
    ('🔧 爱因博士 (实用)', '<i data-lucide="wrench" style="width:14px;height:14px;margin-right:4px;"></i> 爱因博士 (实用)'),
    ('🧘 苏拉底 (哲学)', '<i data-lucide="brain" style="width:14px;height:14px;margin-right:4px;"></i> 苏拉底 (哲学)'),
    ('<h1>🎯 目标罗盘</h1>', '<h1><i data-lucide="target" style="width:28px;height:28px;margin-right:8px;vertical-align:text-bottom;"></i>目标罗盘</h1>'),
    ('<h1>🎁 今日盲盒</h1>', '<h1><i data-lucide="package" style="width:28px;height:28px;margin-right:8px;vertical-align:text-bottom;"></i>今日盲盒</h1>'),
    ('<h1>📔 心灵日记</h1>', '<h1><i data-lucide="book-open" style="width:28px;height:28px;margin-right:8px;vertical-align:text-bottom;"></i>心灵日记</h1>'),
    ('<h1>🔧 技能工坊</h1>', '<h1><i data-lucide="wrench" style="width:28px;height:28px;margin-right:8px;vertical-align:text-bottom;"></i>技能工坊</h1>'),
    ('<h1>📡 每日资讯</h1>', '<h1><i data-lucide="radio" style="width:28px;height:28px;margin-right:8px;vertical-align:text-bottom;"></i>每日资讯</h1>'),
    ('<h1>🔮 每日运势</h1>', '<h1><i data-lucide="star" style="width:28px;height:28px;margin-right:8px;vertical-align:text-bottom;"></i>每日运势</h1>'),
    ('🔥 连续', '连续'),
    ('🌟 积分', '积分'),
    ('<h2>✅ 已完成</h2>', '<h2><i data-lucide="check-circle" style="width:20px;height:20px;margin-right:8px;vertical-align:text-bottom;"></i> 已完成</h2>'),
    ('<h2>📦 已封存（待重新开启）</h2>', '<h2><i data-lucide="archive" style="width:20px;height:20px;margin-right:8px;vertical-align:text-bottom;"></i> 已封存（待重新开启）</h2>'),
    ('<h2>📋 导师深度点评</h2>', '<h2><i data-lucide="file-text" style="width:20px;height:20px;margin-right:8px;vertical-align:text-bottom;"></i> 导师深度点评</h2>'),
    ('<h2>📜 往期翻阅</h2>', '<h2><i data-lucide="history" style="width:20px;height:20px;margin-right:8px;vertical-align:text-bottom;"></i> 往期翻阅</h2>'),
    ('🔴', '<i data-lucide="stamp"></i>'),
    ('🖋️ 行楷简体 (默认)', '行楷简体 (默认)'),
    ('📝 经典楷体', '经典楷体'),
    ('🖌️ 狂草毛笔', '狂草毛笔'),
    ('✏️ 清秀小楷', '清秀小楷'),
    ('💻 现代黑体', '现代黑体'),
    ('💾 记录这一页', '<i data-lucide="save" style="width:16px;height:16px;margin-right:4px;vertical-align:middle;"></i> 记录这一页'),
    ('🎓 课程', '课程'),
    ('🛠️ 工具', '工具'),
    ('📖 书籍', '书籍'),
    ('📝 实战', '实战'),
    ('🃏\n                        塔罗牌', '塔罗牌'),
    ('📜 抽签', '抽签'),
    ('🃏', '<i data-lucide="layers"></i>'),
    ('🏮', '<i data-lucide="party-popper" style="width:48px;height:48px;"></i>'),
    ('🎋\n                            摇签', '摇签'),
    ('<h2>📸 提交成果照片</h2>', '<h2><i data-lucide="camera" style="width:20px;height:20px;margin-right:8px;vertical-align:text-bottom;"></i> 提交成果照片</h2>'),
    ('📷 打开相机拍照', '<i data-lucide="camera" style="width:16px;height:16px;margin-right:4px;"></i> 打开相机拍照'),
    ('🖼️ 从相册选取', '<i data-lucide="image" style="width:16px;height:16px;margin-right:4px;"></i> 从相册选取'),
    ('✅', ''),
    ('🏆', '<i data-lucide="award"></i>'),
    ('💰', ''), ('💼', ''), ('🧭', ''), ('📚', ''), ('⏰', ''), ('👥', ''), ('😰', ''), ('😶', ''), ('🤔', ''), ('🌫️', ''), ('🐌', ''), ('🎭', ''), ('🚀', '')
]

replace_in_file(html_path, html_replacements)

# Inject lucide
with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

if '<script src="https://unpkg.com/lucide@latest"></script>' not in html_content:
    html_content = html_content.replace('</head>', '    <script src="https://unpkg.com/lucide@latest"></script>\n</head>')
    
with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html_content)


js_replacements = [
    ('👨‍🔬', ''),
    ('🔧', ''),
    ('🧘', ''),
    ('😊', ''),
    ('💻', ''),
    ('🎨', ''),
    ('📢', ''),
    ('📊', ''),
    ('💪', ''),
    ('🌟', ''),
    ('🌱', ''),
    ('🎯', ''),
    ('❤️', ''),
    ('✨', ''),
    ('📖', ''),
    ('🎓', ''),
    ('📝', ''),
    ('🎬', ''),
    ('🛠️', ''),
    ('☀️', ''),
    ('⭐', ''),
    ('🦁', ''),
    ('🎡', ''),
    ('🎩', ''),
    ('👑', ''),
    ('🏔️', ''),
    ('🌍', ''),
    ('🌙', ''),
    ('🗼', ''),
    ('🎉', ''),
    ('🎁', ''),
    ('<div class="empty-icon">🎉</div>', '<div class="empty-icon"><i data-lucide="party-popper"></i></div>'),
    ("<div class='streak-flame'>🔥</div>", "<div class='streak-flame'><i data-lucide='flame'></i></div>")
]
replace_in_file(js_path, js_replacements)

# Add lucide.createIcons(); at the end of window.onload or js file
with open(js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

if 'lucide.createIcons();' not in js_content:
    js_content += '\n// 初始化 SVG 图标\nsetInterval(() => { if(window.lucide) lucide.createIcons(); }, 1000);\nsetTimeout(() => { if(window.lucide) lucide.createIcons(); }, 100);\n'

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js_content)

print('Emoji replacement and Lucide Injection complete.')
