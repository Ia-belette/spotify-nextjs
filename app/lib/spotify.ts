import { getXataClient } from "../xata";

const xata = getXataClient();

export async function refreshAccessToken(userId: string, refreshToken: string, clientID: string, clientSecret: string) {
    try {
        console.log(clientID, clientSecret)
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: clientID,
                client_secret: clientSecret
            })
        });

        const data: {
            access_token: string;
            expires_in: number;
            refresh_token: string;
        } = await response.json();
        if (!data.access_token) {
            return null;
        }

        const newExpiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

        await xata.db.accounts.update(userId, {
            access_token: data.access_token,
            expires_at: newExpiresAt
        });

        return data.access_token;
    } catch (error) {
        console.error(error);
        return null;
    }
}