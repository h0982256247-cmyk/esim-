export interface LineUserInfo {
  sub: string      // LINE UID
  name: string
  picture?: string
  email?: string
}

export async function verifyLineIdToken(idToken: string): Promise<LineUserInfo> {
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: process.env.LINE_CHANNEL_ID!,
    }),
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? 'LINE token verification failed')
  }

  return {
    sub: data.sub,
    name: data.name,
    picture: data.picture,
    email: data.email,
  }
}
