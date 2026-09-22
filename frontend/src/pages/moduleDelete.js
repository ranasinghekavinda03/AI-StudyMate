export async function deleteModuleAndReload({ moduleId, token, deleteRequest, reloadModules }) {
  if (!moduleId) {
    throw new Error('A module must be selected before deletion.')
  }

  await deleteRequest(moduleId, token)
  await reloadModules()
}
