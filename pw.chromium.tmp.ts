import base from "/dev-server/playwright.config";
const cfg: any = { ...(base as any) };
cfg.projects = (cfg.projects ?? []).map((p: any) => ({ ...p, use: { ...(p.use ?? {}), channel: "chromium" } }));
export default cfg;
