import { cache } from "react";
import { getXataClient } from "@/app/xata";
import { cookies } from "next/headers";

const xata = getXataClient();

export const getSession = cache(async () => {
    const cookieStores = await cookies();
    const sessionId = cookieStores.get("session_id")?.value;

    if (!sessionId) return null;

    try {
        const session = await xata.db.sessions.filter({ session_id: sessionId }).getFirst();
        if (!session) return null;

        const user = await xata.db.users.read(session.user!);
        if (!user) return null;

        const account = await xata.db.accounts.filter({ user: user.id }).getFirst();

        return {
            user: {
                id: user.id,
                name: user.display_name,
                email: user.email,
                image: user.image
            },
            account: account ? {
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at
            } : null
        };
    } catch (error) {
        console.error(error);
        return null;
    }
});