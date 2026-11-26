export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  })
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return jsonResponse(
      { error: { code: error.code, message: error.message } },
      error.status,
    )
  }

  console.error('[api] Unexpected error:', error)

  return jsonResponse(
    {
      error: {
        code: 'internal_error',
        message: 'Something went wrong. Please try again.',
      },
    },
    500,
  )
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiError(400, 'invalid_request', 'Content-Type must be application/json.')
  }

  try {
    return await request.json()
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body is not valid JSON.')
  }
}

export function unauthorizedResponse(clearCookie?: string): Response {
  return jsonResponse(
    {
      error: {
        code: 'unauthorized',
        message: 'Your invitation session is missing or no longer valid.',
      },
    },
    401,
    clearCookie ? { 'set-cookie': clearCookie } : {},
  )
}

export function rateLimitedResponse(): Response {
  return jsonResponse(
    {
      error: {
        code: 'rate_limited',
        message: 'Too many attempts. Please try again later.',
      },
    },
    429,
    { 'retry-after': '300' },
  )
}
