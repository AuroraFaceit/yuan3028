// 展馆内容配置 —— 想换顺序 / 改文案，只改这个文件即可
export const ATRIUM = {
  num: '00',
  cn: '逆转时间',
  en: 'SEA OF PINK MIST',
  headline: '碎碎念念',
  desc: '三十五张照片，一座四层的粉色展塔。头顶是一片流动的粉雾海，脚下是一层一层的天光。',
};

// 楼层顺序 = 编号顺序：一层粉雾海 → 二层天空的自由 → 三层生活碎片 → 四层夜幕来临前
// （楼层与章节的对应关系在 js/museum.js 的 LEVELS 里，两边顺序保持一致即可）
export const CHAPTERS = [
  {
    id: 'pink',
    num: '01',
    cat: 'pink',
    cn: '粉雾海',
    en: 'SEA OF PINK MIST',
    headline: '粉雾海',
    desc: '天空被打翻的胭脂，一层层晕开。生活里最柔软的那几分钟，都留在了这一片粉里。',
    captions: ['请你看粉雾海', '晚霞也要红红火火', '傍晚的粉色背景板', '晚间云海', '早上的朝霞也有一抹粉', '定格每个瞬间'],
  },
  {
    id: 'sky',
    num: '02',
    cat: 'sky',
    cn: '天空的自由',
    en: 'FREEDOM OF THE SKY',
    headline: '天空的自由',
    desc: '云在走，光在变，风把整片天翻来覆去。抬头的那一秒，人是自由的。',
    captions: ['积云练习曲', '一朵云的侧脸', '天空的纹理', '蓝色很深', '云在搬家', '光穿过云层', '远景是山', '云海第一层', '下午四点的天', '把云压平', '蘑菇云', '云的褶皱', '抬头就有的风景'],
  },
  {
    id: 'daily',
    num: '03',
    cat: 'daily',
    cn: '生活碎片',
    en: 'FRAGMENTS OF LIFE',
    headline: '生活碎片',
    desc: '车厢、房间、路灯和窗。日子并不壮阔，却处处有光，一片一片拼起来就是你。',
    captions: ['客厅的氛围感时刻', '乌蒙山之美', '火车外越过的风景', '火车的氛围感', '高铁外的画', '亮眼的树', '飞机起飞前', '出发时的瞬间', '车内小憩', '童年的小卖铺'],
  },
  {
    id: 'dusk',
    num: '04',
    cat: 'dusk',
    cn: '夜幕来临前',
    en: 'BEFORE NIGHTFALL',
    headline: '夜幕来临前',
    desc: '塔顶的一层留给黄昏。太阳沉下去，天光却留了很久，所有的告别都值得被温柔收进档案。',
    captions: ['屋脊与最后的橙', '天黑之前的五分钟', '一盏灯替太阳值班', '晚霞橙', '暮色的分界线', '厦门十里长堤'],
  },
];

// 花：不打散成章节，而是分散在中庭的悬浮展板上
export const FLOWERS = {
  id: 'flower',
  num: '✿',
  cat: 'flower',
  cn: '花与光',
  en: 'FLOWERS IN LIGHT',
  headline: '花与光',
  desc: '花不按顺序开放。它们散落在中庭里，抬头就能看见。',
  captions: ['日出时刻', '手误 打扰了', '日出的浪', '凌晨五点的海上日出', '海边唯一的出镜', '一朵就够了', '早上的花', '花的影子', '把它们插进光里'],
};

// 陪你一起看：从一楼开始一件一件地看过去，看完再回到第一件
// 排序规则：按楼层（一层 → 顶层），同层按墙上排列的角度顺时针走
export const TOUR_IDS = CHAPTERS.map((c) => c.id);

// 一楼电视里能点的三首歌
export const SONGS = [
  {
    id: 'stay',
    cn: 'Stay With Me',
    en: '鬼怪 · OST',
    file: 'assets/audio/stay-with-me.mp3',
  },
  {
    id: 'pink',
    cn: '粉雾海',
    en: '易烊千玺',
    file: 'assets/audio/fenwu-hai.mp3',
  },
  {
    id: 'baby',
    cn: "Baby, Don't Cry",
    en: '인어의 눈물 · Korean Ver.',
    file: 'assets/audio/baby-dont-cry.mp3',
  },
];

// 展信佳 —— 顶部「展信佳」按钮打开的就是这封信
export const PROFILE = {
  title: '相信就会存在',
  en: 'A LETTER, ALWAYS HERE',
  date: '2026 · 11 · 28',
  paragraphs: [
    '时隔好久好久，那份相遇依旧惊艳。',
    '你勇敢地做自己，明媚，灿烂成了你的人生底色，愿生活里的你一直笑。',
    "我会成为更好的少年，也会找到你藏在 Always Online、Baby Don't Cry、Stay With Me 里的永远。",
    '一直都在，请你相信。',
  ],
  sign: '—— 南风入弦',
  // 沙漏下面的那句话
  timerCaption: '2025年12月7日初相识 少年的心中自此展开了一片粉雾海',
};
