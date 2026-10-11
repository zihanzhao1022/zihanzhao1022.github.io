/** A GitHub user name GitHub does not know; the site says so in the reader's language (describeSaveError). */
export class UnknownUserError extends Error {
  constructor(readonly login: string) {
    super('找不到 GitHub 用户 {name}，请检查用户名'.replace('{name}', login));
  }
}

/** A save that gave up because the branch kept moving under it (a save from somewhere else got in first). */
export class ConflictError extends Error {
  constructor() {
    // The worker uses this too: the site translates the message where it shows it (describeSaveError).
    super('内容已在别处修改，请刷新页面后再试');
  }
}
