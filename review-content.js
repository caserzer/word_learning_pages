/**
 * Reviewed, deterministic use practice from the cross-checked 6A U2 worksheet.
 * Provenance: code/database/imports/6a-u2-family-ties.json and
 * discussions/12-family-ties-import.md. Each missing token was selected explicitly.
 *
 * These questions restore a particular source phrase. They do not grade whether
 * arbitrary English is valid, invent sentences, infer senses, or accept synonyms.
 * Keep the word + meaning match exact: editing a sense must not silently reuse a
 * different teaching fact. Imported IDs/source metadata may differ, so they are
 * not used to decide which sense is being reviewed.
 *
 * Row: [source position, exact phrase, exact meaning, blank offset, answer, pages].
 * Offsets preserve every original capital, space, slash, apostrophe and hyphen.
 */
const reviewedRows = [
 [14,"family ties","家庭关系、家庭纽带",7,"ties","P28-29"],
 [15,"father and mother","父亲和母亲",11,"mother","P28-29"],
 [16,"grandmother and grandfather","（外）祖父和祖母",16,"grandfather","P28-29"],
 [17,"aunt and uncle","阿姨（姑姑）和叔叔（伯伯）",9,"uncle","P28-29"],
 [18,"family relations","家庭关系",7,"relations","P28-29"],
 [19,"family and relatives","家人和亲戚",11,"relatives","P28-29"],
 [20,"husband and wife","丈夫和妻子",12,"wife","P28-29"],
 [21,"daughter and son","女儿和儿子",13,"son","P28-29"],
 [22,"granddaughter and grandson","（外）孙女和孙子",18,"grandson","P28-29"],
 [23,"the only child","独生子女",4,"only","P28-29"],
 [25,"fry eggs in a pan","在平底锅里煎鸡蛋",9,"in","P28-29"],
 [26,"chat with sb.","与……聊天",5,"with","P28-29"],
 [27,"set the table","摆放餐桌",0,"set","P28-29"],
 [28,"as fast as they can","尽他们所能快地",3,"fast","P28-29"],
 [39,"add notes to photos","在照片上添加笔记",10,"to","P30-31"],
 [40,"family album","家庭影集",7,"album","P30-31"],
 [41,"play the piano / violin / guitar","弹钢琴 / 拉小提琴 / 弹吉他",5,"the","P30-31"],
 [42,"play football with friends","和朋友一起踢足球",14,"with","P30-31"],
 [43,"play basketball","打篮球",0,"play","P30-31"],
 [44,"play badminton","打羽毛球",0,"play","P30-31"],
 [45,"play games","玩游戏",0,"play","P30-31"],
 [46,"play chess","下国际象棋",0,"play","P30-31"],
 [47,"make tea","泡茶",0,"make","P30-31"],
 [48,"short dark hair","黑色短发",0,"short","P30-31"],
 [49,"take photos","拍照",0,"take","P30-31"],
 [50,"take a photo of sb. / sth.","拍摄某人 / 某物的照片",13,"of","P30-31"],
 [51,"help me with my English","帮助辅导我的英语",8,"with","P30-31"],
 [52,"help sb. (to) do sth.","帮助某人做某事",0,"help","P30-31"],
 [53,"have the same big eyes","有着同样一双大眼睛",9,"same","P30-31"],
 [55,"my elder sister","我的姐姐",3,"elder","P30-31"],
 [56,"sit on the sofa","坐在沙发上",4,"on","P30-31"],
 [57,"raise a question","提一个问题",0,"raise","P30-31"],
 [58,"make a comment","发表评论",0,"make","P30-31"],
 [90,"go back to work","恢复工作",8,"to","P32-33"],
 [91,"stop working","停止工作",5,"working","P32-33"],
 [92,"a vlog story","一个微视频故事",2,"vlog","P32-33"],
 [94,"work at the hospital","在医院工作",5,"at","P32-33"],
 [95,"be busy with/doing sth.","忙于做某事",3,"busy","P32-33"],
 [96,"at work","工作",0,"at","P32-33"],
 [97,"make things easy","让事情变得容易",12,"easy","P32-33"],
 [98,"a great cook","一个很棒的厨师",8,"cook","P32-33"],
 [99,"water the flowers","浇花",0,"water","P32-33"],
 [100,"share family chores","分担家务",0,"share","P32-33"],
 [101,"make the bed","铺床",0,"make","P32-33"],
 [102,"wash dishes","洗碗",0,"wash","P32-33"],
 [103,"be home early","提前到家",8,"early","P32-33"],
 [106,"look tired","看上去疲劳",5,"tired","P32-33"],
 [110,"work alone","独自工作",5,"alone","P32-33"],
 [111,"take out the rubbish","倒垃圾",5,"out","P32-33"],
 [112,"old enough","年龄足够大",4,"enough","P32-33"],
 [113,"prepare the food","准备食物",0,"prepare","P32-33"],
 [119,"sing an English song","唱一首英文歌",5,"an","P34-35"],
 [120,"make dinner for us","为我们做晚饭",12,"for","P34-35"],
 [121,"at the moment","现在，目前，此刻",0,"at","P34-35"],
 [122,"make a vlog of her family","拍一段关于她家庭的微视频",12,"of","P34-35"],
 [123,"sweep the floor","扫地",0,"sweep","P34-35"],
 [124,"tidy up the books","整理书籍",5,"up","P34-35"],
 [125,"look at the pictures","看图片",5,"at","P34-35"],
 [126,"make a phone call","打个电话",0,"make","P34-35"],
 [127,"think of","想到，思考",6,"of","P34-35"],
 [128,"the daily activities of your family members","你家人每天的活动",21,"of","P34-35"],
 [150,"Grandma's birthday","祖母的生日",10,"birthday","P36-37"],
 [151,"your family celebration photos","你家庭的庆祝照片",12,"celebration","P36-37"],
 [152,"prepare a birthday party","准备一场生日聚会",0,"prepare","P36-37"],
 [153,"decorate the living room with balloons and flowers","用气球和鲜花装饰客厅",25,"with","P36-37"],
 [154,"make the birthday card","做生日卡片",0,"make","P36-37"],
 [155,"cook in the kitchen","在厨房里烹饪",5,"in","P36-37"],
 [156,"sing birthday songs to Grandma","为祖母唱生日歌",20,"to","P36-37"],
 [157,"give her birthday gifts = give birthday gifts to her","给她生日礼物",46,"to","P36-37"],
 [159,"bring sth. to sb.","把某物带给某人",11,"to","P36-37"],
 [160,"describe personal feelings","描述个人的感受",0,"describe","P36-37"],
 [161,"jump for joy","欢呼雀跃",5,"for","P36-37"],
 [162,"a special day","特殊的一天",2,"special","P36-37"],
 [163,"pay attention to","注意",14,"to","P36-37"],
 [179,"stand for a long life","代表长寿",6,"for","P38-39"],
 [180,"bring good luck","带来好运",0,"bring","P38-39"],
 [181,"get together","相聚在一起",4,"together","P38-39"],
 [182,"get a bag of sweets","得到一袋糖果",10,"of","P38-39"],
 [183,"on that day","在那一天",0,"on","P38-39"],
 [184,"a rich harvest","大丰收",2,"rich","P38-39"],
 [185,"put on new clothes","穿上新衣服",4,"on","P38-39"],
 [186,"a harvest festival","一个丰收的节日",2,"harvest","P38-39"],
 [187,"rice pudding","米布丁",5,"pudding","P38-39"],
 [188,"thank the Sun for a rich harvest","感谢太阳带来丰收",14,"for","P38-39"],
 [189,"make a family poster","制作一张家庭海报",0,"make","P38-39"],
 [190,"help each other","互相帮助",5,"each","P38-39"],
 [191,"teach me how to ride a bike","教我如何骑自行车",9,"how","P38-39"],
 [192,"spend time together","共度时光",0,"spend","P38-39"],
 [193,"learn quickly","快速学习",6,"quickly","P38-39"]
];

