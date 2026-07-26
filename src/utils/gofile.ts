interface GofileServerResponse {
  status: string;
  data?: { servers?: Array<{ name: string }> };
}

interface GofileUploadResponse {
  status: string;
  data?: { downloadPage?: string };
}

/** Upload a buffer to Gofile and return the download page URL. */
export async function uploadToGofile(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  // Resolve the best upload server
  let server = 'store1';
  try {
    const res = await fetch('https://api.gofile.io/servers', {
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as GofileServerResponse;
    if (json.status === 'ok' && json.data?.servers?.[0]?.name) {
      server = json.data.servers[0].name;
    }
  } catch {
    // Fall back to the default server
  }

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: 'application/zip' });
  formData.append('file', blob, filename);

  const uploadRes = await fetch(`https://${server}.gofile.io/uploadFile`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(60_000),
  });

  if (!uploadRes.ok) {
    throw new Error(`Gofile HTTP error: ${uploadRes.status}`);
  }

  const uploadData = (await uploadRes.json()) as GofileUploadResponse;

  if (uploadData.status !== 'ok' || !uploadData.data?.downloadPage) {
    throw new Error(`Gofile API error: ${JSON.stringify(uploadData)}`);
  }

  return uploadData.data.downloadPage;
}
