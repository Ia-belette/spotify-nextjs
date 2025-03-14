import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateRandomString } from "@/app/utils/random"
import { cookies } from "next/headers";
export async function GET() {
    const { env } = getCloudflareContext();
    const cookieStores = await cookies()
    const state = generateRandomString(16);
    const authURL = `https://accounts.spotify.com/authorize?client_id=${env.SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(env.SPOTIFY_REDIRECT_URI)}&scope=${env.SCOPES}&code_challenge_method=S256&state=${state}`

    cookieStores.set("spotify_state", state, {
        httpOnly: true,
        secure: true,
        path: "/",
        sameSite: "strict",
        expires: Date.now() + 3 * 60 * 1000,
    });

    return Response.redirect(authURL);
}