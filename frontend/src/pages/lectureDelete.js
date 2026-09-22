export async function deleteLectureAndReload({ lectureId, token, deleteRequest, reloadLectures }) {
  if (!lectureId) {
    throw new Error('A lecture must be selected before deletion.')
  }

  await deleteRequest(lectureId, token)
  await reloadLectures()
}
