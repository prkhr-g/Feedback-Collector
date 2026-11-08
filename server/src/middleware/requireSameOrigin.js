export function requireSameOrigin(request, response, next) {
  let expected;
  let supplied;
  try {
    expected = new URL(process.env.CLIENT_ORIGIN).origin;
    supplied = new URL(request.get('Origin')).origin;
  } catch {
    return response.status(403).json({ success: false, message: 'Request origin is not allowed.' });
  }
  if (supplied !== expected) {
    return response.status(403).json({ success: false, message: 'Request origin is not allowed.' });
  }
  next();
}
