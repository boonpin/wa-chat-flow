import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { jwtSecret } from '@/lib/config'

export function createToken(userId: string) {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, jwtSecret) as { userId: string }
  } catch {
    return null
  }
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null
  return verifyToken(token)
}
