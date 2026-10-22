const POLITICS_SUBJECTS = ['马原', '毛中特', '习思想', '史纲', '思法']

// Source identity belongs to evidence; the study directory belongs to the subject.
export function organizePoliticsContent(practice, matching, technique) {
  const referenceImages = { ...practice.referenceImages, ...matching.referenceImages, ...technique.referenceImages }
  const groups = []
  const lectures = []
  for (const [data, label] of [[technique, '技巧班作业'], [matching, '自测'], [practice, '专题练习']]) {
    const counters = new Map()
    const chapterMap = new Map()
    for (const lecture of data.lectures) {
      const candidate = lecture.topic.split(' · ').at(-1)
      const topic = POLITICS_SUBJECTS.includes(candidate) ? candidate : '马原'
      const number = (counters.get(topic) || 0) + 1
      counters.set(topic, number)
      const detail = label === '技巧班作业'
        ? lecture.title.split(' · ').slice(1).join(' · ')
        : label === '自测' ? lecture.title.split(' · ')[1] : lecture.title
      const chapter = { ...lecture, topic, number, title: `${label}${number} · ${detail}` }
      chapterMap.set(lecture.id, chapter)
      lectures.push(chapter)
    }
    for (const group of data.groups) {
      const chapter = chapterMap.get(group.lectureIds[0])
      groups.push({
        ...group,
        topic: chapter.topic,
        title: label === '技巧班作业' ? `${chapter.title} · ${group.kindLabel === '匹配 / 归类' ? '连线匹配' : group.kindLabel}`
          : label === '自测' ? chapter.title : group.title,
        lectureEvidence: group.lectureEvidence ? { ...group.lectureEvidence, image: referenceImages[group.lectureEvidence.image] } : null,
      })
    }
  }
  return {
    ...practice,
    meta: {
      ...practice.meta,
      sourceLabel: '技巧班作业与冲刺背诵手册自测',
      lectureCount: lectures.length,
      sourcePages: technique.meta.sourcePages + matching.meta.sourcePages + practice.meta.sourcePages,
      groupCount: groups.length,
      stemCount: groups.reduce((sum, group) => sum + group.stems.length, 0),
    },
    topics: POLITICS_SUBJECTS,
    groups,
    pages: [...technique.pages, ...matching.pages, ...practice.pages],
    lectures,
  }
}
