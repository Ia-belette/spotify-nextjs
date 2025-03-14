import { cookies } from 'next/headers'
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getXataClient } from '@/app/xata';
import { generateRandomString } from '@/app/utils/random';

type TokenResponse = {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

type UserResponse = {
    email: string;
    display_name: string;
    images: { url: string }[];
    id: string;
}

function getRedirectURL() {
    const env = process.env.NEXTJS_ENV || "production";
    const urls = {
        development: process.env.REDIRECT_URL_DEV,
        preview: process.env.REDIRECT_URL_PREVIEW,
        production: process.env.REDIRECT_URL_PROD,
    } as Record<string, string | undefined>;

    return urls[env] ?? "http://localhost:3000/";
}


export async function GET(request: Request) {
    const xata = getXataClient();

    const { env } = getCloudflareContext();
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const cookieStores = await cookies();
    const state = cookieStores.get('spotify_state')?.value;

    if (!code || !state) {
        return Response.json({ error: 'No code or state' }, { status: 400 });
    }

    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: env.SPOTIFY_CLIENT_ID,
            client_secret: env.SPOTIFY_CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: env.SPOTIFY_REDIRECT_URI,
        })
    });

    if (!tokenResponse.ok) {
        return Response.json({ message: "Error fetching token", cause: tokenResponse }, { status: 400 });
    }

    const tokenData: TokenResponse = await tokenResponse.json();
    if (!tokenData.access_token) {
        return Response.json({ message: "Can't get token" }, { status: 400 });
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

    const userResponse = await fetch("https://api.spotify.com/v1/me", {
        headers: { "Authorization": `Bearer ${accessToken}` }
    });

    if (!userResponse.ok) {
        return Response.json({ message: "Error fetching user data", cause: userResponse }, { status: 400 });
    }

    const userData: UserResponse = await userResponse.json();
    if (!userData.email) {
        return Response.json({ message: "Can't get user email" }, { status: 400 });
    }

    const { display_name, images, email, id: providerId } = userData;
    const image = images.length > 0 ? images[0].url : null;

    let user = await xata.db.users.filter({ provider_id: providerId }).getFirst();

    const sessionId = generateRandomString(64);

    if (user) {
        await xata.db.accounts.update(user.id, {
            access_token: accessToken,
            expires_at: expiresAt,
            refresh_token: refreshToken,
            user: user.id
        });
    } else {
        user = await xata.db.users.create({
            display_name,
            image,
            email,
            provider_id: providerId
        });
        await xata.db.accounts.create({
            access_token: accessToken,
            expires_at: expiresAt,
            refresh_token: refreshToken,
            user: user.id
        });
    }

    const existingSession = await xata.db.sessions.filter({ user: user.id }).getFirst();

    if (existingSession) {
        await xata.db.sessions.update(existingSession.id, { session_id: sessionId });
    } else {
        await xata.db.sessions.create({
            session_id: sessionId,
            user: user.id
        });
    }

    cookieStores.set('session_id', sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        expires: new Date(Date.now() + 60 * 60 * 24 * 7),
    });

    cookieStores.delete('spotify_state');

    return Response.redirect(getRedirectURL()!);
}