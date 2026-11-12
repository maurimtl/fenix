// Every page and API route lives under the person it belongs to.
export const pagePath = (profile: string, path: string) => `/p/${profile}${path}`;
export const apiPath = (profile: string, path: string) => `/api/p/${profile}${path}`;
export const PROFILE_COOKIE = "fenix_profile";
