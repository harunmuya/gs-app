const DEFAULT_SITE_URL = 'https://genuinesugarmummies.co.ke';
const DEFAULT_FROM = 'Genuine Sugar Mummies <no-reply@genuinesugarmummies.co.ke>';

export function getSiteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

function baseEmailTemplate({ title, preview, bodyHtml, ctaLabel, ctaUrl }) {
    const siteUrl = getSiteUrl();
    const logoUrl = `${siteUrl}/genuine-logo.png?v=6`;
    const safePreview = preview || title || 'Genuine Sugar Mummies update';

    return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <title>${title}</title>
</head>
<body style="margin:0;background:#f6f7f9;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreview}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e9ecef;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 14px;text-align:center;">
              <img src="${logoUrl}" alt="Genuine Sugar Mummies" style="height:42px;max-width:220px;object-fit:contain;" />
            </td>
          </tr>
          <tr>
            <td style="padding:4px 28px 8px;text-align:center;">
              <h1 style="margin:0;color:#e03131;font-size:24px;line-height:1.25;font-weight:800;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 8px;font-size:15px;line-height:1.65;color:#495057;">
              ${bodyHtml}
            </td>
          </tr>
          ${ctaLabel && ctaUrl ? `<tr><td style="padding:10px 28px 28px;text-align:center;"><a href="${ctaUrl}" style="display:inline-block;background:#ff5a5f;color:#ffffff;text-decoration:none;border-radius:14px;padding:13px 22px;font-weight:800;font-size:14px;">${ctaLabel}</a></td></tr>` : ''}
          <tr>
            <td style="padding:18px 28px;background:#fff5f5;border-top:1px solid #ffe3e3;text-align:center;font-size:12px;line-height:1.5;color:#868e96;">
              Genuine Sugar Mummies Kenya<br />
              <a href="${siteUrl}" style="color:#e03131;text-decoration:none;font-weight:700;">${siteUrl.replace(/^https?:\/\//, '')}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendTransactionalEmail({ to, subject, title, preview, bodyHtml, ctaLabel, ctaUrl }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !to) {
        return { skipped: true, reason: !apiKey ? 'RESEND_API_KEY not configured' : 'Missing recipient' };
    }

    const html = baseEmailTemplate({
        title: title || subject,
        preview,
        bodyHtml,
        ctaLabel,
        ctaUrl,
    });

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Resend email failed: ${text}`);
    }

    return res.json();
}
