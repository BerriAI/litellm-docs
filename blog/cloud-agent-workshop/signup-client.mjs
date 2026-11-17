export async function submitWorkshopSignup(fields, fetchImpl = fetch) {
  const response = await fetchImpl('/api/workshop/signup', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(fields),
  });
  let data;
  try { data = await response.json(); } catch { /* A non-JSON response is not confirmation. */ }
  if (!response.ok || data?.ok !== true || data.submissionId !== fields.submissionId) {
    throw new Error('Workshop signup could not be confirmed.');
  }
  return data;
}
