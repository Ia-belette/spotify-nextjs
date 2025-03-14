import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getXataClient } from './app/xata'
import { refreshAccessToken } from './app/lib/spotify'

const xata = getXataClient()
export async function middleware(request: NextRequest) {
    const c = getCloudflareContext()

    if (request.nextUrl.pathname.startsWith('/me')) {
        const sessionCookie = request.cookies.get('session_id')?.value

        if (!sessionCookie) {
            return NextResponse.redirect(new URL('/', request.url))
        }

        const session = await xata.db.sessions
            .filter({ session_id: sessionCookie })
            .getFirst()

        if (!session) {
            return NextResponse.redirect(new URL('/', request.url))
        }

        const userId = session.user?.id || session.user
        if (!userId) {
            return NextResponse.redirect(new URL('/', request.url))
        }

        const [user, account] = await Promise.all([
            xata.db.users.read(userId.toString()),
            xata.db.accounts.filter({ user: userId }).getFirst()
        ])

        if (!user || !account) {
            return NextResponse.redirect(new URL('/', request.url))
        }

        const now = Math.floor(Date.now() / 1000)

        if (account.expires_at && account.expires_at < now) {
            if (!account.refresh_token) {
                return NextResponse.redirect(new URL('/', request.url))
            }

            const newAccessToken = await refreshAccessToken(
                user.id,
                account.refresh_token,
                c.env.SPOTIFY_CLIENT_ID,
                c.env.SPOTIFY_CLIENT_SECRET
            )

            if (!newAccessToken) {
                return NextResponse.redirect(new URL('/', request.url))
            }

            await xata.db.accounts.update(account.id, {
                access_token: newAccessToken,
                expires_at: now + 3600
            })

        }

        return NextResponse.next()
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
    ]
}
