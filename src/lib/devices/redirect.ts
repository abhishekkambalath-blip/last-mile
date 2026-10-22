/** The address a band's login sends the runner back to. It must be registered with the band's developer account. */
export const appBase = (req: Request) => process.env.APP_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
export const redirectUri = (req: Request, id: string) => `${appBase(req)}/api/devices/${id}/callback`;
