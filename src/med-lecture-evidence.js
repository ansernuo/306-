// Apply the reviewed lecture references after all medicine question sources load.
// Question wording, answers, identifiers and chapter navigation stay in their source datasets.
export function applyReviewedMedEvidence(content, review) {
  return {
    ...content,
    groups: content.groups.map(group => {
      const location = review.groups[group.id]
      if (!location) return group
      const pages = location.pages.map(id => review.pages[id])
      return {
        ...group,
        lectureEvidence: pages[0],
        lectureEvidencePages: pages,
        stems: group.stems.map((stem, index) => ({
          ...stem,
          lectureEvidencePages: [review.pages[location.stemPages[index]]],
        })),
      }
    }),
  }
}

export function lectureForStem(group, index) {
  const stem = group.stems[index]
  const number = stem?.sourceQuestion ?? stem?.number
  return stem?.lectureEvidencePages?.[0]
    || group.lectureEvidencePages?.find(page => page.questionNumbers?.some(item => String(item) === String(number)))
    || group.lectureEvidence || group.lectureEvidencePages?.[0]
}
