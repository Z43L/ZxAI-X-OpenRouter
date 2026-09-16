const SESSION_KEY = "chatai.github.pat.session";
const REMEMBER_FLAG = "chatai.github.pat.remember";
const IDB_TOKEN_ID = "pat";

import { IDB_STORES, idbDelete, idbGet, idbSet } from "./idb";

export interface GitHubTokenRecord {
  id: string;
  token: string;
  remember: boolean;
}

export function getSessionGitHubToken(): string {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

export async function loadGitHubToken(): Promise<{ token: string; remember: boolean }> {
  const session = getSessionGitHubToken();
  if (session) return { token: session, remember: false };
  try {
    const remembered = localStorage.getItem(REMEMBER_FLAG) === "1";
    if (!remembered) return { token: "", remember: false };
    const rec = await idbGet<GitHubTokenRecord>(IDB_STORES.githubToken, IDB_TOKEN_ID);
    return { token: rec?.token ?? "", remember: Boolean(rec?.token) };
  } catch {
    return { token: "", remember: false };
  }
}

export async function saveGitHubToken(token: string, remember: boolean): Promise<void> {
  const trimmed = token.trim();
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  if (!trimmed) {
    await clearGitHubToken();
    return;
  }
  if (remember) {
    await idbSet<GitHubTokenRecord>(IDB_STORES.githubToken, { id: IDB_TOKEN_ID, token: trimmed, remember: true });
    try {
      localStorage.setItem(REMEMBER_FLAG, "1");
    } catch {
      /* ignore */
    }
  } else {
    await idbDelete(IDB_STORES.githubToken, IDB_TOKEN_ID);
    try {
      localStorage.removeItem(REMEMBER_FLAG);
      sessionStorage.setItem(SESSION_KEY, trimmed);
    } catch {
      /* ignore */
    }
  }
}

export async function clearGitHubToken(): Promise<void> {
  await idbDelete(IDB_STORES.githubToken, IDB_TOKEN_ID);
  try {
    localStorage.removeItem(REMEMBER_FLAG);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
