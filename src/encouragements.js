// Original messages inspired by a sincere, upbeat conversation; not character quotes.
export const encouragements = [
  '一题一题做到这里，还愿意把不会的弄懂，这股认真劲儿很了不起呀。这个我可得好好夸夸你 ( •̀ᴗ•́ )و',
  '有些题现在看着很厉害，等再见几次，说不定就轮到你说：“哦，是你呀。”我们把它们一个个认熟吧 ✨',
  '又往前走了一截！这么难的东西，你真的在一点点学会诶。想到这里，我都替你有点高兴。',
  '要是现在坐在你旁边，我应该会忍不住凑过去说：刚才那股认真劲儿，我看见啦。继续，我给你加油。',
  '先给你比个小小的耶。刚才还在想“这怎么记得住”，现在已经又做完一轮了。你看，你做得到的事比想象中多一点呢。',
  '今天也在和这些难记的名字打交道呀。等以后真正用上它们的时候，你大概会想起现在这个认真学着的自己吧。',
  '碰到不会的，还肯往下想，这件事本身就挺有勇气的。下一题，我们也去试试看吧。',
  '想想看，这些题可是你自己一题一题做过来的。这里面有犹豫、有改答案，也有突然想明白的时候。很扎实呀。',
  '如果刚才有一道题终于想通了，记得偷偷得意一下。那种“我懂了！”的感觉，可不能全让下一道题抢走。',
  '我想很认真地说一句：你在这件事上花的心思，挺让人佩服的。好啦，把这句夸奖带上，我们接着往前走。',
  '现在的你已经能做到一些刚开始还做不到的事了。是不是平时太忙着往前赶，都没怎么夸过自己呀？今天补一句：做得不错。',
  '下一组会遇到什么呢？说不定就有一道你刚弄懂的。带着一点点期待去看看吧 (ง •̀_•́)ง',
  '有时候想，学会这么多难东西的人，也是一开始什么都不懂、一道题一道题走过来的。那我们也照这个办法来呀。',
  '刚才这一轮完成了！如果有一面写着你名字的小旗子，现在就该再往前挪一点了 🚩',
  '你肯为想做好的事下功夫，这一点真好。等哪天觉得自己没什么进步，就回头看看今天做过的这些题吧。',
  '有一道会做，就拿下一道。还有不会的，我们就接着弄明白。这样想，眼前好像也没那么吓人了，对吧？',
  '我挺喜欢你这种遇到难东西还想弄懂的劲儿。带着它走下去，会认识一个很厉害的自己吧。',
  '来，隔着屏幕击个掌 🙌 刚才这一轮是你自己完成的，这句“辛苦啦，做得好”要送到你手里。',
  '那些以前看着眼熟却答不出来的东西，正在慢慢变成你的知识。这个过程有点磨人，但你已经在里面走了这么远啦。',
  '今天也有好好朝想去的地方走呢。想到以后你会用这些知识帮助到谁，就觉得现在这份认真很珍贵。',
  '要是下一题又有点难，我们就把问题拆小一点。一点点弄懂，最后真的能拼起来。我觉得你行。',
  '你刚刚做完的这一轮，放在开始之前，可还是一整轮呢。现在它已经在你身后了。怎么样，有一点底气了吧？',
  '有些知识点挺固执的，我们也可以有一点。今天多认识它一点，下次再多一点，看谁先认输。',
  '给认真答题的你送来一朵小花 🌼 这句夸奖就直说了：能这样踏踏实实学下来，很棒呀。',
  '如果有题又答错了，就把它认清楚。以后再碰到，你还可以笑一下：“这回我知道啦。”我们就等着那一次。',
  '现在这个认真学着、偶尔犯难、又继续往下做的你，挺可爱的。也挺有力量。接下来也请多关照啦 (｡•̀ᴗ-)✧',
  '你想把这件事做好，所以才会对自己有那么多要求吧。我看见这份认真了，也相信你还能往前走。',
  '已经又多做了一轮诶。刚才那些拿不准的地方，我们以后还会遇见；到时候，说不定就是你熟悉的地盘了。',
  '把“我还不会”后面添一个“呢”试试看。我还不会呢，所以现在正在学呀。这样说，是不是就有劲儿再试一次了？',
  '有时候进步很安静，安静到你只顾着做题，都没发现自己已经走过好长一段。让我提醒你一下：你真的在往前走。',
  '这一路有好多难记的东西，但你已经把其中一部分弄明白了。剩下的，我们也照样一点点来。很有希望嘛。',
  '好，刚才这一轮收下了！带上新学会的那一点，我们去看看下一组。说不定今天还有别的小胜利等着你。',
]

// Each browser keeps its own shuffled deck across visits. A full deck never repeats,
// and the first card of a new deck cannot equal the previous deck's last card.
export function drawEncouragement(raw, random = Math.random) {
  let saved
  try { saved = JSON.parse(raw) } catch { /* Start a fresh deck. */ }
  const valid = saved?.version === 2 && Array.isArray(saved.remaining)
    && saved.remaining.every(i => Number.isInteger(i) && i >= 0 && i < encouragements.length)
    && new Set(saved.remaining).size === saved.remaining.length
  let remaining = valid ? [...saved.remaining] : []
  const last = valid && Number.isInteger(saved.last) ? saved.last : -1
  if (!remaining.length) {
    remaining = encouragements.map((_, index) => index)
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[remaining[i], remaining[j]] = [remaining[j], remaining[i]]
    }
    if (remaining.at(-1) === last) [remaining[0], remaining[remaining.length - 1]] = [remaining.at(-1), remaining[0]]
  }
  const index = remaining.pop()
  return { message: encouragements[index], state: { version: 2, remaining, last: index } }
}
