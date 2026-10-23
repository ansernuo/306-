// Apply reviewed references after every question source for a subject has loaded.
// Question wording, answers, identifiers and chapter navigation stay in their source datasets.
export function applyReviewedEvidence(content, ...reviews) {
  const groups = Object.assign({}, ...reviews.map(review => review.groups))
  const reviewedPages = Object.assign({}, ...reviews.map(review => review.pages))
  return {
    ...content,
    groups: content.groups.map(group => {
      const location = groups[group.id]
      if (!location) return group
      const pages = location.pages.map(id => reviewedPages[id])
      return {
        ...group,
        lectureEvidence: pages[0],
        lectureEvidencePages: pages,
        ...(location.notice ? { lectureEvidenceNotice: location.notice } : {}),
        stems: group.stems.map((stem, index) => ({
          ...stem,
          lectureEvidencePages: [location.stemPages[index]].flat().map(id => reviewedPages[id]),
        })),
      }
    }),
  }
}

// Retained for existing medicine review checks and scripts.
export const applyReviewedMedEvidence = applyReviewedEvidence

export function lectureForStem(group, index) {
  const stem = group.stems[index]
  const number = stem?.sourceQuestion ?? stem?.number
  return stem?.lectureEvidencePages?.[0]
    || group.lectureEvidencePages?.find(page => page.questionNumbers?.some(item => String(item) === String(number)))
    || group.lectureEvidence || group.lectureEvidencePages?.[0]
}
