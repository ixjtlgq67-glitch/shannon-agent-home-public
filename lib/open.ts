/** Stable local reader used when sign-in is turned off. */
export const OPEN_USER_ID = "usr_open_reader";
export const OPEN_SESSION_ID = "sess_open_reader";
export const OPEN_SAVE_TOKEN = "shannon-open-demo-token-0001";

export function isOpenDemo(): boolean {
  return process.env.SHANNON_OPEN === "1";
}