const questions = new Map(reviewedRows.map(([position, word, meaning, offset, answer, pages]) => {
 const cloze = word.slice(0, offset) + '____' + word.slice(offset + answer.length);
 const question = Object.freeze({
  prompt: `按积累单原词组，填入缺失的一个词。\n中文：${meaning}\n${cloze}`,
  answers: Object.freeze([answer]),
  // Do not print the unit's English title: it would reveal the answer to item 14.
  source: `6A 英语 U2 积累单 · ${pages} · 第${position}项`,
  kind: 'phrase-cloze'
 });
 return [JSON.stringify([word, meaning]), question];
}));

/** Coverage is intentionally explicit; unknown words/senses get no generated quiz. */
export const useQuestionCoverage = Object.freeze({
 sourceId: '6a-u2-family-ties',
 sourceTitle: '6A英语 U2 Family ties 积累单',
 sourceVerification: 'transcribed_and_cross_checked',
 sourceVocabularySenseCount: 180,
 sourcePhraseSenseCount: 89,
 reviewedPhraseQuestionCount: reviewedRows.length,
 reviewedSingleWordQuestionCount: 0,
 totalQuestionCount: questions.size,
 matching: 'exact-word-and-meaning',
 kind: 'phrase-cloze',
 sourceRecordIds: Object.freeze(reviewedRows.map(([position]) => `family_ties_${String(position).padStart(3, '0')}`))
});

/**
 * @param {{word: string, meaning: string}} item
 * @returns {{prompt: string, answers: string[], source: string, kind: string} | null}
 * Show only this prompt/source until submission. A full headword, pronunciation,
 * source title, or example elsewhere on the card could give away the hidden token.
 * A fresh result prevents callers from changing the reviewed answers in memory.
 */
export function getUseQuestion(item) {
 if (!item || typeof item.word !== 'string' || typeof item.meaning !== 'string') return null;
 const question = questions.get(JSON.stringify([item.word, item.meaning]));
 return question ? {...question, answers: [...question.answers]} : null;
}
